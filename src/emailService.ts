import { SECRET_SETTINGS } from "./secretSettings";
import { withSessionPayload } from "./authTransport";

type EmailWorkshop = {
  title: string;
  duration: string;
  format: string;
  date: string;
  time: string;
  price: number;
  custom: boolean;
};

export type WorkshopRequestEmailPayload = {
  contact: {
    firstName: string;
    lastName: string;
    email: string;
    company: string;
    phone: string;
  };
  workshops: EmailWorkshop[];
  quote: {
    gross: number;
    discount: number;
    promoDiscount: number;
    customTotal: number;
    total: number;
    saved: number;
    packageName: string;
  };
  mail?: {
    cc?: string;
    fromName?: string;
  };
};

export type WorkflowNotificationRecipientRole = "client" | "funnifin" | "expert" | "brand";

export type WorkflowNotificationPayload = {
  phase:
    | "request_received"
    | "request_updated"
    | "expert_candidate_received"
    | "dates_approved"
    | "date_change_requested"
    | "candidacies_open"
    | "expert_assigned"
    | "brand_review"
    | "final_approval"
    | "event_tentative"
    | "event_confirmed";
  project: {
    id: string;
    company: string;
    manager: string;
    email: string;
    phone: string;
    status: string;
    quoteTotal: number;
  };
  workshops: Array<{
    title: string;
    date: string;
    time: string;
    duration: string;
    format: string;
    expertName?: string;
  }>;
  recipients: WorkflowNotificationRecipientRole[];
  recipientEmails?: Partial<Record<WorkflowNotificationRecipientRole, string>>;
  fromName?: string;
  note?: string;
  event?: {
    mode: "tentative" | "confirmed";
    id?: string;
    htmlLink?: string;
    meetLink?: string;
  };
  actionUrl?: string;
  actionLabel?: string;
};

function euro(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function escapeEmailHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function emailDataCell(label: string, value: string, href?: string) {
  const content = href
    ? `<a href="${escapeEmailHtml(href)}" style="color:#1cafb9;text-decoration:none;font-weight:800;">${escapeEmailHtml(value || "-")}</a>`
    : escapeEmailHtml(value || "-");
  return `
    <td width="50%" style="width:50%;padding:10px 12px;border-top:1px solid #dde0e3;vertical-align:top;">
      <span style="display:block;margin:0 0 4px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:#8c9096;font-weight:800;">${escapeEmailHtml(label)}</span>
      <strong style="display:block;color:#171d1d;font-size:14px;line-height:1.35;font-weight:800;word-break:break-word;">${content}</strong>
    </td>`;
}

function emailDataGrid(rows: Array<Array<{ label: string; value: string; href?: string }>>) {
  return `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dde0e3;border-radius:12px;overflow:hidden;background:#ffffff;">
      ${rows.map((row, rowIndex) => `
        <tr>
          ${row.map((item) => emailDataCell(item.label, item.value, item.href).replace("border-top:1px solid #dde0e3;", rowIndex === 0 ? "" : "border-top:1px solid #dde0e3;")).join("")}
        </tr>`).join("")}
    </table>`;
}

const LOGO_URL = typeof window !== "undefined"
  ? `${window.location.origin}/Logo.png`
  : "https://funnifin-workshop-planner.vercel.app/Logo.png";

const APP_URL = typeof window !== "undefined"
  ? window.location.origin
  : "https://funnifin-workshop-planner.vercel.app";

function appUrlForRole(role: WorkflowNotificationRecipientRole) {
  if (role === "funnifin") return `${APP_URL}#funnifin`;
  if (role === "expert") return `${APP_URL}#esperto-candidature`;
  if (role === "brand") return `${APP_URL}#brand`;
  return `${APP_URL}#login`;
}

function actionLabelForRole(role: WorkflowNotificationRecipientRole) {
  if (role === "funnifin") return "Apri la console FunniFin";
  if (role === "expert") return "Apri l'area Esperto";
  if (role === "brand") return "Apri l'area Brand";
  return "Apri FunniFin";
}

function buildWorkflowAction(payload: WorkflowNotificationPayload) {
  const firstInternalRole = payload.recipients.find((role) => role !== "client");
  if (!firstInternalRole) return {};
  return {
    actionUrl: payload.actionUrl || appUrlForRole(firstInternalRole),
    actionLabel: payload.actionLabel || actionLabelForRole(firstInternalRole),
  };
}

function emailWrapper(inner: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FunniFin</title></head>
<body style="margin:0;padding:0;background:#f0f1f3;font-family:Nunito,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f1f3;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dde0e3;box-shadow:0 12px 40px rgba(172,175,185,0.18);">
      ${inner}
      <tr><td style="padding:20px 32px 24px;background:#f7f8f9;border-top:1px solid #dde0e3;text-align:center;">
        <p style="margin:0;font-size:11px;color:#8c9096;line-height:1.6;">
          FunniFin Workshop Planner · Email di servizio richiesta workshop.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildEmailHtml(payload: WorkshopRequestEmailPayload) {
  const requesterGrid = emailDataGrid([
    [
      { label: "Nome", value: `${payload.contact.firstName} ${payload.contact.lastName}`.trim() || "Referente" },
      { label: "Azienda", value: payload.contact.company },
    ],
    [
      { label: "Email", value: payload.contact.email, href: `mailto:${payload.contact.email}` },
      { label: "Telefono", value: payload.contact.phone },
    ],
  ]);

  const workshopRows = payload.workshops
    .map((workshop, i) => `
      <tr>
        <td style="padding:15px 16px;${i > 0 ? "border-top:1px solid #dde0e3;" : ""}">
          <strong style="display:block;color:#171d1d;font-size:15px;line-height:1.35;margin-bottom:6px;">${workshop.title}</strong>
          <span style="display:inline-block;margin-right:6px;padding:3px 9px;border-radius:999px;background:rgba(28,175,185,0.12);color:#1cafb9;font-size:11px;font-weight:700;">${workshop.duration}</span>
          <span style="display:inline-block;margin-right:6px;padding:3px 9px;border-radius:999px;background:#f0f1f3;color:#747878;font-size:11px;font-weight:700;">${workshop.format}</span>
          <span style="color:#8c9096;font-size:12px;">${workshop.date || "data da concordare"}${workshop.time ? " · " + workshop.time : ""}${workshop.custom ? " · su misura" : ""}</span>
        </td>
        <td align="right" style="padding:15px 16px;${i > 0 ? "border-top:1px solid #dde0e3;" : ""}white-space:nowrap;vertical-align:top;">
          <strong style="color:#1cafb9;font-size:15px;">${euro(workshop.price)}</strong>
        </td>
      </tr>`)
    .join("");

  const quoteRows = [
    `<tr><td style="padding:5px 0;color:#747878;font-size:13px;">Listino workshop</td><td align="right" style="padding:5px 0;font-size:13px;color:#444748;">${euro(payload.quote.gross)}</td></tr>`,
    `<tr><td style="padding:5px 0;color:#747878;font-size:13px;">Pacchetto: ${payload.quote.packageName}</td><td align="right" style="padding:5px 0;font-size:13px;color:#1a9e6a;font-weight:700;">−${euro(payload.quote.discount)}</td></tr>`,
    payload.quote.promoDiscount ? `<tr><td style="padding:5px 0;color:#747878;font-size:13px;">Sconto date flessibili</td><td align="right" style="padding:5px 0;font-size:13px;color:#1a9e6a;font-weight:700;">−${euro(payload.quote.promoDiscount)}</td></tr>` : "",
    payload.quote.customTotal ? `<tr><td style="padding:5px 0;color:#747878;font-size:13px;">Adattamenti su misura</td><td align="right" style="padding:5px 0;font-size:13px;color:#444748;">+${euro(payload.quote.customTotal)}</td></tr>` : "",
  ].join("");

  const inner = `
    <tr><td style="padding:36px 32px 28px;background:#1cafb9;text-align:center;">
      <img src="${LOGO_URL}" alt="FunniFin" height="48" style="display:block;margin:0 auto 20px;max-width:180px;object-fit:contain;" />
      <h1 style="margin:0 0 10px;font-size:24px;line-height:1.18;color:#ffffff;font-weight:800;">Abbiamo ricevuto la tua richiesta</h1>
      <p style="margin:0 auto;color:rgba(255,255,255,0.85);font-size:14px;line-height:1.6;max-width:440px;">Grazie, <strong style="color:#ffffff;">${payload.contact.company}</strong>. Il team FunniFin sta preparando il percorso workshop più adatto.</p>
    </td></tr>
    <tr><td style="padding:28px 32px 0;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#1cafb9;">Dati richiedente</p>
      ${requesterGrid}
    </td></tr>
    <tr><td style="padding:20px 32px 0;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#1cafb9;">Workshop selezionati</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #dde0e3;border-radius:12px;overflow:hidden;background:#ffffff;">
        ${workshopRows}
      </table>
    </td></tr>
    <tr><td style="padding:16px 32px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:rgba(28,175,185,0.10);border:1px solid rgba(28,175,185,0.28);border-radius:12px;padding:16px 20px;">
        <tr><td>
          <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#1cafb9;">Riepilogo economico</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${quoteRows}
            <tr><td colspan="2" style="padding-top:10px;border-top:1.5px solid rgba(28,175,185,0.35);"></td></tr>
            <tr>
              <td style="padding-top:8px;font-size:16px;font-weight:800;color:#171d1d;">Totale stimato</td>
              <td align="right" style="padding-top:8px;font-size:20px;font-weight:900;color:#1cafb9;">${euro(payload.quote.total)} <span style="font-size:12px;font-weight:600;color:#8c9096;">+ IVA</span></td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:16px 32px 30px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7f8f9;border:1px solid #dde0e3;border-radius:12px;padding:16px 20px;">
        <tr><td style="font-size:13px;color:#444748;line-height:1.7;">
          <strong style="display:block;margin-bottom:6px;color:#171d1d;">Cosa succede ora</strong>
          Verifichiamo date, formato e obiettivi del percorso. Se serve, ti contattiamo per rifinire la proposta; poi riceverai la conferma con i prossimi passaggi.
        </td></tr>
      </table>
    </td></tr>`;

  return emailWrapper(inner);
}

function buildEmailText(payload: WorkshopRequestEmailPayload) {
  const workshops = payload.workshops
    .map((workshop) => `- ${workshop.title}: ${workshop.duration} · ${workshop.format} · ${workshop.date || "data da proporre"} ${workshop.time || ""} · ${euro(workshop.price)}`)
    .join("\n");

  return [
    "Abbiamo ricevuto la tua richiesta FunniFin",
    "",
    `Azienda: ${payload.contact.company}`,
    `Referente: ${payload.contact.firstName} ${payload.contact.lastName}`,
    `Email: ${payload.contact.email}`,
    `Telefono: ${payload.contact.phone}`,
    "",
    "Workshop:",
    workshops,
    "",
    `Totale stimato: ${euro(payload.quote.total)} + IVA`,
    `Pacchetto applicato: ${payload.quote.packageName}`,
    "",
    "Cosa succede ora: il team FunniFin verifica date, formato e obiettivi del percorso. Ti aggiorneremo con la conferma o con eventuali domande.",
  ].join("\n");
}

function buildWorkflowText(payload: WorkflowNotificationPayload, to: string[]) {
  const workshops = payload.workshops
    .map((workshop) => `- ${workshop.title}: ${workshop.duration} · ${workshop.format} · ${workshop.date || "data da confermare"} ${workshop.time || ""}${workshop.expertName ? ` · ${workshop.expertName}` : ""}`)
    .join("\n");

  return [
    `Aggiornamento FunniFin - ${payload.project.company}`,
    "",
    `Progetto: ${payload.project.company}`,
    `Referente: ${payload.project.manager} · ${payload.project.email} · ${payload.project.phone}`,
    `Punto del percorso: ${payload.project.status}`,
    `Preventivo: ${euro(payload.project.quoteTotal)} + IVA`,
    "",
    "Workshop:",
    workshops,
    payload.note ? `\nNota: ${payload.note}` : "",
    payload.actionUrl ? `\n${payload.actionLabel || "Apri"}: ${payload.actionUrl}` : "",
    payload.event?.htmlLink ? `\nEvento: ${payload.event.htmlLink}` : "",
    payload.event?.meetLink ? `Meet: ${payload.event.meetLink}` : "",
  ].filter(Boolean).join("\n");
}

async function postAppsScriptJson<T>(scriptUrl: string, body: unknown): Promise<T> {
  const serialized = JSON.stringify(body);
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: serialized,
  });
  if (!response.ok) throw new Error(`Apps Script email HTTP ${response.status}`);
  const result = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
  if (!result) throw new Error("Apps Script email ha risposto con un formato non valido");
  if (result.ok === false) throw new Error(result.error || "Apps Script email non riuscito");
  return result;
}

export async function sendWorkshopRequestEmail(payload: WorkshopRequestEmailPayload) {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const scriptUrl = env[SECRET_SETTINGS.google.env.appScriptDeploymentUrl];
  const subject = `Richiesta workshop FunniFin - ${payload.contact.company}`;
  const html = buildEmailHtml(payload);
  const text = buildEmailText(payload);

  if (scriptUrl) {
    const body = {
      action: SECRET_SETTINGS.google.email.actions.sendWorkshopRequest,
      to: payload.contact.email,
      cc: payload.mail?.cc || SECRET_SETTINGS.google.email.internalRecipient,
      fromName: payload.mail?.fromName || SECRET_SETTINGS.google.email.fromName,
      subject,
      html,
      text,
      payload,
    };
    const result = await postAppsScriptJson<{ sent?: boolean; error?: string }>(scriptUrl, body);
    if (!result.sent) throw new Error(result.error || "Apps Script non ha confermato l'invio email.");
    return { sent: true, html, subject };
  }

  return {
    sent: false,
    html,
    subject,
    text,
    recipients: [payload.contact.email, payload.mail?.cc || SECRET_SETTINGS.google.email.internalRecipient],
  };
}

export async function sendWorkflowNotification(payload: WorkflowNotificationPayload) {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const scriptUrl = env[SECRET_SETTINGS.google.env.appScriptDeploymentUrl];
  const recipientMap = SECRET_SETTINGS.google.email.testRecipients;
  const to = payload.recipients.map((role) => (role === "client" ? payload.project.email : payload.recipientEmails?.[role] || recipientMap[role]));
  const payloadWithAction = {
    ...payload,
    ...buildWorkflowAction(payload),
  };
  const text = buildWorkflowText(payloadWithAction, to);

  if (scriptUrl) {
    const body = {
      action: SECRET_SETTINGS.google.email.actions.sendWorkflowNotification,
      payload: withSessionPayload({
        ...payloadWithAction,
        to,
        text,
        fromName: payload.fromName || SECRET_SETTINGS.google.email.fromName,
        recipientLabels: payload.recipients,
      }),
    };
    const result = await postAppsScriptJson<{ sent?: boolean; subject?: string; recipients?: string[]; error?: string }>(scriptUrl, body);
    if (!result.sent) throw new Error(result.error || "Apps Script non ha confermato l'invio email.");
    return {
      sent: true,
      subject: result.subject || `FunniFin - ${payload.project.company} - ${payload.phase}`,
      recipients: result.recipients || to,
    };
  }

  return {
    sent: false,
    subject: `FunniFin - ${payload.project.company} - ${payload.phase}`,
    recipients: to,
  };
}
