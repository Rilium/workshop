import React from "react";

export function AdminSectionNav({
  sections,
  activeSection,
  onSection,
}: {
  sections: Array<{ id: string; title: string; meta: string; body: string }>;
  activeSection: string;
  onSection: (section: string) => void;
}) {
  return (
    <nav className="admin-section-nav" aria-label="Navigazione FunniFin">
      {sections.map((section) => (
        <button key={section.id} className={activeSection === section.id ? "active" : ""} onClick={() => onSection(section.id)}>
          <span>{section.meta}</span>
          <strong>{section.title}</strong>
          <em>{section.body}</em>
        </button>
      ))}
    </nav>
  );
}
