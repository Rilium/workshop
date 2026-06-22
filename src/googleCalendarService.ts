import { SECRET_SETTINGS } from "./secretSettings";
import { withSessionPayload } from "./authTransport";
import { calendarDateLimitMessage, isCalendarDateAllowed } from "./utils/dateLimits";

export type CalendarSlot = {
  time: string;
  status: "available" | "busy" | "promo";
  eventId?: string;
  title?: string;
  calendarId?: string;
};

export type CalendarAvailability = {
  source: "google-calendar-funnifin-slots";
  slots: CalendarSlot[];
  connected?: boolean;
  calendarId?: string;
  calendarName?: string;
  updatedAt?: string;
};

export type ExpertCalendarConnection = {
  source: "google-calendar";
  connected: boolean;
  calendarId: string;
  calendarName?: string;
  expertId?: string;
  shared?: boolean;
  sharedWith?: string;
  shareError?: string;
  updatedAt: string;
};

export type ExpertCalendarEventPayload = {
  company: string;
  workshopId: string;
  workshopTitle: string;
  date: string;
  time: string;
  duration: "1h" | "2h";
  format: "live" | "webinar" | "ibrido";
  expertName?: string;
  mode: "candidate" | "assigned_by_funnifin";
};

export type ExpertCalendarEventResult = {
  source: "google-calendar";
  id: string;
  htmlLink?: string;
  calendarId: string;
  calendarName?: string;
  createdAt: string;
};

export type CalendarEventPayload = {
  projectId: string;
  company: string;
  manager: string;
  managerEmail: string;
  managerPhone: string;
  workshops: Array<{
    title: string;
    date: string;
    time: string;
    duration: "1h" | "2h";
    format: "live" | "webinar" | "ibrido";
    expertName?: string;
  }>;
  quoteTotal: number;
  eventMode?: "tentative" | "confirmed";
  driveFolderUrl?: string;
  finalDeckUrl?: string;
  finalDeckTitle?: string;
  sendCalendarInvites?: boolean;
  includeClientInCalendar?: boolean;
  existingEventId?: string;
};

export type CalendarEventResult = {
  source: "google-calendar";
  id: string;
  mode?: "tentative" | "confirmed";
  htmlLink?: string;
  meetLink: string;
  calendarId?: string;
  fallback?: boolean;
  fallbackReason?: string;
  createdAt: string;
  workshops: number;
};

function normalizeCalendarSlot(slot: Partial<CalendarSlot> = {}): CalendarSlot {
  const status = slot.status === "busy" || slot.status === "promo" ? slot.status : "available";
  return {
    time: String(slot.time || ""),
    status,
    eventId: slot.eventId,
    title: slot.title,
    calendarId: slot.calendarId,
  };
}

function normalizeCalendarAvailability(value: Partial<CalendarAvailability> | null): CalendarAvailability {
  return {
    source: "google-calendar-funnifin-slots",
    slots: Array.isArray(value?.slots) ? value.slots.map(normalizeCalendarSlot) : [],
    connected: Boolean(value?.connected),
    calendarId: value?.calendarId,
    calendarName: value?.calendarName,
    updatedAt: value?.updatedAt,
  };
}

function friendlyCalendarError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/failed to fetch/i.test(message) || /networkerror/i.test(message)) return fallback;
  if (/unknown action/i.test(message)) return "Backend Google da aggiornare: crea un nuovo deploy Apps Script con il Code.gs corrente.";
  return message;
}

function assertCalendarDateAllowed(date: string) {
  if (!isCalendarDateAllowed(date)) throw new Error(calendarDateLimitMessage());
}

function assertCalendarPayloadDatesAllowed(dates: string[]) {
  const invalidDate = dates.find((date) => !isCalendarDateAllowed(date));
  if (invalidDate) throw new Error(`${calendarDateLimitMessage()} Data non valida: ${invalidDate}.`);
}

export async function getWorkshopAvailability(params: {
  date: string;
  duration: "1h" | "2h";
  format: "live" | "webinar" | "ibrido";
  expertIds?: string[];
}): Promise<CalendarAvailability> {
  assertCalendarDateAllowed(params.date);
  const scriptUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];

  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "freeBusy");
  url.searchParams.set("date", params.date);
  url.searchParams.set("duration", params.duration);
  url.searchParams.set("format", params.format);
  if (params.expertIds?.length) url.searchParams.set("expertIds", params.expertIds.join(","));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Calendar FreeBusy request failed");
    const result = (await response.json().catch(() => null)) as (Partial<CalendarAvailability> & { ok?: boolean; error?: string }) | null;
    if (result?.ok === false) throw new Error(result.error || "Calendar FreeBusy request failed");
    return normalizeCalendarAvailability(result);
  } catch (error) {
    throw new Error(friendlyCalendarError(error, "Connessione Calendar non disponibile."));
  }
}

export async function getExpertFunniFinAvailability(params: {
  date?: string;
  horizonDays?: number;
} = {}): Promise<CalendarAvailability> {
  if (params.date) assertCalendarDateAllowed(params.date);
  const scriptUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];

  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "expertAvailability");
  if (params.date) url.searchParams.set("date", params.date);
  if (params.horizonDays) url.searchParams.set("horizonDays", String(params.horizonDays));

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Expert Calendar request failed");
    const result = (await response.json().catch(() => null)) as (Partial<CalendarAvailability> & { ok?: boolean; error?: string }) | null;
    if (result?.ok === false) throw new Error(result.error || "Lettura Calendar esperto non riuscita");
    return normalizeCalendarAvailability(result);
  } catch (error) {
    throw new Error(friendlyCalendarError(error, "Connessione Calendar esperto non disponibile."));
  }
}

export async function connectExpertCalendar(calendarId: string): Promise<ExpertCalendarConnection> {
  const scriptUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];

  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "connectExpertCalendar",
        payload: withSessionPayload({ calendarId }),
      }),
    });
    if (!response.ok) throw new Error("Expert Calendar connect request failed");
    const result = (await response.json().catch(() => null)) as (ExpertCalendarConnection & { ok?: boolean; error?: string }) | null;
    if (!result) throw new Error("Calendar connect response non valida");
    if (result.ok === false) throw new Error(result.error || "Collegamento Calendar non riuscito");
    return result;
  } catch (error) {
    throw new Error(friendlyCalendarError(error, "Collegamento Calendar esperto non disponibile."));
  }
}

export async function createExpertCalendar(): Promise<ExpertCalendarConnection> {
  const scriptUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];

  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "createExpertCalendar",
        payload: withSessionPayload({}),
      }),
    });
    if (!response.ok) throw new Error("Expert Calendar create request failed");
    const result = (await response.json().catch(() => null)) as (ExpertCalendarConnection & { ok?: boolean; error?: string }) | null;
    if (!result) throw new Error("Calendar create response non valida");
    if (result.ok === false) throw new Error(result.error || "Creazione Calendar non riuscita");
    return result;
  } catch (error) {
    throw new Error(friendlyCalendarError(error, "Creazione Calendar esperto non disponibile."));
  }
}

export async function createExpertCalendarEvent(payload: ExpertCalendarEventPayload): Promise<ExpertCalendarEventResult> {
  assertCalendarDateAllowed(payload.date);
  const scriptUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];

  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "createExpertCalendarEvent",
        payload: withSessionPayload(payload),
      }),
    });
    if (!response.ok) throw new Error("Expert Calendar event request failed");
    const result = (await response.json().catch(() => null)) as (ExpertCalendarEventResult & { ok?: boolean; error?: string }) | null;
    if (!result) throw new Error("Expert Calendar event response non valida");
    if (result.ok === false) throw new Error(result.error || "Creazione evento Calendar esperto non riuscita");
    return result;
  } catch (error) {
    throw new Error(friendlyCalendarError(error, "Scrittura Calendar esperto non disponibile."));
  }
}

export async function createWorkshopCalendarEvent(payload: CalendarEventPayload): Promise<CalendarEventResult> {
  assertCalendarPayloadDatesAllowed(payload.workshops.map((workshop) => workshop.date));
  const scriptUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];

  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action: "createCalendarEvent",
        payload: withSessionPayload(payload),
      }),
    });
    if (!response.ok) throw new Error("Calendar event request failed");
    const result = (await response.json().catch(() => null)) as (CalendarEventResult & { ok?: boolean; error?: string }) | null;
    if (!result) throw new Error("Calendar event response non valida");
    if (result.ok === false) throw new Error(result.error || "Creazione evento Calendar non riuscita");
    return result;
  } catch (error) {
    throw new Error(friendlyCalendarError(error, "Connessione Calendar non disponibile."));
  }
}
