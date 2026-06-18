import React from "react";

export function SectionTitle({
  icon,
  title,
  meta,
  actions,
}: {
  icon?: React.ReactNode;
  title: string;
  meta?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="section-title-row">
      <div className="section-title-main">
        {icon && <span className="section-title-icon">{icon}</span>}
        <div className="section-title-text">
          <h2 className="section-title-heading">{title}</h2>
          {meta && <p className="section-title-meta">{meta}</p>}
        </div>
      </div>
      {actions && <div className="section-title-actions">{actions}</div>}
    </div>
  );
}
