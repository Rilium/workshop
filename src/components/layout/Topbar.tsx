import React from "react";
import { InfoIcon, LogIn, LogOut, Menu, RefreshCw, Settings2 } from "lucide-react";
import { statusDescription, statusLabel } from "../../data/workflow";
import type { ProjectStatus, Role } from "../../types/domain";
import type { AuthUser } from "../../types/auth";
import { ToolIconButton } from "../ui/IconButton";

// Tutti i ruoli visualizzabili da FunniFin, incluso Cliente
const FUNNIFIN_SWITCH_OPTIONS: Role[] = ["FunniFin", "Cliente", "Esperto", "Brand"];

export function Topbar({
  role,
  context,
  projectStatus,
  notify,
}: {
  role: Role;
  context: string;
  projectStatus: ProjectStatus;
  notify: (title: string, body: string) => void;
}) {
  return (
    <header className="topbar">
      <div className="brand-mark">
        <img className="logo-bubble" src="/Logo.png" alt="FunniFin" />
        <div>
          <div className="brand-title-row">
            <strong>FunniFin Workshop Planner</strong>
            <span className="role-title-badge">{role}</span>
          </div>
          <div className="brand-subline">
            <span>{context}</span>
            <span className="request-status-chip" title={statusDescription[projectStatus]}>
              <strong>{statusLabel[projectStatus]}</strong>
              <button
                type="button"
                className="status-info-button"
                aria-label={"Dettagli stato: " + statusDescription[projectStatus]}
                title={statusDescription[projectStatus]}
                onClick={() => notify(statusLabel[projectStatus], statusDescription[projectStatus])}
              >
                <InfoIcon size={14} />
              </button>
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}

export function SystemBar({
  role,
  actualRole,
  context,
  roleMenuOpen,
  onToggleRoleMenu,
  onRole,
  onSettings,
  settingsLabel,
  onRefresh,
  onLogout,
  onLogin,
  currentUser,
}: {
  role: Role;
  /** actualRole dell'utente autenticato (null = visitatore anonimo Cliente) */
  actualRole: import("../../types/auth").AuthRole | null;
  context: string;
  roleMenuOpen: boolean;
  onToggleRoleMenu: () => void;
  onRole: (role: Role) => void;
  onSettings: () => void;
  settingsLabel: string;
  onRefresh: () => void;
  onLogout: () => void;
  onLogin: () => void;
  currentUser: AuthUser | null;
}) {
  const isFunniFin = actualRole === "FunniFin";

  return (
    <section className="system-bar" aria-label="Barra sistema">
      <div className="system-role-area">
        {isFunniFin ? (
          /* Switch ruolo: solo per FunniFin */
          <div className="role-menu">
            <button
              className="role-menu-trigger"
              type="button"
              aria-label="Visualizza come"
              aria-expanded={roleMenuOpen}
              onClick={onToggleRoleMenu}
            >
              <span>Visualizza come: {role}</span>
              <Menu size={18} />
            </button>
            {roleMenuOpen && (
              <div className="role-switch" aria-label="Seleziona visualizzazione">
                {FUNNIFIN_SWITCH_OPTIONS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={role === item ? "active" : ""}
                    onClick={() => onRole(item)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* Per Esperto e Brand: mostra solo il ruolo, nessuno switch */
          <div className="role-label-static">
            <span>{role}</span>
          </div>
        )}
        <span>{context}</span>
      </div>
      <div className="system-actions">
        <ToolIconButton onClick={onSettings} label={settingsLabel}>
          <Settings2 size={18} />
        </ToolIconButton>
        <ToolIconButton onClick={onRefresh} label="Ricarica sezione">
          <RefreshCw size={18} />
        </ToolIconButton>
        {currentUser ? (
          <ToolIconButton onClick={onLogout} label={`Esci (${currentUser.displayName})`}>
            <LogOut size={18} />
          </ToolIconButton>
        ) : (
          <ToolIconButton onClick={onLogin} label="Accedi all'area riservata">
            <LogIn size={18} />
          </ToolIconButton>
        )}
      </div>
    </section>
  );
}
