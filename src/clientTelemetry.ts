import { fetchAppsScript } from "./appsScriptTransport";
import { SECRET_SETTINGS } from "./secretSettings";

type ClientErrorContext = {
  boundary?: string;
  componentStack?: string;
  source?: string;
};

let globalReportingInstalled = false;

function sanitizedLocation() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}${window.location.hash}`;
}

function errorPayload(error: unknown, context: ClientErrorContext = {}) {
  const normalized = error instanceof Error ? error : new Error(String(error || "Errore client sconosciuto"));
  return {
    fingerprint: `${normalized.name}:${normalized.message}`.slice(0, 220),
    name: normalized.name.slice(0, 80),
    message: normalized.message.slice(0, 500),
    stack: String(normalized.stack || "").replaceAll(window.location.href, sanitizedLocation()).slice(0, 3000),
    componentStack: String(context.componentStack || "").slice(0, 2000),
    boundary: String(context.boundary || "").slice(0, 120),
    source: String(context.source || "client").slice(0, 80),
    location: sanitizedLocation(),
    userAgent: navigator.userAgent.slice(0, 300),
    occurredAt: new Date().toISOString(),
  };
}

export function reportClientError(error: unknown, context: ClientErrorContext = {}) {
  console.error("[FunniFin client error]", error, context);
  if (typeof window === "undefined") return;
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  if (String(env.VITE_CLIENT_TELEMETRY || "true").toLowerCase() === "false") return;
  const scriptUrl = env[SECRET_SETTINGS.google.env.appScriptDeploymentUrl];
  if (!scriptUrl) return;
  void fetchAppsScript(scriptUrl, {
    method: "POST",
    keepalive: true,
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action: "reportClientError", payload: errorPayload(error, context) }),
  }).catch(() => {});
}

export function installGlobalErrorReporting() {
  if (globalReportingInstalled || typeof window === "undefined") return;
  globalReportingInstalled = true;
  window.addEventListener("error", (event) => {
    reportClientError(event.error ?? event.message, { source: "window.error" });
  });
  window.addEventListener("unhandledrejection", (event) => {
    reportClientError(event.reason, { source: "window.unhandledrejection" });
  });
}
