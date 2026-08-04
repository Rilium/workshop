import { fetchAppsScriptScheduledRead } from "./appsScriptTransport";
import { withSessionPayload } from "./authTransport";

export function fetchAppsScriptRead(
  scriptUrl: string,
  readAction: string,
  params: Record<string, unknown> = {},
  init: Pick<RequestInit, "signal" | "keepalive"> = {},
) {
  return fetchAppsScriptScheduledRead(scriptUrl, {
    ...init,
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({
      action: "read",
      payload: withSessionPayload({ readAction, params }),
    }),
  });
}
