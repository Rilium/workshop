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
import { createAssetDraftFolder, uploadAssetFiles, type AssetDraftFolder, type UploadedAsset } from "../../driveAssetService";
import { getDriveFolderPreview, type DriveFolderItem } from "../../googleDriveService";
import { listWorkshopRequests, updateWorkshopRequest } from "../../requestService";
import { roleIdentities } from "../../data/mockData";
import { workshops } from "../../data/catalog";
import type { AdminProject, ProjectStatus, Selection, Workshop } from "../../types/domain";
import { useAuth } from "../../AuthContext";
import { requestToAdminProject } from "../../utils/workshop";
import { AppButton } from "../../components/ui/AppButton";
import { ActionIconButton, ToolIconButton } from "../../components/ui/IconButton";
import { Info } from "../../components/ui/Info";
import { Panel } from "../../components/ui/Panel";
import { Stepper } from "../../components/ui/Stepper";
import { BottomActionBar } from "../../components/layout/BottomActionBar";
import { OperationalStrip } from "../../components/layout/OperationalStrip";
import { OperatorIdentityCard } from "../../components/layout/OperatorIdentityCard";
import { RoleHero } from "../../components/layout/RoleHero";
import { ExpertCandidateModal } from "./components/ExpertCandidateModal";

export function ExpertView({
  selections,
  updateSelection,
  setProjectStatus,
  notify,
  syncProjectStatus,
  systemRefreshToken,
  systemSettingsToken,
  project,
}: {
  selections: Selection[];
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  notify: (title: string, body: string) => void;
  syncProjectStatus: (status: ProjectStatus) => void;
  systemRefreshToken: number;
  systemSettingsToken: number;
  project: AdminProject;
}) {
  const { currentUser } = useAuth();
  const expertSteps = ["Opportunita", "Assegnati", "Upload deck", "Storico"];
  // Nome esperto: usa displayName dell'utente autenticato, fallback al roleIdentities mock
  const expertName = currentUser?.displayName ?? roleIdentities.Esperto.name;
  const [syncedProject, setSyncedProject] = useState<AdminProject>(project);
  const [expertSyncState, setExpertSyncState] = useState<{ loading: boolean; error: string }>({ loading: false, error: "" });
  const [expertStep, setExpertStep] = useState(expertSteps[0]);
  const [candidateModalRow, setCandidateModalRow] = useState<{ selection: Selection; workshop: Workshop } | null>(null);
  const [candidateSending, setCandidateSending] = useState(false);
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState("");
  const [expertDeckFolder, setExpertDeckFolder] = useState<AssetDraftFolder | null>(null);
  const [expertDeckFile, setExpertDeckFile] = useState<UploadedAsset | null>(null);
  const [expertDeckUploading, setExpertDeckUploading] = useState(false);
  const [expertDeckError, setExpertDeckError] = useState("");
  const [expertDrivePickerOpen, setExpertDrivePickerOpen] = useState(false);
  const [expertDriveItems, setExpertDriveItems] = useState<DriveFolderItem[]>([]);
  const [expertDriveLoading, setExpertDriveLoading] = useState(false);
  const activeExpertProject = syncedProject.source === "sheet" ? syncedProject : project;
  useEffect(() => {
    syncProjectStatus(activeExpertProject.status);
  }, [activeExpertProject.status, syncProjectStatus]);
  const expertRows = activeExpertProject.request
    ? activeExpertProject.request.workshops
        .map((record) => {
          const workshop = workshops.find((item) => item.id === record.workshopId);
          if (!workshop) return null;
          return {
            selection: {
              workshopId: record.workshopId,
              duration: record.duration,
              format: record.format,
              date: record.date,
              time: record.time || "10:00",
              custom: record.custom,
              customNote: record.customNote || "",
              promo: false,
              status: record.status,
              dateConfirmed: record.approval === "approved",
            } satisfies Selection,
            workshop,
          };
        })
        .filter(Boolean) as Array<{ selection: Selection; workshop: Workshop }>
    : selections
        .map((selection) => ({ selection, workshop: workshops.find((item) => item.id === selection.workshopId)! }))
        .filter(({ workshop }) => Boolean(workshop));
  const assignedRow = expertRows.find(({ selection }) => selection.status === "esperto_assegnato") ?? expertRows[0];
  const candidateCount = expertRows.filter(({ selection }) => selection.status === "candidatura_ricevuta").length;
  const loadExpertOpportunities = async (showFeedback = false) => {
    setExpertSyncState({ loading: true, error: "" });
    try {
      const requests = await listWorkshopRequests();
      const openRequests = requests.filter((request) =>
        ["aperto_a_esperti", "date_approvate", "esperto_assegnato", "in_preparazione_esperto"].includes(request.status),
      );
      const request = openRequests[0] ?? requests[0];
      if (!request) {
        setExpertSyncState({ loading: false, error: "Nessuna richiesta reale trovata nel registro." });
        if (showFeedback) notify("Nessuna opportunita reale", "Il registro non contiene richieste aperte agli esperti.");
        return;
      }
      setSyncedProject(requestToAdminProject(request));
      setExpertSyncState({ loading: false, error: "" });
      if (showFeedback) notify("Opportunita aggiornate", `${request.company}: ${request.workshops.length} workshop letti dal registro.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lettura opportunita non riuscita.";
      setExpertSyncState({ loading: false, error: message });
      if (showFeedback) notify("Opportunita non aggiornate", message);
    }
  };
  useEffect(() => {
    void loadExpertOpportunities(false);
  }, []);
  const expertMainAction = (() => {
    if (expertStep === "Opportunita") return { label: "Aggiorna disponibilita", disabled: false, action: () => {
      setAvailabilityUpdatedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      void loadExpertOpportunities(true);
    } };
    if (expertStep === "Assegnati") return { label: "Vai all'upload", disabled: !assignedRow, action: () => setExpertStep("Upload deck") };
    if (expertStep === "Upload deck") return { label: "Invia a brand", disabled: !assignedRow || !expertDeckFile, action: () => { void sendDeckToBrand(); } };
    return { label: "Vedi opportunita", disabled: false, action: () => setExpertStep("Opportunita") };
  })();
  const handleExpertDeckUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !assignedRow) return;
    setExpertDeckUploading(true);
    setExpertDeckError("");
    try {
      const folder = expertDeckFolder ?? (await createAssetDraftFolder(`deck ${assignedRow.workshop.title}`));
      setExpertDeckFolder(folder);
      const uploaded = await uploadAssetFiles(folder.id, [file]);
      const uploadedFile = uploaded[0] ?? { id: `local_${Date.now()}`, name: file.name, url: folder.url };
      setExpertDeckFile(uploadedFile);
      notify("Deck caricato", `${uploadedFile.name} salvato nella cartella Drive.`);
    } catch (error) {
      setExpertDeckError(error instanceof Error ? error.message : "Upload deck non riuscito.");
    } finally {
      setExpertDeckUploading(false);
    }
  };
  const sendDeckToBrand = async () => {
    if (!assignedRow || !expertDeckFile) return;
    try {
      if (activeExpertProject.source === "sheet" && activeExpertProject.request) {
        const nextWorkshops = activeExpertProject.request.workshops.map((record) =>
          record.workshopId === assignedRow.workshop.id
            ? { ...record, status: "in_revisione_brand", expertName: record.expertName || expertName }
            : record,
        );
        const request = await updateWorkshopRequest(
          activeExpertProject.id,
          {
            status: "in_revisione_brand",
            workshops: nextWorkshops,
            materials: {
              ...(activeExpertProject.request.materials ?? {}),
              folderId: expertDeckFolder?.id ?? activeExpertProject.request.materials?.folderId,
              folderName: expertDeckFolder?.name ?? expertDeckFile.name,
              folderUrl: expertDeckFile.url || expertDeckFolder?.url || activeExpertProject.request.materials?.folderUrl,
              fileCount: Math.max(activeExpertProject.request.materials?.fileCount ?? 0, 1),
            },
          },
          {
            type: "expert_deck_sent_to_brand",
            note: `${expertName} ha inviato ${expertDeckFile.name} alla revisione brand.`,
            payload: { workshopId: assignedRow.workshop.id, file: expertDeckFile, folder: expertDeckFolder },
          },
        );
        setSyncedProject(requestToAdminProject(request));
      } else {
        updateSelection(assignedRow.workshop.id, { status: "in_revisione_brand" });
      }
      setProjectStatus("in_revisione_brand", "Deck inviato al brand", `${expertDeckFile.name} passa alla revisione qualita.`);
      notify("Deck inviato al brand", `${expertDeckFile.name} salvato sul registro del progetto.`);
    } catch (error) {
      notify("Invio a brand non salvato", error instanceof Error ? error.message : "Aggiornamento registro non riuscito.");
    }
  };
  const loadExpertDriveItems = async (openPicker: boolean) => {
    if (openPicker) setExpertDrivePickerOpen(true);
    setExpertDriveLoading(true);
    setExpertDeckError("");
    try {
      const preview = await getDriveFolderPreview();
      const items = [...(preview?.files ?? []), ...(preview?.folders ?? [])].filter((item) =>
        item.type === "presentation" || item.type === "file",
      );
      setExpertDriveItems(items);
      if (!preview) {
        setExpertDeckError("Configura Apps Script e una cartella Drive per selezionare file esistenti.");
      } else if (!items.length) {
        setExpertDeckError("Nessuna presentazione o file selezionabile nella cartella Drive configurata.");
      }
    } catch (error) {
      setExpertDeckError(error instanceof Error ? error.message : "Selezione Drive non disponibile.");
    } finally {
      setExpertDriveLoading(false);
    }
  };
  const openExpertDrivePicker = async () => {
    await loadExpertDriveItems(true);
  };
  const selectExpertDriveItem = (item: DriveFolderItem) => {
    setExpertDeckFile({
      id: item.id,
      name: item.name,
      size: 0,
      mimeType: item.mimeType || (item.type === "presentation" ? "Google Slides" : "File Drive"),
      url: item.url,
    });
    setExpertDrivePickerOpen(false);
    notify("Presentazione selezionata", `${item.name} selezionata da Drive.`);
  };
  const refreshExpertSection = (section: string) => {
    if (section === "Opportunita") {
      setAvailabilityUpdatedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      void loadExpertOpportunities(true);
      return;
    }
    if (section === "Upload deck") {
      void loadExpertDriveItems(false);
      notify("File Drive aggiornati", "Presentazioni e file selezionabili rilette dalla cartella Drive configurata.");
      return;
    }
    notify("Sezione aggiornata", `${section}: dati esperto riletti nella vista corrente.`);
  };
  useEffect(() => {
    if (systemRefreshToken === 0) return;
    refreshExpertSection(expertStep);
  }, [systemRefreshToken]);
  useEffect(() => {
    if (systemSettingsToken === 0) return;
    setExpertStep("Upload deck");
    notify("Impostazioni esperto", "Aperto Upload deck: qui gestisci file e collegamenti Drive dell'esperto.");
  }, [systemSettingsToken]);
  const confirmExpertCandidacy = async () => {
    if (!candidateModalRow || candidateSending) return;
    const { selection, workshop } = candidateModalRow;
    setCandidateSending(true);
    try {
      let updatedProject = activeExpertProject;
      if (activeExpertProject.source === "sheet" && activeExpertProject.request) {
        const nextWorkshops = activeExpertProject.request.workshops.map((record) =>
          record.workshopId === workshop.id
            ? { ...record, status: "candidatura_ricevuta", expertName, approval: record.approval ?? "approved" }
            : record,
        );
        const request = await updateWorkshopRequest(
          activeExpertProject.id,
          {
            status: "aperto_a_esperti",
            workshops: nextWorkshops,
            assignedExpert: activeExpertProject.assignedExpert,
          },
          {
            type: "expert_candidate_received",
            note: `${expertName} si e candidata per ${workshop.title}.`,
            payload: { workshopId: workshop.id, expertName },
          },
        );
        updatedProject = requestToAdminProject(request);
        setSyncedProject(updatedProject);
      }
      if (activeExpertProject.source === "local") updateSelection(workshop.id, { status: "candidatura_ricevuta" });
      setProjectStatus("aperto_a_esperti", "Candidatura inviata", "FunniFin ha ricevuto la candidatura interna e puo assegnarti il workshop.");
      notify("Candidatura registrata", "Nessuna email automatica inviata: FunniFin la vede nella coda progetto.");
      setCandidateModalRow(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invio candidatura non riuscito.";
      notify("Candidatura non inviata", message);
    } finally {
      setCandidateSending(false);
    }
  };

  return (
    <section className="view-stack expert-console">
      {candidateModalRow && (
        <ExpertCandidateModal
          row={candidateModalRow}
          company={activeExpertProject.company}
          sending={candidateSending}
          onClose={() => {
            if (!candidateSending) setCandidateModalRow(null);
          }}
          onConfirm={confirmExpertCandidacy}
        />
      )}
      <RoleHero
        eyebrow="Area esperto"
        title="Gestisci candidature, incarichi e deck."
        subtitle={`${activeExpertProject.company} · ${expertRows.length} opportunita aperte · ${candidateCount} candidature inviate`}
        actions={
          <>
          <ToolIconButton onClick={() => setExpertStep("Opportunita")} label="Vedi opportunita">
            <Megaphone size={22} />
          </ToolIconButton>
          <ToolIconButton onClick={() => setExpertStep("Upload deck")} label="Carica deck">
            <UploadCloud size={22} />
          </ToolIconButton>
          <ToolIconButton
            onClick={() => {
              setAvailabilityUpdatedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
              setExpertStep("Opportunita");
              void loadExpertOpportunities(true);
            }}
            label="Aggiorna disponibilita"
          >
            <CalendarCheck size={22} />
          </ToolIconButton>
          </>
        }
      />
      <OperatorIdentityCard identity={roleIdentities.Esperto} />
      {availabilityUpdatedAt && (
        <div className="inline-status-card">
          <Check size={18} />
          <span>Disponibilita aggiornata alle {availabilityUpdatedAt}. Le opportunita sono filtrate sui tuoi slot liberi.</span>
        </div>
      )}
      {expertSyncState.error && (
        <div className="inline-status-card warning">
          <AlertCircle size={18} />
          <span>{expertSyncState.error}</span>
        </div>
      )}

      <OperationalStrip
        label="Riepilogo operativo esperto"
        items={[
          { id: "opportunities", label: "Workshop disponibili", value: expertRows.length, icon: <Megaphone size={22} />, active: expertStep === "Opportunita", onClick: () => setExpertStep("Opportunita") },
          { id: "assigned", label: "Assegnati", value: assignedRow ? 1 : 0, icon: <CalendarCheck size={22} />, active: expertStep === "Assegnati", onClick: () => setExpertStep("Assegnati") },
          { id: "deck", label: "Deck da caricare", value: 1, icon: <Presentation size={22} />, active: expertStep === "Upload deck", onClick: () => setExpertStep("Upload deck") },
        ]}
      />

      <Stepper steps={expertSteps} activeStep={expertStep} onStep={setExpertStep}>

      {expertStep === "Opportunita" && (
        <Panel
          title="Opportunita disponibili"
          icon={<Megaphone size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshExpertSection("Opportunita")} label="Ricarica opportunita">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          {expertSyncState.loading && <span className="empty-selection">Lettura opportunita dal registro...</span>}
          <div className="expert-opportunity-grid">
            {expertRows.map(({ selection, workshop }) => {
              const alreadyCandidate = selection.status === "candidatura_ricevuta";
              const unavailable = selection.status === "non_disponibile";
              return (
                <div className={`opportunity-card ${alreadyCandidate ? "candidate-sent" : ""} ${unavailable ? "unavailable" : ""}`} key={selection.workshopId}>
                  <div className="opportunity-head">
                    <span className="topic-badge">
                      {alreadyCandidate && "candidatura inviata"}
                      {unavailable && "non disponibile"}
                      {!alreadyCandidate && !unavailable && workshop.level}
                    </span>
                    <strong>{workshop.title}</strong>
                  </div>
                  <div className="opportunity-meta">
                    <Info label="Cliente" value={activeExpertProject.company} />
                    <Info label="Target" value={workshop.target} />
                    <Info label="Formato" value={`${selection.duration} · ${selection.format}`} />
                    <Info label="Data proposta" value={`${selection.date || "da proporre"} ${selection.time}`} />
                  </div>
                  <p className="email-entry-hint">Accesso da mail FunniFin: clicca “Mi candido” per inviare la candidatura al team.</p>
                  <div className="button-row">
                    <AppButton
                      variant={alreadyCandidate ? "outline" : "secondary"}
                      disabled={alreadyCandidate || unavailable}
                      onClick={() => {
                        if (alreadyCandidate || unavailable) return;
                        setCandidateModalRow({ selection, workshop });
                      }}
                    >
                      {alreadyCandidate ? "Candidatura inviata" : "Mi candido"}
                    </AppButton>
                    <AppButton
                      variant="ghost"
                      disabled={alreadyCandidate || unavailable}
                      onClick={() => {
                        if (alreadyCandidate || unavailable) return;
                        updateSelection(workshop.id, { status: "non_disponibile" });
                        notify("Non disponibile", `${workshop.title} segnato come non disponibile per la tua agenda.`);
                      }}
                    >
                      {unavailable ? "Segnato non disponibile" : "Non disponibile"}
                    </AppButton>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {expertStep === "Assegnati" && (
        <Panel
          title="Workshop assegnati"
          icon={<CalendarCheck size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshExpertSection("Assegnati")} label="Ricarica workshop assegnati">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          <div className="expert-opportunity-grid">
            {(assignedRow ? [assignedRow] : []).map(({ selection, workshop }) => (
              <div className="opportunity-card selected" key={workshop.id}>
                <div className="opportunity-head">
                  <span className="topic-badge">assegnato</span>
                  <strong>{workshop.title}</strong>
                </div>
                <div className="opportunity-meta">
                  <Info label="Cliente" value={activeExpertProject.company} />
                  <Info label="Quando" value={`${selection.date || "data da confermare"} ${selection.time}`} />
                  <Info label="Formato" value={`${selection.duration} · ${selection.format}`} />
                  <Info label="Materiali" value="Logo e note disponibili" />
                </div>
                <AppButton variant="secondary" onClick={() => setExpertStep("Upload deck")}>
                  Vai all'upload
                </AppButton>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {expertStep === "Upload deck" && (
        <Panel
          title="Upload presentazione"
          icon={<UploadCloud size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshExpertSection("Upload deck")} label="Ricarica file Drive">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          <div className="expert-upload-panel">
            <div className="expert-upload-copy">
              <span className="topic-badge">deck</span>
              <h3>{assignedRow?.workshop.title ?? "Nessun workshop assegnato"}</h3>
              <p>Carica la presentazione pronta o scegli un file gia presente in Drive. Dopo l'invio passa al brand.</p>
            </div>
            <div className={`expert-upload-dropzone ${expertDeckFile ? "has-file" : ""}`}>
              {expertDeckFile ? <FileCheck2 size={28} /> : <UploadCloud size={28} />}
              <strong>{expertDeckFile ? expertDeckFile.name : "Nessuna presentazione selezionata"}</strong>
              <span>{expertDeckFile ? expertDeckFile.mimeType || "File selezionato" : "Google Slides, PPTX o PDF"}</span>
              {expertDeckError && <em>{expertDeckError}</em>}
              <div className="expert-upload-actions">
                <label className="app-btn app-btn-secondary asset-upload-trigger">
                  {expertDeckUploading ? "Carico..." : "Carica file"}
                  <input
                    className="asset-file-input"
                    type="file"
                    accept=".ppt,.pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    disabled={expertDeckUploading}
                    onChange={(event) => handleExpertDeckUpload(event.target.files)}
                  />
                </label>
                <AppButton variant="ghost" onClick={openExpertDrivePicker}>
                  <ExternalLink size={18} /> Seleziona da Drive
                </AppButton>
              </div>
              {expertDrivePickerOpen && (
                <div className="drive-picker-panel">
                  <div>
                    <strong>Seleziona da Drive</strong>
                    <button type="button" onClick={() => setExpertDrivePickerOpen(false)} aria-label="Chiudi selezione Drive">
                      <X size={16} />
                    </button>
                  </div>
                  {expertDriveLoading && <span>Carico file Drive...</span>}
                  {!expertDriveLoading && expertDriveItems.length === 0 && <span>Nessun file selezionabile.</span>}
                  {!expertDriveLoading && expertDriveItems.map((item) => (
                    <button key={item.id} type="button" onClick={() => selectExpertDriveItem(item)}>
                      <Presentation size={16} />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <AppButton
              variant="primary"
              disabled={!assignedRow || !expertDeckFile}
              onClick={() => {
                void sendDeckToBrand();
              }}
            >
              <UploadCloud size={18} /> Invia a revisione brand
            </AppButton>
          </div>
        </Panel>
      )}

      {expertStep === "Storico" && (
        <Panel
          title="Storico workshop"
          icon={<Presentation size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshExpertSection("Storico")} label="Ricarica storico">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          <div className="expert-history-list">
            <div className="info">
              <span>Storico reale</span>
              <strong>Nessun workshop completato registrato per questo esperto.</strong>
            </div>
          </div>
        </Panel>
      )}
      </Stepper>
      <BottomActionBar
        context={`Esperto · ${expertStep}`}
        detail={`${expertRows.length} opportunita · ${candidateCount} candidature inviate`}
        primaryLabel={expertMainAction.label}
        primaryDisabled={expertMainAction.disabled}
        onPrimary={expertMainAction.action}
      />
    </section>
  );
}
