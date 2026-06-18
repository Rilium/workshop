import type { GoogleHealth } from "../../googleAdminService";

const GOOGLE_HEALTH_CACHE_KEY = "funnifin.googleHealth.v1";

export function readCachedGoogleHealth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GOOGLE_HEALTH_CACHE_KEY);
    if (!raw) return null;
    const health = JSON.parse(raw) as GoogleHealth;
    return health?.source === "google-workspace" && health.spreadsheet?.id ? { ...health, cached: true } : null;
  } catch {
    window.localStorage.removeItem(GOOGLE_HEALTH_CACHE_KEY);
    return null;
  }
}

export function writeCachedGoogleHealth(health: GoogleHealth | null) {
  if (typeof window === "undefined" || !health) return;
  window.localStorage.setItem(GOOGLE_HEALTH_CACHE_KEY, JSON.stringify(health));
}
