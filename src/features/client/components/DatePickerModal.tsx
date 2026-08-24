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
import { getWorkshopAvailability } from "../../../googleCalendarService";
import type { Selection, Workshop } from "../../../types/domain";
import { Skeleton } from "../../../components/ui/Skeleton";
import { calendarDateLimitMessage, calendarDateLimits, formatDateKey, isCalendarDateAllowed } from "../../../utils/dateLimits";
import { formatDuration } from "../../../utils/workshop";

function parseDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year || new Date().getFullYear(), (month || 1) - 1, day || 1, 12, 0, 0);
}

const FALLBACK_TIME_SLOTS = ["09:00", "10:00", "11:00", "12:00", "14:00", "15:00", "16:00", "17:00"]
  .map((time) => ({ time, status: "available" as const }));

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
  const dateLimits = calendarDateLimits();
  const initialDate = selection.date && isCalendarDateAllowed(selection.date) ? selection.date : dateLimits.min;
  const [day, setDay] = useState(initialDate);
  const [time, setTime] = useState(selection.time || "09:00");
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
  const selectedDateAllowed = isCalendarDateAllowed(formattedDay);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setAvailabilityError("");
    if (!selectedDateAllowed) {
      setAvailability({ source: "google-freebusy", slots: [] });
      setAvailabilityError(calendarDateLimitMessage());
      setLoadingSlots(false);
      return () => {
        cancelled = true;
      };
    }
    getWorkshopAvailability({ date: formattedDay, duration: selection.duration, format: selection.format, expertIds: workshop.experts })
      .then((result) => {
        if (cancelled) return;
        const slots = result.slots.length > 0 ? result.slots : FALLBACK_TIME_SLOTS;
        setAvailability({ ...result, slots });
        if (!slots.some((slot) => slot.time === time && slot.status !== "busy")) {
          setTime(slots.find((slot) => slot.status !== "busy")?.time ?? "09:00");
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvailability({ source: "orari-proposti", slots: FALLBACK_TIME_SLOTS });
          setAvailabilityError("Calendar non è disponibile: scegli un orario indicativo, FunniFin lo verificherà.");
          setTime((current) => FALLBACK_TIME_SLOTS.some((slot) => slot.time === current) ? current : "09:00");
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formattedDay, selectedDateAllowed, selection.duration, selection.format, workshop.experts]);

  const shiftMonth = (delta: number) => {
    const next = new Date(selectedYear, selectedMonth + delta, 1, 12, 0, 0);
    const nextMaxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate();
    next.setDate(Math.min(dayNumber, nextMaxDay));
    const nextKey = formatDateKey(next);
    if (nextKey < dateLimits.min) setDay(dateLimits.min);
    else if (nextKey > dateLimits.max) setDay(dateLimits.max);
    else setDay(nextKey);
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
                    disabled={!isCalendarDateAllowed(formatDateKey(new Date(selectedYear, selectedMonth, item, 12, 0, 0)))}
                    className={`${item === dayNumber ? "active" : ""} ${scheduledDays.has(item) ? "has-selection" : ""}`}
                    onClick={() => {
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
              <span>
                {time} → {(() => {
                  const [hours, minutes] = time.split(":").map(Number);
                  const durationMinutes = selection.duration === "2h" ? 120 : selection.duration === "1.5h" ? 90 : 60;
                  const endMinutes = hours * 60 + minutes + durationMinutes;
                  return `${String(Math.floor(endMinutes / 60) % 24).padStart(2, "0")}:${String(endMinutes % 60).padStart(2, "0")}`;
                })()}
              </span>
            </div>
            <em>{formatDuration(selection.duration)}</em>
          </div>
          <button className="primary-btn" disabled={!selectedDateAllowed} onClick={() => onConfirm(formattedDay, time)}>
            Conferma proposta
          </button>
        </footer>
      </section>
    </div>
  );
}
