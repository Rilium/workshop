import type { Dispatch, SetStateAction } from "react";
import {
  BadgeCheck,
  CalendarCheck,
  Check,
  ChevronDown,
  Clock3,
  FileCheck2,
  InfoIcon,
  Loader2,
  Plus,
  UploadCloud,
} from "../../../components/ui/FaIcons";
import { AppButton } from "../../../components/ui/AppButton";
import { EmptyWorkflowState } from "../../../components/ui/EmptyWorkflowState";
import { Panel } from "../../../components/ui/Panel";
import { RemoveWorkshopButton } from "../../../components/ui/RemoveWorkshopButton";
import { SectionTitle } from "../../../components/ui/SectionTitle";
import { Skeleton } from "../../../components/ui/Skeleton";
import { ToolIconButton } from "../../../components/ui/IconButton";
import { ReadinessPanel } from "../../../components/workshop/ReadinessPanel";
import type { AssetDraftFolder, UploadedAsset } from "../../../driveAssetService";
import type { ClientContact, CommercialConfig, Selection, Workshop } from "../../../types/domain";
import { money } from "../../../utils/money";
import { formatDuration } from "../../../utils/workshop";
import type { SelectedWorkshopRow } from "../hooks/useClientSubmission";

export function ClientPersonalizeStep({
  selectedWorkshopRows,
  customizableWorkshopRows,
  fixedWorkshopRows,
  commercialConfig,
  updateSelection,
  openCustomRequest,
  showCustomModal,
  removeWorkshop,
  onEmpty,
}: {
  selectedWorkshopRows: SelectedWorkshopRow[];
  customizableWorkshopRows: SelectedWorkshopRow[];
  fixedWorkshopRows: SelectedWorkshopRow[];
  commercialConfig: CommercialConfig;
  updateSelection: (workshopId: string, patch: Partial<Selection>) => void;
  openCustomRequest: (workshop: Workshop) => void;
  showCustomModal: (workshop: Workshop) => void;
  removeWorkshop: (workshopId: string) => void;
  onEmpty: () => void;
}) {
  return (
    <Panel>
      <SectionTitle title="Personalizzazione su misura" icon={<span className="section-title-emoji" aria-hidden="true">✍️</span>} />
      {selectedWorkshopRows.length === 0 ? (
        <EmptyWorkflowState
          title="Nessun workshop da personalizzare"
          body="Aggiungi almeno un workshop al percorso per attivare il su misura."
          cta="Vai ai workshop"
          onClick={onEmpty}
        />
      ) : (
        <div className="personalize-list">
          {customizableWorkshopRows.map(({ selection, workshop }) => (
            <div className="personalize-row" key={workshop.id}>
              <div>
                <strong>{workshop.title}</strong>
                <span>Co-design con FunniFin e migliori esperti: +{money(commercialConfig.customExtra)}</span>
              </div>
              <button
                className={`custom-mini-toggle ${selection.custom ? "active" : ""}`}
                onClick={() => {
                  if (selection.custom) updateSelection(workshop.id, { custom: false, customNote: "" });
                  else openCustomRequest(workshop);
                }}
                aria-pressed={selection.custom}
              >
                <span>{selection.custom ? <Check size={15} /> : <Plus size={15} />}</span>
                <strong>Rendi su misura</strong>
                <em>{selection.customNote || "Aggiungi note e contesto"}</em>
              </button>
              <div className="personalize-row-actions">
                <ToolIconButton onClick={() => showCustomModal(workshop)} label={`Dettagli su misura per ${workshop.title}`}>
                  <InfoIcon size={18} />
                </ToolIconButton>
                <RemoveWorkshopButton onClick={() => removeWorkshop(workshop.id)} label={workshop.title} />
              </div>
            </div>
          ))}
          {fixedWorkshopRows.length > 0 && (
            <details className="personalize-unavailable-disclosure">
              <summary>
                <span>
                  <strong>Personalizzazione non disponibile</strong>
                  <small>Questi workshop restano comunque nel percorso.</small>
                </span>
                <span className="personalize-unavailable-count">{fixedWorkshopRows.length}</span>
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <div className="personalize-unavailable-list">
                {fixedWorkshopRows.map(({ workshop }) => (
                  <div className="personalize-row is-unavailable" key={workshop.id}>
                    <div>
                      <strong>{workshop.title}</strong>
                      <span>Contenuto a formato fisso.</span>
                    </div>
                    <div className="personalize-row-actions">
                      <RemoveWorkshopButton onClick={() => removeWorkshop(workshop.id)} label={workshop.title} />
                    </div>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </Panel>
  );
}

export function ClientDatesStep({
  selectedWorkshopRows,
  selections,
  workshops,
  datePlanningMode,
  setDatePlanningMode,
  setDatesDeferred,
  openDateModal,
  removeWorkshop,
  onEmpty,
}: {
  selectedWorkshopRows: SelectedWorkshopRow[];
  selections: Selection[];
  workshops: Workshop[];
  datePlanningMode: "now" | "later" | null;
  setDatePlanningMode: Dispatch<SetStateAction<"now" | "later" | null>>;
  setDatesDeferred: Dispatch<SetStateAction<boolean>>;
  openDateModal: (selection: Selection) => void;
  removeWorkshop: (workshopId: string) => void;
  onEmpty: () => void;
}) {
  return (
    <Panel>
      <SectionTitle title="Quando vuoi definire le date?" icon={<span className="section-title-emoji" aria-hidden="true">📅</span>} />
      {selectedWorkshopRows.length === 0 ? (
        <EmptyWorkflowState
          title="Nessun workshop da pianificare"
          body="Aggiungi workshop al percorso, poi torna qui per scegliere le date."
          cta="Vai ai workshop"
          onClick={onEmpty}
        />
      ) : (
        <>
          <div className="date-planning-choice-grid" role="group" aria-label="Quando definire le date">
            <button
              type="button"
              className={datePlanningMode === "now" ? "selected" : ""}
              aria-pressed={datePlanningMode === "now"}
              onClick={() => {
                setDatePlanningMode("now");
                setDatesDeferred(false);
              }}
            >
              <CalendarCheck size={22} />
              <span><strong>Le conosco già</strong><small>Inseriscile ora per ciascun workshop.</small></span>
            </button>
            <button
              type="button"
              className={datePlanningMode === "later" ? "selected" : ""}
              aria-pressed={datePlanningMode === "later"}
              onClick={() => {
                setDatePlanningMode("later");
                setDatesDeferred(true);
              }}
            >
              <Clock3 size={22} />
              <span><strong>Le definirò in seguito</strong><small>Invia la richiesta e concordale poi con FunniFin.</small></span>
            </button>
          </div>
          {datePlanningMode === "later" && (
            <div className="date-planning-confirmation" role="status">
              <span><Check size={18} /></span>
              <div><strong>Perfetto, le date restano da concordare</strong><small>FunniFin le verificherà insieme a esperti e fattibilità operativa.</small></div>
            </div>
          )}
          {datePlanningMode === "now" && (
            <>
              <div className="date-list-intro">
                <strong>Scegli le date che conosci già</strong>
                <span>Puoi indicarne anche solo una o alcune: le altre resteranno da concordare con FunniFin.</span>
              </div>
              <div className="date-choice-grid">
                {selections.map((selection) => {
                  const workshop = workshops.find((item) => item.id === selection.workshopId);
                  if (!workshop) return null;
                  const hasDate = Boolean(selection.date);
                  const isConfirmed = Boolean(selection.dateConfirmed);
                  const dateStateClass = isConfirmed ? "done" : hasDate ? "proposed" : "";
                  const dateIcon = isConfirmed ? <Check size={16} /> : hasDate ? <CalendarCheck size={16} /> : <Clock3 size={16} />;
                  const dateLabel = isConfirmed
                    ? `${selection.date} · ${selection.time} · ${formatDuration(selection.duration)}`
                    : hasDate
                      ? `${selection.date} · ${selection.time} — in attesa di conferma`
                      : "Data non ancora scelta";
                  return (
                    <div className={`date-action-card ${dateStateClass}`} key={selection.workshopId}>
                      <span className="date-status">{dateIcon}</span>
                      <div><strong>{workshop.title}</strong><span>{dateLabel}</span></div>
                      <div className="date-row-actions">
                        <AppButton variant={isConfirmed ? "outline" : "secondary"} onClick={() => openDateModal(selection)}>
                          <CalendarCheck size={17} /> {isConfirmed ? "Modifica" : "Scegli"}
                        </AppButton>
                        <RemoveWorkshopButton onClick={() => removeWorkshop(workshop.id)} label={workshop.title} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </>
      )}
    </Panel>
  );
}

export function ClientMaterialsStep({
  logoPreview,
  setLogoPreview,
  uploadingAssets,
  assetFolder,
  uploadedAssets,
  assetUploadError,
  handleAssetFiles,
}: {
  logoPreview: { name: string; url: string } | null;
  setLogoPreview: Dispatch<SetStateAction<{ name: string; url: string } | null>>;
  uploadingAssets: boolean;
  assetFolder: AssetDraftFolder | null;
  uploadedAssets: UploadedAsset[];
  assetUploadError: string;
  handleAssetFiles: (files: FileList | File[] | null) => Promise<void>;
}) {
  return (
    <Panel>
      <SectionTitle title="Logo e note cliente facoltativi" icon={<span className="section-title-emoji" aria-hidden="true">🖼️</span>} />
      <div className="upload-box">
        <UploadCloud size={32} />
        <strong>Carica il logo aziendale</strong>
        <span>È facoltativo. Puoi selezionare un’immagine, verificarla in anteprima e sostituirla con un clic.</span>
        {logoPreview && (
          <div className="company-logo-preview">
            <img src={logoPreview.url} alt={`Anteprima ${logoPreview.name}`} />
            <span>{logoPreview.name}</span>
          </div>
        )}
        <label className={`secondary-btn asset-upload-trigger ${uploadingAssets ? "app-btn-loading" : ""}`} aria-busy={uploadingAssets || undefined}>
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            disabled={uploadingAssets}
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) {
                setLogoPreview((current) => {
                  if (current?.url) URL.revokeObjectURL(current.url);
                  return { name: file.name, url: URL.createObjectURL(file) };
                });
                void handleAssetFiles([file]);
              }
              event.target.value = "";
            }}
          />
          <span className="app-btn-icon-slot" aria-hidden={!uploadingAssets}>
            {uploadingAssets ? <Loader2 className="app-btn-spinner" size={16} aria-hidden="true" /> : <span className="app-btn-spinner-placeholder" />}
          </span>
          {logoPreview ? "Sostituisci logo" : "Scegli logo"}
        </label>
        {logoPreview && (
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              URL.revokeObjectURL(logoPreview.url);
              setLogoPreview(null);
            }}
          >
            Rimuovi anteprima
          </button>
        )}
        {assetFolder && <a className="asset-folder-link" href={assetFolder.url} target="_blank" rel="noreferrer">Apri cartella Drive: {assetFolder.name}</a>}
        {uploadingAssets && (
          <div className="upload-skeleton-list" aria-hidden="true">
            {Array.from({ length: 2 }).map((_, index) => (
              <span className="skeleton-row" key={index}>
                <Skeleton className="skeleton-dot" />
                <span className="skeleton-text"><Skeleton className="skeleton-line" /><Skeleton className="skeleton-line short" /></span>
                <Skeleton className="skeleton-button" />
              </span>
            ))}
          </div>
        )}
        {!uploadingAssets && uploadedAssets.length > 0 && (
          <div className="asset-file-list">
            {uploadedAssets.map((asset, index) => (
              <div key={`${asset.name}-${index}`} className="asset-file-row">
                <FileCheck2 size={17} /><span>{asset.name}</span><em>{Math.max(1, Math.round(asset.size / 1024))} KB</em>
              </div>
            ))}
          </div>
        )}
        {assetUploadError && <p className="modal-warning">{assetUploadError}</p>}
        <small>La cartella draft resta disponibile se aggiorni la pagina; le bozze non inviate vengono ripulite automaticamente.</small>
      </div>
    </Panel>
  );
}

export function ClientSubmitStep({
  selectedWorkshopRows,
  missingDateRows,
  datesDeferred,
  requestFinalized,
  emailDeliveryMode,
  submittedEmail,
  contact,
  setContact,
  contactTouched,
  privacyAccepted,
  setPrivacyAccepted,
  privacyNoticeVersion,
}: {
  selectedWorkshopRows: SelectedWorkshopRow[];
  missingDateRows: SelectedWorkshopRow[];
  datesDeferred: boolean;
  requestFinalized: boolean;
  emailDeliveryMode: "pending" | "sent" | "not_sent";
  submittedEmail: string;
  contact: ClientContact;
  setContact: Dispatch<SetStateAction<ClientContact>>;
  contactTouched: boolean;
  privacyAccepted: boolean;
  setPrivacyAccepted: Dispatch<SetStateAction<boolean>>;
  privacyNoticeVersion: string;
}) {
  const validEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim());
  return (
    <Panel>
      <SectionTitle title="Invio richiesta" icon={<span className="section-title-emoji" aria-hidden="true">✅</span>} />
      <ReadinessPanel rows={selectedWorkshopRows} missingDateRows={missingDateRows} datesDeferred={datesDeferred} />
      {requestFinalized ? (
        <div className="request-success-card">
          <span className="success-check"><Check size={38} /></span>
          <div>
            <strong>Richiesta salvata</strong>
            <p>{emailDeliveryMode === "pending"
              ? "Richiesta ricevuta. Stiamo inviando il riepilogo via email: puoi già chiudere questa pagina."
              : emailDeliveryMode === "not_sent"
                ? "Il recap email non è partito, ma la richiesta è al sicuro: il team FunniFin ti ricontatterà."
                : "Il riepilogo è stato inviato via email. FunniFin verificherà date, disponibilità e fattibilità."}</p>
          </div>
          <div className="submitted-email-box">
            <span>{emailDeliveryMode === "sent" ? "Inviata a" : "Recap per"}</span>
            <strong>{submittedEmail}</strong>
          </div>
        </div>
      ) : (
        <>
          <div className="contact-card">
            <div><strong>Dati per recap e contatto FunniFin</strong><span>Nessun account richiesto: inserisci i dati solo alla fine per inviare la richiesta.</span></div>
            <div className="contact-grid">
              <label className={contactTouched && !contact.firstName.trim() ? "has-error" : ""}>
                Nome *
                <input value={contact.firstName} onChange={(event) => setContact({ ...contact, firstName: event.target.value })} autoComplete="given-name" />
                {contactTouched && !contact.firstName.trim() && <small className="field-error">Campo obbligatorio</small>}
              </label>
              <label className={contactTouched && !contact.lastName.trim() ? "has-error" : ""}>
                Cognome *
                <input value={contact.lastName} onChange={(event) => setContact({ ...contact, lastName: event.target.value })} autoComplete="family-name" />
                {contactTouched && !contact.lastName.trim() && <small className="field-error">Campo obbligatorio</small>}
              </label>
              <label className={contactTouched && !validEmail ? "has-error" : ""}>
                Mail aziendale *
                <input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} autoComplete="email" />
                {contactTouched && !validEmail && <small className="field-error">Email non valida</small>}
              </label>
              <label className={contactTouched && !contact.company.trim() ? "has-error" : ""}>
                Azienda *
                <input value={contact.company} onChange={(event) => setContact({ ...contact, company: event.target.value })} autoComplete="organization" />
                {contactTouched && !contact.company.trim() && <small className="field-error">Campo obbligatorio</small>}
              </label>
              <label>
                <span className="contact-field-label">Telefono <small>(facoltativo)</small></span>
                <input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} autoComplete="tel" />
              </label>
              <label>
                <span className="contact-field-label">Numero dipendenti dell’azienda <small>(facoltativo)</small></span>
                <input
                  type="number"
                  min="1"
                  inputMode="numeric"
                  value={contact.employeeCount}
                  onChange={(event) => setContact({ ...contact, employeeCount: event.target.value })}
                  placeholder="Es. 128"
                />
              </label>
            </div>
          </div>
          <div className="approval-card submission-preview-card">
            <span className="submission-preview-icon" aria-hidden="true"><BadgeCheck size={22} /></span>
            <div className="submission-preview-copy"><strong>Preventivo pronto per FunniFin</strong><span>Riceverai un recap via email. FunniFin verificherà date, esperti e fattibilità operativa.</span></div>
          </div>
          <label className={`approval-card privacy-consent ${contactTouched && !privacyAccepted ? "has-error" : ""}`}>
            <input type="checkbox" checked={privacyAccepted} onChange={(event) => setPrivacyAccepted(event.target.checked)} />
            <span>
              Autorizzo FunniFin a trattare questi dati per gestire la richiesta workshop, ricontattarmi e preparare materiali/date collegati. *
              <small>Versione informativa: {privacyNoticeVersion}</small>
              {contactTouched && !privacyAccepted && <small className="field-error">Conferma obbligatoria</small>}
            </span>
          </label>
        </>
      )}
    </Panel>
  );
}
