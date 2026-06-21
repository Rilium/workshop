import { appendSessionParams, withSessionPayload } from "./authTransport";
import { SECRET_SETTINGS } from "./secretSettings";
import type { AppNotification, AppNotificationRole } from "./types/domain";

function getScriptUrl() {
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];
}

export function hasNotificationBackend() {
  return Boolean(getScriptUrl());
}

async function getAppsScript<T>(action: string): Promise<T> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");
  const url = new URL(scriptUrl);
  url.searchParams.set("action", action);
  appendSessionParams(url);
  const response = await fetch(url.toString());
  if (!response.ok) throw new Error(`Lettura ${action} non riuscita`);
  const result = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
  if (result.ok === false) throw new Error(result.error || `Lettura ${action} non riuscita`);
  return result;
}

async function postAppsScript<T>(action: string, payload: unknown): Promise<T> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action,
      payload: payload && typeof payload === "object" && !Array.isArray(payload)
        ? withSessionPayload(payload as Record<string, unknown>)
        : payload,
    }),
  });
  if (!response.ok) throw new Error(`Salvataggio ${action} non riuscito`);
  const result = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
  if (result.ok === false) throw new Error(result.error || `Salvataggio ${action} non riuscito`);
  return result;
}

export async function listNotifications(): Promise<AppNotification[]> {
  const result = await getAppsScript<{ notifications?: AppNotification[] }>("listNotifications");
  return result.notifications ?? [];
}

export async function createNotification(notification: AppNotification): Promise<AppNotification> {
  const result = await postAppsScript<{ notification: AppNotification }>("createNotification", notification);
  return result.notification;
}

export async function updateNotification(id: string, patch: Partial<AppNotification>): Promise<AppNotification> {
  const result = await postAppsScript<{ notification: AppNotification }>("updateNotification", { id, patch });
  return result.notification;
}

export async function deleteNotification(id: string): Promise<void> {
  await postAppsScript("deleteNotification", { id });
}

export async function markNotificationsRead(ids: string[], readerRole: AppNotificationRole): Promise<void> {
  await postAppsScript("markNotificationsRead", { ids, readerRole });
}
