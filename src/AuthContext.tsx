import React, { createContext, useContext, useEffect, useState } from "react";
import {
  getStoredSession,
  getUserFromSession,
  logout as serviceLogout,
  requestLoginCode,
  setSessionEffectiveRole,
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

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // Ripristina sessione al mount
  useEffect(() => {
    const stored = getStoredSession();
    if (stored) {
      const user = getUserFromSession(stored);
      if (user) {
        setSession(stored);
        setCurrentUser(user);
      }
    }
    setLoading(false);
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
