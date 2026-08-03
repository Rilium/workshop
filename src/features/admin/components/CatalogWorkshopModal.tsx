import React, { useState } from "react";
import { Archive, Check, X } from "../../../components/ui/FaIcons";
import { AppButton } from "../../../components/ui/AppButton";
import type { CatalogWorkshopConfig } from "../../../googleAdminService";
import type { Duration } from "../../../types/domain";

export function CatalogWorkshopModal({
  workshop,
  topics,
  saving,
  onClose,
  onSave,
}: {
  workshop: CatalogWorkshopConfig;
  topics: Array<{ id: string; title: string }>;
  saving: boolean;
  onClose: () => void;
  onSave: (workshop: CatalogWorkshopConfig) => void;
}) {
  const [draft, setDraft] = useState(workshop);
  const topicIds = draft.topicIds?.length ? draft.topicIds : [draft.topicId].filter(Boolean);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="catalog-workshop-title">
      <section className="modal-card catalog-workshop-modal">
        <header className="modal-header">
          <div>
            <span className="eyebrow">Catalogo workshop</span>
            <h2 id="catalog-workshop-title">{draft.id ? "Modifica workshop" : "Nuovo workshop"}</h2>
          </div>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Chiudi"><X size={18} /></button>
        </header>
        <div className="modal-body catalog-workshop-form">
          <label>
            Titolo
            <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} />
          </label>
          <label>
            Descrizione
            <textarea value={draft.long} onChange={(event) => setDraft({ ...draft, long: event.target.value, short: event.target.value })} rows={5} />
          </label>
          <fieldset>
            <legend>Topic</legend>
            <div className="catalog-topic-checkboxes">
              {topics.map((topic) => (
                <label key={topic.id}>
                  <input
                    type="checkbox"
                    checked={topicIds.includes(topic.id)}
                    onChange={(event) => {
                      const next = event.target.checked ? [...topicIds, topic.id] : topicIds.filter((id) => id !== topic.id);
                      setDraft({ ...draft, topicIds: next, topicId: next[0] || "" });
                    }}
                  />
                  {topic.title}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Durata disponibile</legend>
            <div className="catalog-topic-checkboxes">
              {(["1h", "1.5h", "2h"] as Duration[]).map((duration) => (
                <label key={duration}>
                  <input
                    type="checkbox"
                    checked={draft.durationOptions.includes(duration)}
                    onChange={(event) => {
                      const next = event.target.checked
                        ? [...draft.durationOptions, duration]
                        : draft.durationOptions.filter((item) => item !== duration);
                      setDraft({ ...draft, durationOptions: next, durationLabel: next.join(" / ") });
                    }}
                  />
                  {duration}
                </label>
              ))}
            </div>
          </fieldset>
          <div className="catalog-workshop-form-grid">
            <div className="catalog-central-price-note">
              <strong>Prezzo centralizzato</strong>
              <span>Modificabile dalla sezione “Prezzi”.</span>
            </div>
            <label>
              Stato produzione
              <select
                value={draft.productionStatus || "published"}
                onChange={(event) => setDraft({
                  ...draft,
                  productionStatus: event.target.value === "draft" ? "draft" : "published",
                  state: event.target.value === "draft" ? "da aggiornare" : "attivo",
                })}
              >
                <option value="published">Pubblicato</option>
                <option value="draft">Da produrre</option>
              </select>
            </label>
            <label className="bundle-active-toggle">
              <input type="checkbox" checked={draft.customAvailable} onChange={(event) => setDraft({ ...draft, customAvailable: event.target.checked })} />
              Personalizzabile
            </label>
          </div>
          <label>
            Note interne
            <textarea value={draft.adminNotes || ""} onChange={(event) => setDraft({ ...draft, adminNotes: event.target.value })} rows={3} />
          </label>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={() => onSave({ ...draft, active: false, state: "nascosto" })}>
            <Archive size={16} /> Archivia
          </AppButton>
          <AppButton
            variant="primary"
            loading={saving}
            disabled={!draft.title.trim() || topicIds.length === 0 || draft.durationOptions.length === 0}
            onClick={() => onSave({ ...draft, id: draft.id || `ws-${Date.now()}`, active: true })}
          >
            <Check size={16} /> Salva workshop
          </AppButton>
        </footer>
      </section>
    </div>
  );
}
