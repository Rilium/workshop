import { SECRET_SETTINGS } from "./secretSettings";
import { allowLocalFallbacks, appendSessionParams, withSessionPayload } from "./authTransport";

export type AssetDraftFolder = {
  source: "google-drive" | "mock";
  id: string;
  name: string;
  url: string;
};

export type UploadedAsset = {
  id?: string;
  name: string;
  size: number;
  mimeType: string;
  url?: string;
};

function getScriptUrl() {
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];
}

function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = String(reader.result || "");
      resolve(value.includes(",") ? value.split(",")[1] : value);
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function postAppsScript(scriptUrl: string, body: unknown) {
  const serialized = JSON.stringify(body);
  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: serialized,
    });
    if (response.ok) return;
  } catch {
    // Apps Script redirects can trip browser CORS; fall back to a simple opaque POST.
  }

  await fetch(scriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: serialized,
  });
}

export async function createAssetDraftFolder(clientName: string): Promise<AssetDraftFolder> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl && allowLocalFallbacks()) {
    return {
      source: "mock",
      id: `mock_assets_${Date.now().toString(36)}`,
      name: `${clientName} ${new Intl.DateTimeFormat("it-IT").format(new Date()).replace(/\//g, "-")}`,
      url: "",
    };
  }
  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "createAssetDraftFolder");
  appendSessionParams(url);
  url.searchParams.set("clientName", clientName);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("Creazione cartella asset non riuscita");
  return (await response.json()) as AssetDraftFolder;
}

export async function uploadAssetFiles(folderId: string, files: File[]): Promise<UploadedAsset[]> {
  const scriptUrl = getScriptUrl();
  const uploaded: UploadedAsset[] = [];

  for (const file of files) {
    uploaded.push({ name: file.name, size: file.size, mimeType: file.type || "application/octet-stream" });
    if (!scriptUrl || folderId.startsWith("mock_")) continue;

    const data = await fileToBase64(file);
    await postAppsScript(scriptUrl, {
      action: "uploadAssetFile",
      payload: withSessionPayload({
        folderId,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        data,
      }),
    });
  }

  return uploaded;
}

export async function deleteAssetDraftFolder(folderId?: string) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !folderId || folderId.startsWith("mock_")) return;

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "deleteAssetDraftFolder");
  appendSessionParams(url);
  url.searchParams.set("folderId", folderId);
  await fetch(url.toString(), { mode: "no-cors", keepalive: true }).catch(() => {});
}
