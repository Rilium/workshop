import React from "react";
import { topicColorClass } from "../../../utils/workshop";
import { AppButton } from "../../../components/ui/AppButton";

export function CatalogEditModal({
  topic,
  draft,
  onChange,
  onReset,
  onSave,
  onClose,
  workshopCount,
  saving = false,
}: {
  topic: { id: string; title: string; description: string; badge: string; active: boolean };
  draft: { title: string; description: string; badge: string; active: boolean };
  onChange: (patch: Partial<{ title: string; description: string; badge: string; active: boolean }>) => void;
  onReset: () => void;
  onSave: () => void;
  onClose: () => void;
  workshopCount: number;
  saving?: boolean;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="catalog-edit-title">
      <section className="custom-modal catalog-edit-modal">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Catalogo</span>
            <h2 id="catalog-edit-title">Modifica topic</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body catalog-modal-body">
          <div className="catalog-modal-summary">
            <span className={`color-dot ${topicColorClass(topic.id)}`} />
            <strong>{draft.title}</strong>
            <em>{workshopCount} workshop collegati</em>
          </div>
          <label>
            Nome topic
            <input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} />
          </label>
          <label>
            Descrizione
            <textarea value={draft.description} onChange={(event) => onChange({ description: event.target.value })} />
          </label>
          <label>
            Evidenza commerciale
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
          <AppButton variant="ghost" onClick={onReset} disabled={saving}>
            Ripristina
          </AppButton>
          <AppButton variant="primary" onClick={onSave} loading={saving}>
            Salva modifiche
          </AppButton>
        </footer>
      </section>
    </div>
  );
}
