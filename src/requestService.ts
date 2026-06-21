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
};

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
  return result.request;
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
    return result.requests ?? [];
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
  return result.request;
}

export async function deleteWorkshopRequest(requestId: string): Promise<{ deleted: boolean; requestId: string }> {
  return postAppsScript<{ deleted: boolean; requestId: string }>({
    action: "deleteWorkshopRequest",
    payload: withSessionPayload({ requestId }),
  });
}
