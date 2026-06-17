import React from "react";
import { CalendarCheck, FolderKanban, Presentation, Video } from "lucide-react";
import type { CalendarEventRecord } from "../../types/domain";
import { EventLink } from "../ui/EventLink";
import { Info } from "../ui/Info";

export type WorkshopSessionItem = {
  id: string;
  title: string;
  date: string;
  time: string;
  duration: "1h" | "2h";
  format: "live" | "webinar" | "ibrido";
  expertName?: string;
};

export function WorkshopSessionView({
  title,
  subtitle,
  items,
  event,
  deckTitle,
  deckUrl,
  driveFolderUrl,
  statusLabel,
  emptyLabel = "Nessuna call attiva",
}: {
  title: string;
  subtitle: string;
  items: WorkshopSessionItem[];
  event?: CalendarEventRecord;
  deckTitle?: string;
  deckUrl?: string;
  driveFolderUrl?: string;
  statusLabel: string;
  emptyLabel?: string;
}) {
  const firstItem = items[0];
  const hasItems = items.length > 0;

  return (
    <section className="workshop-session-view" aria-label={title}>
      <div className="workshop-session-head">
        <div>
          <span className="eyebrow">{statusLabel}</span>
          <strong>{title}</strong>
          <span>{subtitle}</span>
        </div>
        <div className="workshop-session-actions">
          {event?.meetLink && <EventLink href={event.meetLink} label="Apri Meet" />}
          {event?.htmlLink && <EventLink href={event.htmlLink} label="Apri Calendar" />}
          {deckUrl && <EventLink href={deckUrl} label="Apri presentazione" />}
          {driveFolderUrl && <EventLink href={driveFolderUrl} label="Apri Drive" />}
        </div>
      </div>

      <div className="workshop-session-meta">
        <Info label="Evento" value={event ? event.id : "da creare"} />
        <Info label="Deck Calendar" value={deckTitle || "non abilitato"} />
        <Info label="Workshop" value={String(items.length)} />
        <Info label="Durata" value={firstItem ? `${firstItem.duration} · ${firstItem.format}` : "da definire"} />
      </div>

      {hasItems ? (
        <div className="workshop-session-list">
          {items.map((item) => (
            <article key={item.id} className="workshop-session-row">
              <div>
                <strong>{item.title}</strong>
                <span>
                  {item.date || "data da definire"} · {item.time || "orario da definire"} · {item.duration} · {item.format}
                </span>
              </div>
              <em>{item.expertName || "esperto da confermare"}</em>
            </article>
          ))}
        </div>
      ) : (
        <div className="workshop-session-empty">
          <Video size={18} />
          <strong>{emptyLabel}</strong>
          <span>Qui appaiono call, presentazione e materiali collegati alla sessione.</span>
        </div>
      )}

      <div className="workshop-session-footer">
        {deckTitle && deckUrl ? (
          <div className="workshop-session-deck">
            <Presentation size={18} />
            <div>
              <strong>{deckTitle}</strong>
              <span>Presentazione del workshop abilitata per il calendario finale.</span>
            </div>
          </div>
        ) : (
          <div className="workshop-session-deck muted">
            <FolderKanban size={18} />
            <div>
              <strong>Presentazione non ancora abilitata</strong>
              <span>Il deck entra qui quando Brand lo abilita per il calendario finale.</span>
            </div>
          </div>
        )}
        {event && event.workshops > 0 && (
          <span className="catalog-status active">
            <CalendarCheck size={16} />
            {event.mode === "confirmed" ? "Sessione confermata" : "Sessione provvisoria"}
          </span>
        )}
      </div>
    </section>
  );
}
