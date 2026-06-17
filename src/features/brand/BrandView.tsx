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
import { getBrandPresentations, type BrandPresentation } from "../../googleDriveService";
import { listWorkshopRequests, updateWorkshopRequest } from "../../requestService";
import { roleIdentities } from "../../data/mockData";
import { statusLabel } from "../../data/workflow";
import type { AdminProject, BrandDeckStatus, ProjectStatus } from "../../types/domain";
import { getDeckOpenUrl, getDeckPreviewUrl } from "../../utils/googleDrive";
import { requestToAdminProject } from "../../utils/workshop";
import { AppButton } from "../../components/ui/AppButton";
import { ActionIconButton, ToolIconButton } from "../../components/ui/IconButton";
import { Info } from "../../components/ui/Info";
import { Panel } from "../../components/ui/Panel";
import { Skeleton } from "../../components/ui/Skeleton";
import { BottomActionBar } from "../../components/layout/BottomActionBar";
import { OperatorIdentityCard } from "../../components/layout/OperatorIdentityCard";
import { RoleHero } from "../../components/layout/RoleHero";
import { WorkshopSessionView } from "../../components/workshop/WorkshopSessionView";

export function BrandView({
  brandFilter,
  setBrandFilter,
  setProjectStatus,
  syncProjectStatus,
  notify,
  systemRefreshToken,
  systemSettingsToken,
}: {
  brandFilter: string;
  setBrandFilter: (filter: string) => void;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  syncProjectStatus: (status: ProjectStatus) => void;
  notify: (title: string, body: string) => void;
  systemRefreshToken: number;
  systemSettingsToken: number;
}) {
  const [brandDecks, setBrandDecks] = useState<BrandPresentation[]>([]);
  const [brandProjects, setBrandProjects] = useState<AdminProject[]>([]);
  const [selectedBrandProjectId, setSelectedBrandProjectId] = useState("");
  const [brandProjectLoading, setBrandProjectLoading] = useState(false);
  const [brandProjectError, setBrandProjectError] = useState("");
  const [selectedBrandDeckId, setSelectedBrandDeckId] = useState("");
  const [brandVersion, setBrandVersion] = useState(2);
  const [brandDriveLoading, setBrandDriveLoading] = useState(false);
  const [brandDriveError, setBrandDriveError] = useState("");
  const [brandDriveFolder, setBrandDriveFolder] = useState<{ name: string; url: string } | null>(null);
  const [reviewNote, setReviewNote] = useState("Uniformare chip topic, inserire logo nella cover, verificare disclaimer finale.");
  const [reviewChecklist, setReviewChecklist] = useState({
    clientLogo: false,
    contents: false,
    qrCode: false,
  });
  const brandItems = {
    Revisioni: brandDecks.filter((deck) => deck.status === "in_review"),
    "Da correggere": brandDecks.filter((deck) => deck.status === "changes_requested"),
    Approvate: brandDecks.filter((deck) => deck.status === "approved"),
    Storico: brandDecks.filter((deck) => deck.status === "archived"),
  };
  const selectedBrandDeck = brandDecks.find((deck) => deck.id === selectedBrandDeckId) ?? brandItems[brandFilter as keyof typeof brandItems][0];
  const selectedBrandProject = brandProjects.find((project) => project.id === selectedBrandProjectId) ?? brandProjects[0];
  useEffect(() => {
    if (selectedBrandProject) syncProjectStatus(selectedBrandProject.status);
  }, [selectedBrandProject?.id, selectedBrandProject?.status, syncProjectStatus]);
  const selectedDeckStatus = selectedBrandDeck?.status ?? "in_review";
  const selectedDeckPreviewUrl = selectedBrandDeck ? getDeckPreviewUrl(selectedBrandDeck) : "";
  const selectedDeckOpenUrl = selectedBrandDeck ? getDeckOpenUrl(selectedBrandDeck) : "";
  const selectedDeckStatusLabel: Record<BrandDeckStatus, string> = {
    in_review: "in revisione",
    changes_requested: "modifiche richieste",
    approved: "approvata",
    archived: "archiviata",
  };
  const updateDeckStatus = (status: BrandDeckStatus) => {
    if (!selectedBrandDeck) return;
    setBrandDecks((current) => current.map((deck) => (deck.id === selectedBrandDeck.id ? { ...deck, status } : deck)));
  };
  const brandSessionItems =
    selectedBrandProject?.request?.workshops.map((workshop) => ({
      id: workshop.workshopId,
      title: workshop.title,
      date: workshop.date,
      time: workshop.time,
      duration: workshop.duration,
      format: workshop.format,
      expertName: workshop.expertName,
    })) ?? [];
  const refreshBrandProjects = (showFeedback = true) => {
    setBrandProjectLoading(true);
    setBrandProjectError("");
    listWorkshopRequests()
      .then((requests) => {
        const projects = requests
          .filter((request) => ["in_revisione_brand", "approvazione_finale", "confermato", "evento_provvisorio"].includes(request.status))
          .map(requestToAdminProject);
        setBrandProjects(projects);
        setSelectedBrandProjectId((current) => (projects.some((project) => project.id === current) ? current : projects[0]?.id ?? ""));
        if (!projects.length) setBrandProjectError("Nessun progetto reale in revisione brand nel registro.");
        if (showFeedback) notify(projects.length ? "Coda brand aggiornata" : "Nessun progetto brand", projects.length ? `${projects.length} progetti letti dal registro.` : "Il registro non contiene progetti in revisione brand.");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Lettura progetti brand non riuscita.";
        setBrandProjectError(message);
        if (showFeedback) notify("Coda brand non aggiornata", message);
      })
      .finally(() => setBrandProjectLoading(false));
  };
  const persistBrandProjectStatus = async (status: ProjectStatus, eventType: string, note: string, deckStatus?: BrandDeckStatus) => {
    if (!selectedBrandProject) {
      notify("Nessun progetto selezionato", "Seleziona un progetto reale dalla coda brand.");
      return;
    }
    try {
      const request = await updateWorkshopRequest(
        selectedBrandProject.id,
        {
          status,
          materials: {
            ...(selectedBrandProject.request?.materials ?? {}),
            folderUrl: selectedBrandDeck ? getDeckOpenUrl(selectedBrandDeck) : selectedBrandProject.request?.materials?.folderUrl,
            folderName: selectedBrandDeck?.title ?? selectedBrandProject.request?.materials?.folderName,
          },
        },
        {
          type: eventType,
          note,
          payload: {
            deckId: selectedBrandDeck?.id,
            deckTitle: selectedBrandDeck?.title,
            deckStatus,
            reviewNote,
            checklist: reviewChecklist,
          },
        },
      );
      const project = requestToAdminProject(request);
      setBrandProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
      setSelectedBrandProjectId(project.id);
      setProjectStatus(status, eventType === "brand_approved" ? "Brand approvato" : "Modifiche richieste", note);
      notify(eventType === "brand_approved" ? "Brand approvato" : "Modifiche richieste", `${project.company}: stato salvato sul registro.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aggiornamento brand non salvato.";
      notify("Registro brand non aggiornato", message);
    }
  };
  const refreshBrandDrive = (showFeedback = true) => {
    setBrandDriveLoading(true);
    getBrandPresentations()
      .then((result) => {
        if (!result) {
          setBrandDriveError("Endpoint Apps Script non configurato.");
          return;
        }
        if (!Array.isArray(result.presentations)) {
          setBrandDriveError("Action brandPresentations non disponibile nel deploy Apps Script corrente.");
          return;
        }
        setBrandDriveFolder(result.folder ? { name: result.folder.name, url: result.folder.url } : null);
        if (!result.presentations.length) {
          setBrandDecks([]);
          setSelectedBrandDeckId("");
          setBrandDriveError("Nessuna presentazione trovata nella cartella configurata.");
          return;
        }
        setBrandDecks(result.presentations.map((deck) => ({ ...deck, source: "google-drive" })));
        setSelectedBrandDeckId(result.presentations[0].id);
        setBrandDriveError("");
        if (showFeedback) notify("Presentazioni aggiornate", `${result.presentations.length} deck riletti dalla cartella Drive.`);
      })
      .catch((error) => {
        setBrandDriveError(error instanceof Error ? error.message : "Sincronizzazione Drive non riuscita.");
      })
      .finally(() => {
        setBrandDriveLoading(false);
      });
  };

  useEffect(() => {
    refreshBrandDrive(false);
    refreshBrandProjects(false);
    return () => {
    };
  }, []);
  useEffect(() => {
    if (systemRefreshToken === 0) return;
    refreshBrandProjects(true);
    refreshBrandDrive(true);
  }, [systemRefreshToken]);
  useEffect(() => {
    if (systemSettingsToken === 0) return;
    setBrandFilter("Revisioni");
    notify("Impostazioni brand", "Vista revisioni attiva: qui gestisci stato deck, versioni e collegamenti Drive.");
  }, [systemSettingsToken]);

  useEffect(() => {
    const currentQueue = brandItems[brandFilter as keyof typeof brandItems];
    if (currentQueue.some((deck) => deck.id === selectedBrandDeckId)) return;
    const firstDeck = currentQueue[0];
    setSelectedBrandDeckId(firstDeck?.id ?? "");
  }, [brandFilter, brandDecks]);
  const approveSelectedDeck = () => {
    if (!selectedBrandDeck && !selectedBrandProject) return;
    if (selectedBrandDeck) {
      const deckId = selectedBrandDeck.id;
      updateDeckStatus("approved");
      setSelectedBrandDeckId(deckId);
    }
    setBrandFilter("Approvate");
    void persistBrandProjectStatus("approvazione_finale", "brand_approved", "La versione brand-approved passa all'approvazione finale FunniFin/cliente.", "approved");
  };
  const requestDeckChanges = () => {
    if (!selectedBrandDeck && !selectedBrandProject) return;
    if (selectedBrandDeck) {
      const deckId = selectedBrandDeck.id;
      updateDeckStatus("changes_requested");
      setSelectedBrandDeckId(deckId);
    }
    setBrandFilter("Da correggere");
    void persistBrandProjectStatus("in_revisione_brand", "brand_changes_requested", "L'esperto vede le note e deve caricare una nuova versione.", "changes_requested");
  };
  const enableDeckForCalendar = async () => {
    if (!selectedBrandProject || !selectedBrandDeck) {
      notify("Deck non selezionato", "Seleziona un progetto e una presentazione prima di abilitarla per Calendar.");
      return;
    }
    const finalDeckUrl = getDeckOpenUrl(selectedBrandDeck);
    if (!finalDeckUrl) {
      notify("Link deck mancante", "La presentazione selezionata non espone un link Drive/Slides.");
      return;
    }
    try {
      const request = await updateWorkshopRequest(
        selectedBrandProject.id,
        {
          materials: {
            ...(selectedBrandProject.request?.materials ?? {}),
            folderUrl: finalDeckUrl,
            folderName: selectedBrandDeck.title,
            finalDeckUrl,
            finalDeckTitle: selectedBrandDeck.title,
            calendarDeckEnabled: true,
            calendarDeckEnabledAt: new Date().toLocaleString("sv-SE", { timeZone: "Europe/Rome" }),
          },
        },
        {
          type: "brand_calendar_deck_enabled",
          note: `Brand ha abilitato ${selectedBrandDeck.title} come deck finale da scrivere nel Calendar.`,
          payload: {
            deckId: selectedBrandDeck.id,
            deckTitle: selectedBrandDeck.title,
            finalDeckUrl,
          },
        },
      );
      const project = requestToAdminProject(request);
      setBrandProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
      setSelectedBrandProjectId(project.id);
      notify("Deck abilitato per Calendar", `${selectedBrandDeck.title}: il link verra scritto solo negli eventi creati dopo questa abilitazione.`);
    } catch (error) {
      notify("Deck Calendar non salvato", error instanceof Error ? error.message : "Aggiornamento registro non riuscito.");
    }
  };
  const uploadDeckVersion = () => {
    if (!selectedBrandDeck) return;
    const deckId = selectedBrandDeck.id;
    setBrandDecks((current) =>
      current.map((deck) =>
        deck.id === selectedBrandDeck.id ? { ...deck, version: deck.version + 1, status: "in_review" as BrandDeckStatus } : deck,
      ),
    );
    setBrandVersion((version) => version + 1);
    setSelectedBrandDeckId(deckId);
    setBrandFilter("Revisioni");
    notify("Nuova versione caricata", `${selectedBrandDeck.title} aggiornato e rimesso in coda revisioni.`);
  };
  const brandMainAction = (() => {
    if (!selectedBrandDeck && !selectedBrandProject) return { label: "Nessun deck selezionato", disabled: true, action: () => {} };
    if (brandFilter === "Approvate") return { label: "Carica nuova versione", disabled: false, action: uploadDeckVersion };
    if (brandFilter === "Da correggere") return { label: "Carica nuova versione", disabled: false, action: uploadDeckVersion };
    if (brandFilter === "Storico") return { label: "Riapri revisione", disabled: false, action: uploadDeckVersion };
    return { label: "Approva brand", disabled: false, action: approveSelectedDeck };
  })();
  const queueIcons: Record<string, React.ReactNode> = {
    Revisioni: <Palette size={18} />,
    "Da correggere": <AlertCircle size={18} />,
    Approvate: <BadgeCheck size={18} />,
    Storico: <Presentation size={18} />,
  };

  return (
    <section className="view-stack">
      <RoleHero
        eyebrow="Area brand"
        title="Revisiona deck, note e versioni prima della conferma finale."
        subtitle={`${brandProjects.length} progetti reali · ${brandDecks.length} deck in Drive · ${brandItems.Revisioni.length} in revisione`}
        actions={
          brandDriveFolder?.url ? (
            <ToolIconButton onClick={() => window.open(brandDriveFolder.url, "_blank", "noopener,noreferrer")} label="Apri cartella Drive">
              <ExternalLink size={22} />
            </ToolIconButton>
          ) : undefined
        }
      />
      <OperatorIdentityCard identity={roleIdentities.Brand} />
      <Panel
        title="Progetti in revisione"
        icon={<BadgeCheck size={20} />}
        actions={
          <ToolIconButton onClick={() => refreshBrandProjects(true)} label="Ricarica progetti brand">
            <RefreshCw size={18} />
          </ToolIconButton>
        }
      >
        <div className="drive-sync-strip">
          <span>
            {brandProjectLoading && "Leggo progetti dal registro..."}
            {!brandProjectLoading && !brandProjectError && "Progetti reali letti da Google Sheet"}
            {!brandProjectLoading && brandProjectError}
          </span>
          <strong>{brandProjects.length} progetti</strong>
        </div>
        <div className="review-list" aria-busy={brandProjectLoading}>
          {brandProjectLoading ? Array.from({ length: 3 }).map((_, index) => (
            <span className="review-list-item skeleton-row" key={`brand-project-skeleton-${index}`} aria-hidden="true">
              <Skeleton className="skeleton-dot" />
              <span className="skeleton-text">
                <Skeleton className="skeleton-line" />
                <Skeleton className="skeleton-line short" />
              </span>
            </span>
          )) : brandProjects.map((project) => (
            <button
              key={project.id}
              className={`review-list-item ${selectedBrandProject?.id === project.id ? "active" : ""}`}
              onClick={() => setSelectedBrandProjectId(project.id)}
            >
              <BadgeCheck size={16} />
              <span>{project.company} · {statusLabel[project.status] ?? project.status}</span>
            </button>
          ))}
          {!brandProjectLoading && brandProjects.length === 0 && <span className="empty-selection">Nessun progetto in revisione brand.</span>}
        </div>
      </Panel>
      <Panel
        title="Revisione materiali brand"
        icon={<Palette size={20} />}
        actions={
          <ToolIconButton onClick={() => refreshBrandDrive(true)} label="Ricarica presentazioni Drive">
            <RefreshCw size={18} />
          </ToolIconButton>
        }
      >
        <div className="drive-sync-strip">
          <span>
            {brandDriveLoading && "Sincronizzo presentazioni Drive..."}
            {!brandDriveLoading && !brandDriveError && `Presentazioni reali da ${brandDriveFolder?.name || "Google Drive"}`}
            {!brandDriveLoading && brandDriveError}
          </span>
          <strong>{brandDecks.length} deck</strong>
        </div>
        <div className="brand-workbench">
          <div className="brand-queue-card">
            <span>Coda materiali</span>
            {Object.entries(brandItems).map(([label, items]) => (
              <button
                key={label}
                className={brandFilter === label ? "active" : ""}
                onClick={() => setBrandFilter(label)}
              >
                {queueIcons[label]}
                <span>{label}</span>
                <strong>{items.length}</strong>
              </button>
            ))}
          </div>
          <div className="brand-review-area">
            <div className="review-list" aria-busy={brandDriveLoading}>
              {brandDriveLoading ? Array.from({ length: 4 }).map((_, index) => (
                <span className="review-list-item skeleton-row" key={`brand-deck-skeleton-${index}`} aria-hidden="true">
                  <Skeleton className="skeleton-dot" />
                  <span className="skeleton-text">
                    <Skeleton className="skeleton-line" />
                    <Skeleton className="skeleton-line short" />
                  </span>
                </span>
              )) : brandItems[brandFilter as keyof typeof brandItems].map((item) => (
                <button key={item.id} className={`review-list-item ${selectedBrandDeck?.id === item.id ? "active" : ""}`} onClick={() => setSelectedBrandDeckId(item.id)}>
                  <Presentation size={16} />
                  <span>{item.title}_v{String(item.version).padStart(2, "0")}</span>
                </button>
              ))}
              {!brandDriveLoading && brandItems[brandFilter as keyof typeof brandItems].length === 0 && (
                <span className="empty-selection">Nessun deck in questa coda.</span>
              )}
            </div>
            {brandDriveLoading ? (
              <div className="brand-review">
                <Skeleton className="deck-preview-skeleton" large />
              </div>
            ) : !selectedBrandDeck ? (
              <div className="brand-empty-state">
                <Presentation size={42} />
                <strong>Nessuna presentazione da revisionare</strong>
                <span>Quando arriva un deck nella cartella Drive del progetto, lo trovi qui con anteprima, note e stato di revisione.</span>
                {brandDriveFolder?.url && (
                  <AppButton variant="secondary" onClick={() => window.open(brandDriveFolder.url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink size={17} /> Apri Drive
                  </AppButton>
                )}
              </div>
            ) : (
              <div className="brand-review">
                <div className="deck-preview">
                  {selectedDeckPreviewUrl ? (
                    <iframe title={`Anteprima ${selectedBrandDeck.title}`} src={selectedDeckPreviewUrl} loading="lazy" allowFullScreen />
                  ) : (
                    <div className="deck-preview-empty">
                      <Presentation size={42} />
                      <strong>{selectedBrandDeck.title}</strong>
                      <span>Anteprima non disponibile: apri il file in Slides/Drive.</span>
                    </div>
                  )}
                  <div className="deck-preview-meta">
                    <span className={`review-status-badge ${selectedDeckStatus}`}>{selectedDeckStatusLabel[selectedDeckStatus]}</span>
                    <strong>{selectedBrandDeck.title}</strong>
                    <span>{selectedBrandDeck.client} · versione v{String(selectedBrandDeck.version).padStart(2, "0")}</span>
                    <AppButton
                      variant="outline"
                      disabled={!selectedDeckOpenUrl}
                      onClick={() => {
                        if (!selectedDeckOpenUrl) {
                          notify("Link non disponibile", "Il file non espone un URL Drive/Slides apribile.");
                          return;
                        }
                        window.open(selectedDeckOpenUrl, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <Presentation size={18} /> Apri in Slides
                    </AppButton>
                  </div>
                </div>
              </div>
            )}
            <WorkshopSessionView
              title="Workshop live"
              subtitle="La sessione continua qui con deck, Meet e materiali collegati."
              statusLabel={selectedBrandProject?.request?.materials?.calendarDeckEnabled ? "Deck pronto" : "Deck in attesa"}
              items={brandSessionItems}
              deckTitle={selectedBrandProject?.request?.materials?.finalDeckTitle || selectedBrandProject?.request?.materials?.folderName || ""}
              deckUrl={selectedBrandProject?.request?.materials?.calendarDeckEnabled ? selectedBrandProject?.request?.materials?.finalDeckUrl : undefined}
              driveFolderUrl={selectedBrandProject?.request?.materials?.folderUrl}
            />
            {selectedBrandDeck && (
              <div className="review-fields">
                  <div className="brand-review-info">
                    <Info label="Progetto" value={selectedBrandProject?.company ?? "Nessun progetto collegato"} />
                    <Info label="Cliente" value={selectedBrandDeck.client} />
                    <Info label="Workshop" value={selectedBrandDeck.workshop} />
                    <Info label="Esperto" value={selectedBrandDeck.expert} />
                    <Info label="Origine" value={selectedBrandDeck.source === "google-drive" ? selectedBrandDeck.folderName || "Google Drive" : "Demo"} />
                    <Info label="Aggiornata" value={selectedBrandDeck.updatedAt || "Non disponibile"} />
                  </div>
                  <div className="brand-checklist">
                    {[
                      ["clientLogo", "Logo cliente:"],
                      ["contents", "Contenuti;"],
                      ["qrCode", "Qrcode aggiornato:"],
                    ].map(([id, label]) => (
                      <label className="check-row" key={id}>
                        <input
                          type="checkbox"
                          checked={reviewChecklist[id as keyof typeof reviewChecklist]}
                          onChange={(event) => setReviewChecklist({ ...reviewChecklist, [id]: event.target.checked })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <label>
                    Note revisione
                    <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
                  </label>
                  <div className={`inline-status-card ${selectedBrandProject?.request?.materials?.calendarDeckEnabled ? "" : "warning"}`}>
                    <CalendarCheck size={18} />
                    <div className="inline-status-copy">
                      <strong>{selectedBrandProject?.request?.materials?.calendarDeckEnabled ? "Deck abilitato per Calendar" : "Deck non abilitato per Calendar"}</strong>
                      <span>
                        {selectedBrandProject?.request?.materials?.calendarDeckEnabled
                          ? selectedBrandProject.request.materials.finalDeckTitle || selectedBrandProject.request.materials.finalDeckUrl
                          : "Il link verra scritto negli eventi solo dopo questa abilitazione esplicita."}
                      </span>
                    </div>
                    <AppButton variant="secondary" onClick={enableDeckForCalendar} disabled={!selectedBrandDeck || selectedDeckStatus !== "approved"}>
                      <CalendarCheck size={17} /> Abilita per Calendar
                    </AppButton>
                  </div>
                  <div className="button-row compact-actions">
                    <ActionIconButton variant="success" onClick={approveSelectedDeck} label="Approva brand">
                      <Check size={18} />
                    </ActionIconButton>
                    <ActionIconButton onClick={requestDeckChanges} label="Richiedi modifiche">
                      <AlertCircle size={18} />
                    </ActionIconButton>
                    <ActionIconButton onClick={uploadDeckVersion} label="Carica nuova versione">
                      <UploadCloud size={18} />
                    </ActionIconButton>
                  </div>
                </div>
            )}
          </div>
        </div>
      </Panel>
      <BottomActionBar
        context={`Brand · ${brandFilter}`}
        detail={selectedBrandDeck ? `${selectedBrandDeck.title} · ${selectedDeckStatusLabel[selectedDeckStatus]}` : "Nessun deck reale trovato in Drive"}
        primaryLabel={brandMainAction.label}
        primaryDisabled={brandMainAction.disabled}
        onPrimary={brandMainAction.action}
        secondaryLabel={brandFilter === "Revisioni" && selectedBrandDeck ? "Richiedi modifiche" : undefined}
        onSecondary={brandFilter === "Revisioni" ? requestDeckChanges : undefined}
      />
    </section>
  );
}
