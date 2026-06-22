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
  Loader2,
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
} from "../../components/ui/FaIcons";
import { createAssetDraftFolder, uploadAssetFiles, type AssetDraftFolder, type UploadedAsset } from "../../driveAssetService";
import { connectExpertCalendar, createExpertCalendar, createExpertCalendarEvent, getExpertFunniFinAvailability, type CalendarSlot } from "../../googleCalendarService";
import { getDriveFolderPreview, type DriveFolderItem } from "../../googleDriveService";
import { listWorkshopRequests, updateWorkshopRequest } from "../../requestService";
import { sendWorkflowNotification } from "../../emailService";
import { roleIdentities } from "../../data/mockData";
import { workshops } from "../../data/catalog";
import { statusLabel } from "../../data/workflow";
import type { AdminProject, NotifyOptions, ProjectStatus, Selection, Workshop } from "../../types/domain";
import { useAuth } from "../../AuthContext";
import { requestToAdminProject } from "../../utils/workshop";
import { AppButton } from "../../components/ui/AppButton";
import { ActionIconButton, ToolIconButton } from "../../components/ui/IconButton";
import { Info } from "../../components/ui/Info";
import { Panel } from "../../components/ui/Panel";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import { BottomActionBar } from "../../components/layout/BottomActionBar";
import { OperatorIdentityCard } from "../../components/layout/OperatorIdentityCard";
import { RoleHero } from "../../components/layout/RoleHero";
import { ExpertCandidateModal } from "./components/ExpertCandidateModal";

export function ExpertView({
  selections,
  updateSelection,
  setProjectStatus,
  notify,
  syncProjectStatus,
  currentUserId,
  currentUserEmail,
  systemRefreshToken,
  systemSettingsToken,
  project,
}: {
  selections: Selection[];
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  notify: (title: string, body: string, options?: NotifyOptions) => void;
  syncProjectStatus: (status: ProjectStatus) => void;
  currentUserId?: string;
  currentUserEmail?: string;
  systemRefreshToken: number;
  systemSettingsToken: number;
  project: AdminProject;
}) {
  const { currentUser } = useAuth();
  const expertSteps = ["Disponibilita", "Opportunita", "Assegnati", "Upload deck", "Storico"];
  // Nome esperto: usa displayName dell'utente autenticato, fallback al roleIdentities mock
  const expertName = currentUser?.displayName ?? roleIdentities.Esperto.name;
  const [syncedProject, setSyncedProject] = useState<AdminProject>(project);
  const [expertSyncState, setExpertSyncState] = useState<{ loading: boolean; error: string }>({ loading: false, error: "" });
  const [expertStep, setExpertStep] = useState("Opportunita");
  const [candidateModalRow, setCandidateModalRow] = useState<{ selection: Selection; workshop: Workshop } | null>(null);
  const [candidateSending, setCandidateSending] = useState(false);
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState("");
  const [expertCalendarIdInput, setExpertCalendarIdInput] = useState("");
  const [expertCalendarSlots, setExpertCalendarSlots] = useState<CalendarSlot[]>([]);
  const [expertCalendarState, setExpertCalendarState] = useState<{
    connected: boolean;
    loading: boolean;
    saving: boolean;
    error: string;
    calendarName: string;
    updatedAt: string;
  }>({ connected: false, loading: false, saving: false, error: "", calendarName: "", updatedAt: "" });
  const [expertDeckFolder, setExpertDeckFolder] = useState<AssetDraftFolder | null>(null);
  const [expertDeckFile, setExpertDeckFile] = useState<UploadedAsset | null>(null);
  const [expertDeckUploading, setExpertDeckUploading] = useState(false);
  const [expertDeckSending, setExpertDeckSending] = useState(false);
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
  const assignedStatuses = new Set([
    "esperto_assegnato",
    "materiali_cliente_in_attesa",
    "in_preparazione_esperto",
    "in_revisione_brand",
    "approvazione_finale",
    "evento_provvisorio",
    "confermato",
  ]);
  const historyStatuses = new Set(["candidatura_ricevuta", "non_disponibile", ...assignedStatuses]);
  const assignedRows = expertRows.filter(({ selection }) => assignedStatuses.has(selection.status));
  const assignedRow = assignedRows[0];
  const historyRows = expertRows.filter(({ selection }) => historyStatuses.has(selection.status));
  const candidateCount = expertRows.filter(({ selection }) => selection.status === "candidatura_ricevuta").length;
  const expertStatusLabel = (status: string) => {
    if (status === "candidatura_ricevuta") return "Candidatura inviata";
    if (status === "non_disponibile") return "Non disponibile";
    return statusLabel[status as ProjectStatus] ?? "Aggiornato";
  };
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
  useEffect(() => {
    const noticeKey = `funnifin_expert_calendar_notice_${currentUserId || currentUserEmail || "session"}`;
    if (!sessionStorage.getItem(noticeKey)) {
      sessionStorage.setItem(noticeKey, "1");
      notify("Collega Google Calendar", "Gli eventi nel tuo calendario con titolo FunniFin vengono letti come non disponibilita.", {
        audience: ["Esperto"],
        audienceUserIds: currentUserId ? [currentUserId] : undefined,
        audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
        priority: "task",
        category: "task",
        action: { label: "Collega Calendar", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
    }
    void refreshExpertCalendar(false);
  }, [currentUserId, currentUserEmail]);
  const expertActiveIndex = expertSteps.indexOf(expertStep);
  const expertCompletedSteps = new Set<string>([
    ...(expertCalendarState.connected ? ["Disponibilita"] : []),
    ...(candidateCount > 0 ? ["Opportunita"] : []),
    ...(assignedRow ? ["Assegnati"] : []),
    ...(expertDeckFile ? ["Upload deck"] : []),
  ]);
  const expertMainAction = (() => {
    if (expertStep === "Disponibilita") return { label: "Rileggi Calendar", disabled: false, loading: expertCalendarState.loading, action: () => {
      setAvailabilityUpdatedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      void refreshExpertCalendar(true);
    } };
    if (expertStep === "Opportunita") return { label: "Aggiorna disponibilita", disabled: false, action: () => {
      setAvailabilityUpdatedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      void refreshExpertCalendar(true);
      void loadExpertOpportunities(true);
    } };
    if (expertStep === "Assegnati") return { label: "Vai all'upload", disabled: !assignedRow, action: () => setExpertStep("Upload deck") };
    if (expertStep === "Upload deck") return { label: "Invia a brand", disabled: !assignedRow || !expertDeckFile || expertDeckSending, loading: expertDeckSending, action: () => { void sendDeckToBrand(); } };
    return { label: "Vedi opportunita", disabled: false, action: () => setExpertStep("Opportunita") };
  })();
  const expertFlowTabs = [
    {
      id: "Disponibilita",
      label: "Disponibilita",
      meta: expertCalendarState.connected ? "Calendar collegato" : "Da collegare",
      icon: <CalendarCheck size={20} />,
    },
    {
      id: "Opportunita",
      label: "Candidature",
      meta: `${candidateCount} inviate`,
      icon: <Megaphone size={20} />,
    },
    {
      id: "Assegnati",
      label: "Incarichi",
      meta: assignedRows.length ? "Da lavorare" : "In attesa",
      icon: <BriefcaseBusiness size={20} />,
    },
    {
      id: "Upload deck",
      label: "Deck",
      meta: expertDeckFile ? "File selezionato" : "Da caricare",
      icon: <Presentation size={20} />,
    },
    {
      id: "Storico",
      label: "Stato",
      meta: historyRows.length ? "Aggiornato" : "Vuoto",
      icon: <Clock3 size={20} />,
    },
  ];
  const refreshExpertCalendar = async (showFeedback = false) => {
    setExpertCalendarState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const availability = await getExpertFunniFinAvailability({ horizonDays: 45 });
      const slots = Array.isArray(availability.slots) ? availability.slots : [];
      setExpertCalendarSlots(slots);
      setExpertCalendarState((current) => ({
        ...current,
        connected: Boolean(availability.connected),
        loading: false,
        error: "",
        calendarName: availability.calendarName || current.calendarName,
        updatedAt: availability.updatedAt || new Date().toLocaleString("it-IT"),
      }));
      if (availability.calendarId) setExpertCalendarIdInput(availability.calendarId);
      if (showFeedback) {
        notify(
          availability.connected ? "Disponibilita Calendar aggiornate" : "Calendar non collegato",
          availability.connected
            ? `${slots.length} blocchi FunniFin letti dal tuo Google Calendar.`
            : "Collega un Calendar ID condiviso con FunniFin: gli slot liberi generici non vengono usati.",
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lettura Calendar esperto non riuscita.";
      setExpertCalendarState((current) => ({ ...current, loading: false, error: message }));
      if (showFeedback) notify("Calendar non aggiornato", message);
    }
  };
  const saveExpertCalendar = async () => {
    const calendarId = expertCalendarIdInput.trim();
    if (!calendarId || expertCalendarState.saving) return;
    setExpertCalendarState((current) => ({ ...current, saving: true, error: "" }));
    try {
      const result = await connectExpertCalendar(calendarId);
      setExpertCalendarState((current) => ({
        ...current,
        connected: result.connected,
        saving: false,
        error: "",
        calendarName: result.calendarName || current.calendarName,
        updatedAt: result.updatedAt,
      }));
      notify("Google Calendar collegato", "Da ora FunniFin considera non disponibili gli eventi del tuo calendario con titolo FunniFin.", {
        audience: ["Esperto"],
        audienceUserIds: currentUserId ? [currentUserId] : undefined,
        audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
        priority: "task",
        category: "task",
        action: { label: "Rileggi slot", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
      await refreshExpertCalendar(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Collegamento Calendar non riuscito.";
      setExpertCalendarState((current) => ({ ...current, saving: false, error: message }));
      notify("Calendar non collegato", message, {
        audience: ["Esperto"],
        audienceUserIds: currentUserId ? [currentUserId] : undefined,
        audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
        priority: "critical",
        category: "system",
        action: { label: "Riprova", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
    }
  };
  const createAndConnectExpertCalendar = async () => {
    if (expertCalendarState.saving) return;
    setExpertCalendarState((current) => ({ ...current, saving: true, error: "" }));
    try {
      const result = await createExpertCalendar();
      setExpertCalendarIdInput(result.calendarId);
      setExpertCalendarState((current) => ({
        ...current,
        connected: result.connected,
        saving: false,
        error: "",
        calendarName: result.calendarName || current.calendarName,
        updatedAt: result.updatedAt,
      }));
      const shareCopy = result.shared === false
        ? `Creato e collegato. Condivisione Google non inviata: ${result.shareError || "controlla permessi Calendar."}`
        : `${result.calendarName || "Calendar esperto"} creato, collegato e condiviso con la tua email.`;
      notify("Google Calendar creato", shareCopy, {
        audience: ["Esperto"],
        audienceUserIds: currentUserId ? [currentUserId] : undefined,
        audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
        priority: "task",
        category: "task",
        action: { label: "Rileggi blocchi", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
      await refreshExpertCalendar(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Creazione Calendar non riuscita.";
      setExpertCalendarState((current) => ({ ...current, saving: false, error: message }));
      notify("Calendar non creato", message, {
        audience: ["Esperto"],
        audienceUserIds: currentUserId ? [currentUserId] : undefined,
        audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
        priority: "critical",
        category: "system",
        action: { label: "Riprova", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
    }
  };
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
    if (!assignedRow || !expertDeckFile || expertDeckSending) return;
    setExpertDeckSending(true);
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
      notify("Deck inviato al brand", `Hai inviato ${expertDeckFile.name} al Brand per la revisione.`, {
        audience: ["Esperto"],
        audienceUserIds: currentUserId ? [currentUserId] : undefined,
        audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
        priority: "task",
        category: "task",
        action: { label: "Torna all'upload", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
      notify("Esperto ti ha inviato una presentazione", `${expertName} ha inviato ${expertDeckFile.name}: apri la revisione Brand.`, {
        audience: ["Brand"],
        priority: "task",
        category: "task",
        action: { label: "Apri revisione", role: "Brand", hash: "#brand", projectId: activeExpertProject.id },
        toast: false,
      });
      try {
        const mailWorkshops = activeExpertProject.request
          ? activeExpertProject.request.workshops.map((record) => ({
              title: record.title,
              date: record.date,
              time: record.time,
              duration: record.duration,
              format: record.format,
              expertName: record.expertName || expertName,
            }))
          : expertRows.map(({ selection, workshop }) => ({
              title: workshop.title,
              date: selection.date,
              time: selection.time,
              duration: selection.duration,
              format: selection.format,
              expertName,
            }));
        const result = await sendWorkflowNotification({
          phase: "brand_review",
          project: {
            id: activeExpertProject.id,
            company: activeExpertProject.company,
            manager: activeExpertProject.manager,
            email: activeExpertProject.email,
            phone: activeExpertProject.phone,
            status: statusLabel.in_revisione_brand,
            quoteTotal: activeExpertProject.quoteTotal,
          },
          workshops: mailWorkshops,
          recipients: ["brand", "funnifin"],
          note: `${expertName} ha caricato ${expertDeckFile.name}.${expertDeckFile.url ? ` File: ${expertDeckFile.url}` : ""}`,
          actionUrl: expertDeckFile.url || undefined,
          actionLabel: "Apri presentazione",
        });
        notify("Email revisione inviata", `Avvisati via mail: ${result.recipients.join(", ") || "Brand e FunniFin"}.`, {
          audience: ["FunniFin"],
          priority: "info",
          category: "mail",
          action: { label: "Apri revisione", role: "FunniFin", hash: "#funnifin", projectId: activeExpertProject.id },
        });
      } catch (mailError) {
        notify("Email revisione non inviata", mailError instanceof Error ? mailError.message : "Il deck e stato salvato, ma la mail non e partita.", {
          audience: ["FunniFin"],
          priority: "critical",
          category: "mail",
          action: { label: "Verifica Google", role: "FunniFin", hash: "#funnifin" },
        });
      }
    } catch (error) {
      notify("Invio a brand non salvato", error instanceof Error ? error.message : "Aggiornamento registro non riuscito.", {
        audience: ["Esperto"],
        priority: "critical",
        category: "system",
        action: { label: "Torna all'upload", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
    } finally {
      setExpertDeckSending(false);
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
      void refreshExpertCalendar(true);
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
      notify("Candidatura registrata", `Hai inviato la candidatura per ${workshop.title}.`, {
        audience: ["Esperto"],
        audienceUserIds: currentUserId ? [currentUserId] : undefined,
        audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
        priority: "task",
        category: "task",
        action: { label: "Vedi opportunita", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
      notify("Esperto candidato", `${expertName} si e candidato per ${workshop.title}.`, {
        audience: ["FunniFin"],
        priority: "task",
        category: "task",
        action: { label: "Apri coda", role: "FunniFin", hash: "#funnifin", projectId: activeExpertProject.id },
        toast: false,
      });
      createExpertCalendarEvent({
        company: activeExpertProject.company,
        workshopId: workshop.id,
        workshopTitle: workshop.title,
        date: selection.date,
        time: selection.time,
        duration: selection.duration,
        format: selection.format,
        expertName,
        mode: "candidate",
      })
        .then((event) => {
          notify("Evento creato nel tuo Calendar", `Promemoria candidatura salvato su ${event.calendarName || "Google Calendar"}.`, {
            audience: ["Esperto"],
            audienceUserIds: currentUserId ? [currentUserId] : undefined,
            audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
            priority: "task",
            category: "task",
            action: { label: "Apri Calendar", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
          });
        })
        .catch((error) => {
          notify("Calendar esperto da collegare", error instanceof Error ? error.message : "Non ho potuto creare l'evento nel Calendar esperto.", {
            audience: ["Esperto"],
            audienceUserIds: currentUserId ? [currentUserId] : undefined,
            audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
            priority: "critical",
            category: "system",
            action: { label: "Collega Calendar", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
          });
        });
      setCandidateModalRow(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invio candidatura non riuscito.";
      notify("Candidatura non inviata", message, {
        audience: ["Esperto"],
        priority: "critical",
        category: "system",
        action: { label: "Riprova candidatura", role: "Esperto", hash: "#esperto-candidature", projectId: activeExpertProject.id },
      });
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
      <div className="role-header-grid">
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
                void refreshExpertCalendar(true);
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
      </div>
      {availabilityUpdatedAt && (
        <div className="inline-status-card">
          <Check size={18} />
          <span>Disponibilita aggiornata alle {availabilityUpdatedAt}. Gli eventi Google Calendar con titolo FunniFin bloccano quelle fasce.</span>
        </div>
      )}
      {expertSyncState.error && (
        <div className="inline-status-card warning">
          <AlertCircle size={18} />
          <span>{expertSyncState.error}</span>
        </div>
      )}

      <div className="expert-workspace-layout">
        <nav className="expert-flow-tabs" aria-label="Sezioni area esperto">
          {expertFlowTabs.map((tab) => {
            const active = expertStep === tab.id;
            const done = expertCompletedSteps.has(tab.id);
            return (
              <button
                key={tab.id}
                type="button"
                className={`expert-flow-tab ${active ? "active" : ""} ${done ? "done" : ""}`}
                onClick={() => setExpertStep(tab.id)}
                aria-current={active ? "page" : undefined}
              >
                <span className="expert-flow-tab-icon">{tab.icon}</span>
                <span>
                  <strong>{tab.label}</strong>
                  <em>{tab.meta}</em>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="expert-flow-content">
          {expertStep === "Disponibilita" && (
            <Panel className="expert-calendar-panel">
              <div className="expert-calendar-head">
                <div>
                  <span className="topic-badge">{expertCalendarState.connected ? "calendar collegato" : "azione richiesta"}</span>
                  <h3>Collega Google Calendar</h3>
                  <p>Un click crea un Calendar esperto dedicato, lo collega a FunniFin e lo condivide con la tua email. Gli eventi intitolati <strong>FunniFin</strong> bloccano quelle fasce nel planner cliente.</p>
                </div>
                <CalendarCheck size={26} />
              </div>
              <div className="expert-calendar-steps" aria-label="Procedura collegamento Google Calendar">
                <span><strong>1</strong> Crea e collega</span>
                <span><strong>2</strong> Ricevi il Calendar</span>
                <span><strong>3</strong> Blocca con eventi FunniFin</span>
              </div>
              <div className="expert-calendar-primary">
                <AppButton variant="primary" onClick={createAndConnectExpertCalendar} loading={expertCalendarState.saving}>
                  <CalendarCheck size={17} /> Crea e collega Calendar
                </AppButton>
                <span>FunniFin crea il calendario dedicato e lo rende modificabile dalla tua email.</span>
              </div>
              <div className="expert-calendar-connect">
                <label>
                  <span>Hai gia un calendario? Incolla Calendar ID</span>
                  <input
                    type="text"
                    value={expertCalendarIdInput}
                    onChange={(event) => setExpertCalendarIdInput(event.target.value)}
                    placeholder="nome@group.calendar.google.com"
                  />
                </label>
                <AppButton variant="secondary" onClick={saveExpertCalendar} loading={expertCalendarState.saving} disabled={!expertCalendarIdInput.trim()}>
                  <CalendarCheck size={17} /> Usa questo ID
                </AppButton>
                <AppButton variant="ghost" onClick={() => refreshExpertCalendar(true)} loading={expertCalendarState.loading}>
                  <RefreshCw size={17} /> Rileggi
                </AppButton>
                <a className="expert-calendar-settings-link" href="https://calendar.google.com/calendar/u/0/r/settings" target="_blank" rel="noreferrer">
                  <ExternalLink size={16} /> Apri Google Calendar
                </a>
              </div>
              <p className="expert-calendar-help">
                Percorso consigliato: usa il pulsante qui sopra. Il collegamento manuale serve solo se vuoi usare un calendario Google gia esistente e condiviso con FunniFin.
              </p>
              <div className="expert-calendar-status">
                <Info label="Stato" value={expertCalendarState.connected ? "Collegato" : "Non collegato"} />
                <Info label="Calendario" value={expertCalendarState.calendarName || "Da collegare"} />
                <Info label="Blocchi FunniFin" value={String(expertCalendarSlots.length)} />
                <Info label="Ultima lettura" value={expertCalendarState.updatedAt || "Mai"} />
              </div>
              {expertCalendarState.error && (
                <div className="inline-status-card warning">
                  <AlertCircle size={18} />
                  <span>{expertCalendarState.error}</span>
                </div>
              )}
              {expertCalendarSlots.length > 0 && (
                <div className="expert-calendar-slot-list" aria-label="Blocchi FunniFin rilevati">
                  {expertCalendarSlots.slice(0, 6).map((slot) => (
                    <span key={`${slot.eventId || slot.time}-${slot.calendarId || "calendar"}`}>
                      <Clock3 size={15} /> {slot.time}
                    </span>
                  ))}
                </div>
              )}
            </Panel>
          )}

          {expertStep === "Opportunita" && (
        <Panel>
          <SectionTitle
            title="Opportunità disponibili"
            actions={
              <ToolIconButton onClick={() => refreshExpertSection("Opportunita")} loading={expertSyncState.loading} label="Ricarica opportunita">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          />
          <div className="expert-opportunity-grid" aria-busy={expertSyncState.loading}>
            {expertSyncState.loading ? Array.from({ length: 3 }).map((_, index) => (
              <SkeletonCard key={`expert-opportunity-skeleton-${index}`} className="opportunity-card" lines={3} />
            )) : expertRows.map(({ selection, workshop }) => {
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
                  <p className={`email-entry-hint ${alreadyCandidate ? "candidate-sent-hint" : ""}`}>
                    {alreadyCandidate
                      ? "Candidatura inviata: FunniFin la vede in coda e puo assegnarti il workshop."
                      : "Accesso da mail FunniFin: clicca “Mi candido” per inviare la candidatura al team."}
                  </p>
                  {alreadyCandidate && (
                    <div className="candidate-sent-status" role="status">
                      <Check size={17} />
                      <span>In attesa di assegnazione FunniFin</span>
                    </div>
                  )}
                  <div className="button-row">
                    <AppButton
                      variant={alreadyCandidate ? "outline" : "secondary"}
                      disabled={alreadyCandidate || unavailable}
                      onClick={() => {
                        if (alreadyCandidate || unavailable) return;
                        setCandidateModalRow({ selection, workshop });
                      }}
                    >
                      {alreadyCandidate ? (
                        <>
                          <Check size={17} /> Candidatura inviata
                        </>
                      ) : (
                        <>
                          <Send size={17} /> Mi candido
                        </>
                      )}
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
        <Panel>
          <SectionTitle
            title="Workshop assegnati"
            actions={
              <ToolIconButton onClick={() => refreshExpertSection("Assegnati")} label="Ricarica workshop assegnati">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          />
          <div className="expert-opportunity-grid">
            {assignedRows.length === 0 && (
              <div className="expert-empty-state">
                <CalendarCheck size={22} />
                <strong>Nessun incarico assegnato</strong>
                <span>Quando FunniFin conferma una candidatura, il workshop compare qui con data, formato e materiali.</span>
              </div>
            )}
            {assignedRows.map(({ selection, workshop }) => (
              <div className="opportunity-card selected" key={workshop.id}>
                <div className="opportunity-head">
                  <span className="topic-badge">{expertStatusLabel(selection.status)}</span>
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
        <Panel>
          <SectionTitle
            title="Upload presentazione"
            actions={
              <ToolIconButton onClick={() => refreshExpertSection("Upload deck")} loading={expertDriveLoading} label="Ricarica file Drive">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          />
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
                <label className={`app-btn app-btn-secondary asset-upload-trigger ${expertDeckUploading ? "app-btn-loading" : ""}`} aria-busy={expertDeckUploading || undefined}>
                  <span className="app-btn-icon-slot" aria-hidden={!expertDeckUploading}>
                    {expertDeckUploading ? <Loader2 className="app-btn-spinner" size={16} aria-hidden="true" /> : <span className="app-btn-spinner-placeholder" />}
                  </span>
                  Carica file
                  <input
                    className="asset-file-input"
                    type="file"
                    accept=".ppt,.pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    disabled={expertDeckUploading}
                    onChange={(event) => handleExpertDeckUpload(event.target.files)}
                  />
                </label>
                <AppButton variant="ghost" onClick={openExpertDrivePicker} loading={expertDriveLoading}>
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
                  {expertDriveLoading && Array.from({ length: 3 }).map((_, index) => (
                    <span className="skeleton-row" key={`expert-drive-skeleton-${index}`} aria-hidden="true">
                      <Skeleton className="skeleton-dot" />
                      <span className="skeleton-text">
                        <Skeleton className="skeleton-line" />
                        <Skeleton className="skeleton-line short" />
                      </span>
                      <Skeleton className="skeleton-button" />
                    </span>
                  ))}
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
              loading={expertDeckSending}
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
        <Panel>
          <SectionTitle
            title="Stato workshop"
            actions={
              <ToolIconButton onClick={() => refreshExpertSection("Storico")} label="Ricarica storico">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          />
          <div className="expert-history-list">
            {historyRows.length === 0 && (
              <div className="expert-empty-state">
                <Clock3 size={22} />
                <strong>Nessuna attivita registrata</strong>
                <span>Candidature, incarichi e revisioni compariranno qui appena avviene una prima azione.</span>
              </div>
            )}
            {historyRows.map(({ selection, workshop }) => (
              <article className="expert-history-card" key={`history-${selection.workshopId}`}>
                <div>
                  <span className="topic-badge">{expertStatusLabel(selection.status)}</span>
                  <strong>{workshop.title}</strong>
                  <em>{activeExpertProject.company}</em>
                </div>
                <div className="opportunity-meta">
                  <Info label="Data" value={`${selection.date || "da confermare"} ${selection.time}`} />
                  <Info label="Formato" value={`${selection.duration} · ${selection.format}`} />
                  <Info label="Target" value={workshop.target} />
                  <Info label="Fase" value={expertStatusLabel(selection.status)} />
                </div>
              </article>
            ))}
          </div>
        </Panel>
      )}
        </div>
      </div>
      <BottomActionBar
        context={`Step ${expertActiveIndex + 1} — ${expertStep}`}
        detail={`${expertRows.length} opportunita · ${candidateCount} candidature inviate`}
        primaryLabel={expertMainAction.label}
        primaryDisabled={expertMainAction.disabled}
        primaryLoading={"loading" in expertMainAction ? expertMainAction.loading : false}
        onPrimary={expertMainAction.action}
      />
    </section>
  );
}
