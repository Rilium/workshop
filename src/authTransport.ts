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

export function allowLocalFallbacks() {
  return envValue("VITE_ALLOW_LOCAL_FALLBACKS") !== "false" && envValue("VITE_STRICT_GOOGLE_BACKEND") !== "true";
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
