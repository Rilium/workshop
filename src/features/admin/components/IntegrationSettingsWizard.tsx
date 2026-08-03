import React, { useEffect, useMemo, useRef, useState } from "react";
import { CalendarCheck, Check, FolderKanban, Mail, RefreshCw } from "../../../components/ui/FaIcons";
import { AppButton } from "../../../components/ui/AppButton";
import { Stepper } from "../../../components/ui/Stepper";
import {
  sendIntegrationTestEmail,
  testIntegrationSettings,
  updateIntegrationProperties,
  type GoogleHealth,
  type IntegrationSettingsTest,
  type WorkspaceSetting,
} from "../../../googleAdminService";

const INTEGRATION_STEPS = ["Calendario", "Dati e Drive", "Email"] as const;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
type IntegrationStep = (typeof INTEGRATION_STEPS)[number];

type IntegrationDraft = {
  calendarId: string;
  calendarName: string;
  driveRootFolderId: string;
  slidesRootFolderId: string;
  fromName: string;
  replyTo: string;
  senderAlias: string;
};

function buildDraft(settings: Map<string, WorkspaceSetting>, health: GoogleHealth | null): IntegrationDraft {
  return {
    calendarId: settings.get("calendar.id")?.value || health?.calendar.id || "",
    calendarName: settings.get("calendar.name")?.value || health?.calendar.name || "",
    driveRootFolderId: settings.get("drive.rootFolderId")?.value || health?.drive.rootFolderId || "",
    slidesRootFolderId: settings.get("drive.slidesRootFolderId")?.value || health?.drive.slidesRootFolderId || "",
    fromName: settings.get("mail.fromName")?.value || health?.mail.fromName || "FunniFin Workshop Planner",
    replyTo: settings.get("mail.replyTo")?.value || health?.mail.replyTo || "",
    senderAlias: settings.get("mail.senderAlias")?.value || health?.mail.senderAlias || "",
  };
}

export function IntegrationSettingsWizard({
  health,
  settings,
  onSave,
  onRefresh,
  notify,
}: {
  health: GoogleHealth | null;
  settings: WorkspaceSetting[];
  onSave: (settings: WorkspaceSetting[]) => Promise<WorkspaceSetting[]>;
  onRefresh: () => void;
  notify: (title: string, body: string) => void;
}) {
  const settingsMap = useMemo(() => new Map(settings.map((setting) => [setting.key, setting])), [settings]);
  const [step, setStep] = useState<IntegrationStep>("Calendario");
  const [draft, setDraft] = useState<IntegrationDraft>(() => buildDraft(settingsMap, health));
  const [busy, setBusy] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const [testSending, setTestSending] = useState(false);
  const [verified, setVerified] = useState<Partial<Record<IntegrationStep, IntegrationSettingsTest>>>({});
  const onRefreshRef = useRef(onRefresh);

  useEffect(() => {
    setDraft(buildDraft(settingsMap, health));
  }, [settingsMap, health]);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  useEffect(() => {
    if (step !== "Email") return;
    const refreshAfterGoogleFlow = () => onRefreshRef.current();
    window.addEventListener("focus", refreshAfterGoogleFlow);
    return () => window.removeEventListener("focus", refreshAfterGoogleFlow);
  }, [step]);

  const updateDraft = (patch: Partial<IntegrationDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setVerified((current) => {
      const next = { ...current };
      delete next[step];
      return next;
    });
  };

  const stepIndex = INTEGRATION_STEPS.indexOf(step);
  const availableAliases = health?.mail.aliases || [];
  const gmailAuthorizationRequired = health?.mail.authorizationRequired === true;
  const senderAliasIsAvailable = !draft.senderAlias || availableAliases.includes(draft.senderAlias);
  const replyToIsValid = !draft.replyTo.trim() || EMAIL_PATTERN.test(draft.replyTo.trim());
  const testRecipientIsValid = EMAIL_PATTERN.test(testRecipient.trim());
  const canVerify = step === "Calendario"
    ? Boolean(draft.calendarId.trim() || draft.calendarName.trim())
    : step === "Dati e Drive"
      ? Boolean(draft.driveRootFolderId.trim() || draft.slidesRootFolderId.trim())
      : Boolean(draft.fromName.trim()) && replyToIsValid && senderAliasIsAvailable && !gmailAuthorizationRequired;

  const verifyAndSave = async () => {
    if (!canVerify) return;
    setBusy(true);
    try {
      const test = await testIntegrationSettings({
        scope: step === "Calendario" ? "calendar" : step === "Dati e Drive" ? "storage" : "mail",
        calendarId: draft.calendarId,
        calendarName: draft.calendarName,
        driveRootFolderId: draft.driveRootFolderId,
        slidesRootFolderId: draft.slidesRootFolderId,
        fromName: draft.fromName,
        replyTo: draft.replyTo,
        senderAlias: draft.senderAlias,
      });
      const toSave: WorkspaceSetting[] = step === "Calendario"
        ? [
          { key: "calendar.id", value: test.calendar?.id || draft.calendarId.trim(), group: "provider", label: "Calendar ID" },
          { key: "calendar.name", value: test.calendar?.name || draft.calendarName.trim(), group: "provider", label: "Calendar name" },
        ]
        : step === "Dati e Drive"
          ? [
            { key: "drive.rootFolderId", value: draft.driveRootFolderId.trim(), group: "provider", label: "Drive root materiali" },
            { key: "drive.slidesRootFolderId", value: draft.slidesRootFolderId.trim(), group: "provider", label: "Drive root Slides" },
          ]
          : [
            { key: "mail.senderAlias", value: draft.senderAlias.trim().toLowerCase(), group: "mail", label: "Indirizzo mittente" },
            { key: "mail.fromName", value: draft.fromName.trim(), group: "mail", label: "Nome mittente" },
            { key: "mail.replyTo", value: draft.replyTo.trim().toLowerCase(), group: "mail", label: "Rispondi a" },
          ];
      await onSave(toSave);
      await updateIntegrationProperties({
        scope: test.scope,
        calendarId: test.calendar?.id || draft.calendarId,
        calendarName: test.calendar?.name || draft.calendarName,
        driveRootFolderId: draft.driveRootFolderId,
        slidesRootFolderId: draft.slidesRootFolderId,
        senderAlias: draft.senderAlias,
        fromName: draft.fromName,
        replyTo: draft.replyTo,
      });
      setVerified((current) => ({ ...current, [step]: test }));
      notify("Configurazione verificata", `${step}: collegamento Google valido e impostazioni salvate.`);
      onRefresh();
    } catch (error) {
      notify("Configurazione non salvata", error instanceof Error ? error.message : "Verifica Google non riuscita.");
    } finally {
      setBusy(false);
    }
  };

  const advance = () => {
    const next = INTEGRATION_STEPS[stepIndex + 1];
    if (next) setStep(next);
  };

  const sendTestEmail = async () => {
    if (!testRecipientIsValid) return;
    setTestSending(true);
    try {
      const result = await sendIntegrationTestEmail({
        to: testRecipient.trim().toLowerCase(),
        senderAlias: draft.senderAlias,
        fromName: draft.fromName,
        replyTo: draft.replyTo,
      });
      notify("Email di test inviata", `Da ${result.senderEmail} a ${result.to}.`);
    } catch (error) {
      notify("Test email non riuscito", error instanceof Error ? error.message : "Google non ha autorizzato il mittente.");
    } finally {
      setTestSending(false);
    }
  };

  return (
    <section className="integration-settings-wizard" aria-labelledby="integration-settings-title">
      <div className="integration-settings-head">
        <div>
          <span className="eyebrow">Configurazione rapida</span>
          <strong id="integration-settings-title">Dove lavora FunniFin</strong>
          <p>Controlla Calendar, archiviazione e mittente senza modificare codice o variabili tecniche.</p>
        </div>
        <AppButton type="button" variant="outline" onClick={onRefresh}>
          <RefreshCw size={16} /> Rileggi configurazione
        </AppButton>
      </div>

      <Stepper steps={[...INTEGRATION_STEPS]} activeStep={step} onStep={(value) => setStep(value as IntegrationStep)}>
        {step === "Calendario" ? (
          <div className="integration-step-panel">
            <div className="integration-step-title"><CalendarCheck size={20} /><div><strong>Calendario eventi</strong><span>Qui vengono creati gli eventi dei workshop.</span></div></div>
            <div className="auth-invite-grid">
              <label className="auth-invite-field">Calendar ID<input value={draft.calendarId} onChange={(event) => updateDraft({ calendarId: event.target.value })} placeholder="primary o ID calendario" /></label>
              <label className="auth-invite-field">Nome calendario<input value={draft.calendarName} onChange={(event) => updateDraft({ calendarName: event.target.value })} placeholder="FunniFin Workshop" /></label>
            </div>
            {verified.Calendario?.calendar ? <div className="integration-verified"><Check size={16} /><span>Collegato a {verified.Calendario.calendar.name}</span></div> : null}
          </div>
        ) : step === "Dati e Drive" ? (
          <div className="integration-step-panel">
            <div className="integration-step-title"><FolderKanban size={20} /><div><strong>Dati e cartelle</strong><span>Lo Sheet contiene richieste e configurazione; Drive contiene materiali e slide.</span></div></div>
            <div className="integration-current-destination">
              <span>Google Sheet attivo</span>
              <strong>{health?.spreadsheet.id || "Da verificare"}</strong>
              {health?.spreadsheet.url ? <a href={health.spreadsheet.url} target="_blank" rel="noreferrer">Apri Sheet</a> : null}
              <small>Il cambio dello Sheet richiede una migrazione dei dati e degli accessi, quindi non viene trattato come un semplice campo.</small>
            </div>
            <div className="auth-invite-grid">
              <label className="auth-invite-field">Cartella materiali Drive<input value={draft.driveRootFolderId} onChange={(event) => updateDraft({ driveRootFolderId: event.target.value })} placeholder="ID cartella Drive" /></label>
              <label className="auth-invite-field">Cartella master e slide<input value={draft.slidesRootFolderId} onChange={(event) => updateDraft({ slidesRootFolderId: event.target.value })} placeholder="ID cartella Drive" /></label>
            </div>
            {verified["Dati e Drive"]?.drive ? <div className="integration-verified"><Check size={16} /><span>Cartelle accessibili dall'account Apps Script</span></div> : null}
          </div>
        ) : (
          <div className="integration-step-panel">
            <div className="integration-step-title"><Mail size={20} /><div><strong>Mittente email</strong><span>Google invia dall'account proprietario dello script.</span></div></div>
            <div className={`integration-consent-card ${gmailAuthorizationRequired ? "required" : "ready"}`}>
              <div>
                {gmailAuthorizationRequired ? <strong>1. Autorizza Gmail</strong> : <strong><Check size={16} /> 1. Gmail autorizzato</strong>}
                <span>{gmailAuthorizationRequired ? "Google deve consentire al backend di leggere gli alias e inviare con il sender scelto." : "Il backend può leggere gli alias verificati dell'account."}</span>
              </div>
              {gmailAuthorizationRequired && health?.mail.authorizationUrl ? (
                <a className="app-btn app-btn-primary" href={health.mail.authorizationUrl} target="_blank" rel="noreferrer">Apri consenso Google</a>
              ) : (
                <AppButton type="button" variant="outline" onClick={onRefresh}>Rileggi permessi</AppButton>
              )}
            </div>
            <div className="integration-consent-card ready">
              <div>
                <strong>{availableAliases.length ? <><Check size={16} /> 2. Alias disponibili</> : "2. Aggiungi un alias (opzionale)"}</strong>
                <span>{availableAliases.length ? `${availableAliases.length} indirizzi “Invia come” trovati.` : "Senza alias le mail partono dall'account principale Apps Script."}</span>
              </div>
              <a className="app-btn app-btn-outline" href="https://mail.google.com/mail/u/0/#settings/accounts" target="_blank" rel="noreferrer">Gestisci alias Gmail</a>
            </div>
            <div className="integration-current-destination">
              <span>Mittente reale</span>
              <strong>{health?.mail.senderEmail || "Rileva dal backend"}</strong>
              <small>Il menu contiene soltanto il proprietario e gli alias “Invia come” che Google ha già verificato.</small>
            </div>
            <div className="auth-invite-grid">
              <label className="auth-invite-field">
                Indirizzo mittente
                <select value={draft.senderAlias} onChange={(event) => updateDraft({ senderAlias: event.target.value })}>
                  <option value="">Account principale · {health?.mail.primarySenderEmail || "Apps Script"}</option>
                  {availableAliases.map((alias) => <option value={alias} key={alias}>{alias}</option>)}
                </select>
              </label>
              <label className="auth-invite-field">Nome visibile<input value={draft.fromName} onChange={(event) => updateDraft({ fromName: event.target.value })} placeholder="FunniFin Workshop Planner" /></label>
              <label className="auth-invite-field">Rispondi a<input type="email" value={draft.replyTo} onChange={(event) => updateDraft({ replyTo: event.target.value })} placeholder="team@azienda.it" /></label>
            </div>
            {!senderAliasIsAvailable ? <p className="admin-email-error">L'alias salvato non è più autorizzato: scegline uno disponibile o usa l'account principale.</p> : null}
            {!replyToIsValid ? <p className="admin-email-error">Inserisci un indirizzo completo, per esempio nome@azienda.it.</p> : null}
            {verified.Email?.mail ? <div className="integration-verified"><Check size={16} /><span>{verified.Email.mail.provider} · quota {verified.Email.mail.remainingDailyQuota}</span></div> : null}
            {verified.Email?.mail ? (
              <div className="integration-email-test">
                <label className="auth-invite-field">Destinatario prova<input type="email" value={testRecipient} onChange={(event) => setTestRecipient(event.target.value)} placeholder="prova@azienda.it" /></label>
                <AppButton type="button" variant="outline" loading={testSending} disabled={!testRecipientIsValid} onClick={() => void sendTestEmail()}>Invia email di prova</AppButton>
              </div>
            ) : null}
          </div>
        )}
      </Stepper>

      <div className="integration-settings-actions">
        <AppButton type="button" variant="primary" loading={busy} disabled={!canVerify} onClick={() => void verifyAndSave()}>
          Verifica e salva
        </AppButton>
        {verified[step] && stepIndex < INTEGRATION_STEPS.length - 1 ? (
          <AppButton type="button" variant="secondary" onClick={advance}>Continua</AppButton>
        ) : null}
      </div>
    </section>
  );
}
