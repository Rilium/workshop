import { SECRET_SETTINGS } from "./secretSettings";

export type CalendarSlot = {
  time: string;
  status: "available" | "busy" | "promo";
};

export type CalendarAvailability = {
  source: "google-freebusy" | "mock";
  slots: CalendarSlot[];
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
};

export type CalendarEventResult = {
  source: "google-calendar" | "mock";
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

const DEFAULT_SLOTS = [
  "08:00",
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
  "18:00",
  "19:00",
  "20:00",
  "21:00",
  "22:00",
  "23:00",
];

export async function getWorkshopAvailability(params: {
  date: string;
  duration: "1h" | "2h";
  format: "live" | "webinar" | "ibrido";
  expertIds?: string[];
}): Promise<CalendarAvailability> {
  const scriptUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];

  if (!scriptUrl) {
    return {
      source: "mock",
      slots: DEFAULT_SLOTS.map((time) => ({
        time,
        status: ["08:00", "09:00", "10:00", "12:00", "13:00", "14:00", "16:00", "17:00"].includes(time)
          ? "busy"
          : time === "18:00"
            ? "promo"
            : "available",
      })),
    };
  }

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "freeBusy");
  url.searchParams.set("date", params.date);
  url.searchParams.set("duration", params.duration);
  url.searchParams.set("format", params.format);
  if (params.expertIds?.length) url.searchParams.set("expertIds", params.expertIds.join(","));

  const response = await fetch(url.toString());
  if (!response.ok) throw new Error("Calendar FreeBusy request failed");
  return (await response.json()) as CalendarAvailability;
}

export async function createWorkshopCalendarEvent(payload: CalendarEventPayload): Promise<CalendarEventResult> {
  const scriptUrl = (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];

  if (!scriptUrl) {
    return {
      source: "mock",
      id: `mock_${payload.projectId}_${Date.now().toString(36)}`,
      mode: payload.eventMode ?? "confirmed",
      meetLink: `https://meet.google.com/funnifin-${payload.projectId}`,
      createdAt: new Date().toLocaleString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }),
      workshops: payload.workshops.length,
    };
  }

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "createCalendarEvent",
      payload,
    }),
  });
  if (!response.ok) throw new Error("Calendar event request failed");
  return (await response.json()) as CalendarEventResult;
}
