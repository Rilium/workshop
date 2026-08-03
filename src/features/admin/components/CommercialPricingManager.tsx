import { useEffect, useState } from "react";
import { Check, CircleDollarSign } from "../../../components/ui/FaIcons";
import { AppButton } from "../../../components/ui/AppButton";
import type { CommercialConfig } from "../../../types/domain";

export function CommercialPricingManager({
  config,
  saving,
  onSave,
}: {
  config: CommercialConfig;
  saving: boolean;
  onSave: (config: CommercialConfig) => void;
}) {
  const [draft, setDraft] = useState(config);

  useEffect(() => setDraft(config), [config]);

  const setNumber = (key: "workshopBasePrice" | "inPersonExtra" | "customExtra" | "recordingOptOutDiscount", value: number) => {
    setDraft((current) => ({ ...current, [key]: Math.max(0, value || 0) }));
  };

  return (
    <section className="commercial-pricing-manager" aria-label="Gestione centralizzata prezzi">
      <div className="commercial-pricing-head">
        <div>
          <span className="eyebrow">Listino centralizzato</span>
          <strong>Fasce prezzo ed extra</strong>
          <small>Questi valori aggiornano catalogo, pacchetti, survey e preventivo cliente.</small>
        </div>
        <CircleDollarSign size={28} />
      </div>

      <div className="commercial-pricing-grid">
        <label>
          Workshop singolo
          <span><input type="number" min={0} step={100} value={draft.workshopBasePrice} onChange={(event) => setNumber("workshopBasePrice", Number(event.target.value))} /> €</span>
        </label>
        {([3, 6, 10] as const).map((size) => (
          <label key={size}>
            Pacchetto da {size}
            <span>
              <input
                type="number"
                min={0}
                step={100}
                value={draft.bundlePrices[size]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    bundlePrices: { ...current.bundlePrices, [size]: Math.max(0, Number(event.target.value) || 0) },
                  }))
                }
              /> €
            </span>
          </label>
        ))}
        <label>
          Extra in presenza
          <span><input type="number" min={0} step={50} value={draft.inPersonExtra} onChange={(event) => setNumber("inPersonExtra", Number(event.target.value))} /> €</span>
        </label>
        <label>
          Extra personalizzazione
          <span><input type="number" min={0} step={50} value={draft.customExtra} onChange={(event) => setNumber("customExtra", Number(event.target.value))} /> €</span>
        </label>
        <label>
          Riduzione senza registrazione
          <span><input type="number" min={0} step={50} value={draft.recordingOptOutDiscount} onChange={(event) => setNumber("recordingOptOutDiscount", Number(event.target.value))} /> €</span>
        </label>
        <label className="commercial-recording-default">
          <input
            type="checkbox"
            checked={draft.recordingDefault}
            onChange={(event) => setDraft((current) => ({ ...current, recordingDefault: event.target.checked }))}
          />
          Registrazione inclusa di default
        </label>
      </div>

      <AppButton variant="primary" loading={saving} onClick={() => onSave(draft)}>
        <Check size={16} /> Salva listino
      </AppButton>
    </section>
  );
}
