import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Topic } from "../../../types/domain";
import { workshops } from "../../../data/catalog";
import { topicColorClass } from "../../../utils/workshop";
import { AppButton } from "../../../components/ui/AppButton";

export function CatalogEditModal({
  topic,
  draft,
  onChange,
  onReset,
  onSave,
  onClose,
}: {
  topic: Topic;
  draft: { title: string; description: string; badge: string; active: boolean };
  onChange: (patch: Partial<{ title: string; description: string; badge: string; active: boolean }>) => void;
  onReset: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="catalog-edit-title">
      <section className="custom-modal catalog-edit-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">Catalogo</span>
            <h2 id="catalog-edit-title">Modifica ambito</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body catalog-modal-body">
          <div className="catalog-modal-summary">
            <span className={`color-dot ${topicColorClass(topic.id)}`} />
            <strong>{draft.title}</strong>
            <em>{draft.badge} · {topic.themes.length} temi · {workshops.filter((workshop) => workshop.topicId === topic.id).length} workshop</em>
          </div>
          <label>
            Titolo catalogo
            <input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} />
          </label>
          <label>
            Descrizione
            <textarea value={draft.description} onChange={(event) => onChange({ description: event.target.value })} />
          </label>
          <label>
            Badge commerciale
            <select value={draft.badge} onChange={(event) => onChange({ badge: event.target.value })}>
              <option value="base">base</option>
              <option value="popolare">popolare</option>
              <option value="consigliato">consigliato</option>
              <option value="speciale">speciale</option>
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={draft.active} onChange={(event) => onChange({ active: event.target.checked })} />
            Visibile nel catalogo cliente
          </label>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onReset}>
            Ripristina
          </AppButton>
          <AppButton variant="primary" onClick={onSave}>
            Salva modifiche
          </AppButton>
        </footer>
      </section>
    </div>
  );
}
