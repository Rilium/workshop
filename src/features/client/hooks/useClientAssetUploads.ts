import { useState, type Dispatch, type SetStateAction } from "react";
import {
  createAssetDraftFolder,
  uploadAssetFiles,
  type AssetDraftFolder,
  type UploadedAsset,
} from "../../../driveAssetService";
import type { ProjectStatus } from "../../../types/domain";

type ClientAssetUploadOptions = {
  company: string;
  assetFolder: AssetDraftFolder | null;
  setAssetFolder: (folder: AssetDraftFolder | null) => void;
  setUploadedAssets: Dispatch<SetStateAction<UploadedAsset[]>>;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  notify: (title: string, body: string) => void;
};

export function useClientAssetUploads({
  company,
  assetFolder,
  setAssetFolder,
  setUploadedAssets,
  setProjectStatus,
  notify,
}: ClientAssetUploadOptions) {
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [assetUploadError, setAssetUploadError] = useState("");

  const handleAssetFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;

    setUploadingAssets(true);
    setAssetUploadError("");
    try {
      const folder = assetFolder ?? (await createAssetDraftFolder(company.trim() || "Cliente"));
      setAssetFolder(folder);
      const uploaded = await uploadAssetFiles(folder.id, list, folder.draftToken);
      setUploadedAssets((current) => [...current, ...uploaded]);
      setProjectStatus("materiali_cliente_in_attesa", "Materiali caricati", `${uploaded.length} file salvati nella cartella ${folder.name}.`);
      notify("Materiali caricati", `${uploaded.length} file salvati in Drive.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload materiali non riuscito";
      setAssetUploadError(message);
      notify("Upload materiali non riuscito", message);
    } finally {
      setUploadingAssets(false);
    }
  };

  return { uploadingAssets, assetUploadError, handleAssetFiles };
}
