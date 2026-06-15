import React from "react";
import { money } from "../../utils/money";
import { statusLabel } from "../../data/workflow";
import type { ProjectStatus } from "../../types/domain";

export function AdminProjectBar({
  company,
  manager,
  email,
  phone,
  status,
  total,
}: {
  company: string;
  manager: string;
  email: string;
  phone: string;
  status: ProjectStatus;
  total: number;
}) {
  return (
    <aside className="admin-project-bar" aria-label="Progetto attivo">
      <div className="admin-project-bar-left">
        <span className="admin-project-bar-eyebrow">Progetto attivo</span>
        <strong className="admin-project-bar-company">{company}</strong>
        <p className="admin-project-bar-contact">{manager} · {email} · {phone}</p>
      </div>
      <div className="admin-project-bar-right">
        <span className="admin-project-bar-status">{statusLabel[status]}</span>
        <strong className="admin-project-bar-price">{money(total)}</strong>
        <small className="admin-project-bar-iva">+ IVA</small>
      </div>
    </aside>
  );
}
