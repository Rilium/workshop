import { SECRET_SETTINGS } from "./secretSettings";

export type BrandPresentationStatus = "in_review" | "changes_requested" | "approved" | "archived";

export type BrandPresentation = {
  id: string;
  title: string;
  client: string;
  workshop: string;
  expert: string;
  status: BrandPresentationStatus;
  version: number;
  url?: string;
  previewUrl?: string;
  mimeType?: string;
  folderName?: string;
  updatedAt?: string;
  source?: "google-drive" | "demo";
};

export type BrandPresentationResponse = {
  source: "google-drive";
  folder?: {
    id: string;
    name: string;
    url: string;
  };
  presentations: BrandPresentation[];
};

export type DriveFolderItem = {
  id: string;
  name: string;
  url: string;
  type: "folder" | "presentation" | "file";
  role?: string;
  mimeType?: string;
};

export type DriveFolderResponse = {
  source: "google-drive";
  folder: {
    id: string;
    name: string;
    url: string;
  };
  folders: DriveFolderItem[];
  files: DriveFolderItem[];
};

function getScriptUrl() {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  return env[SECRET_SETTINGS.google.env.appScriptDeploymentUrl];
}

function getConfiguredFolderId() {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  return (
    env[SECRET_SETTINGS.google.env.driveRootFolderId] ||
    env[SECRET_SETTINGS.google.env.clientMaterialsFolderId] ||
    env[SECRET_SETTINGS.google.env.finalDecksFolderId] ||
    env[SECRET_SETTINGS.google.env.slidesTemplateFolderId]
  );
}

function friendlyDriveError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/failed to fetch/i.test(message) || /networkerror/i.test(message)) return fallback;
  return message;
}

export async function getBrandPresentations(): Promise<BrandPresentationResponse | null> {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const scriptUrl = getScriptUrl();

  if (!scriptUrl) return null;

  const folderId =
    env[SECRET_SETTINGS.google.env.finalDecksFolderId] ||
    env[SECRET_SETTINGS.google.env.slidesTemplateFolderId] ||
    env[SECRET_SETTINGS.google.env.driveRootFolderId];

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "brandPresentations");
  if (folderId) url.searchParams.set("folderId", folderId);

  const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 20000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error("Drive presentations request failed");
    return (await response.json()) as BrandPresentationResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Timeout lettura presentazioni Drive: lo script sta rispondendo troppo lentamente. Riprova o riduci la cartella sorgente.");
    }
    throw new Error(friendlyDriveError(error, "Connessione Drive non disponibile."));
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function getDriveFolderPreview(folderId = getConfiguredFolderId()): Promise<DriveFolderResponse | null> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !folderId) return null;

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "driveFolder");
  url.searchParams.set("folderId", folderId);

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);

  try {
    const response = await fetch(url.toString(), { signal: controller.signal });
    if (!response.ok) throw new Error("Drive folder request failed");
    return (await response.json()) as DriveFolderResponse;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Timeout lettura cartella Drive.");
    }
    throw new Error(friendlyDriveError(error, "Connessione Drive non disponibile."));
  } finally {
    window.clearTimeout(timeout);
  }
}
