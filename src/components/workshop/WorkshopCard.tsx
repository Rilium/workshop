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
} from "lucide-react";
import { topics } from "../../data/catalog";
import type { Duration, Format, Selection, Workshop } from "../../types/domain";
import { money } from "../../utils/money";
import { AppButton } from "../ui/AppButton";

export function WorkshopCard({
  workshop,
  selection,
  onToggle,
  onChange,
  onCustomRequest,
  onCustomInfo,
}: {
  workshop: Workshop;
  selection?: Selection;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChange: (patch: Partial<Selection>) => void;
  onCustomRequest: () => void;
  onCustomInfo: () => void;
}) {
  const selectedPrice = selection?.duration === "2h" ? workshop.price2h : workshop.price1h;
  const topic = topics.find((item) => item.id === workshop.topicId);
  const theme = topic?.themes.find((item) => item.id === workshop.themeId);
  return (
    <article className={`workshop-card ${selection ? "selected" : ""}`}>
      <div className="workshop-card-top">
        <span>{topic?.title} · {theme?.title}</span>
      </div>
      <div className="workshop-head">
        <div>
          <strong>{workshop.title}</strong>
        </div>
      </div>
      <p>{workshop.short}</p>
      <div className="meta-grid">
        <span>
          <Clock3 size={15} /> {workshop.durationOptions.join(" / ")}
        </span>
        <span>
          <Video size={15} /> {workshop.formatOptions.join(" / ")} · {workshop.level.toUpperCase()}
        </span>
        <span>
          <UsersRound size={15} /> {workshop.participants}
        </span>
      </div>
      {selection && (
        <div className="config-row">
          <select value={selection.duration} onChange={(event) => onChange({ duration: event.target.value as Duration })}>
            {workshop.durationOptions.map((duration) => (
              <option key={duration}>{duration}</option>
            ))}
          </select>
          <select value={selection.format} onChange={(event) => onChange({ format: event.target.value as Format })}>
            {workshop.formatOptions.map((format) => (
              <option key={format}>{format}</option>
            ))}
          </select>
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
                <em>+{money(workshop.customExtra)}</em>
              </button>
              <p>Adattiamo esempi, tono e casi pratici al pubblico aziendale.</p>
              {selection.customNote && <small>{selection.customNote}</small>}
              <button type="button" className="icon-help" onClick={onCustomInfo} aria-label="Spiega su misura">
                <InfoIcon size={16} />
              </button>
            </div>
          )}
        </div>
      )}
      <div className="card-footer">
        <strong>{money(selectedPrice || workshop.price1h)}</strong>
        <AppButton variant={selection ? "dangerIcon" : "secondary"} onClick={onToggle} aria-label={selection ? `Rimuovi ${workshop.title}` : `Aggiungi ${workshop.title} al percorso`}>
          {selection ? <Trash2 size={18} /> : "Aggiungi al percorso"}
        </AppButton>
      </div>
    </article>
  );
}
