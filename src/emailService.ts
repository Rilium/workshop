import { SECRET_SETTINGS } from "./secretSettings";

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

const LOGO_URL = typeof window !== "undefined"
  ? `${window.location.origin}/Logo.png`
  : "https://workshop-rilium.vercel.app/Logo.png";

function emailWrapper(inner: string) {
  return `<!DOCTYPE html>
<html lang="it">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FunniFin</title></head>
<body style="margin:0;padding:0;background:#f0f9fb;font-family:Nunito,Helvetica,Arial,sans-serif;-webkit-font-smoothing:antialiased;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0f9fb;padding:32px 16px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:620px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 32px rgba(0,79,84,0.10);">
      ${inner}
      <tr><td style="padding:20px 32px 24px;background:#f8fcfc;border-top:1px solid #e0f2f4;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9ab0b2;line-height:1.6;">
          FunniFin Workshop Planner &middot; Messaggio generato automaticamente.<br>
          Non rispondere a questa email.
        </p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

function buildEmailHtml(payload: WorkshopRequestEmailPayload) {
  const workshopRows = payload.workshops
    .map((workshop, i) => `
      <tr>
        <td style="padding:14px 16px;${i > 0 ? "border-top:1px solid #e8f4f6;" : ""}">
          <strong style="display:block;color:#171d1d;font-size:14px;margin-bottom:3px;">${workshop.title}</strong>
          <span style="color:#6b8a8c;font-size:12px;">${workshop.duration} &middot; ${workshop.format} &middot; ${workshop.date || "data da proporre"}${workshop.time ? " " + workshop.time : ""}${workshop.custom ? " &middot; su misura" : ""}</span>
        </td>
        <td align="right" style="padding:14px 16px;${i > 0 ? "border-top:1px solid #e8f4f6;" : ""}white-space:nowrap;">
          <strong style="color:#004f54;font-size:15px;">${euro(workshop.price)}</strong>
        </td>
      </tr>`)
    .join("");

  const quoteRows = [
    `<tr><td style="padding:4px 0;color:#5a7a7c;font-size:13px;">Subtotale</td><td align="right" style="padding:4px 0;font-size:13px;color:#2a5254;">${euro(payload.quote.gross)}</td></tr>`,
    `<tr><td style="padding:4px 0;color:#5a7a7c;font-size:13px;">${payload.quote.packageName}</td><td align="right" style="padding:4px 0;font-size:13px;color:#1a9e6a;font-weight:700;">−${euro(payload.quote.discount)}</td></tr>`,
    payload.quote.promoDiscount ? `<tr><td style="padding:4px 0;color:#5a7a7c;font-size:13px;">Sconto date promo</td><td align="right" style="padding:4px 0;font-size:13px;color:#1a9e6a;font-weight:700;">−${euro(payload.quote.promoDiscount)}</td></tr>` : "",
    payload.quote.customTotal ? `<tr><td style="padding:4px 0;color:#5a7a7c;font-size:13px;">Personalizzazione</td><td align="right" style="padding:4px 0;font-size:13px;color:#2a5254;">+${euro(payload.quote.customTotal)}</td></tr>` : "",
  ].join("");

  const inner = `
    <tr><td style="padding:32px 32px 24px;background:linear-gradient(135deg,#003f44 0%,#0d8b94 100%);text-align:center;">
      <img src="${LOGO_URL}" alt="FunniFin" height="44" style="display:block;margin:0 auto 20px;max-width:160px;object-fit:contain;" />
      <h1 style="margin:0 0 8px;font-size:22px;line-height:1.2;color:#ffffff;font-weight:800;">Richiesta workshop ricevuta</h1>
      <p style="margin:0;color:#a0dde4;font-size:14px;">La richiesta di <strong style="color:#ffffff;">${payload.contact.company}</strong> è stata ricevuta correttamente.</p>
    </td></tr>
    <tr><td style="padding:28px 32px 0;">
      <p style="margin:0 0 4px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#1cafb9;">Referente</p>
      <p style="margin:0;font-size:14px;color:#2a4244;line-height:1.7;">
        <strong>${payload.contact.firstName} ${payload.contact.lastName}</strong><br>
        <a href="mailto:${payload.contact.email}" style="color:#1cafb9;">${payload.contact.email}</a> &middot; ${payload.contact.phone}<br>
        ${payload.contact.company}
      </p>
    </td></tr>
    <tr><td style="padding:20px 32px 0;">
      <p style="margin:0 0 10px;font-size:10px;font-weight:700;letter-spacing:.09em;text-transform:uppercase;color:#1cafb9;">Workshop richiesti</p>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1.5px solid #cce8ec;border-radius:12px;overflow:hidden;background:#f8fcfc;">
        ${workshopRows}
      </table>
    </td></tr>
    <tr><td style="padding:16px 32px 28px;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff8e1;border-radius:12px;padding:16px 20px;">
        <tr><td>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            ${quoteRows}
            <tr><td colspan="2" style="padding-top:10px;border-top:1.5px solid #f5c842;"></td></tr>
            <tr>
              <td style="padding-top:8px;font-size:16px;font-weight:800;color:#004f54;">Totale</td>
              <td align="right" style="padding-top:8px;font-size:20px;font-weight:900;color:#004f54;">${euro(payload.quote.total)} <span style="font-size:12px;font-weight:600;color:#7a6a00;">+ IVA</span></td>
            </tr>
          </table>
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
    "Richiesta workshop FunniFin ricevuta",
    "",
    `Azienda: ${payload.contact.company}`,
    `Referente: ${payload.contact.firstName} ${payload.contact.lastName}`,
    `Email: ${payload.contact.email}`,
    `Telefono: ${payload.contact.phone}`,
    "",
    "Workshop:",
    workshops,
    "",
    `Totale: ${euro(payload.quote.total)} + IVA`,
    `Pacchetto: ${payload.quote.packageName}`,
  ].join("\n");
}

function buildWorkflowText(payload: WorkflowNotificationPayload, to: string[]) {
  const workshops = payload.workshops
    .map((workshop) => `- ${workshop.title}: ${workshop.duration} · ${workshop.format} · ${workshop.date || "data da confermare"} ${workshop.time || ""}${workshop.expertName ? ` · ${workshop.expertName}` : ""}`)
    .join("\n");

  return [
    `FunniFin - ${payload.project.company} - ${payload.phase}`,
    "",
    `Destinatari: ${to.join(", ")}`,
    `Progetto: ${payload.project.company}`,
    `Referente: ${payload.project.manager} · ${payload.project.email} · ${payload.project.phone}`,
    `Stato: ${payload.project.status}`,
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

async function postAppsScriptNoCors(scriptUrl: string, body: unknown) {
  await fetch(scriptUrl, {
    method: "POST",
    mode: "no-cors",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
  });
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
    try {
      const result = await postAppsScriptJson<{ sent?: boolean; error?: string }>(scriptUrl, body);
      if (!result.sent) throw new Error(result.error || "Apps Script non ha confermato l'invio email.");
      return { sent: true, html, subject, opaque: false };
    } catch {
      await postAppsScriptNoCors(scriptUrl, body);
      return { sent: true, html, subject, opaque: true };
    }
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
  const text = buildWorkflowText(payload, to);

  if (scriptUrl) {
    const body = {
      action: SECRET_SETTINGS.google.email.actions.sendWorkflowNotification,
      payload: {
        ...payload,
        to,
        text,
        fromName: payload.fromName || SECRET_SETTINGS.google.email.fromName,
        recipientLabels: payload.recipients,
      },
    };
    try {
      const result = await postAppsScriptJson<{ sent?: boolean; subject?: string; recipients?: string[]; error?: string }>(scriptUrl, body);
      if (!result.sent) throw new Error(result.error || "Apps Script non ha confermato l'invio email.");
      return {
        sent: true,
        subject: result.subject || `FunniFin - ${payload.project.company} - ${payload.phase}`,
        recipients: result.recipients || to,
        opaque: false,
      };
    } catch {
      await postAppsScriptNoCors(scriptUrl, body);
      return {
        sent: true,
        subject: `FunniFin - ${payload.project.company} - ${payload.phase}`,
        recipients: to,
        opaque: true,
      };
    }
  }

  return {
    sent: false,
    subject: `FunniFin - ${payload.project.company} - ${payload.phase}`,
    recipients: to,
  };
}
