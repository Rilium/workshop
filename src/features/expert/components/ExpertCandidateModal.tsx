import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  FolderKanban,
  InfoIcon,
  Menu,
  Megaphone,
  Palette,
  Presentation,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  UsersRound,
  Video,
  X,
} from "../../../components/ui/FaIcons";
import type { Selection, Workshop } from "../../../types/domain";
import { money } from "../../../utils/money";
import { getWorkshopSelectionPrice } from "../../../utils/workshop";
import { AppButton } from "../../../components/ui/AppButton";
import { Info } from "../../../components/ui/Info";

export function ExpertCandidateModal({
  row,
  company,
  sending,
  onClose,
  onConfirm,
}: {
  row: { selection: Selection; workshop: Workshop };
  company: string;
  sending: boolean;
  onClose: () => void;
  onConfirm: () => void;
  }) {
  const { selection, workshop } = row;
  const price = getWorkshopSelectionPrice(workshop, selection).total;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="expert-candidate-title">
      <section className="custom-modal expert-candidate-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">Candidatura esperto</span>
            <h2 id="expert-candidate-title">Confermi la candidatura?</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi" disabled={sending}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <div className="candidate-confirm-card">
            <span className="workshop-badge">{workshop.level}</span>
            <strong>{workshop.title}</strong>
            <p>{workshop.short}</p>
            <div className="opportunity-meta">
              <Info label="Cliente" value={company} />
              <Info label="Formato" value={`${selection.duration} · ${selection.format}`} />
              <Info label="Data proposta" value={`${selection.date || "da proporre"} ${selection.time}`} />
              <Info label="Valore" value={money(price)} />
            </div>
          </div>
          <div className="modal-points">
            <span>
              <Check size={16} />
              La candidatura viene registrata nella coda FunniFin.
            </span>
            <span>
              <Send size={16} />
              Ricevi una mail di conferma e FunniFin riceve l'avviso operativo.
            </span>
            <span>
              <CalendarCheck size={16} />
              Se il Calendar esperto e collegato, viene creato anche un blocco FunniFin.
            </span>
          </div>
          <div className="candidate-delivery-grid" aria-label="Destinatari candidatura">
            <div>
              <Send size={16} />
              <span>
                <strong>A te</strong>
                <small>Conferma candidatura e riepilogo workshop.</small>
              </span>
            </div>
            <div>
              <BadgeCheck size={16} />
              <span>
                <strong>A FunniFin</strong>
                <small>Alert per valutare e assegnare l'esperto.</small>
              </span>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose} disabled={sending}>
            Annulla
          </AppButton>
          <AppButton variant="secondary" onClick={onConfirm} loading={sending}>
            <Send size={17} /> {sending ? "Invio..." : "Conferma candidatura"}
          </AppButton>
        </footer>
      </section>
    </div>
  );
}
