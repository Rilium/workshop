import React from "react";

export type AdminSectionNavItem = {
  id: string;
  title: string;
  meta: string;
  body: string;
  icon: React.ReactNode;
  tone?: "default" | "todo" | "ok" | "warning";
};

export function AdminSectionNav({
  sections,
  activeSection,
  onSection,
}: {
  sections: AdminSectionNavItem[];
  activeSection: string;
  onSection: (section: string) => void;
}) {
  const active = sections.find((section) => section.id === activeSection) ?? sections[0];

  return (
    <div className="admin-section-shell">
      <nav className="admin-section-nav" aria-label="Navigazione FunniFin">
        {sections.map((section) => (
          <button
            key={section.id}
            className={`${activeSection === section.id ? "active" : ""} ${section.tone ? `tone-${section.tone}` : ""}`}
            onClick={() => onSection(section.id)}
            aria-current={activeSection === section.id ? "page" : undefined}
          >
            <span className="admin-section-nav-meta">{section.meta}</span>
            <span className="admin-section-nav-main">
              <i className="admin-section-nav-icon" aria-hidden="true">
                {section.icon}
              </i>
              <strong>{section.title}</strong>
            </span>
            <span className="admin-section-nav-copy">
              <em>{section.body}</em>
            </span>
          </button>
        ))}
      </nav>
      {active && (
        <div className="admin-section-summary" aria-live="polite">
          <strong>{active.title}</strong>
          <span>{active.body}</span>
        </div>
      )}
    </div>
  );
}
