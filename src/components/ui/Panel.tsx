import React from "react";

export function Panel({
  title,
  icon,
  actions,
  children,
}: {
  title?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="panel">
      {title && (
        <div className="panel-title">
          <div className="panel-title-main">
            {icon}
            <h2>{title}</h2>
          </div>
          {actions && <div className="panel-title-actions">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}
