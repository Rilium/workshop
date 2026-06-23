import React, { useMemo, useRef, useState } from "react";
import { AppButton } from "../../../components/ui/AppButton";
import { ActionIconButton } from "../../../components/ui/IconButton";
import { ModalBackdrop } from "../../../components/ui/Modal";
import { Check, Mail, RefreshCw, Search, Send, Settings2, X } from "../../../components/ui/FaIcons";
import type { WorkspaceSetting } from "../../../googleAdminService";

type EmailTemplateAudience = "Cliente" | "Brand" | "Esperto" | "FunniFin";
type EmailTemplateTrigger = "Accesso" | "Richiesta" | "Date" | "Esperto" | "Materiali" | "Evento" | "Sistema";

type EmailTemplate = {
  id: string;
  settingsKey: string;
  title: string;
  audience: EmailTemplateAudience;
  trigger: EmailTemplateTrigger;
  when: string;
  subject: string;
  preheader: string;
  html: string;
  fallbackText: string;
  active: boolean;
  updatedAt: string;
};

const audienceTabs: Array<"Tutti" | EmailTemplateAudience> = ["Tutti", "Cliente", "Brand", "Esperto", "FunniFin"];
const triggerTabs: Array<"Tutti" | EmailTemplateTrigger> = ["Tutti", "Accesso", "Richiesta", "Date", "Esperto", "Materiali", "Evento", "Sistema"];
const templateTokens = ["{{nome}}", "{{azienda}}", "{{workshop}}", "{{data}}", "{{link}}", "{{codice}}"];
const workflowEmailTemplates: EmailTemplate[] = [
  {
    id: "workflow-request-updated",
    settingsKey: "workflow.request_updated",
    title: "Richiesta modificata",
    audience: "Cliente",
    trigger: "Richiesta",
    when: "Quando FunniFin modifica workshop, date o preventivo",
    subject: "FunniFin - Richiesta modificata - {{azienda}}",
    preheader: "Abbiamo aggiornato il riepilogo del percorso.",
    html: "<p>Workshop, date o preventivo sono stati aggiornati dal team FunniFin.</p>",
    fallbackText: "Workshop, date o preventivo sono stati aggiornati dal team FunniFin.",
    active: true,
    updatedAt: "Default",
  },
  {
    id: "workflow-dates-approved",
    settingsKey: "workflow.dates_approved",
    title: "Date approvate",
    audience: "Cliente",
    trigger: "Date",
    when: "Quando le date proposte vengono approvate",
    subject: "FunniFin - Date approvate - {{azienda}}",
    preheader: "Le date proposte vanno bene.",
    html: "<p>Possiamo passare alla scelta degli esperti più adatti.</p>",
    fallbackText: "Possiamo passare alla scelta degli esperti più adatti.",
    active: true,
    updatedAt: "Default",
  },
  {
    id: "workflow-date-change",
    settingsKey: "workflow.date_change_requested",
    title: "Modifica date richiesta",
    audience: "Cliente",
    trigger: "Date",
    when: "Quando serve una nuova proposta data",
    subject: "FunniFin - Modifica date richiesta - {{azienda}}",
    preheader: "Una o più date non sono disponibili.",
    html: "<p>Prima di andare avanti abbiamo bisogno di una nuova proposta di data o fascia oraria.</p>",
    fallbackText: "Prima di andare avanti abbiamo bisogno di una nuova proposta di data o fascia oraria.",
    active: true,
    updatedAt: "Default",
  },
  {
    id: "workflow-candidacies-open",
    settingsKey: "workflow.candidacies_open",
    title: "Candidature aperte",
    audience: "Esperto",
    trigger: "Esperto",
    when: "Quando FunniFin pubblica opportunità agli esperti",
    subject: "FunniFin - Candidature esperti aperte - {{azienda}}",
    preheader: "Conferma disponibilità e interesse.",
    html: "<p>Apri l'area Esperto e candidati se sei compatibile con workshop e data.</p>",
    fallbackText: "Apri l'area Esperto e candidati se sei compatibile con workshop e data.",
    active: true,
    updatedAt: "Default",
  },
  {
    id: "workflow-expert-candidate",
    settingsKey: "workflow.expert_candidate_received",
    title: "Candidatura ricevuta",
    audience: "Esperto",
    trigger: "Esperto",
    when: "Quando un esperto si candida",
    subject: "FunniFin - Candidatura esperto ricevuta - {{azienda}}",
    preheader: "La candidatura è stata registrata e FunniFin è stato avvisato.",
    html: "<p>Grazie: abbiamo salvato la tua disponibilità e il team FunniFin può valutarla dalla coda esperti.</p>",
    fallbackText: "Grazie: abbiamo salvato la tua disponibilità e il team FunniFin può valutarla dalla coda esperti.",
    active: true,
    updatedAt: "Default",
  },
  {
    id: "workflow-final-approval",
    settingsKey: "workflow.final_approval",
    title: "Approvazione finale",
    audience: "FunniFin",
    trigger: "Materiali",
    when: "Prima della conferma finale",
    subject: "FunniFin - Approvazione finale - {{azienda}}",
    preheader: "La versione finale è pronta per l'ultimo controllo.",
    html: "<p>Prima della conferma a calendario puoi fare l'ultimo giro di verifica.</p>",
    fallbackText: "Prima della conferma a calendario puoi fare l'ultimo giro di verifica.",
    active: true,
    updatedAt: "Default",
  },
  {
    id: "workflow-event-tentative",
    settingsKey: "workflow.event_tentative",
    title: "Evento provvisorio",
    audience: "Cliente",
    trigger: "Evento",
    when: "Quando viene creato un evento provvisorio",
    subject: "FunniFin - Evento provvisorio creato - {{azienda}}",
    preheader: "La data è stata bloccata a calendario.",
    html: "<p>Abbiamo creato un evento provvisorio per tenere libera la data.</p>",
    fallbackText: "Abbiamo creato un evento provvisorio per tenere libera la data.",
    active: true,
    updatedAt: "Default",
  },
];

const initialEmailTemplates: EmailTemplate[] = [
  {
    id: "client-request-received",
    settingsKey: "request.client_received",
    title: "Richiesta ricevuta",
    audience: "Cliente",
    trigger: "Richiesta",
    when: "Subito dopo l'invio del configuratore cliente",
    subject: "Abbiamo ricevuto la tua richiesta workshop",
    preheader: "FunniFin sta verificando date, materiali e prossimi passi.",
    html: "<p>Ciao <strong>{{nome}}</strong>,</p><p>abbiamo ricevuto la richiesta per <strong>{{azienda}}</strong>. Il team FunniFin verifica disponibilita, materiali e fit dei workshop selezionati.</p><p>Ti aggiorniamo appena la proposta operativa e pronta.</p>",
    fallbackText: "Ciao {{nome}}, abbiamo ricevuto la richiesta per {{azienda}}. Ti aggiorniamo appena la proposta operativa e pronta.",
    active: true,
    updatedAt: "Oggi 09:30",
  },
  {
    id: "brand-review-materials",
    settingsKey: "workflow.brand_review",
    title: "Revisione materiali",
    audience: "Brand",
    trigger: "Materiali",
    when: "Quando FunniFin apre la revisione dei materiali caricati",
    subject: "Materiali workshop da verificare",
    preheader: "Controlla asset, note e approvazioni prima della produzione.",
    html: "<p>Ciao <strong>{{nome}}</strong>,</p><p>i materiali per <strong>{{workshop}}</strong> sono pronti per la revisione.</p><p>Apri il workspace e conferma eventuali note entro la data indicata.</p>",
    fallbackText: "I materiali per {{workshop}} sono pronti per la revisione. Apri il workspace e conferma eventuali note.",
    active: true,
    updatedAt: "Ieri 17:15",
  },
  {
    id: "expert-assigned",
    settingsKey: "workflow.expert_assigned",
    title: "Esperto assegnato",
    audience: "Esperto",
    trigger: "Esperto",
    when: "Dopo assegnazione o riassegnazione esperto a un workshop",
    subject: "Nuovo workshop FunniFin assegnato",
    preheader: "Hai un nuovo slot operativo da confermare.",
    html: "<p>Ciao <strong>{{nome}}</strong>,</p><p>ti abbiamo assegnato il workshop <strong>{{workshop}}</strong> per <strong>{{azienda}}</strong>.</p><p>Verifica data, brief e materiali nel tuo pannello.</p>",
    fallbackText: "Ti abbiamo assegnato il workshop {{workshop}} per {{azienda}}. Verifica data, brief e materiali nel tuo pannello.",
    active: true,
    updatedAt: "18 giu 2026",
  },
  {
    id: "admin-access-code",
    settingsKey: "auth.invite",
    title: "Codice accesso",
    audience: "FunniFin",
    trigger: "Accesso",
    when: "Quando viene creato o reinviato un invito utente",
    subject: "Codice accesso FunniFin",
    preheader: "Usa il codice per entrare nel workspace.",
    html: "<p>Ciao <strong>{{nome}}</strong>,</p><p>il tuo codice di accesso e <strong>{{codice}}</strong>.</p><p>Apri FunniFin e completa il login dal link operativo.</p>",
    fallbackText: "Il tuo codice di accesso FunniFin e {{codice}}. Apri il workspace dal link operativo.",
    active: true,
    updatedAt: "17 giu 2026",
  },
  {
    id: "system-health-monitor",
    settingsKey: "system.health_monitor",
    title: "Monitor Google",
    audience: "FunniFin",
    trigger: "Sistema",
    when: "Quando il monitor Google trova problemi su Sheet, Drive, Calendar o quota mail",
    subject: "FunniFin monitor alert",
    preheader: "Il monitor ha trovato elementi da verificare.",
    html: "<p>Health monitor FunniFin</p><p>{{workshop}}</p>",
    fallbackText: "Health monitor FunniFin\n\n{{workshop}}",
    active: true,
    updatedAt: "Default",
  },
  {
    id: "client-event-confirmed",
    settingsKey: "workflow.event_confirmed",
    title: "Evento confermato",
    audience: "Cliente",
    trigger: "Evento",
    when: "Dopo creazione evento Calendar e conferma finale",
    subject: "Workshop confermato per {{data}}",
    preheader: "Evento, materiali e dettagli operativi sono allineati.",
    html: "<p>Ciao <strong>{{nome}}</strong>,</p><p>il workshop <strong>{{workshop}}</strong> e confermato per <strong>{{data}}</strong>.</p><p>Trovi dettagli e link operativo qui: <a href=\"{{link}}\">apri workspace</a>.</p>",
    fallbackText: "Il workshop {{workshop}} e confermato per {{data}}. Apri il workspace: {{link}}.",
    active: true,
    updatedAt: "16 giu 2026",
  },
  ...workflowEmailTemplates,
];

function sanitizeTemplateHtml(value: string) {
  return value
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/\son\w+="[^"]*"/gi, "")
    .replace(/\son\w+='[^']*'/gi, "")
    .replace(/\sjavascript:/gi, "");
}

function renderPreview(value: string) {
  const replacements: Record<string, string> = {
    "{{nome}}": "Giulia",
    "{{azienda}}": "Acme Finance",
    "{{workshop}}": "Budget personale",
    "{{data}}": "2 luglio",
    "{{link}}": "https://funnifin.app/workspace",
    "{{codice}}": "842-193",
  };
  return Object.entries(replacements).reduce((html, [token, replacement]) => html.split(token).join(replacement), sanitizeTemplateHtml(value));
}

function cloneTemplate(template: EmailTemplate): EmailTemplate {
  return { ...template };
}

function applyWorkspaceTemplate(template: EmailTemplate, settings: Map<string, WorkspaceSetting>): EmailTemplate {
  const prefix = `mail.template.${template.settingsKey}`;
  return {
    ...template,
    subject: settings.get(`${prefix}.subject`)?.value || template.subject,
    preheader: settings.get(`${prefix}.preheader`)?.value || template.preheader,
    html: settings.get(`${prefix}.html`)?.value || template.html,
    fallbackText: settings.get(`${prefix}.text`)?.value || template.fallbackText,
    active: settings.get(`${prefix}.active`)?.value !== "false",
    updatedAt: settings.get(`${prefix}.html`)?.updatedAt || settings.get(`${prefix}.subject`)?.updatedAt || template.updatedAt,
  };
}

export function EmailTemplatesSection({
  notify,
  workspaceSettings = [],
  onSaveWorkspaceSetting,
}: {
  notify: (title: string, body: string) => void;
  workspaceSettings?: WorkspaceSetting[];
  onSaveWorkspaceSetting?: (setting: WorkspaceSetting) => Promise<WorkspaceSetting> | void;
}) {
  const settingsMap = useMemo(() => new Map(workspaceSettings.map((setting) => [setting.key, setting])), [workspaceSettings]);
  const templates = useMemo(() => initialEmailTemplates.map((template) => applyWorkspaceTemplate(template, settingsMap)), [settingsMap]);
  const [audience, setAudience] = useState<"Tutti" | EmailTemplateAudience>("Tutti");
  const [trigger, setTrigger] = useState<"Tutti" | EmailTemplateTrigger>("Tutti");
  const [search, setSearch] = useState("");
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);

  const filteredTemplates = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return templates.filter((template) => {
      const matchesAudience = audience === "Tutti" || template.audience === audience;
      const matchesTrigger = trigger === "Tutti" || template.trigger === trigger;
      const matchesSearch = !normalizedSearch || [template.title, template.subject, template.when, template.audience, template.trigger].join(" ").toLowerCase().includes(normalizedSearch);
      return matchesAudience && matchesTrigger && matchesSearch;
    });
  }, [audience, search, templates, trigger]);

  const activeCount = templates.filter((template) => template.active).length;

  const openTemplate = (template: EmailTemplate) => {
    setEditingTemplate(cloneTemplate(template));
    window.requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.innerHTML = sanitizeTemplateHtml(template.html);
    });
  };

  const updateEditingTemplate = (patch: Partial<EmailTemplate>) => {
    setEditingTemplate((current) => (current ? { ...current, ...patch } : current));
  };

  const runEditorCommand = (command: "bold" | "italic" | "insertUnorderedList") => {
    editorRef.current?.focus();
    document.execCommand(command);
    updateEditingTemplate({ html: sanitizeTemplateHtml(editorRef.current?.innerHTML ?? "") });
  };

  const insertToken = (token: string) => {
    editorRef.current?.focus();
    document.execCommand("insertText", false, token);
    updateEditingTemplate({ html: sanitizeTemplateHtml(editorRef.current?.innerHTML ?? "") });
  };

  const saveTemplate = () => {
    if (!editingTemplate) return;
    const html = sanitizeTemplateHtml(editorRef.current?.innerHTML ?? editingTemplate.html);
    const savedTemplate = {
      ...editingTemplate,
      html,
      updatedAt: new Date().toLocaleString("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    };
    const prefix = `mail.template.${savedTemplate.settingsKey}`;
    void Promise.all([
      onSaveWorkspaceSetting?.({ key: `${prefix}.subject`, value: savedTemplate.subject, group: "mail_template", label: `${savedTemplate.title} - oggetto` }),
      onSaveWorkspaceSetting?.({ key: `${prefix}.preheader`, value: savedTemplate.preheader, group: "mail_template", label: `${savedTemplate.title} - preheader` }),
      onSaveWorkspaceSetting?.({ key: `${prefix}.html`, value: html, group: "mail_template", label: `${savedTemplate.title} - corpo HTML` }),
      onSaveWorkspaceSetting?.({ key: `${prefix}.text`, value: savedTemplate.fallbackText, group: "mail_template", label: `${savedTemplate.title} - testo fallback` }),
    ]).then(() => {
      notify("Template mail salvato", `${savedTemplate.title} aggiornato su Google Settings.`);
    });
    setEditingTemplate(null);
  };

  const toggleTemplate = (templateId: string) => {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    void onSaveWorkspaceSetting?.({
      key: `mail.template.${template.settingsKey}.active`,
      value: template.active ? "false" : "true",
      group: "mail_template",
      label: `${template.title} - attivo`,
    });
  };

  return (
    <>
      <div className="pricing-console mail-template-console">
        <div className="pricing-hero-card mail-template-hero">
          <div>
            <span className="eyebrow">Mail operative FunniFin</span>
            <strong>{templates.length} template gestiti</strong>
            <em>Lista per destinatario e momento di invio, con editing rich text e anteprima reale del corpo HTML.</em>
          </div>
          <div className="pricing-hero-metrics mail-template-metrics">
            <div className="info"><span>Attivi</span><strong>{activeCount}</strong></div>
            <div className="info"><span>Utenti</span><strong>{audienceTabs.length - 1}</strong></div>
            <div className="info"><span>Trigger</span><strong>{triggerTabs.length - 1}</strong></div>
            <div className="info"><span>Preview</span><strong>HTML</strong></div>
          </div>
        </div>

        <div className="mail-template-toolbar">
          <label className="admin-search-field">
            <Search size={16} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca template, oggetto o trigger" />
            {search && (
              <button type="button" onClick={() => setSearch("")} aria-label="Cancella ricerca template">
                <X size={16} />
              </button>
            )}
          </label>
          <div className="mail-template-tabs" aria-label="Destinatari template">
            {audienceTabs.map((item) => (
              <button key={item} type="button" className={audience === item ? "active" : ""} onClick={() => setAudience(item)}>
                {item}
              </button>
            ))}
          </div>
          <label className="mail-template-trigger-filter">
            <span>Momento invio</span>
            <select value={trigger} onChange={(event) => setTrigger(event.target.value as "Tutti" | EmailTemplateTrigger)}>
              {triggerTabs.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="mail-template-list" aria-label="Template mail FunniFin">
          {filteredTemplates.map((template) => (
            <article key={template.id} className={`mail-template-row ${template.active ? "active" : "paused"}`}>
              <div className="mail-template-row-main">
                <span className="mail-template-icon"><Mail size={17} /></span>
                <div>
                  <strong>{template.title}</strong>
                  <em>{template.subject}</em>
                  <small>{template.when}</small>
                </div>
              </div>
              <div className="mail-template-meta">
                <span>{template.audience}</span>
                <span>{template.trigger}</span>
                <small>{template.updatedAt}</small>
              </div>
              <div className="table-actions">
                <ActionIconButton variant={template.active ? "success" : "neutral"} onClick={() => toggleTemplate(template.id)} label={template.active ? `Disattiva ${template.title}` : `Attiva ${template.title}`}>
                  {template.active ? <Check size={15} /> : <RefreshCw size={15} />}
                </ActionIconButton>
                <ActionIconButton variant="neutral" onClick={() => openTemplate(template)} label={`Modifica ${template.title}`}>
                  <Settings2 size={15} />
                </ActionIconButton>
              </div>
            </article>
          ))}
        </div>
      </div>

      {editingTemplate && (
        <ModalBackdrop labelledBy="mail-template-modal-title" className="mail-template-modal-backdrop">
          <section className="custom-modal admin-action-modal mail-template-modal">
            <header className="modal-header">
              <div>
                <span className="eyebrow">{editingTemplate.audience} · {editingTemplate.trigger}</span>
                <strong id="mail-template-modal-title">{editingTemplate.title}</strong>
                <p>{editingTemplate.when}</p>
              </div>
              <button type="button" className="modal-close" onClick={() => setEditingTemplate(null)} aria-label="Chiudi modal template">
                <X size={18} />
              </button>
            </header>
            <div className="modal-body mail-template-modal-body">
              <div className="mail-template-editor-grid">
                <div className="mail-template-editor-panel">
                  <label className="auth-invite-field">
                    Oggetto
                    <input value={editingTemplate.subject} onChange={(event) => updateEditingTemplate({ subject: event.target.value })} />
                  </label>
                  <label className="auth-invite-field">
                    Preheader
                    <input value={editingTemplate.preheader} onChange={(event) => updateEditingTemplate({ preheader: event.target.value })} />
                  </label>
                  <div className="mail-rich-editor">
                    <div className="mail-rich-toolbar" aria-label="Toolbar editor mail">
                      <button type="button" onClick={() => runEditorCommand("bold")} aria-label="Grassetto"><strong>B</strong></button>
                      <button type="button" onClick={() => runEditorCommand("italic")} aria-label="Corsivo"><em>I</em></button>
                      <button type="button" onClick={() => runEditorCommand("insertUnorderedList")} aria-label="Lista puntata">•</button>
                      {templateTokens.map((token) => (
                        <button key={token} type="button" className="token" onClick={() => insertToken(token)}>{token}</button>
                      ))}
                    </div>
                    <div
                      ref={editorRef}
                      className="mail-rich-surface"
                      contentEditable
                      suppressContentEditableWarning
                      onInput={(event) => updateEditingTemplate({ html: sanitizeTemplateHtml(event.currentTarget.innerHTML) })}
                    />
                  </div>
                  <label className="auth-invite-field">
                    Testo fallback
                    <textarea value={editingTemplate.fallbackText} onChange={(event) => updateEditingTemplate({ fallbackText: event.target.value })} rows={4} />
                  </label>
                </div>
                <aside className="mail-preview-panel" aria-label="Micro anteprima template">
                  <div className="mail-preview-head">
                    <Send size={16} />
                    <div>
                      <strong>{editingTemplate.subject || "Oggetto mail"}</strong>
                      <span>{editingTemplate.preheader || "Preheader visibile nella inbox"}</span>
                    </div>
                  </div>
                  <div className="mail-preview-body" dangerouslySetInnerHTML={{ __html: renderPreview(editingTemplate.html) }} />
                </aside>
              </div>
            </div>
            <footer className="modal-footer auth-user-modal-footer">
              <AppButton type="button" variant="ghost" onClick={() => setEditingTemplate(null)}>
                Annulla
              </AppButton>
              <AppButton type="button" variant="primary" onClick={saveTemplate} disabled={!editingTemplate.subject.trim()}>
                Salva template
              </AppButton>
            </footer>
          </section>
        </ModalBackdrop>
      )}
    </>
  );
}
