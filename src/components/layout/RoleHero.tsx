import React from "react";

export function RoleHero({
  eyebrow,
  title,
  subtitle,
  actions,
  className = "",
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`role-hero ${className}`.trim()}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="role-actions">{actions}</div>}
    </section>
  );
}
