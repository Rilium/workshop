import { SECRET_SETTINGS } from "./secretSettings";
import { appendSessionParams, withSessionPayload } from "./authTransport";

export type RequestProjectStatus =
  | "draft_cliente"
  | "richiesta_inviata"
  | "in_verifica_funnifin"
  | "date_approvate"
  | "aperto_a_esperti"
  | "esperto_assegnato"
  | "materiali_cliente_in_attesa"
  | "in_preparazione_esperto"
  | "in_revisione_brand"
  | "approvazione_finale"
  | "evento_provvisorio"
  | "confermato";

export type RequestWorkshopRecord = {
  workshopId: string;
  title: string;
  duration: "1h" | "2h";
  format: "live" | "webinar" | "ibrido";
  date: string;
  time: string;
  price: number;
  custom: boolean;
  customNote?: string;
  status: string;
  approval?: "approved" | "rejected" | "change_requested" | "pending";
  expertName?: string;
};

export type WorkshopRequestRecord = {
  id: string;
  company: string;
  manager: string;
  email: string;
  phone: string;
  status: RequestProjectStatus;
  quoteTotal: number;
  workshopIds: string[];
  dateCount: number;
  assignedExpert?: string;
  createdAt: string;
  updatedAt: string;
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    phone: string;
  };
  workshops: RequestWorkshopRecord[];
  quote: {
    gross: number;
    discount: number;
    promoDiscount: number;
    customTotal: number;
    total: number;
    saved: number;
    packageName: string;
  };
  materials?: {
    folderId?: string;
    folderName?: string;
    folderUrl?: string;
    fileCount?: number;
    finalDeckUrl?: string;
    finalDeckTitle?: string;
    brandDeckId?: string;
    brandDeckStatus?: "in_review" | "changes_requested" | "approved" | "archived";
    brandDeckReviewedAt?: string;
    brandReviewNote?: string;
    calendarDeckEnabled?: boolean;
    calendarDeckEnabledAt?: string;
  };
  privacy?: {
    accepted: boolean;
    acceptedAt: string;
    version: string;
  };
  calendarEvent?: {
    id?: string;
    mode?: "tentative" | "confirmed";
    htmlLink?: string;
    meetLink?: string;
  };
};

export type CreateWorkshopRequestPayload = {
  contact: WorkshopRequestRecord["contact"];
  workshops: RequestWorkshopRecord[];
  quote: WorkshopRequestRecord["quote"];
  materials?: WorkshopRequestRecord["materials"];
  privacy?: WorkshopRequestRecord["privacy"];
};

function asStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map((item) => String(item)).filter(Boolean);
  if (typeof value === "string") return value.split(",").map((item) => item.trim()).filter(Boolean);
  return [];
}

function normalizeWorkshopRecord(record: Partial<RequestWorkshopRecord> & { id?: string } = {}): RequestWorkshopRecord {
  return {
    workshopId: String(record.workshopId || record.id || ""),
    title: String(record.title || ""),
    duration: record.duration === "2h" ? "2h" : "1h",
    format: record.format === "live" || record.format === "ibrido" ? record.format : "webinar",
    date: String(record.date || ""),
    time: String(record.time || ""),
    price: Number(record.price || 0),
    custom: Boolean(record.custom),
    customNote: String(record.customNote || ""),
    status: String(record.status || "selezionato"),
    approval:
      record.approval === "approved" ||
      record.approval === "rejected" ||
      record.approval === "change_requested" ||
      record.approval === "pending"
        ? record.approval
        : "pending",
    expertName: String(record.expertName || ""),
  };
}

function normalizeWorkshopRequest(request: Partial<WorkshopRequestRecord> = {}): WorkshopRequestRecord {
  const contact: Partial<WorkshopRequestRecord["contact"]> = request.contact ?? {};
  const quote: Partial<WorkshopRequestRecord["quote"]> = request.quote ?? {};
  const workshops = Array.isArray(request.workshops) ? request.workshops.map(normalizeWorkshopRecord) : [];
  const workshopIds = asStringArray(request.workshopIds);
  const resolvedWorkshopIds = workshopIds.length ? workshopIds : workshops.map((workshop) => workshop.workshopId).filter(Boolean);
  const now = new Date().toISOString();

  return {
    id: String(request.id || "request"),
    company: String(request.company || contact.company || "Cliente"),
    manager: String(request.manager || [contact.firstName, contact.lastName].filter(Boolean).join(" ").trim() || contact.email || "Referente"),
    email: String(request.email || contact.email || ""),
    phone: String(request.phone || contact.phone || ""),
    status: request.status || "richiesta_inviata",
    quoteTotal: Number(request.quoteTotal || quote.total || 0),
    workshopIds: resolvedWorkshopIds,
    dateCount: Number(request.dateCount ?? workshops.filter((workshop) => workshop.date).length),
    assignedExpert: request.assignedExpert || workshops.find((workshop) => workshop.expertName)?.expertName || "",
    createdAt: String(request.createdAt || now),
    updatedAt: String(request.updatedAt || now),
    contact: {
      firstName: String(contact.firstName || ""),
      lastName: String(contact.lastName || ""),
      email: String(contact.email || request.email || ""),
      company: String(contact.company || request.company || ""),
      phone: String(contact.phone || request.phone || ""),
    },
    workshops,
    quote: {
      gross: Number(quote.gross || 0),
      discount: Number(quote.discount || 0),
      promoDiscount: Number(quote.promoDiscount || 0),
      customTotal: Number(quote.customTotal || 0),
      total: Number(quote.total || request.quoteTotal || 0),
      saved: Number(quote.saved || 0),
      packageName: String(quote.packageName || ""),
    },
    materials: request.materials,
    privacy: request.privacy,
    calendarEvent: request.calendarEvent,
  };
}

function getScriptUrl() {
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];
}

function friendlyRequestError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/failed to fetch/i.test(message) || /networkerror/i.test(message)) return fallback;
  return message;
}

async function postAppsScript<T>(body: unknown): Promise<T> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error("Richiesta Apps Script non riuscita");
  const result = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
  if (result.ok === false) throw new Error(result.error || "Operazione richiesta non salvata");
  return result;
}

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "cliente";
}

function timestampId() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}

export async function createWorkshopRequest(payload: CreateWorkshopRequestPayload): Promise<WorkshopRequestRecord> {
  const id = `${slug(payload.contact.company)}-${timestampId()}`;
  const clientMutationId = crypto.randomUUID();
  const payloadWithId = { ...payload, id, clientMutationId };
  const body = {
    action: "createWorkshopRequest",
    payload: payloadWithId,
  };

  const result = await postAppsScript<{ request: WorkshopRequestRecord }>(body);
  return normalizeWorkshopRequest(result.request);
}

export async function listWorkshopRequests(): Promise<WorkshopRequestRecord[]> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) return [];

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "listWorkshopRequests");
  appendSessionParams(url);

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Lettura richieste non riuscita");
    const result = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; requests?: WorkshopRequestRecord[] } | null;
    if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
    if (result.ok === false) throw new Error(result.error || "Lettura richieste non riuscita");
    return (result.requests ?? []).map(normalizeWorkshopRequest);
  } catch (error) {
    throw new Error(friendlyRequestError(error, "Connessione al registro richieste non disponibile."));
  }
}

export async function updateWorkshopRequest(
  requestId: string,
  patch: Partial<WorkshopRequestRecord>,
  event?: { type: string; note?: string; payload?: unknown },
): Promise<WorkshopRequestRecord> {
  const result = await postAppsScript<{ request: WorkshopRequestRecord }>({
    action: "updateWorkshopRequest",
    payload: withSessionPayload({ requestId, patch, event }),
  });
  return normalizeWorkshopRequest(result.request);
}

export async function deleteWorkshopRequest(requestId: string): Promise<{ deleted: boolean; requestId: string }> {
  return postAppsScript<{ deleted: boolean; requestId: string }>({
    action: "deleteWorkshopRequest",
    payload: withSessionPayload({ requestId }),
  });
}
