export const AUTH_SESSION_KEY = "funnifin_auth_session";

type StoredAuthSession = {
  token?: string;
  userId?: string;
  user?: {
    actualRole?: string;
    email?: string;
  };
};

function envValue(key: string) {
  return (import.meta as unknown as { env: Record<string, string | boolean | undefined> }).env[key];
}

function envFlag(key: string) {
  const value = envValue(key);
  if (typeof value === "boolean") return value;
  return String(value ?? "").trim().toLowerCase() === "true";
}

export function allowLocalFallbacks() {
  if (envFlag("VITE_STRICT_GOOGLE_BACKEND")) return false;
  const explicitFallback = envValue("VITE_ALLOW_LOCAL_FALLBACKS");
  if (explicitFallback !== undefined) return envFlag("VITE_ALLOW_LOCAL_FALLBACKS");
  return envFlag("DEV");
}

export function getStoredAuthSession(): StoredAuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? (JSON.parse(raw) as StoredAuthSession) : null;
  } catch {
    return null;
  }
}

export function getStoredSessionToken() {
  return getStoredAuthSession()?.token || "";
}

export function withSessionPayload<T extends object>(payload: T): T & { sessionToken?: string } {
  const sessionToken = getStoredSessionToken();
  return sessionToken ? { ...payload, sessionToken } : payload;
}

export function appendSessionParams(url: URL) {
  const session = getStoredAuthSession();
  if (session?.token) url.searchParams.set("sessionToken", session.token);
  if (session?.user?.actualRole) url.searchParams.set("sessionRole", session.user.actualRole);
}
