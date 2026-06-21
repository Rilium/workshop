import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Banknote,
  BookOpen,
  BriefcaseBusiness,
  CalendarCheck,
  Check,
  ChevronLeft,
  CircleDollarSign,
  Clock3,
  ExternalLink,
  FileCheck2,
  FolderKanban,
  InfoIcon,
  Menu,
  Megaphone,
  Palette,
  Presentation,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  SlidersHorizontal,
  Sparkles,
  Trash2,
  UploadCloud,
  UsersRound,
  Video,
  X,
} from "lucide-react";
import type { WorkflowNotificationRecipientRole } from "../../../emailService";
import type { RequestWorkshopRecord } from "../../../requestService";
import { workshops } from "../../../data/catalog";
import { projectStatuses, statusDescription, statusLabel } from "../../../data/workflow";
import { SECRET_SETTINGS } from "../../../secretSettings";
import type { AdminProject, AdminProjectWorkshopRow, CalendarEventRecord, DateDecision, Duration, Format, PricingRule, ProjectStatus, Workshop } from "../../../types/domain";
import type { AdminActionModalState, NotificationChoice } from "../../../types/ui";
import { money } from "../../../utils/money";
import { getWorkshopSelectionPrice } from "../../../utils/workshop";
import { AppButton } from "../../../components/ui/AppButton";
import { EventLink } from "../../../components/ui/EventLink";
import { Info } from "../../../components/ui/Info";

export function AdminActionModal({
  modal,
  rows,
  project,
  recipientEmails,
  eventPrechecks,
  eventRecord,
  canConfirmEvent,
  brandApprovedForCalendar,
  rules,
  expertCount,
  onClose,
  onConfirmDate,
  onConfirmExpert,
  onInviteExperts,
  onConfirmBrandHandoff,
  onConfirmEvent,
  onSaveRequestEdit,
  onSaveRule,
}: {
  modal: AdminActionModalState;
  rows: AdminProjectWorkshopRow[];
  project: AdminProject;
  recipientEmails: Partial<Record<WorkflowNotificationRecipientRole, string>>;
  eventPrechecks: Array<{ label: string; done: boolean }>;
  eventRecord?: CalendarEventRecord;
  canConfirmEvent: boolean;
  brandApprovedForCalendar: boolean;
  rules: PricingRule[];
  expertCount: number;
  onClose: () => void;
  onConfirmDate: (workshopId: string, decision: DateDecision, notification: NotificationChoice) => Promise<void> | void;
  onConfirmExpert: (workshopId: string, expertName: string, mode: "assign" | "reassign", notification: NotificationChoice) => Promise<void> | void;
  onInviteExperts: (notification: NotificationChoice) => Promise<void> | void;
  onConfirmBrandHandoff: (notification: NotificationChoice) => Promise<void> | void;
  onConfirmEvent: (notification: NotificationChoice) => Promise<void> | void;
  onSaveRequestEdit: (records: RequestWorkshopRecord[], phase: ProjectStatus, notification: NotificationChoice) => Promise<void> | void;
  onSaveRule: (ruleId: string, patch: Partial<PricingRule>) => Promise<void> | void;
}) {
  const rule = modal.type === "price" ? rules.find((item) => item.id === modal.ruleId) ?? rules[0] : rules[0];
  const [draftRule, setDraftRule] = useState({
    name: rule?.name ?? "",
    min: rule?.min ?? 1,
    max: rule?.max ?? 1,
    discountPercent: rule?.discountPercent ?? 0,
    specialQuote: Boolean(rule?.specialQuote),
  });
  const notificationContextKey = rows.map((row) => `${row.workshop.id}:${row.approval}`).join("|");
  const [notification, setNotification] = useState<NotificationChoice>(() => getDefaultNotificationChoice(modal, rows));
  const [selectedExpertWorkshopId, setSelectedExpertWorkshopId] = useState(
    modal.type === "expert" ? modal.workshopId ?? rows[0]?.workshop.id ?? "" : "",
  );
  const [requestPhase, setRequestPhase] = useState<ProjectStatus>(project.status);
  const [pendingAction, setPendingAction] = useState<
    "edit_request" | "date" | "expert" | "open_candidacies" | "brand_handoff" | "confirm_event" | "price" | null
  >(null);
  const [requestDraft, setRequestDraft] = useState<Record<string, RequestWorkshopRecord>>(() => {
    if (modal.type !== "edit_request") return {};
    return Object.fromEntries(
      rows.map((row) => [
        row.workshop.id,
        {
          workshopId: row.workshop.id,
          title: row.workshop.title,
          duration: row.duration,
          format: row.format,
          date: row.date,
          time: row.time,
          price: getWorkshopSelectionPrice(row.workshop, { duration: row.duration, format: row.format, custom: false }).total,
          custom: false,
          status: "selezionato",
          approval: row.approval,
          expertName: row.assignedExpert,
        } satisfies RequestWorkshopRecord,
      ]),
    );
  });

  useEffect(() => {
    setDraftRule({
      name: rule?.name ?? "",
      min: rule?.min ?? 1,
      max: rule?.max ?? 1,
      discountPercent: rule?.discountPercent ?? 0,
      specialQuote: Boolean(rule?.specialQuote),
    });
  }, [rule?.id, rule?.name, rule?.min, rule?.max, rule?.discountPercent, rule?.specialQuote]);
  useEffect(() => {
    setNotification(getDefaultNotificationChoice(modal, rows));
  }, [modal, notificationContextKey]);
  useEffect(() => {
    if (modal.type === "expert") setSelectedExpertWorkshopId(modal.workshopId ?? rows[0]?.workshop.id ?? "");
  }, [modal, notificationContextKey]);
  useEffect(() => {
    if (modal.type !== "edit_request") return;
    setRequestPhase(project.status);
    setRequestDraft(
      Object.fromEntries(
        rows.map((row) => [
          row.workshop.id,
          {
            workshopId: row.workshop.id,
            title: row.workshop.title,
            duration: row.duration,
            format: row.format,
            date: row.date,
            time: row.time,
            price: getWorkshopSelectionPrice(row.workshop, { duration: row.duration, format: row.format, custom: false }).total,
            custom: false,
            status: "selezionato",
            approval: row.approval,
            expertName: row.assignedExpert,
          } satisfies RequestWorkshopRecord,
        ]),
      ),
    );
  }, [modal, notificationContextKey, project.status]);
  useEffect(() => {
    setPendingAction(null);
  }, [modal.type, modal.type === "date" ? modal.workshopId : "", modal.type === "expert" ? modal.workshopId : "", modal.type === "price" ? modal.ruleId : ""]);

  const runModalAction = async (
    actionKey: NonNullable<typeof pendingAction>,
    handler: () => Promise<void> | void,
  ) => {
    if (pendingAction) return;
    setPendingAction(actionKey);
    try {
      await Promise.resolve(handler());
      onClose();
    } finally {
      setPendingAction(null);
    }
  };

  const row =
    modal.type === "date"
      ? rows.find((item) => item.workshop.id === modal.workshopId)
      : modal.type === "expert"
        ? rows.find((item) => item.workshop.id === selectedExpertWorkshopId)
        : undefined;
  const editedRecords = Object.values(requestDraft);
  const editedQuoteTotal = editedRecords.reduce((total, record) => {
    const workshop = workshops.find((item) => item.id === record.workshopId);
    if (!workshop) return total;
    return total + getWorkshopSelectionPrice(workshop, { duration: record.duration, format: record.format, custom: record.custom }).total;
  }, 0);
  const toggleDraftWorkshop = (workshop: Workshop) => {
    setRequestDraft((current) => {
      if (current[workshop.id]) {
        const next = { ...current };
        delete next[workshop.id];
        return next;
      }
      return {
        ...current,
        [workshop.id]: {
          workshopId: workshop.id,
          title: workshop.title,
          duration: workshop.durationOptions[0],
          format: workshop.formatOptions[0],
          date: "",
          time: "10:00",
          price: getWorkshopSelectionPrice(workshop, { duration: workshop.durationOptions[0], format: workshop.formatOptions[0], custom: false }).total,
          custom: false,
          status: "selezionato",
          approval: "pending",
        },
      };
    });
  };
  const updateDraftWorkshop = (workshopId: string, patch: Partial<RequestWorkshopRecord>) => {
    setRequestDraft((current) => ({
      ...current,
      [workshopId]: {
        ...current[workshopId],
        ...patch,
      },
    }));
  };
  const decisionCopy: Record<DateDecision, { title: string; action: string; body: string }> = {
    approved: {
      title: "Approva data",
      action: "Approva data",
      body: "Valida questa proposta e sblocca il percorso quando tutte le date del progetto risultano approvate.",
    },
    change_requested: {
      title: "Chiedi modifica data",
      action: "Chiedi modifica",
      body: "Rimanda la proposta al cliente: serve una nuova data o una nuova fascia oraria per questo workshop.",
    },
    rejected: {
      title: "Rifiuta data",
      action: "Rifiuta data",
      body: "Marca la proposta come non valida: il workshop resta da ripianificare prima di aprire il passaggio successivo.",
    },
  };
  const title =
    modal.type === "edit_request"
      ? "Modifica richiesta cliente"
      : modal.type === "date"
      ? decisionCopy[modal.decision].title
      : modal.type === "expert"
        ? modal.mode === "reassign"
          ? "Riapri assegnazione esperto"
          : "Assegna esperto"
        : modal.type === "open_candidacies"
          ? "Invita esperti"
        : modal.type === "brand_handoff"
          ? "Manda a brand"
        : modal.type === "price"
          ? "Modifica regola prezzo"
          : "Conferma evento";
  const dateApprovalCompletesAll =
    modal.type === "date" &&
    modal.decision === "approved" &&
    rows.length > 0 &&
    rows.every((item) => (item.workshop.id === modal.workshopId ? "approved" : item.approval) === "approved");
  const showNotification = modal.type !== "price" && !(modal.type === "date" && modal.decision === "approved" && !dateApprovalCompletesAll);
  const showImpact = true;
  const needsBrandBypass = modal.type === "confirm_event" && notification.eventMode === "confirmed" && !brandApprovedForCalendar;
  const canRunConfirmEvent = canConfirmEvent && (!needsBrandBypass || Boolean(notification.bypassBrandApproval));
  const normalizedDiscount = Math.min(100, Math.max(0, Number(draftRule.discountPercent) || 0));
  const normalizedMin = Math.max(1, Number(draftRule.min) || 1);
  const normalizedMax = Math.max(normalizedMin, Number(draftRule.max) || normalizedMin);
  const pricePreviewCount = normalizedMax >= 99 ? Math.max(normalizedMin, 6) : normalizedMax;
  const pricePreviewGross = pricePreviewCount * 1000;
  const pricePreviewTotal = Math.round(pricePreviewGross * (1 - normalizedDiscount / 100));
  const selectedRecipients = notification.recipients.map((role) => `${recipientLabels[role]} · ${role === "client" ? project.email : recipientEmails[role] || SECRET_SETTINGS.google.email.roleRecipients[role] || "non configurata"}`);
  const emailImpact = notification.send && selectedRecipients.length > 0
    ? `Email: al click inviamo un aggiornamento a ${selectedRecipients.join(" / ")}.`
    : "Email: al click salvi solo l'azione, senza inviare messaggi.";
  const calendarGuestImpact = notification.addClientToCalendar
    ? `Calendar: il cliente ${project.email} viene aggiunto tra gli invitati.`
    : "Calendar: l'evento resta interno, senza invitare il cliente.";
  const workflowImpact = (() => {
    if (modal.type === "edit_request") {
      return [
        `Richiesta: salva ${editedRecords.length} workshop, aggiorna il preventivo a ${money(editedQuoteTotal)} + IVA e mostra "${statusLabel[requestPhase]}".`,
        emailImpact,
        "Calendario: non crea eventi; aggiorna solo il riepilogo della richiesta.",
        "Registro: la modifica viene salvata nello storico del progetto.",
      ];
    }
    if (modal.type === "date") {
      const completesAllDates =
        modal.decision === "approved" &&
        rows.length > 0 &&
        rows.every((item) => (item.workshop.id === modal.workshopId ? "approved" : item.approval) === "approved");
      return [
        `Stato: ${modal.decision === "approved" ? (completesAllDates ? "tutte le date risultano approvate" : "approva solo questa data") : modal.decision === "change_requested" ? "chiede una nuova proposta data" : "marca la proposta come rifiutata"}.`,
        emailImpact,
        "Calendario: non crea ancora l'evento; la creazione avviene nella conferma finale.",
        "Materiali: non cambia catalogo o slide, usa solo il workshop già scelto.",
      ];
    }
    if (modal.type === "expert") {
      return [
        `Stato: ${modal.mode === "reassign" ? "riapre la candidatura e rimuove l'esperto" : `assegna ${modal.expertName || "l'esperto selezionato"} al workshop scelto`}.`,
        emailImpact,
        "Calendario: non invita ancora l'esperto; l'evento si prepara più avanti.",
        "Materiali: mantiene workshop e slide già collegati.",
      ];
    }
    if (modal.type === "open_candidacies") {
      return [
        "Stato: rende il progetto visibile agli esperti compatibili.",
        emailImpact,
        "Area esperto: gli esperti vedono l'opportunità e possono candidarsi.",
        "Dopo il click: l'esperto conferma disponibilità e interesse in app.",
      ];
    }
    if (modal.type === "brand_handoff") {
      return [
        "Stato: manda il progetto alla revisione brand.",
        emailImpact,
        "Calendario: non crea eventi; prima si chiude la revisione dei materiali.",
        "Materiali: passa al team brand i deck collegati al progetto.",
      ];
    }
    if (modal.type === "confirm_event") {
      return [
        `Stato: crea un evento ${notification.eventMode === "tentative" ? "provvisorio" : "definitivo"} e aggiorna il progetto.`,
        emailImpact,
        calendarGuestImpact,
        `Calendario: crea un evento Google Calendar ${notification.eventMode === "tentative" ? "in bozza" : "confermato"} con Meet e workshop collegati.`,
        needsBrandBypass
          ? "Materiali: bypass Brand attivo, il definitivo nasce senza deck finale approvato dal Brand."
          : "Materiali: collega presentazioni e deck finale gia approvati.",
      ];
    }
    if (modal.type === "price") {
      return [
        `Prezzi: salva "${draftRule.name || rule.name}" per ${normalizedMin}-${normalizedMax >= 99 ? "6+" : normalizedMax} workshop.`,
        draftRule.specialQuote ? "Preventivo: il cliente vede il percorso senza il prezzo calcolato in automatico." : `Preventivo: esempio ${pricePreviewCount} workshop passa da ${money(pricePreviewGross)} a ${money(pricePreviewTotal)}.`,
        "Email: non invia comunicazioni.",
        "Catalogo: non modifica workshop o slide, cambia solo la regola prezzo.",
      ];
    }
    return [];
  })();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-action-title">
      <section className={`custom-modal admin-action-modal${modal.type === "confirm_event" ? " confirm-event-modal" : ""}`}>
        <header className="modal-header">
          <div>
            <span className="topic-badge">FunniFin</span>
            <h2 id="admin-action-title">{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body">
          {modal.type === "edit_request" && (
            <div className="modal-stack">
              <p>
                Aggiorna la richiesta prima di procedere: puoi cambiare workshop, formato, durata, date e totale.
              </p>
              <div className="request-edit-summary">
                <Info label="Cliente" value={project.company} />
                <Info label="Fase" value={statusLabel[requestPhase]} />
                <Info label="Workshop" value={`${editedRecords.length} selezionati`} />
                <Info label="Preventivo aggiornato" value={`${money(editedQuoteTotal)} + IVA`} />
              </div>
              <label className="request-phase-field">
                Fase progetto
                <select value={requestPhase} onChange={(event) => setRequestPhase(event.target.value as ProjectStatus)}>
                  {projectStatuses.map((status) => (
                    <option key={status} value={status}>{statusLabel[status]}</option>
                  ))}
                </select>
                <span>{statusDescription[requestPhase]}</span>
              </label>
              <div className="request-edit-list" aria-label="Modifica workshop richiesta">
                {workshops.map((workshop) => {
                  const draft = requestDraft[workshop.id];
                  const selected = Boolean(draft);
                  return (
                    <article className={selected ? "selected" : ""} key={workshop.id}>
                      <button type="button" className="request-edit-toggle" onClick={() => toggleDraftWorkshop(workshop)}>
                        {selected ? <Check size={17} /> : <Plus size={17} />}
                      </button>
                      <div className="request-edit-main">
                        <strong>{workshop.title}</strong>
                        <span>{workshop.durationOptions.join(" / ")} · {workshop.formatOptions.join(" / ")} / {workshop.level.toUpperCase()}</span>
                      </div>
                      {selected && (
                        <div className="request-edit-controls">
                          <label>
                            Durata
                            <select value={draft.duration} onChange={(event) => updateDraftWorkshop(workshop.id, { duration: event.target.value as Duration })}>
                              {workshop.durationOptions.map((duration) => (
                                <option key={duration} value={duration}>{duration}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Formato
                            <select value={draft.format} onChange={(event) => updateDraftWorkshop(workshop.id, { format: event.target.value as Format })}>
                              {workshop.formatOptions.map((format) => (
                                <option key={format} value={format}>{format}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Data
                            <input value={draft.date} type="date" onChange={(event) => updateDraftWorkshop(workshop.id, { date: event.target.value, approval: "pending" })} />
                          </label>
                          <label>
                            Ora
                            <input value={draft.time} type="time" onChange={(event) => updateDraftWorkshop(workshop.id, { time: event.target.value })} />
                          </label>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {editedRecords.length === 0 && <p className="modal-warning">Lascia almeno un workshop nella richiesta.</p>}
            </div>
          )}
          {modal.type === "date" && row && (
            <div className="modal-stack">
              <p>{decisionCopy[modal.decision].body}</p>
              <div className="modal-points single">
                <Info label="Workshop" value={row.workshop.title} />
                <Info label="Data proposta" value={`${row.date} · ${row.time} · ${row.duration} · ${row.format}`} />
                <Info label="Stato attuale" value={row.approval === "pending" ? "da verificare" : row.approval} />
              </div>
            </div>
          )}
          {modal.type === "expert" && (
            <div className="modal-stack">
              <p>
                {modal.mode === "reassign"
                  ? "Il workshop torna in candidatura e l'esperto assegnato viene rimosso."
                  : "Scegli il workshop da assegnare a questo esperto e conferma l'assegnazione operativa."}
              </p>
              {modal.mode === "assign" && (
                <div className="modal-workshop-picker" aria-label="Scegli workshop da assegnare">
                  {rows.map((item) => (
                    <button
                      key={item.workshop.id}
                      type="button"
                      className={selectedExpertWorkshopId === item.workshop.id ? "active" : ""}
                      onClick={() => setSelectedExpertWorkshopId(
                        selectedExpertWorkshopId === item.workshop.id ? "" : item.workshop.id
                      )}
                    >
                      <span>{item.assignedExpert ? `assegnato a ${item.assignedExpert}` : "da assegnare"}</span>
                      <strong>{item.workshop.title}</strong>
                      <em>{item.duration} · {item.format} / {item.workshop.level.toUpperCase()}</em>
                    </button>
                  ))}
                </div>
              )}
              {row ? (
                <div className="modal-points single">
                  <Info label="Workshop" value={row.workshop.title} />
                  <Info label="Esperto" value={modal.expertName || row.assignedExpert || "Da assegnare"} />
                  <Info label="Cliente" value={project.company} />
                </div>
              ) : (
                <p className="modal-warning">Nessun workshop disponibile per questo progetto.</p>
              )}
            </div>
          )}
          {modal.type === "open_candidacies" && (
            <div className="modal-stack">
              <p>Rende visibile il progetto agli esperti compatibili. L'invio mail resta facoltativo.</p>
              <div className="modal-points single">
                <Info label="Esperti compatibili" value={`${expertCount} profili compatibili/test`} />
                <Info label="Azione in app" value="Mi candido" />
                <Info label="Dove appare" value="Area Esperto, lista opportunità" />
              </div>
              <div className="candidate-confirm-card">
                <span className="workshop-badge">Area esperto</span>
                <strong>Nuove opportunità FunniFin per {project.company}</strong>
                <p>
                  L'esperto vede workshop, date proposte e pulsante “Mi candido”. Da lì conferma disponibilità e interesse.
                </p>
              </div>
            </div>
          )}
          {modal.type === "confirm_event" && (
            <div className="modal-stack">
              <p>
                Crea l'evento, collega Meet e materiali, poi porta il progetto verso la conferma finale.
              </p>
              <div className="precheck-list">
                {eventPrechecks.map((item) => (
                  <span key={item.label} className={item.done ? "done" : "missing"}>
                    {item.done ? <Check size={16} /> : <AlertCircle size={16} />}
                    {item.label}
                  </span>
                ))}
              </div>
              <div className="event-summary-row">
                <Info label="Cliente" value={project.company} />
                <Info label="Workshop" value={`${rows.length} collegati`} />
                <Info label="Evento" value={eventRecord ? eventRecord.id : "da creare"} />
                {eventRecord && <Info label="Meet" value={<EventLink href={eventRecord.meetLink} label="Apri Meet" />} />}
                {eventRecord?.htmlLink && <Info label="Calendar" value={<EventLink href={eventRecord.htmlLink} label="Apri Calendar" />} />}
              </div>
              {needsBrandBypass && (
                <div className="brand-bypass-panel" role="alert">
                  <div>
                    <AlertCircle size={18} />
                    <span>
                      <strong>Vuoi finalizzare anche senza approvazione Brand?</strong>
                      <small>Il definitivo verra creato senza deck finale abilitato dal Brand. Potrai collegarlo piu avanti.</small>
                    </span>
                  </div>
                  <label className="toggle-line">
                    <input
                      type="checkbox"
                      checked={Boolean(notification.bypassBrandApproval)}
                      onChange={(event) => setNotification({ ...notification, bypassBrandApproval: event.target.checked })}
                    />
                    <span>Si, finalizza senza approvazione Brand</span>
                  </label>
                </div>
              )}
              {!canConfirmEvent && <p className="modal-warning">Completa i passaggi mancanti prima di creare l'evento.</p>}
            </div>
          )}
          {modal.type === "brand_handoff" && (
            <div className="modal-stack">
              <p>Passa i materiali al team brand per l'ultima revisione prima della conferma.</p>
              <div className="modal-points single">
                <Info label="Cliente" value={project.company} />
                <Info label="Workshop" value={`${rows.length} deck collegati`} />
                <Info label="Stato successivo" value="In revisione brand" />
              </div>
            </div>
          )}
          {modal.type === "price" && rule && (
            <div className="modal-stack">
              <p>Configura una regola prezzo: nome, quantità di workshop, sconto e modalità mostrata nel preventivo.</p>
              <div className="pricing-editor-grid">
                <label>
                  Nome regola
                  <input value={draftRule.name} onChange={(event) => setDraftRule((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label>
                  Min workshop
                  <input
                    type="number"
                    min="1"
                    value={draftRule.min}
                    onChange={(event) => setDraftRule((current) => ({ ...current, min: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Max workshop
                  <input
                    type="number"
                    min="1"
                    value={draftRule.max}
                    onChange={(event) => setDraftRule((current) => ({ ...current, max: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Sconto %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draftRule.discountPercent}
                    onChange={(event) => setDraftRule((current) => ({ ...current, discountPercent: Number(event.target.value) }))}
                  />
                </label>
                <label className="toggle-line pricing-toggle">
                  <input
                    type="checkbox"
                    checked={draftRule.specialQuote}
                    onChange={(event) => setDraftRule((current) => ({ ...current, specialQuote: event.target.checked }))}
                  />
                  <span>Mostra come percorso su preventivo</span>
                </label>
              </div>
              <div className="price-preview-card">
                <div>
                  <span>Preview cliente</span>
                  <strong>{draftRule.specialQuote ? "Su preventivo" : money(pricePreviewTotal)}</strong>
                </div>
                <div>
                  <span>Scenario</span>
                  <strong>{pricePreviewCount} workshop · listino {money(pricePreviewGross)}</strong>
                </div>
                <div>
                  <span>Sconto applicato</span>
                  <strong>{normalizedDiscount}% · {draftRule.specialQuote ? "prezzo nascosto" : `risparmio ${money(pricePreviewGross - pricePreviewTotal)}`}</strong>
                </div>
              </div>
            </div>
          )}
          {showImpact && (
            <div className="workflow-impact-panel" aria-label="Cosa succede alla conferma">
              <div>
                <strong>Prima del click</strong>
                <span>Riepilogo chiaro di cosa verrà salvato, inviato o creato.</span>
              </div>
              <ul>
                {workflowImpact.map((item) => (
                  <li key={item}>
                    <Check size={15} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showNotification && (
            <NotificationController
              choice={notification}
              modalType={modal.type}
              onChange={setNotification}
            />
          )}
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose}>
            Annulla
          </AppButton>
          {modal.type === "edit_request" && (
            <AppButton
              variant="primary"
              disabled={editedRecords.length === 0}
              loading={pendingAction === "edit_request"}
              onClick={() => void runModalAction("edit_request", () => onSaveRequestEdit(editedRecords, requestPhase, notification))}
            >
              Salva modifica
            </AppButton>
          )}
          {modal.type === "date" && (
            <AppButton
              variant="primary"
              loading={pendingAction === "date"}
              onClick={() => void runModalAction("date", () => onConfirmDate(modal.workshopId, modal.decision, notification))}
            >
              {decisionCopy[modal.decision].action}
            </AppButton>
          )}
          {modal.type === "expert" && (
            <AppButton
              variant="primary"
              disabled={!selectedExpertWorkshopId}
              loading={pendingAction === "expert"}
              onClick={() => void runModalAction("expert", () => onConfirmExpert(selectedExpertWorkshopId, modal.expertName, modal.mode, notification))}
            >
              {modal.mode === "reassign" ? "Riapri candidatura" : "Assegna esperto"}
            </AppButton>
          )}
          {modal.type === "open_candidacies" && (
            <AppButton variant="primary" loading={pendingAction === "open_candidacies"} onClick={() => void runModalAction("open_candidacies", () => onInviteExperts(notification))}>
              Apri candidature
            </AppButton>
          )}
          {modal.type === "brand_handoff" && (
            <AppButton variant="primary" loading={pendingAction === "brand_handoff"} onClick={() => void runModalAction("brand_handoff", () => onConfirmBrandHandoff(notification))}>
              Manda a brand
            </AppButton>
          )}
          {modal.type === "confirm_event" && (
            <AppButton
              variant="primary"
              loading={pendingAction === "confirm_event"}
              onClick={() =>
                void runModalAction("confirm_event", () => (eventRecord?.mode === notification.eventMode ? onClose() : onConfirmEvent(notification)))
              }
              disabled={eventRecord?.mode === notification.eventMode ? false : !canRunConfirmEvent}
            >
              {eventRecord?.mode === notification.eventMode
                ? "Chiudi riepilogo"
                : notification.eventMode === "tentative"
                  ? "Crea provvisorio"
                  : "Crea definitivo"}
            </AppButton>
          )}
          {modal.type === "price" && rule && (
            <AppButton
              variant="primary"
              loading={pendingAction === "price"}
              onClick={() =>
                void runModalAction("price", () =>
                  onSaveRule(rule.id, {
                    name: draftRule.name.trim() || rule.name,
                    min: normalizedMin,
                    max: normalizedMax,
                    discountPercent: normalizedDiscount,
                    specialQuote: draftRule.specialQuote,
                  }),
                )
              }
            >
              Salva regola
            </AppButton>
          )}
        </footer>
      </section>
    </div>
  );
}

export const recipientLabels: Record<WorkflowNotificationRecipientRole, string> = {
  client: "Cliente",
  funnifin: "FunniFin",
  expert: "Esperto",
  brand: "Brand",
};

const recipientDescriptions: Record<WorkflowNotificationRecipientRole, string> = {
  client: "referente azienda",
  funnifin: "team interno",
  expert: "docente o consulente",
  brand: "revisione materiali",
};

export function getDefaultNotificationChoice(modal: AdminActionModalState, rows: AdminProjectWorkshopRow[] = []): NotificationChoice {
  if (modal.type === "edit_request") {
    return {
      send: false,
      recipients: ["client", "funnifin"],
      note: "Abbiamo aggiornato il riepilogo della richiesta con workshop, date o preventivo.",
    };
  }
  if (modal.type === "date") {
    const completesAllDates =
      modal.decision === "approved" &&
      rows.length > 0 &&
      rows.every((row) => (row.workshop.id === modal.workshopId ? "approved" : row.approval) === "approved");
    return {
      send: false,
      recipients: completesAllDates ? ["client", "funnifin"] : ["funnifin"],
      note: completesAllDates
        ? "Le date proposte sono state approvate e possiamo passare alla scelta degli esperti."
        : modal.decision === "change_requested"
          ? "Serve una nuova proposta di data o fascia oraria per questo workshop."
          : "Questa data è stata approvata; il cliente verrà aggiornato quando tutte le date saranno complete.",
    };
  }
  if (modal.type === "expert") {
    return {
      send: false,
      recipients: ["funnifin"],
      note: modal.mode === "reassign" ? "Il workshop torna disponibile per una nuova assegnazione." : "Esperto assegnato al workshop selezionato.",
    };
  }
  if (modal.type === "open_candidacies") {
    return {
      send: false,
      recipients: ["expert"],
      note: "Nuova opportunità disponibile: apri l'area Esperto e conferma disponibilità e interesse.",
    };
  }
  if (modal.type === "brand_handoff") {
    return {
      send: false,
      recipients: ["brand", "funnifin"],
      note: "I materiali sono pronti per la revisione brand.",
    };
  }
  if (modal.type === "confirm_event") {
    return {
      send: false,
      recipients: ["client", "funnifin"],
      note: "Evento creato a calendario con workshop, Meet e materiali collegati.",
      eventMode: "tentative",
      addClientToCalendar: true,
    };
  }
  return { send: false, recipients: [], note: "" };
}

export function NotificationController({
  choice,
  modalType,
  onChange,
}: {
  choice: NotificationChoice;
  modalType: AdminActionModalState["type"];
  onChange: (choice: NotificationChoice) => void;
}) {
  const selectedRecipients = choice.recipients.map((role) => recipientLabels[role]).join(", ");
  const notificationTitle = choice.send
    ? modalType === "confirm_event"
      ? "Mail finale attiva"
      : "Mail di aggiornamento attiva"
    : "Mail disattivata";
  const notificationBody = choice.send
    ? `Partirà verso: ${selectedRecipients || "scegli almeno un destinatario"}.`
    : "L'azione verrà salvata senza inviare messaggi.";

  const toggleRecipient = (role: WorkflowNotificationRecipientRole) => {
    onChange({
      ...choice,
      recipients: choice.recipients.includes(role) ? choice.recipients.filter((item) => item !== role) : [...choice.recipients, role],
    });
  };

  return (
    <div className="notification-controller">
      <div className="notification-controller-copy">
        <span className={choice.send ? "active" : ""}>
          <Send size={16} />
        </span>
        <div>
          <strong>{notificationTitle}</strong>
          <p>{notificationBody}</p>
        </div>
      </div>
      <div className="notification-controller-head">
        <label className="toggle-line">
          <input type="checkbox" checked={choice.send} onChange={(event) => onChange({ ...choice, send: event.target.checked })} />
          <span>{modalType === "confirm_event" ? "Invia conferma finale" : "Invia aggiornamento"}</span>
        </label>
        {modalType === "confirm_event" && (
          <div className="event-mode-switch" aria-label="Tipo evento calendario">
            {[
              ["tentative", "Provvisorio"],
              ["confirmed", "Definitivo"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={choice.eventMode === mode ? "active" : ""}
                onClick={() => onChange({ ...choice, eventMode: mode as "tentative" | "confirmed" })}
              >
                {mode === "tentative" ? "Bozza calendario" : label}
              </button>
            ))}
          </div>
        )}
      </div>
      {modalType === "confirm_event" && (
        <label className="toggle-line calendar-guest-toggle">
          <input
            type="checkbox"
            checked={Boolean(choice.addClientToCalendar)}
            onChange={(event) => onChange({ ...choice, addClientToCalendar: event.target.checked })}
          />
          <span>Aggiungi cliente al Calendar</span>
        </label>
      )}
      <div className="recipient-grid" aria-disabled={!choice.send}>
        {(Object.keys(recipientLabels) as WorkflowNotificationRecipientRole[]).map((role) => (
          <button
            key={role}
            type="button"
            className={choice.recipients.includes(role) ? "active" : ""}
            disabled={!choice.send}
            onClick={() => toggleRecipient(role)}
          >
            {choice.recipients.includes(role) ? <Check size={15} /> : <Plus size={15} />}
            <span>
              <strong>{recipientLabels[role]}</strong>
              <small>{recipientDescriptions[role]}</small>
            </span>
          </button>
        ))}
      </div>
      <label className="notification-note">
        Messaggio aggiuntivo
        <textarea value={choice.note} disabled={!choice.send} onChange={(event) => onChange({ ...choice, note: event.target.value })} rows={2} />
      </label>
    </div>
  );
}
