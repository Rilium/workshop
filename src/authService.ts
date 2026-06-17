/**
 * authService.ts
 *
 * Login invite-only gestito da FunniFin:
 * - invito/credenziali scritti su Google Sheet via Apps Script
 * - codice OTP generato dal backend
 * - sessione persistita in localStorage
 *
 * In assenza del backend Google, mantiene un fallback locale per non bloccare la UI.
 */
import type { AuthRole, AuthSession, AuthUser, AccessRequest } from "./types/auth";
import type { Role } from "./types/domain";
import { SECRET_SETTINGS } from "./secretSettings";

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

export const SEED_USERS: AuthUser[] = [
  {
    id: "user-funnifin",
    email: "rinaldi.rilio@gmail.com",
    actualRole: "FunniFin",
    displayName: "Team FunniFin",
    createdAt: "2024-01-01T00:00:00",
    disabled: false,
  },
  {
    id: "user-esperto-laura",
    email: "rinaldi.rilio+3@gmail.com",
    actualRole: "Esperto",
    expertId: "laura-bianchi",
    displayName: "Laura Bianchi",
    createdAt: "2024-01-01T00:00:00",
    disabled: false,
  },
  {
    id: "user-brand",
    email: "rinaldi.rilio+4@gmail.com",
    actualRole: "Brand",
    displayName: "Brand Review",
    createdAt: "2024-01-01T00:00:00",
    disabled: false,
  },
];

const NOTIFICATION_ONLY_EMAILS = ["rinaldi.rilio+1@gmail.com", "rinaldi.rilio+2@gmail.com"];
const SESSION_KEY = "funnifin_auth_session";
const SESSION_DURATION_MS = 365 * 24 * 60 * 60 * 1000;
const DEFAULT_CODE_TTL_MS = 10 * 60 * 1000;

const pendingOtps = new Map<string, { otp: string; expiresAt: number }>();
const localAuthUsers = new Map<string, AuthUser>(SEED_USERS.map((user) => [user.email.toLowerCase(), user]));
const localAccessRequests = new Map<string, AccessRequest>();

function findLocalUserById(userId: string) {
  const normalizedId = String(userId || "");
  return [...localAuthUsers.values()].find((user) => user.id === normalizedId) ?? null;
}

function getScriptUrl() {
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];
}

function friendlyAuthError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/failed to fetch/i.test(message) || /networkerror/i.test(message)) return fallback;
  return message;
}

async function getAppsScript<T>(action: string, params?: Record<string, string>): Promise<T | null> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return null;

  const url = new URL(scriptUrl);
  url.searchParams.set("action", action);
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

async function postAppsScript<T>(action: string, payload: unknown): Promise<T | null> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return null;

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, payload }),
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

function buildLocalCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function buildSession(user: AuthUser, previousRole?: Role | null): AuthSession {
  const effectiveRole = previousRole ?? user.actualRole;
  return {
    userId: user.id,
    token: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    effectiveRole,
    user,
  };
}

function storeSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function upsertLocalAccessRequest(request: AccessRequest) {
  localAccessRequests.set(request.email.toLowerCase(), request);
}

function upsertLocalUser(user: AuthUser) {
  localAuthUsers.set(user.email.toLowerCase(), user);
}

function removeLocalUser(email: string) {
  localAuthUsers.delete(email.toLowerCase());
}

function findLocalUserByEmail(email: string) {
  return localAuthUsers.get(email.toLowerCase()) ?? null;
}

function getLatestLocalAccessRequest(email: string) {
  return localAccessRequests.get(email.toLowerCase()) ?? null;
}

function buildLocalAccessRequest(email: string, overrides?: Partial<AccessRequest>): AccessRequest {
  const existing = getLatestLocalAccessRequest(email);
  const now = new Date().toISOString();
  return {
    id: existing?.id || `access-${normalizeEmail(email).replace(/[^a-z0-9]+/g, "-") || "user"}-${Date.now()}`,
    email,
    status: overrides?.status || existing?.status || "pending",
    refCode: overrides?.refCode ?? existing?.refCode,
    requestedRole: overrides?.requestedRole ?? existing?.requestedRole,
    sendMail: overrides?.sendMail ?? existing?.sendMail,
    code: overrides?.code ?? existing?.code,
    codeStatus: overrides?.codeStatus ?? existing?.codeStatus,
    codeExpiresAt: overrides?.codeExpiresAt ?? existing?.codeExpiresAt,
    createdAt: existing?.createdAt || now,
    reviewedAt: overrides?.reviewedAt ?? existing?.reviewedAt,
    reviewedBy: overrides?.reviewedBy ?? existing?.reviewedBy,
    verifiedAt: overrides?.verifiedAt ?? existing?.verifiedAt,
  };
}

function localRequestLoginCode(email: string, options: RequestLoginCodeOptions): RequestLoginCodeResult {
  const normalizedEmail = normalizeEmail(email);
  const user = findLocalUserByEmail(normalizedEmail);
  const canIssueCode = Boolean(user && !user.disabled && !NOTIFICATION_ONLY_EMAILS.includes(normalizedEmail));
  const sendMail = options.sendMail !== false;

  if (options.requestedRole) {
    upsertLocalUser({
      id: user?.id || `user-${normalizedEmail.replace(/[^a-z0-9]+/g, "-") || "invite"}`,
      email: normalizedEmail,
      actualRole: options.requestedRole,
      expertId: user?.expertId,
      displayName: options.displayName || user?.displayName || normalizedEmail,
      invitedBy: options.invitedBy || user?.invitedBy || "FunniFin",
      createdAt: user?.createdAt || new Date().toISOString(),
      disabled: false,
    });
  }

  const issuingUser = findLocalUserByEmail(normalizedEmail);

  if (canIssueCode || options.requestedRole) {
    const otp = buildLocalCode();
    const expiresAt = Date.now() + DEFAULT_CODE_TTL_MS;
    pendingOtps.set(normalizedEmail, { otp, expiresAt });
    const request = buildLocalAccessRequest(normalizedEmail, {
      status: "approved",
      sendMail,
      requestedRole: options.requestedRole || issuingUser?.actualRole,
      code: otp,
      codeStatus: sendMail ? "sent" : "queued",
      codeExpiresAt: new Date(expiresAt).toISOString(),
      reviewedAt: new Date().toISOString(),
      reviewedBy: options.invitedBy || "FunniFin",
      refCode: options.refCode,
    });
    upsertLocalAccessRequest(request);
    return {
      sent: true,
      pending: false,
      codeStatus: request.codeStatus,
      request,
      user: issuingUser || undefined,
    };
  }

  const request = buildLocalAccessRequest(normalizedEmail, {
    status: "pending",
    sendMail,
    requestedRole: options.requestedRole,
    refCode: options.refCode,
    codeStatus: "pending",
  });
  upsertLocalAccessRequest(request);
  return { sent: true, pending: true, codeStatus: request.codeStatus, request };
}

function localVerifyLoginCode(email: string, code: string): AuthSession {
  const normalizedEmail = normalizeEmail(email);
  const entry = pendingOtps.get(normalizedEmail);
  const user = findLocalUserByEmail(normalizedEmail);

  if (!user || user.disabled) {
    throw new Error("Codice non valido o scaduto.");
  }

  if (!entry || entry.otp !== code.trim() || Date.now() > entry.expiresAt) {
    throw new Error("Codice non valido o scaduto.");
  }

  pendingOtps.delete(normalizedEmail);
  const request = getLatestLocalAccessRequest(normalizedEmail);
  if (request) {
    upsertLocalAccessRequest({
      ...request,
      codeStatus: "verified",
      verifiedAt: new Date().toISOString(),
    });
  }

  const session = buildSession(user);
  storeSession(session);
  return session;
}

function localReviewAccessRequest(requestId: string, options: ReviewAccessRequestOptions): ReviewAccessRequestResult {
  const request = Array.from(localAccessRequests.values()).find((item) => item.id === requestId);
  if (!request) throw new Error("Richiesta di accesso non trovata.");

  const now = new Date().toISOString();
  const next: AccessRequest = {
    ...request,
    status: options.status,
    reviewedAt: now,
    reviewedBy: options.reviewedBy || "FunniFin",
    sendMail: options.sendMail ?? request.sendMail,
    codeStatus: options.status === "approved" ? (options.sendMail === false ? "queued" : "sent") : "pending",
  };

  if (options.status === "approved") {
    if (!findLocalUserByEmail(next.email) && next.requestedRole) {
      upsertLocalUser({
        id: `user-${normalizeEmail(next.email).replace(/[^a-z0-9]+/g, "-") || "invite"}`,
        email: normalizeEmail(next.email),
        actualRole: next.requestedRole,
        displayName: normalizeEmail(next.email),
        invitedBy: options.reviewedBy || "FunniFin",
        createdAt: next.createdAt,
        disabled: false,
      });
    }
    const otp = buildLocalCode();
    next.code = otp;
    next.codeExpiresAt = new Date(Date.now() + DEFAULT_CODE_TTL_MS).toISOString();
    pendingOtps.set(normalizeEmail(next.email), { otp, expiresAt: Date.now() + DEFAULT_CODE_TTL_MS });
  } else {
    next.code = "";
    next.codeExpiresAt = "";
  }

  upsertLocalAccessRequest(next);
  return {
    request: next,
    user: findLocalUserByEmail(normalizeEmail(next.email)),
    codeSent: options.status === "approved" && options.sendMail !== false,
  };
}

export async function requestLoginCode(email: string, options: RequestLoginCodeOptions = {}): Promise<RequestLoginCodeResult> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("Email non valida.");

  try {
    const result = await postAppsScript<RequestLoginCodeResult>("requestLoginCode", {
      email: normalizedEmail,
      ...options,
    });
    if (result) return result;
  } catch {
    // fallback locale sotto
  }

  return localRequestLoginCode(normalizedEmail, options);
}

export async function verifyLoginCode(email: string, code: string): Promise<AuthSession> {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) throw new Error("Email non valida.");

  try {
    const result = await postAppsScript<AuthSessionPayload>("verifyLoginCode", {
      email: normalizedEmail,
      code: code.trim(),
    });
    if (result?.session && result?.user) {
      storeSession(result.session);
      return result.session;
    }
    if (result?.session) {
      storeSession(result.session);
      return result.session;
    }
    throw new Error("Codice non valido o scaduto.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/connessione google/i.test(message)) {
      return localVerifyLoginCode(normalizedEmail, code);
    }
    return localVerifyLoginCode(normalizedEmail, code);
  }
}

export async function reviewAccessRequest(
  requestId: string,
  options: ReviewAccessRequestOptions,
): Promise<ReviewAccessRequestResult> {
  if (!requestId) throw new Error("requestId mancante.");

  try {
    const result = await postAppsScript<ReviewAccessRequestResult>("reviewAccessRequest", {
      requestId,
      ...options,
    });
    if (result) return result;
  } catch {
    // fallback locale
  }

  return localReviewAccessRequest(requestId, options);
}

export async function listAuthUsers(): Promise<AuthUser[]> {
  try {
    const result = await getAppsScript<{ users?: AuthUser[] }>("listAuthUsers");
    return result?.users ?? [...localAuthUsers.values()];
  } catch {
    return [...localAuthUsers.values()];
  }
}

export async function listAccessRequests(): Promise<AccessRequest[]> {
  try {
    const result = await getAppsScript<{ requests?: AccessRequest[] }>("listAccessRequests");
    return result?.requests ?? Array.from(localAccessRequests.values());
  } catch {
    return Array.from(localAccessRequests.values());
  }
}

function localUpdateAuthUser(userId: string, patch: UpdateAuthUserOptions): UpdateAuthUserResult {
  const existing = findLocalUserById(userId) ?? findLocalUserByEmail(patch.email);
  if (!existing) throw new Error("Utente non trovato.");
  const next: AuthUser = {
    ...existing,
    email: normalizeEmail(patch.email),
    actualRole: patch.actualRole,
    displayName: patch.displayName,
    expertId: patch.expertId ?? "",
    invitedBy: patch.invitedBy ?? existing.invitedBy,
    disabled: Boolean(patch.disabled),
  };
  if (existing.email.toLowerCase() !== next.email.toLowerCase()) {
    removeLocalUser(existing.email);
  }
  upsertLocalUser(next);
  return { user: next };
}

export async function updateAuthUser(userId: string, patch: UpdateAuthUserOptions): Promise<UpdateAuthUserResult> {
  if (!userId) throw new Error("userId mancante.");

  try {
    const result = await postAppsScript<UpdateAuthUserResult>("updateAuthUser", {
      userId,
      ...patch,
    });
    if (result?.user) return result;
  } catch {
    // fallback locale
  }

  return localUpdateAuthUser(userId, patch);
}

export function getStoredSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session: AuthSession = JSON.parse(raw);
    if (new Date(session.expiresAt) < new Date()) {
      localStorage.removeItem(SESSION_KEY);
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
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
}

export function getUserFromSession(session: AuthSession): AuthUser | null {
  if (session.user) return session.user;
  return [...localAuthUsers.values()].find((user) => user.id === session.userId) ?? SEED_USERS.find((user) => user.id === session.userId) ?? null;
}

export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}
