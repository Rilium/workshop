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
import { topics } from "../../../data/catalog";
import type { ExpertProfile, Theme } from "../../../types/domain";
import { AppButton } from "../../../components/ui/AppButton";
import { ActionIconButton } from "../../../components/ui/IconButton";

export function ExpertProfileModal({
  expert,
  catalogThemeRows,
  onClose,
  onDelete,
  onChange,
  onSave,
  saving = false,
  deleting = false,
}: {
  expert: ExpertProfile;
  catalogThemeRows: Array<Theme & { topicId: string; topicTitle: string }>;
  onClose: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<ExpertProfile>) => void;
  onSave: () => void;
  saving?: boolean;
  deleting?: boolean;
}) {
  const fullName = `${expert.firstName} ${expert.lastName}`.trim();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="expert-profile-title">
      <section className="custom-modal expert-profile-modal">
        <header className="modal-header expert-profile-header">
          <div className="expert-modal-title">
            <div className="expert-avatar large">{expert.photo ? <img src={expert.photo} alt="" /> : `${expert.firstName[0] ?? ""}${expert.lastName[0] ?? ""}`}</div>
            <div>
              <span className="topic-badge">Pool esperti</span>
              <h2 id="expert-profile-title">Modifica profilo</h2>
              <em>{fullName || "Nuovo esperto"} · {expert.email}</em>
            </div>
          </div>
          <div className="row-actions compact-actions">
            <ActionIconButton variant="danger" onClick={onDelete} loading={deleting} disabled={saving || deleting} label="Elimina esperto">
              <Trash2 size={17} />
            </ActionIconButton>
            <button className="modal-close" onClick={onClose} aria-label="Chiudi">
              x
            </button>
          </div>
        </header>
        <div className="modal-body">
          <div className="modal-stack">
            <div className="contact-grid">
              <label>
                Nome
                <input value={expert.firstName} onChange={(event) => onChange({ firstName: event.target.value })} />
              </label>
              <label>
                Cognome
                <input value={expert.lastName} onChange={(event) => onChange({ lastName: event.target.value })} />
              </label>
              <label>
                Email utenza
                <input value={expert.email} onChange={(event) => onChange({ email: event.target.value })} />
              </label>
              <label>
                Foto URL
                <input value={expert.photo} onChange={(event) => onChange({ photo: event.target.value })} />
              </label>
              <label>
                Disponibilita
                <input value={expert.availability} onChange={(event) => onChange({ availability: event.target.value })} />
              </label>
              <label>
                Google Calendar ID
                <input
                  value={expert.calendarId ?? ""}
                  onChange={(event) => onChange({ calendarId: event.target.value })}
                  placeholder="nome@group.calendar.google.com"
                />
              </label>
            </div>
            <label className="full-field">
              Breve descrizione
              <textarea value={expert.bio} onChange={(event) => onChange({ bio: event.target.value })} />
            </label>
            <div className="expert-association-block">
              <strong>Interessi associati</strong>
              <div className="catalog-theme-chips">
                {topics.map((topic) => {
                  const active = expert.topicIds.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() => {
                        const topicThemeIds = topic.themes.map((theme) => theme.id);
                        onChange({
                          topicIds: active ? expert.topicIds.filter((id) => id !== topic.id) : [...expert.topicIds, topic.id],
                          themeIds: active
                            ? expert.themeIds.filter((id) => !topicThemeIds.includes(id))
                            : [...new Set([...expert.themeIds, ...topicThemeIds])],
                        });
                      }}
                    >
                      {topic.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="expert-association-block">
              <strong>Temi associati</strong>
              <div className="catalog-theme-chips">
                {catalogThemeRows.map((theme) => {
                  const active = expert.themeIds.includes(theme.id);
                  return (
                    <button
                      key={`${theme.topicId}-${theme.id}`}
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() =>
                        onChange({
                          themeIds: active ? expert.themeIds.filter((id) => id !== theme.id) : [...expert.themeIds, theme.id],
                        })
                      }
                    >
                      {theme.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose} disabled={saving || deleting}>
            Annulla
          </AppButton>
          <AppButton variant="primary" onClick={onSave} loading={saving} disabled={deleting}>
            Salva profilo
          </AppButton>
        </footer>
      </section>
    </div>
  );
}
