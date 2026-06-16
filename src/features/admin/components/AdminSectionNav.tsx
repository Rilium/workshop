import React from "react";

export function AdminSectionNav({
  sections,
  activeSection,
  onSection,
}: {
  sections: Array<{ id: string; title: string; meta: string; body: string; icon: React.ReactNode }>;
  activeSection: string;
  onSection: (section: string) => void;
}) {
  return (
    <nav className="admin-section-nav" aria-label="Navigazione FunniFin">
      {sections.map((section) => (
        <button
          key={section.id}
          className={activeSection === section.id ? "active" : ""}
          onClick={() => onSection(section.id)}
          aria-current={activeSection === section.id ? "page" : undefined}
        >
          <span>{section.meta}</span>
          <div className="admin-section-nav-title">
            <i className="admin-section-nav-icon" aria-hidden="true">
              {section.icon}
            </i>
            <strong>{section.title}</strong>
          </div>
          <em>{section.body}</em>
        </button>
      ))}
    </nav>
  );
}
