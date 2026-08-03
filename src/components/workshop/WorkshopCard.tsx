import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  ChevronDown,
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
  Video,
  X,
} from "../../components/ui/FaIcons";
import type { CatalogBundle, CommercialConfig, Duration, Format, Selection, Topic, Workshop } from "../../types/domain";
import { money } from "../../utils/money";
import { getWorkshopSelectionPrice, topicColorClass } from "../../utils/workshop";
import { AppButton } from "../ui/AppButton";
import { ExpandableCardText } from "../ui/ExpandableCardText";

export function WorkshopCard({
  workshop,
  selection,
  onToggle,
  onChange,
  onCustomRequest,
  onCustomInfo,
  topics,
  commercialConfig,
  bundleMemberships = [],
  onOpenBundle,
}: {
  workshop: Workshop;
  selection?: Selection;
  topics: Topic[];
  commercialConfig: CommercialConfig;
  bundleMemberships?: CatalogBundle[];
  onOpenBundle?: (bundle: CatalogBundle) => void;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChange: (patch: Partial<Selection>) => void;
  onCustomRequest: () => void;
  onCustomInfo: () => void;
}) {
  const selectedPrice = selection ? getWorkshopSelectionPrice(workshop, selection, commercialConfig).total : workshop.price1h;
  const topic = topics.find((item) => (workshop.topicIds?.length ? workshop.topicIds : [workshop.topicId]).includes(item.id));
  const selectedBundle = selection?.bundleId ? bundleMemberships.find((bundle) => bundle.id === selection.bundleId) : undefined;
  const includedViaBundle = Boolean(selection?.bundleId);
  return (
    <article className={`workshop-card ${selection ? "selected" : ""}`} data-workshop-id={workshop.id}>
      <div className="workshop-card-top">
        {topic && <span className={`topic-outline-badge ${topicColorClass(topic.id)}`}>{topic.title}</span>}
      </div>
      <div className="workshop-head">
        <div>
          <strong>{workshop.title}</strong>
        </div>
      </div>
      <ExpandableCardText text={workshop.short} />
      {selectedBundle ? (
        <button type="button" className="workshop-bundle-state" onClick={() => onOpenBundle?.(selectedBundle)}>
          <Check size={15} />
          <span>
            <small>Incluso nel pacchetto</small>
            <strong>{selectedBundle.title}</strong>
          </span>
        </button>
      ) : bundleMemberships.length > 0 && (
        <div className="workshop-bundle-links" aria-label="Pacchetti che includono questo workshop">
          <details className="workshop-bundle-disclosure">
            <summary>
              <span>
                <BookOpen size={15} aria-hidden="true" />
                {bundleMemberships.length === 1 ? "Disponibile in un pacchetto" : "Disponibile nei pacchetti"}
                {bundleMemberships.length > 1 && <em>{bundleMemberships.length}</em>}
              </span>
              <ChevronDown size={16} aria-hidden="true" />
            </summary>
            <div className="workshop-bundle-disclosure-content">
              <div>
                {bundleMemberships.map((bundle) => (
                  <button type="button" key={bundle.id} onClick={() => onOpenBundle?.(bundle)}>
                    {bundle.title}
                  </button>
                ))}
              </div>
            </div>
          </details>
        </div>
      )}
      <div className="meta-grid">
        <span title={selection?.duration ?? workshop.durationOptions.join(" / ")}>
          <Clock3 size={15} />
          <span className="meta-label">{selection?.duration ?? workshop.durationOptions.join(" / ")}</span>
        </span>
        <span title={selection ? (selection.format === "live" ? "In presenza" : "Online") : "Online / In presenza"}>
          <Video size={15} />
          <span className="meta-label">{selection ? (selection.format === "live" ? "In presenza" : "Online") : "Online / In presenza"}</span>
        </span>
      </div>
      {selection && (
        <details className="workshop-config-disclosure">
          <summary>
            <span><SlidersHorizontal size={16} /> Personalizza dettagli</span>
            <ChevronDown size={16} />
          </summary>
          <div className="config-row">
          <select value={selection.duration} onChange={(event) => onChange({ duration: event.target.value as Duration })}>
            {workshop.durationOptions.map((duration) => (
              <option key={duration}>{duration}</option>
            ))}
          </select>
          <select value={selection.format} onChange={(event) => onChange({ format: event.target.value as Format })}>
            <option value="webinar">Online</option>
            <option value="live">In presenza</option>
          </select>
          <div className="selection-detail-row">
            <span>Livello {workshop.level.toUpperCase()}</span>
            {workshop.participants && workshop.participants.toLowerCase() !== "da definire" && <span>{workshop.participants}</span>}
          </div>
          {workshop.customAvailable && (
            <div className={`custom-preview-toggle ${selection.custom ? "active" : ""}`}>
              <button
                type="button"
                className="custom-check-button"
                onClick={() => {
                  if (selection.custom) onChange({ custom: false, customNote: "" });
                  else onCustomRequest();
                }}
                aria-pressed={selection.custom}
              >
                <span>{selection.custom ? <Check size={16} /> : <Plus size={16} />}</span>
                <strong>Rendi su misura</strong>
                <em>+{money(commercialConfig.customExtra)}</em>
              </button>
              <p>Adattiamo esempi, tono e casi pratici al pubblico aziendale.</p>
              {selection.customNote && <small>{selection.customNote}</small>}
              <button type="button" className="icon-help" onClick={onCustomInfo} aria-label="Spiega su misura">
                <InfoIcon size={16} />
              </button>
            </div>
          )}
          <label className="recording-toggle">
            <input
              type="checkbox"
              checked={selection.recordingIncluded !== false}
              onChange={(event) => onChange({ recordingIncluded: event.target.checked })}
            />
            <span>
              <strong>Possibilità di registrazione</strong>
              <small>
                {selection.recordingIncluded === false
                  ? `Esclusa: -${money(commercialConfig.recordingOptOutDiscount)}`
                  : "Inclusa nel prezzo"}
              </small>
              </span>
          </label>
          </div>
        </details>
      )}
      {includedViaBundle ? (
        <div className="card-footer workshop-bundle-footer">
          <span className="bundle-included-price">
            <Check size={16} />
            <span>
              <strong>Compreso nel pacchetto</strong>
              <small>Eventuali extra aggiornano il preventivo</small>
            </span>
          </span>
          {selectedBundle && (
            <AppButton variant="outline" onClick={() => onOpenBundle?.(selectedBundle)}>
              Vedi pacchetto
            </AppButton>
          )}
        </div>
      ) : (
        <div className="card-footer">
          <strong>{money(selectedPrice || workshop.price1h)}</strong>
          <div className="card-footer-actions">
            {selection ? (
              <>
              <span className="workshop-selected-status"><Check size={15} /> Nel percorso</span>
              <button type="button" className="card-remove-action" onClick={onToggle} aria-label={`Rimuovi ${workshop.title}`} title="Rimuovi dal percorso">
                <Trash2 size={15} />
              </button>
              </>
            ) : (
              <AppButton variant="secondary" onClick={onToggle} aria-label={`Aggiungi ${workshop.title} al percorso`}>
                Aggiungi al percorso
              </AppButton>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
