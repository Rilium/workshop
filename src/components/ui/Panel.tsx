import React from "react";

export function Panel({
  title,
  icon,
  actions,
  className,
  children,
}: {
  title?: string;
  icon?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section className={className ? `panel ${className}` : "panel"}>
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
