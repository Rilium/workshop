import React, { useEffect, useState } from "react";
import { Plus, Trash2 } from "../../../components/ui/FaIcons";
import { AppButton } from "../../../components/ui/AppButton";
import type { CatalogBundle, Workshop } from "../../../types/domain";

export function BundleManager({
  bundles,
  workshops,
  saving,
  onSave,
}: {
  bundles: CatalogBundle[];
  workshops: Array<Pick<Workshop, "id" | "title">>;
  saving: boolean;
  onSave: (bundles: CatalogBundle[]) => void;
}) {
  const [drafts, setDrafts] = useState<CatalogBundle[]>(bundles);

  useEffect(() => setDrafts(bundles), [bundles]);

  const updateBundle = (id: string, patch: Partial<CatalogBundle>) => {
    setDrafts((current) => current.map((bundle) => (bundle.id === id ? { ...bundle, ...patch } : bundle)));
  };

  return (
    <section className="bundle-manager" aria-label="Gestione bundle catalogo">
      <div className="bundle-manager-head">
        <div>
          <span className="eyebrow">Bundle catalogo</span>
          <strong>Composizione e priorità</strong>
          <small>L’ordine guida la survey; il prezzo si applica solo alla composizione ufficiale completa.</small>
        </div>
        <AppButton
          variant="secondary"
          onClick={() => {
            const id = `bundle-${Date.now()}`;
            setDrafts((current) => [...current, { id, title: "Nuovo bundle", size: 3, workshopIds: ["", "", ""], active: true }]);
          }}
        >
          <Plus size={16} /> Nuovo bundle
        </AppButton>
      </div>

      <div className="bundle-admin-grid">
        {drafts.map((bundle) => (
          <article className="bundle-admin-card" key={bundle.id}>
            <div className="bundle-admin-fields">
              <label>
                Nome
                <input value={bundle.title} onChange={(event) => updateBundle(bundle.id, { title: event.target.value })} />
              </label>
              <label>
                Dimensione
                <select
                  value={bundle.size}
                  onChange={(event) => {
                    const size = Number(event.target.value) as 3 | 6 | 10;
                    updateBundle(bundle.id, {
                      size,
                      workshopIds: Array.from({ length: size }, (_, index) => bundle.workshopIds[index] || ""),
                    });
                  }}
                >
                  <option value={3}>3 workshop</option>
                  <option value={6}>6 workshop</option>
                  <option value={10}>10 workshop</option>
                </select>
              </label>
              <label className="bundle-active-toggle">
                <input type="checkbox" checked={bundle.active} onChange={(event) => updateBundle(bundle.id, { active: event.target.checked })} />
                Attivo
              </label>
            </div>
            <div className="bundle-member-list">
              {Array.from({ length: bundle.size }, (_, index) => (
                <label key={`${bundle.id}-${index}`}>
                  <span>{index + 1}</span>
                  <select
                    value={bundle.workshopIds[index] || ""}
                    onChange={(event) => {
                      const workshopIds = [...bundle.workshopIds];
                      workshopIds[index] = event.target.value;
                      updateBundle(bundle.id, { workshopIds });
                    }}
                  >
                    <option value="">Scegli workshop</option>
                    {workshops.map((workshop) => (
                      <option key={workshop.id} value={workshop.id}>{workshop.title}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
            <button
              type="button"
              className="bundle-delete"
              onClick={() => setDrafts((current) => current.filter((item) => item.id !== bundle.id))}
              aria-label={`Elimina ${bundle.title}`}
            >
              <Trash2 size={16} /> Elimina bundle
            </button>
          </article>
        ))}
      </div>
      <AppButton
        variant="primary"
        loading={saving}
        disabled={drafts.some((bundle) => !bundle.title.trim() || bundle.workshopIds.length !== bundle.size || bundle.workshopIds.some((id) => !id))}
        onClick={() => onSave(drafts)}
      >
        Salva bundle
      </AppButton>
    </section>
  );
}
