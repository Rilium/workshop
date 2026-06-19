/**
 * Auth invite-only gestita dallo Sheet via Apps Script.
 * Nessun seed user o fallback locale nel bundle frontend: lo Sheet e l'unica source of truth.
 */
import type { AuthRole, AuthSession, AuthUser, AccessRequest } from "./types/auth";
import type { Role } from "./types/domain";
import { SECRET_SETTINGS } from "./secretSettings";
import { AUTH_SESSION_KEY, appendSessionParams, withSessionPayload } from "./authTransport";

export type RequestLoginCodeOptions = {
  sendMail?: boolean;
  requestedRole?: AuthRole;
  displayName?: string;
  invitedBy?: string;
  refCode?: string;
};

export type RequestLoginCodeResult = {
  sent: boolean;
  pending?: boolean;
  codeStatus?: AccessRequest["codeStatus"];
  request?: AccessRequest;
  user?: AuthUser;
};

export type ReviewAccessRequestOptions = {
  status: "approved" | "rejected";
  sendMail?: boolean;
  reviewedBy?: string;
  note?: string;
};

export type ReviewAccessRequestResult = {
  request: AccessRequest;
  user?: AuthUser | null;
  codeSent?: boolean;
};

export type UpdateAuthUserOptions = {
  email: string;
  actualRole: AuthRole;
  displayName: string;
  expertId?: string;
  invitedBy?: string;
  disabled?: boolean;
  sendMail?: boolean;
};

export type UpdateAuthUserResult = {
  user: AuthUser;
};

type AuthSessionPayload = {
  session: AuthSession;
  user: AuthUser;
};

type ScriptResponse<T> = T & { ok?: boolean; error?: string };

function getScriptUrl() {
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];
}

function requireScriptUrl() {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato.");
  return scriptUrl;
}

function friendlyAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/failed to fetch/i.test(message) || /networkerror/i.test(message)) return fallback;
  return message;
}

async function getAppsScript<T>(action: string, params?: Record<string, string>): Promise<T> {
  const url = new URL(requireScriptUrl());
  url.searchParams.set("action", action);
  appendSessionParams(url);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Lettura ${action} non riuscita`);
    const result = (await response.json().catch(() => null)) as ScriptResponse<T> | null;
    if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
    if (result.ok === false) throw new Error(result.error || `Lettura ${action} non riuscita`);
    return result;
  } catch (error) {
    throw new Error(friendlyAuthError(error, `Connessione Google non disponibile per ${action}.`));
  }
}

async function postAppsScript<T>(action: string, payload: unknown): Promise<T> {
  try {
    const response = await fetch(requireScriptUrl(), {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action,
        payload: payload && typeof payload === "object" && !Array.isArray(payload)
          ? withSessionPayload(payload as Record<string, unknown>)
          : payload,
      }),
    });
    if (!response.ok) throw new Error(`Salvataggio ${action} non riuscito`);
    const result = (await response.json().catch(() => null)) as ScriptResponse<T> | null;
    if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
    if (result.ok === false) throw new Error(result.error || `Salvataggio ${action} non riuscito`);
    return result;
  } catch (error) {
    throw new Error(friendlyAuthError(error, `Connessione Google non disponibile per ${action}.`));
  }
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function storeSession(session: AuthSession) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

export async function requestLoginCode(email: string, options: RequestLoginCodeOptions = {}): Promise<RequestLoginCodeResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("Email non valida.");
  return postAppsScript<RequestLoginCodeResult>("requestLoginCode", {
    email: normalizedEmail,
    ...options,
  });
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthSession> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("Email non valida.");

  const result = await postAppsScript<AuthSessionPayload>("verifyLoginCode", {
    email: normalizedEmail,
    code: code.trim(),
  });
  if (!result.session) throw new Error("Codice non valido.");
  storeSession(result.session);
  return result.session;
}

export async function reviewAccessRequest(
  requestId: string,
  options: ReviewAccessRequestOptions,
): Promise<ReviewAccessRequestResult> {
  if (!requestId) throw new Error("requestId mancante.");
  return postAppsScript<ReviewAccessRequestResult>("reviewAccessRequest", {
    requestId,
    ...options,
  });
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  const result = await getAppsScript<{ users?: AuthUser[] }>("listAuthUsers");
  return result.users ?? [];
}

export async function listAccessRequests(): Promise<AccessRequest[]> {
  const result = await getAppsScript<{ requests?: AccessRequest[] }>("listAccessRequests");
  return result.requests ?? [];
}

export async function updateAuthUser(userId: string, patch: UpdateAuthUserOptions): Promise<UpdateAuthUserResult> {
  if (!userId) throw new Error("userId mancante.");
  return postAppsScript<UpdateAuthUserResult>("updateAuthUser", {
    userId,
    ...patch,
  });
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (new Date(session.expiresAt) < new Date()) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function setSessionEffectiveRole(role: Role): void {
  const session = getStoredSession();
  if (!session) return;
  const updated: AuthSession = { ...session, effectiveRole: role };
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(updated));
}

export function getUserFromSession(session: AuthSession): AuthUser | null {
  return session.user ?? null;
}

export function logout(): void {
  localStorage.removeItem(AUTH_SESSION_KEY);
}
