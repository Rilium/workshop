import type { AssetDraftFolder, UploadedAsset } from "../../driveAssetService";
import type { Selection } from "../../types/domain";
import type { ClientFlowState } from "./clientFlowState";

export const CLIENT_DRAFT_STORAGE_KEY = "funnifin_client_draft_v1";
const CLIENT_DRAFT_VERSION = 1;
const CLIENT_DRAFT_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type ClientDraftSnapshot = {
  flow: ClientFlowState;
  activeTopics: string[];
  activeThemes: string[];
  selections: Selection[];
  assetFolder: AssetDraftFolder | null;
  uploadedAssets: UploadedAsset[];
};

type StoredClientDraft = ClientDraftSnapshot & {
  version: typeof CLIENT_DRAFT_VERSION;
  savedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function loadClientDraft(): ClientDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(CLIENT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as unknown;
    if (!isRecord(stored) || stored.version !== CLIENT_DRAFT_VERSION || typeof stored.savedAt !== "string") {
      clearClientDraft();
      return null;
    }
    const savedAt = new Date(stored.savedAt).getTime();
    if (!Number.isFinite(savedAt) || Date.now() - savedAt > CLIENT_DRAFT_MAX_AGE_MS) {
      clearClientDraft();
      return null;
    }
    if (!isRecord(stored.flow) || !Array.isArray(stored.selections)) {
      clearClientDraft();
      return null;
    }
    return {
      flow: stored.flow as ClientFlowState,
      activeTopics: Array.isArray(stored.activeTopics) ? stored.activeTopics.map(String) : [],
      activeThemes: Array.isArray(stored.activeThemes) ? stored.activeThemes.map(String) : [],
      selections: stored.selections as Selection[],
      assetFolder: isRecord(stored.assetFolder) ? stored.assetFolder as AssetDraftFolder : null,
      uploadedAssets: Array.isArray(stored.uploadedAssets) ? stored.uploadedAssets as UploadedAsset[] : [],
    };
  } catch {
    clearClientDraft();
    return null;
  }
}

export function saveClientDraft(snapshot: ClientDraftSnapshot) {
  if (typeof window === "undefined") return;
  const stored: StoredClientDraft = {
    ...snapshot,
    version: CLIENT_DRAFT_VERSION,
    savedAt: new Date().toISOString(),
  };
  try {
    window.sessionStorage.setItem(CLIENT_DRAFT_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage disabilitato o quota esaurita: il percorso resta utilizzabile in memoria.
  }
}

export function clearClientDraft() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.removeItem(CLIENT_DRAFT_STORAGE_KEY);
  } catch {
    // Nessuna azione necessaria.
  }
}
