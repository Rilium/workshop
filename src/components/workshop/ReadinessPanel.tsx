import React from "react";
import { Check, Clock3 } from "../../components/ui/FaIcons";
import type { Selection, Workshop } from "../../types/domain";

export function ReadinessPanel({
  rows,
  missingDateRows,
  datesDeferred = false,
}: {
  rows: Array<{ selection: Selection; workshop: Workshop }>;
  missingDateRows: Array<{ selection: Selection; workshop: Workshop }>;
  datesDeferred?: boolean;
}) {
  const checks = [
    { label: "Percorso configurato", done: rows.length > 0, detail: rows.length ? `${rows.length} workshop` : "Aggiungi almeno un workshop" },
    {
      label: "Date proposte",
      done: rows.length > 0 && (datesDeferred || missingDateRows.length === 0),
      detail: datesDeferred ? "Da concordare in seguito" : missingDateRows.length ? `${missingDateRows.length} mancanti` : "Tutte compilate",
    },
    { label: "Preventivo", done: rows.length > 0, detail: rows.length ? "Totale calcolato" : "Non disponibile" },
  ];

  return (
    <section className="readiness-panel" aria-label="Checklist invio richiesta">
      {checks.map((check) => (
        <div className={check.done ? "done" : ""} key={check.label}>
          <span className="readiness-check-icon" aria-hidden="true">
            {check.done ? <Check size={18} /> : <Clock3 size={18} />}
          </span>
          <span>
            <strong>{check.label}</strong>
            <em>{check.detail}</em>
          </span>
        </div>
      ))}
    </section>
  );
}
