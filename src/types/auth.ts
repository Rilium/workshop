import type { Role } from "./domain";

/** Ruoli che richiedono login (Cliente è pubblico) */
export type AuthRole = Exclude<Role, "Cliente">;

/** Utente autorizzato nel sistema */
export type AuthUser = {
  id: string;
  email: string;
  actualRole: AuthRole;
  /** expertId collegato al profilo esperto (solo per Esperto) */
  expertId?: string;
  displayName: string;
  invitedBy?: string;
  createdAt: string;
  disabled: boolean;
};

/** Sessione attiva (mock Phase 1: salvata in localStorage) */
export type AuthSession = {
  userId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  /** effectiveRole: può essere qualsiasi Role, incluso Cliente (solo FunniFin può cambiarlo) */
  effectiveRole: import("./domain").Role;
  /** Snapshot dell'utente al momento del login */
  user?: AuthUser;
};

/** Richiesta di accesso in attesa di approvazione FunniFin */
export type AccessRequest = {
  id: string;
  email: string;
  refCode?: string;
  status: "pending" | "approved" | "rejected";
  requestedRole?: AuthRole;
  sendMail?: boolean;
  code?: string;
  codeStatus?: "pending" | "queued" | "sent" | "verified" | "expired";
  codeExpiresAt?: string;
  createdAt: string;
  reviewedAt?: string;
  reviewedBy?: string;
  verifiedAt?: string;
};

/** Stato esposto dal contesto auth */
export type AuthState = {
  currentUser: AuthUser | null;
  session: AuthSession | null;
  /** Ruolo effettivo visualizzato (può essere diverso da actualRole per FunniFin in impersonificazione) */
  effectiveRole: AuthRole | null;
  loading: boolean;
};
