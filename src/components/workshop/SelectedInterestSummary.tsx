import React from "react";
import { X } from "lucide-react";
import type { Topic } from "../../types/domain";
import { topicColorClass } from "../../utils/workshop";

export function SelectedInterestSummary({
  topics,
  activeThemeIds,
  onRemoveTopic,
  onRemoveTheme,
  context = "default",
}: {
  topics: Topic[];
  activeThemeIds: string[];
  onRemoveTopic: (topicId: string) => void;
  onRemoveTheme: (themeId: string) => void;
  context?: "default" | "filters";
}) {
  const title = context === "filters" ? "Interessi scelti" : "Percorso scelto";

  if (topics.length === 0) {
    return <p className="empty-selection">Seleziona uno o piu interessi per filtrare temi e workshop.</p>;
  }

  return (
    <section className={`selected-interests ${context === "filters" ? "in-filter-panel" : ""}`} aria-label={title}>
      <div className="selected-interests-head">
        <strong>{title}</strong>
        <span>{topics.length} interessi · {activeThemeIds.length} temi</span>
      </div>
      {topics.map((topic) => (
        <article key={topic.id} className={`selected-interest-card ${topicColorClass(topic.id)}`}>
          <div className="selected-interest-title">
            <span className="topic-badge">{topic.badge}</span>
            <strong>{topic.title}</strong>
            <button onClick={() => onRemoveTopic(topic.id)} aria-label={`Rimuovi ${topic.title}`}>
              <X size={16} />
            </button>
          </div>
          <div className="selected-interest-themes">
            {topic.themes.filter((theme) => activeThemeIds.includes(theme.id)).map((theme) => (
              <span key={theme.id}>
                {theme.title}
                <button onClick={() => onRemoveTheme(theme.id)} aria-label={`Rimuovi ${theme.title}`}>
                  <X size={13} />
                </button>
              </span>
            ))}
            {topic.themes.every((theme) => !activeThemeIds.includes(theme.id)) && <em>Nessun tema attivo</em>}
          </div>
        </article>
      ))}
    </section>
  );
}
