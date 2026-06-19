import { SECRET_SETTINGS } from "./secretSettings";
import { appendSessionParams, withSessionPayload } from "./authTransport";

export type AssetDraftFolder = {
  source: "google-drive";
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
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Upload file su Drive non riuscito");
  const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
  if (result.ok === false) throw new Error(result.error || "Upload file su Drive non riuscito");
}

export async function createAssetDraftFolder(clientName: string): Promise<AssetDraftFolder> {
  const scriptUrl = getScriptUrl();
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
    if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

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
    uploaded.push({ name: file.name, size: file.size, mimeType: file.type || "application/octet-stream" });
  }

  return uploaded;
}

export async function deleteAssetDraftFolder(folderId?: string) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !folderId) return;

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "deleteAssetDraftFolder");
  appendSessionParams(url);
  url.searchParams.set("folderId", folderId);
  await fetch(url.toString(), { keepalive: true }).catch(() => {});
}
