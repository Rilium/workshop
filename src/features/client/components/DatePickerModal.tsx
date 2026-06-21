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
import type { Selection, Workshop } from "../../../types/domain";
import { Skeleton } from "../../../components/ui/Skeleton";

function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1, 12, 0, 0);
}

export function DatePickerModal({
  selection,
  selections,
  workshop,
  workshops,
  onClose,
  onConfirm,
}: {
  selection: Selection;
  selections: Selection[];
  workshop: Workshop;
  workshops: Workshop[];
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
}) {
  const [mode, setMode] = useState<"now" | "plan">("plan");
  const todayDate = formatDateKey(new Date());
  const [day, setDay] = useState(selection.date || todayDate);
  const [time, setTime] = useState(selection.time || "18:00");
  const [availability, setAvailability] = useState<{ source: string; slots: Array<{ time: string; status: "available" | "busy" | "promo" }> }>({
    source: "google-freebusy",
    slots: [],
  });
  const [availabilityError, setAvailabilityError] = useState("");
  const [loadingSlots, setLoadingSlots] = useState(false);
  const selectedDate = parseDateKey(day);
  const selectedYear = selectedDate.getFullYear();
  const selectedMonth = selectedDate.getMonth();
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, index) => index + 1);
  const dayNumber = selectedDate.getDate();
  const formattedDay = formatDateKey(selectedDate);
  const selectedMonthKey = formattedDay.slice(0, 7);
  const monthLabel = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(selectedDate);
  const scheduledSelections = selections
    .filter((item) => item.dateConfirmed && item.date && item.time)
    .map((item) => ({ ...item, workshop: workshops.find((workshopItem) => workshopItem.id === item.workshopId) }))
    .filter((item) => item.workshop);
  const scheduledDays = new Set(
    scheduledSelections
      .filter((item) => item.date.slice(0, 7) === selectedMonthKey)
      .map((item) => Number(item.date.split("-")[2])),
  );
  const scheduledTimesForDay = new Set(scheduledSelections.filter((item) => item.date === formattedDay).map((item) => item.time));
  const currentAlreadyScheduled = Boolean(selection.dateConfirmed && selection.date && selection.time);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setAvailabilityError("");
    getWorkshopAvailability({ date: formattedDay, duration: selection.duration, format: selection.format, expertIds: workshop.experts })
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .catch((error) => {
        if (!cancelled) {
          setAvailability({ source: "google-freebusy", slots: [] });
          setAvailabilityError(error instanceof Error ? error.message : "Disponibilita Calendar non disponibile.");
        }
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

  const shiftMonth = (delta: number) => {
    const next = new Date(selectedYear, selectedMonth + delta, 1, 12, 0, 0);
    const nextMaxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(dayNumber, nextMaxDay));
    setMode("plan");
    setDay(formatDateKey(next));
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
                <button type="button" aria-label="Mese precedente" onClick={() => shiftMonth(-1)}>‹</button>
                <strong>{monthLabel}</strong>
                <button type="button" aria-label="Mese successivo" onClick={() => shiftMonth(1)}>›</button>
              </div>
              <div className="weekday-row">
                {["LU", "MA", "ME", "GI", "VE", "SA", "DO"].map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              <div className="day-grid">
                {days.map((item) => (
                  <button
                    key={item}
                    className={`${item === dayNumber ? "active" : ""} ${scheduledDays.has(item) ? "has-selection" : ""}`}
                    onClick={() => {
                      setMode("plan");
                      setDay(formatDateKey(new Date(selectedYear, selectedMonth, item, 12, 0, 0)));
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="slot-panel">
              <div className="slot-title">
                <Clock3 size={18} /> Inizio
                <span>{availabilityError || "Disponibilita aggiornata da Google Calendar"}</span>
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
