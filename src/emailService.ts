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

function buildEmailHtml(payload: WorkshopRequestEmailPayload) {
  const rows = payload.workshops
    .map(
      (workshop) => `
        <tr>
          <td style="padding:12px;border-bottom:1px solid #e0e3e3;">
            <strong style="color:#171d1d;">${workshop.title}</strong><br />
            <span style="color:#747878;">${workshop.duration} · ${workshop.format} · ${workshop.date || "data da proporre"} ${workshop.time || ""}${workshop.custom ? " · su misura" : ""}</span>
          </td>
          <td align="right" style="padding:12px;border-bottom:1px solid #e0e3e3;color:#004f54;font-weight:800;">${euro(workshop.price)}</td>
        </tr>`,
    )
    .join("");

  return `
    <div style="margin:0;padding:24px;background:#f5fafb;font-family:Nunito,Arial,sans-serif;color:#171d1d;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;margin:0 auto;background:#ffffff;border:1px solid #d4edf2;border-radius:24px;overflow:hidden;">
        <tr>
          <td style="padding:28px;background:#e8f8f9;">
            <div style="width:48px;height:48px;border-radius:16px;background:#1cafb9;color:white;display:inline-block;text-align:center;line-height:48px;font-weight:900;font-size:26px;">F</div>
            <h1 style="margin:16px 0 6px;font-size:28px;line-height:1.1;color:#004f54;">Richiesta workshop ricevuta</h1>
            <p style="margin:0;color:#444748;">Recap del percorso FunniFin richiesto da ${payload.contact.company}.</p>
          </td>
        </tr>
        <tr>
          <td style="padding:24px;">
            <h2 style="margin:0 0 12px;font-size:18px;color:#004f54;">Contatto</h2>
            <p style="margin:0 0 18px;color:#444748;">
              ${payload.contact.firstName} ${payload.contact.lastName}<br />
              ${payload.contact.email} · ${payload.contact.phone}<br />
              ${payload.contact.company}
            </p>
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #e0e3e3;border-radius:16px;overflow:hidden;">
              ${rows}
            </table>
            <div style="margin-top:18px;padding:18px;border-radius:18px;background:#fff8dd;">
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Subtotale</span><strong>${euro(payload.quote.gross)}</strong></div>
              <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>${payload.quote.packageName}</span><strong style="color:#229763;">-${euro(payload.quote.discount)}</strong></div>
              ${
                payload.quote.promoDiscount
                  ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Date promo</span><strong style="color:#229763;">-${euro(payload.quote.promoDiscount)}</strong></div>`
                  : ""
              }
              ${
                payload.quote.customTotal
                  ? `<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span>Su misura</span><strong>+${euro(payload.quote.customTotal)}</strong></div>`
                  : ""
              }
              <div style="display:flex;justify-content:space-between;padding-top:12px;border-top:1px solid #f0a314;font-size:22px;color:#004f54;"><span>Totale</span><strong>${euro(payload.quote.total)} + IVA</strong></div>
            </div>
          </td>
        </tr>
      </table>
	    </div>`;
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

  if (scriptUrl) {
    const body = {
      action: SECRET_SETTINGS.google.email.actions.sendWorkshopRequest,
      to: payload.contact.email,
      cc: SECRET_SETTINGS.google.email.internalRecipient,
      subject,
      html,
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
    recipients: [payload.contact.email, SECRET_SETTINGS.google.email.internalRecipient],
  };
}

export async function sendWorkflowNotification(payload: WorkflowNotificationPayload) {
  const env = (import.meta as unknown as { env: Record<string, string | undefined> }).env;
  const scriptUrl = env[SECRET_SETTINGS.google.env.appScriptDeploymentUrl];
  const recipientMap = SECRET_SETTINGS.google.email.testRecipients;
  const to = payload.recipients.map((role) => (role === "client" ? payload.project.email : recipientMap[role]));

  if (scriptUrl) {
    const body = {
      action: SECRET_SETTINGS.google.email.actions.sendWorkflowNotification,
      payload: {
        ...payload,
        to,
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
