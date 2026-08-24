import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getStoredSession,
  getUserFromSession,
  logout as serviceLogout,
  requestLoginCode,
  AUTH_SESSION_UPDATED_EVENT,
  isDefinitiveSessionValidationError,
  setSessionEffectiveRole,
  validateStoredSession,
  verifyLoginCode,
} from "./authService";
import type { AuthSession, AuthUser } from "./types/auth";
import type { Role } from "./types/domain";
import type { RequestLoginCodeOptions, RequestLoginCodeResult } from "./authService";

// ─── Context shape ─────────────────────────────────────────────────────────────

type AuthContextValue = {
  /** Utente autenticato (null = non loggato) */
  currentUser: AuthUser | null;
  session: AuthSession | null;
  /** Ruolo effettivo visualizzato (può differire da actualRole in impersonificazione, include Cliente) */
  effectiveRole: Role | null;
  /** true mentre legge la sessione dal localStorage */
  loading: boolean;

  // Auth actions
  requestCode: (email: string, options?: RequestLoginCodeOptions) => Promise<RequestLoginCodeResult>;
  verifyCode: (email: string, code: string) => Promise<void>;
  logout: () => void;

  /**
   * Cambia il ruolo visualizzato (solo FunniFin).
   * Accetta qualsiasi Role incluso Cliente.
   */
  switchEffectiveRole: (role: Role) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);
export const AUTH_ENTRY_CONFETTI_EVENT = "funnifin:entry-confetti";

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  // La vista pubblica non deve attraversare un loader auth quando non esiste
  // alcuna sessione da ripristinare: in quel caso può partire subito il catalogo.
  const [loading, setLoading] = useState(() => Boolean(getStoredSession()));

  // Ripristina e rivalida la sessione al mount: lo snapshot locale non decide i permessi.
  useEffect(() => {
    let cancelled = false;
    let retryTimer: number | undefined;
    const restoreSession = async (attempt = 0) => {
      const stored = getStoredSession();
      if (!stored) {
        if (!cancelled) setLoading(false);
        return;
      }
      try {
        const validated = await validateStoredSession(stored);
        if (cancelled) return;
        const user = getUserFromSession(validated);
        if (!user) throw new Error("Utente non trovato.");
        setSession(validated);
        setCurrentUser(user);
        window.setTimeout(() => {
          window.dispatchEvent(new CustomEvent(AUTH_ENTRY_CONFETTI_EVENT, { detail: { token: validated.token } }));
        }, 0);
      } catch (error) {
        if (cancelled) return;
        setSession(null);
        setCurrentUser(null);
        if (isDefinitiveSessionValidationError(error)) {
          serviceLogout();
        } else if (attempt < 2) {
          // Non usare lo snapshot locale per autorizzare la UI, ma conserva il
          // token e rivalidalo in background quando Google torna disponibile.
          retryTimer = window.setTimeout(() => void restoreSession(attempt + 1), 3_000 * (attempt + 1));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void restoreSession();
    return () => {
      cancelled = true;
      if (retryTimer !== undefined) window.clearTimeout(retryTimer);
    };
  }, []);

  useEffect(() => {
    const refreshSession = () => {
      const stored = getStoredSession();
      setSession(stored);
      setCurrentUser(stored ? getUserFromSession(stored) : null);
    };
    window.addEventListener(AUTH_SESSION_UPDATED_EVENT, refreshSession);
    return () => window.removeEventListener(AUTH_SESSION_UPDATED_EVENT, refreshSession);
  }, []);

  const requestCode = async (email: string, options?: RequestLoginCodeOptions) => {
    return requestLoginCode(email, options);
  };

  const verifyCode = async (email: string, code: string) => {
    const newSession = await verifyLoginCode(email, code);
    const user = getUserFromSession(newSession);
    if (!user) throw new Error("Utente non trovato.");
    setSession(newSession);
    setCurrentUser(user);
    window.dispatchEvent(new CustomEvent(AUTH_ENTRY_CONFETTI_EVENT, { detail: { token: newSession.token } }));
  };

  const logout = () => {
    serviceLogout();
    setSession(null);
    setCurrentUser(null);
  };

  const switchEffectiveRole = (role: Role) => {
    if (!session || !currentUser) return;
    if (currentUser.actualRole !== "FunniFin") return; // solo FunniFin può impostarlo
    setSessionEffectiveRole(role);
    // Aggiorna lo stato locale senza rileggere localStorage
    const updated: AuthSession = { ...session, effectiveRole: role };
    setSession(updated);
  };

  const effectiveRole: Role | null = session?.effectiveRole ?? null;

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        session,
        effectiveRole,
        loading,
        requestCode,
        verifyCode,
        logout,
        switchEffectiveRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve essere usato dentro AuthProvider");
  return ctx;
}
