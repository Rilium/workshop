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
import { getWorkshopAvailability } from "../../../googleCalendarService";
import { workshops } from "../../../data/catalog";
import type { Selection, Workshop } from "../../../types/domain";
import { Skeleton } from "../../../components/ui/Skeleton";

export function DatePickerModal({
  selection,
  selections,
  workshop,
  onClose,
  onConfirm,
}: {
  selection: Selection;
  selections: Selection[];
  workshop: Workshop;
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
}) {
  const [mode, setMode] = useState<"now" | "plan">("plan");
  const [day, setDay] = useState(selection.date || "2026-06-12");
  const [time, setTime] = useState(selection.time || "18:00");
  const [availability, setAvailability] = useState<{ source: string; slots: Array<{ time: string; status: "available" | "busy" | "promo" }> }>({
    source: "mock",
    slots: [],
  });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const days = Array.from({ length: 30 }, (_, index) => index + 1);
  const todayDate = "2026-06-12";
  const dayNumber = Number(day.split("-")[2] || "12");
  const formattedDay = `2026-06-${String(dayNumber).padStart(2, "0")}`;
  const scheduledSelections = selections
    .filter((item) => item.dateConfirmed && item.date && item.time)
    .map((item) => ({ ...item, workshop: workshops.find((workshopItem) => workshopItem.id === item.workshopId) }))
    .filter((item) => item.workshop);
  const scheduledDays = new Set(scheduledSelections.map((item) => Number(item.date.split("-")[2])));
  const scheduledTimesForDay = new Set(scheduledSelections.filter((item) => item.date === formattedDay).map((item) => item.time));
  const currentAlreadyScheduled = Boolean(selection.dateConfirmed && selection.date && selection.time);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    getWorkshopAvailability({ date: formattedDay, duration: selection.duration, format: selection.format, expertIds: workshop.experts })
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formattedDay, selection.duration, selection.format, workshop.experts]);

  useEffect(() => {
    if (mode !== "now" || formattedDay !== todayDate || loadingSlots) return;
    const immediateSlot = availability.slots.find((slot) => slot.status !== "busy");
    if (immediateSlot && immediateSlot.time !== time) setTime(immediateSlot.time);
  }, [availability.slots, formattedDay, loadingSlots, mode, time]);

  const chooseNow = () => {
    setMode("now");
    setDay(todayDate);
    const immediateSlot = availability.slots.find((slot) => slot.status !== "busy");
    if (immediateSlot) setTime(immediateSlot.time);
  };

  return (
    <div className="modal-backdrop calendar-backdrop" role="dialog" aria-modal="true" aria-labelledby="date-title">
      <section className="calendar-modal">
        <header className="modal-header calendar-header">
          <div>
            <span className="calendar-kicker">Scegli data e orario</span>
            <h2 id="date-title">{workshop.title}</h2>
            <p>Proponi una data. FunniFin verifichera la disponibilita prima della conferma.</p>
          </div>
          <button className="modal-close calendar-close" onClick={onClose} aria-label="Chiudi calendario">
            x
          </button>
        </header>

        <div className="modal-body calendar-body">
          <div className="calendar-mode">
            <button className={mode === "now" ? "active" : ""} onClick={chooseNow}>Adesso</button>
            <button className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")}>Pianifica</button>
          </div>
          {mode === "now" && (
            <div className="now-banner">
              <Clock3 size={18} />
              <span>Adesso seleziona oggi e propone il primo orario libero.</span>
            </div>
          )}

          <div className="calendar-layout">
            <div className="month-card">
              <div className="month-head">
                <button aria-label="Mese precedente">‹</button>
                <strong>Giugno 2026</strong>
                <button aria-label="Mese successivo">›</button>
              </div>
              <div className="weekday-row">
                {["LU", "MA", "ME", "GI", "VE", "SA", "DO"].map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              <div className="day-grid">
                {days.map((item) => (
                  <button
                    key={item}
                    className={`${item === dayNumber ? "active" : ""} ${scheduledDays.has(item) ? "has-selection" : ""}`}
                    onClick={() => setDay(`2026-06-${String(item).padStart(2, "0")}`)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="slot-panel">
              <div className="slot-title">
                <Clock3 size={18} /> Inizio
                <span>{availability.source === "google-freebusy" ? "Disponibilita aggiornata" : "Disponibilita demo"}</span>
              </div>
              <div className="slot-grid" aria-busy={loadingSlots}>
                {loadingSlots && Array.from({ length: 8 }).map((_, index) => <Skeleton key={index} className="slot-skeleton" />)}
                {!loadingSlots && availability.slots.map((slot) => (
                  <button
                    key={slot.time}
                    disabled={slot.status === "busy"}
                    className={`${slot.time === time ? "active" : ""} ${slot.status} ${scheduledTimesForDay.has(slot.time) ? "already-picked" : ""}`}
                    onClick={() => setTime(slot.time)}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="already-selected-dates">
            <div>
              <strong>Date gia scelte</strong>
              <span>{scheduledSelections.length ? `${scheduledSelections.length} proposte nel percorso` : "Nessuna proposta ancora salvata"}</span>
            </div>
            {scheduledSelections.length > 0 && (
              <div className="already-selected-list">
                {scheduledSelections.map((item) => (
                  <button
                    key={item.workshopId}
                    className={item.workshopId === selection.workshopId ? "active" : ""}
                    onClick={() => {
                      setDay(item.date);
                      setTime(item.time);
                    }}
                  >
                    <Check size={16} />
                    <span>
                      <strong>{item.workshop?.title}</strong>
                      <em>{item.date} · {item.time} · {item.duration}</em>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="modal-footer calendar-footer">
          <div className="calendar-selection">
            {currentAlreadyScheduled ? <Check size={20} /> : <Clock3 size={20} />}
            <div>
              <strong>{currentAlreadyScheduled ? "Proposta salvata, puoi modificarla" : new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${formattedDay}T12:00:00`))}</strong>
              <span>{time} → {String(Number(time.slice(0, 2)) + (selection.duration === "2h" ? 2 : 1)).padStart(2, "0")}:00</span>
            </div>
            <em>{selection.duration}</em>
          </div>
          <button className="primary-btn" onClick={() => onConfirm(formattedDay, time)}>
            Conferma proposta
          </button>
        </footer>
      </section>
    </div>
  );
}
