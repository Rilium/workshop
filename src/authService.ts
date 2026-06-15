/**
 * authService.ts – Phase 1 (mock locale)
 *
 * Login invite-only: email → OTP simulato → sessione in localStorage.
 * Phase 2 sostituirà con Apps Script + MailApp.
 */
import type { AuthUser, AuthSession, AuthRole, AccessRequest } from "./types/auth";
import type { Role } from "./types/domain";

// ─── Seed users ────────────────────────────────────────────────────────────────

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

// Email di notifica-only (non autorizzate al login)
const NOTIFICATION_ONLY_EMAILS = [
  "rinaldi.rilio+1@gmail.com",
  "rinaldi.rilio+2@gmail.com",
];

// In Phase 1 usiamo un OTP fisso per tutti i seed user (semplifica il test)
const MOCK_OTP = "123456";
const SESSION_KEY = "funnifin_auth_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 ore

// ─── OTP store (in-memory per Phase 1) ─────────────────────────────────────────

const pendingOtps = new Map<string, { otp: string; expiresAt: number }>();

// ─── Public API ────────────────────────────────────────────────────────────────

/**
 * Invia (simula) un OTP all'email indicata.
 * Risposta sempre neutra: non rivela se l'email è abilitata.
 */
export async function requestLoginCode(email: string): Promise<{ sent: boolean }> {
  const normalizedEmail = email.trim().toLowerCase();
  const user = findUserByEmail(normalizedEmail);

  if (user && !user.disabled && !NOTIFICATION_ONLY_EMAILS.includes(normalizedEmail)) {
    // Salva OTP con scadenza 10 minuti
    pendingOtps.set(normalizedEmail, {
      otp: MOCK_OTP,
      expiresAt: Date.now() + 10 * 60 * 1000,
    });
  }
  // Sempre "sent" – non rivelare se l'email è abilitata
  return { sent: true };
}

/**
 * Verifica l'OTP e crea una sessione.
 * Ritorna la sessione oppure lancia un errore (messaggio neutro).
 */
export async function verifyLoginCode(
  email: string,
  code: string,
): Promise<AuthSession> {
  const normalizedEmail = email.trim().toLowerCase();
  const entry = pendingOtps.get(normalizedEmail);

  if (!entry || entry.otp !== code.trim() || Date.now() > entry.expiresAt) {
    throw new Error("Codice non valido o scaduto.");
  }

  const user = findUserByEmail(normalizedEmail);
  if (!user || user.disabled) {
    throw new Error("Codice non valido o scaduto.");
  }

  pendingOtps.delete(normalizedEmail);

  const session: AuthSession = {
    userId: user.id,
    token: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
    effectiveRole: user.actualRole,
  };

  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  return session;
}

/**
 * Legge la sessione attiva da localStorage.
 * Ritorna null se assente o scaduta.
 */
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

/**
 * Aggiorna il effectiveRole nella sessione (solo FunniFin può usarlo).
 */
export function setSessionEffectiveRole(role: Role): void {
  const session = getStoredSession();
  if (!session) return;
  const updated: AuthSession = { ...session, effectiveRole: role };
  localStorage.setItem(SESSION_KEY, JSON.stringify(updated));
}

/**
 * Risolve l'utente dalla sessione.
 */
export function getUserFromSession(session: AuthSession): AuthUser | null {
  return SEED_USERS.find((user) => user.id === session.userId) ?? null;
}

/** Termina la sessione. */
export function logout(): void {
  localStorage.removeItem(SESSION_KEY);
}

// ─── Admin API (seed data per Phase 1) ─────────────────────────────────────────

/** Lista utenti per pannello "Utenti e inviti" */
export function listAuthUsers(): AuthUser[] {
  return [...SEED_USERS];
}

/** Lista richieste di accesso (vuota in Phase 1) */
export function listAccessRequests(): AccessRequest[] {
  return [];
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function findUserByEmail(email: string): AuthUser | undefined {
  return SEED_USERS.find((user) => user.email.toLowerCase() === email);
}
