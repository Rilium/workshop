import React, { useEffect, useMemo, useRef, useState } from "react";
import type { Workshop } from "../../../types/domain";
import { money } from "../../../utils/money";
import { AppButton } from "../../../components/ui/AppButton";
import { Info } from "../../../components/ui/Info";

export function CustomModal({ workshop, onClose }: { workshop: Workshop; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="custom-title">
      <section className="custom-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">Su misura +{money(workshop.customExtra)}</span>
            <h2 id="custom-title">Cosa significa rendere questo workshop su misura</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body">
          <p>
            Non e una semplice modifica alle slide. Ci sediamo con il cliente, raccogliamo obiettivi, platea, vincoli e linguaggio aziendale, poi coinvolgiamo i nostri migliori esperti per confezionare un'iniziativa davvero adatta al contesto.
          </p>
          <div className="modal-points">
            <Info label="Workshop" value={workshop.title} />
            <Info label="Sessione di co-design" value="Allineamento con HR/manager e obiettivi formativi" />
            <Info label="Esperti FunniFin" value="Scelta esempi, casi pratici e focus piu rilevanti" />
            <Info label="Output" value="Scaletta, deck adattato, note per speaker e proposta finale" />
          </div>
        </div>
        <footer className="modal-footer">
          <AppButton variant="primary" className="full" onClick={onClose}>
            Ok, ho capito
          </AppButton>
        </footer>
      </section>
    </div>
  );
}

export function CustomRequestModal({
  workshop,
  initialNote,
  onClose,
  onSave,
}: {
  workshop: Workshop;
  initialNote: string;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(initialNote);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="custom-request-title">
      <section className="custom-modal custom-request-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">Su misura +{money(workshop.customExtra)}</span>
            <h2 id="custom-request-title">Note per adattare il workshop</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body">
          <div className="custom-note-context">
            <strong>{workshop.title}</strong>
            <span>Scrivi cosa va adattato: platea, esempi, tono, casi aziendali, obiettivi HR o vincoli da rispettare.</span>
          </div>
          <label>
            Note su misura
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Es. pubblico junior, esempi su benefit aziendali, tono molto pratico, focus su famiglie..."
              autoFocus
            />
          </label>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose}>
            Annulla
          </AppButton>
          <AppButton variant="primary" onClick={() => onSave(note.trim())}>
            Salva note
          </AppButton>
        </footer>
      </section>
    </div>
  );
}
