import { SECRET_SETTINGS } from "./secretSettings";
import { withSessionPayload } from "./authTransport";
import { fetchAppsScript } from "./appsScriptTransport";

export type AssetDraftFolder = {
  source: "google-drive";
  id: string;
  name: string;
  url: string;
  draftToken?: string;
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

async function postAppsScript<T>(scriptUrl: string, body: unknown): Promise<T> {
  const response = await fetchAppsScript(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Upload file su Drive non riuscito");
  const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
  if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
  if (result.ok === false) throw new Error(result.error || "Upload file su Drive non riuscito");
  return result as T;
}

export async function createAssetDraftFolder(clientName: string): Promise<AssetDraftFolder> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  return postAppsScript<AssetDraftFolder>(scriptUrl, {
    action: "createAssetDraftFolder",
    payload: withSessionPayload({ clientName }),
  });
}

export async function uploadAssetFiles(folderId: string, files: File[], draftToken?: string): Promise<UploadedAsset[]> {
  const scriptUrl = getScriptUrl();
  const uploaded: UploadedAsset[] = [];

  for (const file of files) {
    if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

    const data = await fileToBase64(file);
    await postAppsScript(scriptUrl, {
      action: "uploadAssetFile",
      payload: withSessionPayload({
        folderId,
        draftToken,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        data,
      }),
    });
    uploaded.push({ name: file.name, size: file.size, mimeType: file.type || "application/octet-stream" });
  }

  return uploaded;
}

export async function deleteAssetDraftFolder(folderId?: string, draftToken?: string) {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl || !folderId) return;

  await fetchAppsScript(scriptUrl, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "deleteAssetDraftFolder",
      payload: withSessionPayload({ folderId, draftToken: draftToken || "" }),
    }),
  }).catch(() => {});
}
