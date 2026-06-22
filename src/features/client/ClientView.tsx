import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowRight,
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
import { createAssetDraftFolder, deleteAssetDraftFolder, uploadAssetFiles, type AssetDraftFolder, type UploadedAsset } from "../../driveAssetService";
import { createWorkshopRequest, type RequestWorkshopRecord, type WorkshopRequestRecord } from "../../requestService";
import { sendWorkshopRequestEmail } from "../../emailService";
import type { ClientContact, Format, ProjectStatus, Quote, Selection, Topic, Workshop } from "../../types/domain";
import { money } from "../../utils/money";
import { AppButton } from "../../components/ui/AppButton";
import { EmptyWorkflowState } from "../../components/ui/EmptyWorkflowState";
import { Panel } from "../../components/ui/Panel";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { RemoveWorkshopButton } from "../../components/ui/RemoveWorkshopButton";
import { Skeleton } from "../../components/ui/Skeleton";
import { Stepper } from "../../components/ui/Stepper";
import { ToolIconButton } from "../../components/ui/IconButton";
import { BottomActionBar } from "../../components/layout/BottomActionBar";
import { RoleHero } from "../../components/layout/RoleHero";
import { EcommerceCart } from "../../components/workshop/EcommerceCart";
import { QuoteStrip } from "../../components/workshop/QuoteStrip";
import { ReadinessPanel } from "../../components/workshop/ReadinessPanel";
import { WorkshopCard } from "../../components/workshop/WorkshopCard";
import { getWorkshopSelectionPrice, topicColorClass } from "../../utils/workshop";

type ClientJourneyStage = "loader" | "choice" | "survey" | "generating" | "result" | "manual";
type SurveyQuestionKind = "single" | "multi";
type SurveyAnswer = {
  id: string;
  label: string;
  description: string;
  meta?: string;
  pointerEmoji?: string;
  topicIds?: string[];
  themeIds?: string[];
};
type SurveyQuestion = {
  id: string;
  title: string;
  subtitle?: string;
  kind: SurveyQuestionKind;
  max?: number;
  answers: SurveyAnswer[];
};

const PRIVACY_NOTICE_VERSION = "privacy-funnifin-mvp-2026-06-22";

const guidedSurveyQuestions: SurveyQuestion[] = [
  {
    id: "topics",
    title: "Su quali temi vuoi generare maggiore impatto?",
    subtitle: "Seleziona tutte le aree prioritarie per il tuo percorso.",
    kind: "multi",
    answers: [
      { id: "retribuzione", label: "Retribuzione", description: "Stipendio, bonus e decisioni economiche quotidiane.", meta: "Ambito lavorativo", pointerEmoji: "💼", topicIds: ["fiscalita"], themeIds: ["benefit"] },
      { id: "assicurazioni", label: "Assicurazioni", description: "Protezione di reddito, famiglia e patrimonio.", meta: "2 workshop disponibili", pointerEmoji: "🛡️", topicIds: ["assicurazioni"] },
      { id: "investimenti", label: "Investimenti", description: "Rischio, orizzonte temporale, ETF e strumenti.", meta: "2 workshop disponibili", pointerEmoji: "📈", topicIds: ["investimenti"], themeIds: ["rischio", "etf"] },
      { id: "genitorialita", label: "Genitorialità", description: "Congedi, spese familiari e pianificazione con figli.", meta: "Ambito famiglia", pointerEmoji: "👶", topicIds: ["fiscalita", "famiglia"], themeIds: ["genitori"] },
      { id: "pensione", label: "TFR & Previdenza", description: "TFR, previdenza complementare e scelte di lungo periodo.", meta: "Percorso popolare", pointerEmoji: "🌱", topicIds: ["previdenza"], themeIds: ["tfr"] },
      { id: "finanziamenti", label: "Finanziamenti", description: "Mutui, prestiti e sostenibilità della rata.", meta: "2 workshop disponibili", pointerEmoji: "🏠", topicIds: ["credito"], themeIds: ["mutuo", "credito-consumo"] },
      { id: "risparmio", label: "Risparmio", description: "Fondo emergenza, liquidità e abitudini sostenibili.", meta: "Consigliato", pointerEmoji: "💰", topicIds: ["risparmio"], themeIds: ["fondo-emergenza", "abitudini"] },
      { id: "fiscalita", label: "Fiscalità", description: "Bonus, detrazioni, IRPEF e novità normative.", meta: "Ambito lavorativo", pointerEmoji: "🧾", topicIds: ["fiscalita"], themeIds: ["dichiarazione", "benefit"] },
      { id: "successione", label: "Successione", description: "Diritti economici, famiglia ed eredità.", meta: "Ambito familiare", pointerEmoji: "🏛️", topicIds: ["famiglia"], themeIds: ["famiglia-diritti"] },
    ],
  },
  {
    id: "outcome",
    title: "Quale risultato vuoi ottenere?",
    kind: "single",
    answers: [
      { id: "sensibilizzazione", label: "Sensibilizzazione", description: "Aprire consapevolezza su temi finanziari chiave." },
      { id: "formazione-base", label: "Formazione base", description: "Dare fondamenta comuni a tutta la popolazione aziendale." },
      { id: "formazione-pratica", label: "Formazione pratica", description: "Portare strumenti applicabili subito nella vita quotidiana." },
      { id: "continuativo", label: "Percorso continuativo", description: "Costruire un programma su più momenti durante l'anno." },
      { id: "annuale", label: "Piano annuale", description: "Impostare un piano strutturato di educazione finanziaria." },
    ],
  },
  {
    id: "employees",
    title: "Quanti dipendenti coinvolgerai?",
    kind: "single",
    answers: [
      { id: "1-20", label: "1-20", description: "Gruppo ristretto o prima sperimentazione." },
      { id: "21-50", label: "21-50", description: "Team ampio con obiettivi formativi condivisi." },
      { id: "51-200", label: "51-200", description: "Popolazione aziendale media, da segmentare per priorità." },
      { id: "200+", label: "200+", description: "Programma scalabile per platea estesa." },
    ],
  },
  {
    id: "format",
    title: "Come preferisci erogarlo?",
    kind: "single",
    answers: [
      { id: "webinar", label: "Webinar live", description: "Massima scalabilità e partecipazione da remoto." },
      { id: "live", label: "In presenza", description: "Esperienza più diretta per gruppi o sedi specifiche." },
      { id: "ibrido", label: "Ibrido", description: "Combina accessibilità e momenti ad alto coinvolgimento." },
      { id: "consigliami", label: "Consigliami il formato migliore", description: "Lascia a FunniFin la proposta più coerente." },
    ],
  },
  {
    id: "budget",
    title: "Hai già un budget indicativo?",
    kind: "single",
    answers: [
      { id: "under-2000", label: "< 2.000 €", description: "Percorso essenziale o primo pilota." },
      { id: "2000-5000", label: "2.000 - 5.000 €", description: "Combinazione di workshop con buona copertura." },
      { id: "5000-10000", label: "5.000 - 10.000 €", description: "Percorso completo e personalizzabile." },
      { id: "over-10000", label: "> 10.000 €", description: "Piano esteso o programma annuale." },
      { id: "unknown", label: "Non ancora definito", description: "Costruiamo prima il perimetro consigliato." },
    ],
  },
];

const guidedOutcomePreview = [
  { label: "Topic", tooltip: "Topic consigliati in base alle priorità formative", icon: BadgeCheck },
  { label: "Workshop", tooltip: "Workshop selezionati per costruire il percorso", icon: Presentation },
  { label: "Esperti", tooltip: "Esperti associati ai workshop scelti", icon: UsersRound },
  { label: "Calendario", tooltip: "Calendario attività con date e momenti formativi", icon: CalendarCheck },
  { label: "Costi", tooltip: "Stima costi aggiornata sul percorso", icon: Banknote },
];

function formatList(items: string[]) {
  if (items.length === 0) return "temi da definire";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

export function ClientView({
  topics,
  workshops,
  activeTopics,
  activeThemes,
  selections,
  quote,
  coveredTopics,
  coveredThemes,
  totalHours,
  setActiveTopics,
  setActiveThemes,
  toggleWorkshop,
  addWorkshops,
  updateSelection,
  setProjectStatus,
  notify,
  showCustomModal,
  openCustomRequest,
  openDateModal,
  assetFolder,
  setAssetFolder,
  uploadedAssets,
  setUploadedAssets,
  systemRefreshToken,
  systemSettingsToken,
  onGuidedLayerChange,
  onRequestCreated,
}: {
  topics: Topic[];
  workshops: Workshop[];
  activeTopics: string[];
  activeThemes: string[];
  selections: Selection[];
  quote: Quote;
  coveredTopics: number;
  coveredThemes: number;
  totalHours: number;
  setActiveTopics: (ids: string[]) => void;
  setActiveThemes: (ids: string[]) => void;
  toggleWorkshop: (id: string) => void;
  addWorkshops: (ids: string[]) => void;
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  notify: (title: string, body: string) => void;
  showCustomModal: (workshop: Workshop) => void;
  openCustomRequest: (workshop: Workshop) => void;
  openDateModal: (selection: Selection) => void;
  assetFolder: AssetDraftFolder | null;
  setAssetFolder: (folder: AssetDraftFolder | null) => void;
  uploadedAssets: UploadedAsset[];
  setUploadedAssets: (value: UploadedAsset[] | ((current: UploadedAsset[]) => UploadedAsset[])) => void;
  systemRefreshToken: number;
  systemSettingsToken: number;
  onGuidedLayerChange?: (active: boolean) => void;
  onRequestCreated: (request: WorkshopRequestRecord) => void;
}) {
  const clientSteps = ["Interessi", "Consigliati", "Workshop", "Personalizza", "Date", "Materiali", "Invio"];
  const debugNotify = (title: string, body: string) => {
    if (import.meta.env.DEV) notify(title, body);
  };
  const [clientStep, setClientStep] = useState(clientSteps[0]);
  const [clientJourneyStage, setClientJourneyStage] = useState<ClientJourneyStage>("loader");
  const [choiceSheet, setChoiceSheet] = useState<"guided" | "catalog" | null>(null);
  const [topicPointer, setTopicPointer] = useState<{ emoji: string; x: number; y: number } | null>(null);
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string[]>>({});
  const [workshopFilters, setWorkshopFilters] = useState({ topic: "all", theme: "all", format: "all" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [assetUploadError, setAssetUploadError] = useState("");
  const [requestFinalized, setRequestFinalized] = useState(false);
  const [sharingCart, setSharingCart] = useState(false);
  const [contactTouched, setContactTouched] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [emailDeliveryMode, setEmailDeliveryMode] = useState<"sent" | "not_sent">("not_sent");
  const [flyToBar, setFlyToBar] = useState<{ id: number; title: string; x: number; y: number } | null>(null);
  const [expandedTopicCards, setExpandedTopicCards] = useState<string[]>([]);
  const assetFolderRef = useRef<AssetDraftFolder | null>(null);
  const requestFinalizedRef = useRef(false);
  const topicPointerTimerRef = useRef<number | null>(null);
  const surveyQuestionPanelRef = useRef<HTMLElement | null>(null);
  const [contact, setContact] = useState<ClientContact>({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    phone: "",
  });
  const selectedTopics = topics.filter((item) => activeTopics.includes(item.id));
  const selectedTopicTitles = selectedTopics.map((item) => item.title).join(", ") || "nessun ambito";
  const allThemes = Array.from(new Map(topics.flatMap((item) => item.themes).map((theme) => [theme.id, theme])).values());
  const activeStructuredFilterCount = [workshopFilters.topic, workshopFilters.theme, workshopFilters.format].filter((value) => value !== "all").length;
  const hasSearchQuery = searchQuery.trim() !== "";
  const hasCatalogQuery = hasSearchQuery || activeStructuredFilterCount > 0;
  const visibleWorkshops = workshops.filter(
    (workshop) =>
      hasCatalogQuery ||
      activeTopics.includes(workshop.topicId) ||
      activeThemes.includes(workshop.themeId) ||
      selections.some((item) => item.workshopId === workshop.id),
  );
  const filteredWorkshops = visibleWorkshops.filter((workshop) => {
    const topic = topics.find((item) => item.id === workshop.topicId);
    const theme = topic?.themes.find((item) => item.id === workshop.themeId);
    const haystack = `${workshop.title} ${workshop.short} ${workshop.long} ${topic?.title ?? ""} ${theme?.title ?? ""}`.toLowerCase();
    const matchesSearch = searchQuery.trim() === "" || haystack.includes(searchQuery.trim().toLowerCase());
    return (
      matchesSearch &&
      (workshopFilters.topic === "all" || workshop.topicId === workshopFilters.topic) &&
      (workshopFilters.theme === "all" || workshop.themeId === workshopFilters.theme) &&
      (workshopFilters.format === "all" || workshop.formatOptions.includes(workshopFilters.format as Format))
    );
  });
  const selectedWorkshopIds = useMemo(() => new Set(selections.map((selection) => selection.workshopId)), [selections]);
  const recommendedWorkshops = useMemo(() => {
    const activeTopicOrder = new Map(activeTopics.map((id, index) => [id, index]));
    const activeThemeOrder = new Map(activeThemes.map((id, index) => [id, index]));
    const orderedCandidates = workshops
      .filter((workshop) => !selectedWorkshopIds.has(workshop.id))
      .map((workshop) => {
        const topicIndex = activeTopicOrder.get(workshop.topicId);
        const themeIndex = activeThemeOrder.get(workshop.themeId);
        const matchesTopic = topicIndex !== undefined;
        const matchesTheme = themeIndex !== undefined;
        const score = (matchesTheme ? 2000 - themeIndex : 0) + (matchesTopic ? 1000 - topicIndex : 0);
        return {
          workshop,
          score,
          topicIndex: topicIndex ?? Number.POSITIVE_INFINITY,
          themeIndex: themeIndex ?? Number.POSITIVE_INFINITY,
        };
      })
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score || a.topicIndex - b.topicIndex || a.themeIndex - b.themeIndex || a.workshop.title.localeCompare(b.workshop.title, "it"));

    const picks: Workshop[] = [];
    const seenTopics = new Set<string>();
    for (const candidate of orderedCandidates) {
      if (picks.length >= 3) break;
      if (seenTopics.has(candidate.workshop.topicId)) continue;
      picks.push(candidate.workshop);
      seenTopics.add(candidate.workshop.topicId);
    }

    if (picks.length < 3) {
      for (const candidate of orderedCandidates) {
        if (picks.length >= 3) break;
        if (picks.some((workshop) => workshop.id === candidate.workshop.id)) continue;
        picks.push(candidate.workshop);
      }
    }

    return picks;
  }, [activeThemes, activeTopics, selectedWorkshopIds]);
  const selectedWorkshopRows = selections
    .map((selection) => ({ selection, workshop: workshops.find((item) => item.id === selection.workshopId)! }))
    .filter(({ workshop }) => Boolean(workshop));
  const allCatalogActive = activeTopics.length === topics.length && activeThemes.length === allThemes.length;
  const selectedRecommendationCount = recommendedWorkshops.filter((workshop) => selections.some((selection) => selection.workshopId === workshop.id)).length;
  const addRecommendedWorkshops = () => {
    addWorkshops(recommendedWorkshops.map((workshop) => workshop.id));
    setClientStep("Workshop");
  };
  const missingDateRows = selectedWorkshopRows.filter(({ selection }) => !selection.dateConfirmed);
  const allDatesSelected = selectedWorkshopRows.length > 0 && missingDateRows.length === 0;
  const activeStepIndex = clientSteps.indexOf(clientStep);
  const goNext = () => setClientStep(clientSteps[Math.min(activeStepIndex + 1, clientSteps.length - 1)]);
  const goBack = () => setClientStep(clientSteps[Math.max(activeStepIndex - 1, 0)]);
  const clientCompletedSteps = new Set<string>([
    ...(coveredTopics > 0 || coveredThemes > 0 || selections.length > 0 ? ["Interessi"] : []),
    ...(selectedWorkshopRows.length > 0 ? ["Consigliati", "Workshop", "Personalizza"] : []),
    ...(allDatesSelected ? ["Date"] : []),
    ...(requestFinalized ? ["Materiali", "Invio"] : []),
  ]);
  const contactReady =
    contact.firstName.trim() &&
    contact.lastName.trim() &&
    contact.company.trim() &&
    contact.phone.trim() &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim());
  const assetClientName = contact.company.trim() || "Cliente";
  useEffect(() => {
    assetFolderRef.current = assetFolder;
  }, [assetFolder]);
  useEffect(() => {
    requestFinalizedRef.current = requestFinalized;
  }, [requestFinalized]);
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (assetFolderRef.current && !requestFinalizedRef.current) void deleteAssetDraftFolder(assetFolderRef.current.id, assetFolderRef.current.draftToken);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
  const handleAssetFiles = async (files: FileList | null) => {
    const list = Array.from(files ?? []);
    if (!list.length) return;

    setUploadingAssets(true);
    setAssetUploadError("");
    try {
      const folder = assetFolder ?? (await createAssetDraftFolder(assetClientName));
      setAssetFolder(folder);
      const uploaded = await uploadAssetFiles(folder.id, list, folder.draftToken);
      setUploadedAssets((current) => [...current, ...uploaded]);
      setProjectStatus("materiali_cliente_in_attesa", "Materiali caricati", `${uploaded.length} file salvati nella cartella ${folder.name}.`);
      notify("Materiali caricati", `${uploaded.length} file salvati in Drive.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Upload materiali non riuscito";
      setAssetUploadError(message);
      notify("Upload materiali non riuscito", message);
    } finally {
      setUploadingAssets(false);
    }
  };
  const submitRequest = async () => {
    if (selectedWorkshopRows.length === 0) {
      setClientStep("Workshop");
      notify("Aggiungi almeno un workshop", "Scegli un workshop dal catalogo prima di inviare la richiesta.");
      return;
    }
    if (!allDatesSelected) {
      setClientStep("Date");
      notify("Date mancanti", `Scegli le date per ${missingDateRows.length} workshop prima di inviare.`);
      return;
    }
    if (!contactReady) {
      setContactTouched(true);
      setClientStep("Invio");
      notify("Dati contatto mancanti", "Compila nome, cognome, azienda, telefono e una email valida per ricevere il recap.");
      return;
    }
    if (!privacyAccepted) {
      setContactTouched(true);
      setClientStep("Invio");
      notify("Consenso privacy mancante", "Conferma il trattamento dei dati per inviare la richiesta.");
      return;
    }
    setSendingRequest(true);
    try {
      const requestWorkshops: RequestWorkshopRecord[] = selectedWorkshopRows.map(({ selection, workshop }) => ({
        workshopId: workshop.id,
        title: workshop.title,
        duration: selection.duration,
        format: selection.format,
        date: selection.date,
        time: selection.time,
        price: getWorkshopSelectionPrice(workshop, selection).total,
        custom: selection.custom,
        customNote: selection.customNote,
        status: selection.status,
        approval: selection.dateConfirmed ? "pending" : undefined,
      }));
      const emailPayload = {
        contact,
        workshops: requestWorkshops.map((workshop) => ({
          title: workshop.title,
          duration: workshop.duration,
          format: workshop.format,
          date: workshop.date,
          time: workshop.time,
          price: workshop.price,
          custom: workshop.custom,
        })),
        quote: {
          gross: quote.gross,
          discount: quote.quantityDiscount,
          promoDiscount: quote.promoDiscount,
          customTotal: quote.customTotal,
          total: quote.total,
          saved: quote.saved,
          packageName: quote.rule.name,
        },
      };
      const request = await createWorkshopRequest({
        contact,
        workshops: requestWorkshops,
        quote: {
          gross: quote.gross,
          discount: quote.quantityDiscount,
          promoDiscount: quote.promoDiscount,
          customTotal: quote.customTotal,
          total: quote.total,
          saved: quote.saved,
          packageName: quote.rule.name,
        },
        materials: assetFolder
          ? {
              folderId: assetFolder.id,
              folderName: assetFolder.name,
              folderUrl: assetFolder.url,
              fileCount: uploadedAssets.length,
            }
          : undefined,
        privacy: {
          accepted: true,
          acceptedAt: new Date().toISOString(),
          version: PRIVACY_NOTICE_VERSION,
        },
      });
      const emailResult = await sendWorkshopRequestEmail({
        ...emailPayload,
      }).catch((error) => {
        const message = error instanceof Error ? error.message : "Email non inviata.";
        notify("Email non inviata", message);
        return { sent: false };
      });
      onRequestCreated(request);
      setProjectStatus(
        "richiesta_inviata",
        emailResult.sent ? "Richiesta presa in carico" : "Richiesta presa in carico",
        emailResult.sent
          ? `Richiesta ${request.id} salvata sullo Sheet e recap inviato a ${contact.email.trim()}.`
          : `Richiesta ${request.id} salvata sullo Sheet, ma l'email non è partita.`,
      );
      setSubmittedEmail(contact.email.trim());
      setEmailDeliveryMode(emailResult.sent ? "sent" : "not_sent");
      setRequestFinalized(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Salvataggio richiesta o invio email non riuscito.";
      notify("Richiesta non completata", `${message} Controlla Apps Script e riprova: non marco questa richiesta come reale finche non viene salvata.`);
    } finally {
      setSendingRequest(false);
    }
  };
  const loadCartLogo = () => new Promise<HTMLImageElement | null>((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = "/Logo.png";
  });
  const createCartShareImage = async () => {
    if (typeof document === "undefined") return null;

    const width = 1080;
    const horizontalPadding = 124;
    const textMaxWidth = 604;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    const getWrappedLines = (text: string, maxWidth: number) => {
      const words = text.split(" ");
      const lines: string[] = [];
      let line = "";

      words.forEach((word) => {
        const testLine = line ? `${line} ${word}` : word;
        if (ctx.measureText(testLine).width > maxWidth && line) {
          lines.push(line);
          line = word;
        } else {
          line = testLine;
        }
      });
      if (line) lines.push(line);
      return lines.length > 0 ? lines : [""];
    };

    const rowLayouts = selectedWorkshopRows.map(({ selection, workshop }) => {
      ctx.font = "700 30px Arial";
      const titleLines = getWrappedLines(workshop.title, textMaxWidth);
      ctx.font = "400 23px Arial";
      const detail = [
        selection.duration,
        selection.format,
        selection.date ? `${selection.date} ${selection.time}` : "",
        selection.custom ? "su misura" : "",
      ].filter(Boolean).join(" · ");
      const detailLines = getWrappedLines(detail, textMaxWidth);
      return {
        titleLines,
        detailLines,
        height: Math.max(126, 46 + titleLines.length * 36 + detailLines.length * 29),
      };
    });
    const rowsHeight = rowLayouts.reduce((sum, row) => sum + row.height + 18, 0);
    const height = 508 + Math.max(rowsHeight, 126);

    canvas.width = width;
    canvas.height = height;

    const drawLines = (lines: string[], x: number, y: number, lineHeight: number) => {
      lines.forEach((line, index) => {
        ctx.fillText(line, x, y + index * lineHeight);
      });
    };

    ctx.fillStyle = "#f6faf8";
    ctx.fillRect(0, 0, width, height);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(48, 48, width - 96, height - 96, 32);
    ctx.fill();

    ctx.fillStyle = "#123832";
    ctx.beginPath();
    ctx.roundRect(72, 72, width - 144, 188, 28);
    ctx.fill();

    const logo = await loadCartLogo();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.roundRect(112, 110, 96, 96, 24);
    ctx.fill();
    if (logo) {
      ctx.drawImage(logo, 130, 128, 60, 60);
    } else {
      ctx.fillStyle = "#123832";
      ctx.font = "700 36px Arial";
      ctx.fillText("F", 146, 170);
    }

    ctx.fillStyle = "#ffffff";
    ctx.font = "700 46px Arial";
    ctx.fillText("Carrello FunniFin", 232, 145);
    ctx.font = "400 28px Arial";
    ctx.fillText(`${selectedWorkshopRows.length} workshop selezionati`, 232, 192);
    ctx.font = "700 34px Arial";
    ctx.fillText(money(quote.total), 788, 172);

    let y = 318;
    if (selectedWorkshopRows.length === 0) {
      ctx.fillStyle = "#6c7f7a";
      ctx.font = "400 30px Arial";
      ctx.fillText("Il percorso e vuoto.", 112, y);
    }

    selectedWorkshopRows.forEach(({ selection, workshop }, index) => {
      const price = getWorkshopSelectionPrice(workshop, selection);
      const layout = rowLayouts[index];
      ctx.fillStyle = index % 2 === 0 ? "#f2f7f5" : "#ffffff";
      ctx.beginPath();
      ctx.roundRect(88, y - 42, width - 176, layout.height, 20);
      ctx.fill();

      ctx.fillStyle = "#153b36";
      ctx.font = "700 30px Arial";
      drawLines(layout.titleLines, horizontalPadding, y, 36);
      ctx.fillStyle = "#627771";
      ctx.font = "400 23px Arial";
      drawLines(layout.detailLines, horizontalPadding, y + layout.titleLines.length * 36 + 14, 29);

      ctx.fillStyle = "#153b36";
      ctx.font = "700 28px Arial";
      ctx.textAlign = "right";
      ctx.fillText(money(price.total), width - 124, y + 16);
      ctx.textAlign = "left";
      y += layout.height + 18;
    });

    ctx.strokeStyle = "#d7e4df";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(88, height - 132);
    ctx.lineTo(width - 88, height - 132);
    ctx.stroke();

    ctx.fillStyle = "#627771";
    ctx.font = "400 28px Arial";
    ctx.fillText("Totale percorso", 112, height - 82);
    ctx.fillStyle = "#123832";
    ctx.font = "700 44px Arial";
    ctx.textAlign = "right";
    ctx.fillText(money(quote.total), width - 112, height - 82);
    ctx.textAlign = "left";

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png", 0.95));
    return blob ? new File([blob], "carrello-funnifin.png", { type: "image/png" }) : null;
  };
  const downloadCartImage = (file: File) => {
    const url = URL.createObjectURL(file);
    const link = document.createElement("a");
    link.href = url;
    link.download = file.name;
    link.click();
    URL.revokeObjectURL(url);
  };
  const handleShareCart = async () => {
    if (selectedWorkshopRows.length === 0 || sharingCart) return;

    setSharingCart(true);
    const cartText = [
      "Carrello FunniFin",
      ...selectedWorkshopRows.map(({ selection, workshop }) => {
        const price = getWorkshopSelectionPrice(workshop, selection);
        const date = selection.date ? `, ${selection.date} ${selection.time}` : "";
        return `- ${workshop.title}: ${selection.duration}, ${selection.format}${date} (${money(price.total)})`;
      }),
      `Totale: ${money(quote.total)}`,
    ].join("\n");

    try {
      const file = await createCartShareImage();
      const shareData: ShareData = {
        title: "Carrello FunniFin",
        text: cartText,
        url: window.location.href,
      };

      if (file && navigator.canShare?.({ files: [file] })) {
        await navigator.share({ ...shareData, files: [file] });
      } else if (navigator.share) {
        if (file) downloadCartImage(file);
        await navigator.share(shareData);
        if (file) notify("Share senza immagine nativa", "Ho scaricato il PNG del carrello con logo e condiviso il riepilogo testuale.");
      } else {
        if (file) downloadCartImage(file);
        await navigator.clipboard?.writeText(cartText);
        notify("Share non disponibile", file ? "PNG del carrello scaricato e riepilogo copiato negli appunti." : "Riepilogo copiato negli appunti.");
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      const message = error instanceof Error ? error.message : "Condivisione non riuscita.";
      notify("Condivisione non riuscita", message);
    } finally {
      setSharingCart(false);
    }
  };
  const removeTopic = (topicId: string) => {
    const nextTopics = activeTopics.filter((id) => id !== topicId);
    const removedThemeIds = topics.find((item) => item.id === topicId)?.themes.map((theme) => theme.id) ?? [];
    setActiveTopics(nextTopics);
    setActiveThemes(activeThemes.filter((themeId) => !removedThemeIds.includes(themeId)));
  };
  const removeWorkshop = (workshopId: string) => {
    const workshop = workshops.find((item) => item.id === workshopId);
    toggleWorkshop(workshopId);
    if (workshop && workshopFilters.theme === workshop.themeId) setWorkshopFilters({ ...workshopFilters, theme: "all" });
  };
  const toggleWorkshopWithFeedback = (workshop: Workshop, event?: React.MouseEvent<HTMLButtonElement>) => {
    const alreadySelected = selections.some((selection) => selection.workshopId === workshop.id);
    if (!alreadySelected && event) {
      const rect = event.currentTarget.getBoundingClientRect();
      const nextFly = {
        id: Date.now(),
        title: workshop.title,
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
      setFlyToBar(nextFly);
      window.setTimeout(() => {
        setFlyToBar((current) => (current?.id === nextFly.id ? null : current));
      }, 760);
    }
    toggleWorkshop(workshop.id);
  };
  const toggleTopic = (topicItem: Topic) => {
    const themeIds = topicItem.themes.map((theme) => theme.id);
    if (activeTopics.includes(topicItem.id)) {
      removeTopic(topicItem.id);
      return;
    }
    const nextTopics = [...activeTopics, topicItem.id];
    setActiveTopics(nextTopics);
    setActiveThemes([...new Set([...activeThemes, ...themeIds])]);
  };
  const selectAllTopics = () => {
    setActiveTopics(topics.map((item) => item.id));
    setActiveThemes([...new Set(topics.flatMap((item) => item.themes.map((theme) => theme.id)))]);
    setClientStep("Workshop");
  };
  const clearWorkshopDiscovery = () => {
    setWorkshopFilters({ topic: "all", theme: "all", format: "all" });
    setSearchQuery("");
  };
  const resetWorkshopDiscovery = () => {
    setActiveTopics(topics.map((item) => item.id));
    setActiveThemes([...new Set(topics.flatMap((item) => item.themes.map((theme) => theme.id)))]);
    clearWorkshopDiscovery();
    setFiltersOpen(false);
  };
  const currentSurveyQuestion = guidedSurveyQuestions[surveyIndex];
  const currentSurveyAnswers = surveyAnswers[currentSurveyQuestion.id] ?? [];
  const surveyProgress = Math.round(((surveyIndex + 1) / guidedSurveyQuestions.length) * 100);
  const allSelectedSurveyAnswers = guidedSurveyQuestions.flatMap((question) => {
    const ids = surveyAnswers[question.id] ?? [];
    return question.answers.filter((answer) => ids.includes(answer.id));
  });
  const guidedTopicIds = [...new Set(allSelectedSurveyAnswers.flatMap((answer) => answer.topicIds ?? []))];
  const guidedThemeIds = [...new Set(allSelectedSurveyAnswers.flatMap((answer) => answer.themeIds ?? []))];
  const resultTopicIds = guidedTopicIds.length > 0 ? guidedTopicIds : ["risparmio", "investimenti", "previdenza"];
  const resultThemeIds = guidedThemeIds.length > 0
    ? guidedThemeIds
    : topics.filter((topic) => resultTopicIds.includes(topic.id)).flatMap((topic) => topic.themes.map((theme) => theme.id));
  const resultTopicTitles = topics.filter((topic) => resultTopicIds.includes(topic.id)).map((topic) => topic.title);
  const resultWorkshops = workshops
    .filter((workshop) => resultTopicIds.includes(workshop.topicId) || resultThemeIds.includes(workshop.themeId))
    .slice(0, 3);
  const outcomeLabel = guidedSurveyQuestions.find((question) => question.id === "outcome")?.answers.find((answer) => surveyAnswers.outcome?.includes(answer.id))?.label ?? "Formazione pratica";
  const employeesLabel = guidedSurveyQuestions.find((question) => question.id === "employees")?.answers.find((answer) => surveyAnswers.employees?.includes(answer.id))?.label ?? "Da definire";
  const formatLabel = guidedSurveyQuestions.find((question) => question.id === "format")?.answers.find((answer) => surveyAnswers.format?.includes(answer.id))?.label ?? "Consigliato da FunniFin";
  const budgetLabel = guidedSurveyQuestions.find((question) => question.id === "budget")?.answers.find((answer) => surveyAnswers.budget?.includes(answer.id))?.label ?? "Non ancora definito";
  const topicProfileLabel =
    guidedSurveyQuestions
      .find((question) => question.id === "topics")
      ?.answers.filter((answer) => surveyAnswers.topics?.includes(answer.id))
      .map((answer) => answer.label)
      .join(", ") || "Da definire";
  const profileGridItems = [
    { label: "Temi prioritari", value: topicProfileLabel },
    { label: "Dipendenti", value: employeesLabel },
    { label: "Formato", value: formatLabel },
    { label: "Budget", value: budgetLabel },
  ];
  const matchScore = Math.min(95, 20 + Object.values(surveyAnswers).filter((answer) => answer.length > 0).length * 15);
  const surveyCanContinue = currentSurveyAnswers.length > 0;
  const applyGuidedProfile = () => {
    setActiveTopics(resultTopicIds);
    setActiveThemes(resultThemeIds);
    clearWorkshopDiscovery();
  };
  const startManualJourney = () => {
    setChoiceSheet(null);
    setClientJourneyStage("manual");
    setClientStep("Interessi");
  };
  const startGuidedJourney = () => {
    setChoiceSheet(null);
    setTopicPointer(null);
    setSurveyIndex(0);
    setSurveyAnswers({});
    setClientJourneyStage("survey");
  };
  const showTopicPointer = (answer: SurveyAnswer, event: React.PointerEvent<HTMLButtonElement>) => {
    if (currentSurveyQuestion.id !== "topics" || !answer.pointerEmoji) return;
    if (topicPointerTimerRef.current) window.clearTimeout(topicPointerTimerRef.current);
    setTopicPointer({ emoji: answer.pointerEmoji, x: event.clientX, y: event.clientY });
  };
  const hideTopicPointer = () => {
    if (topicPointerTimerRef.current) window.clearTimeout(topicPointerTimerRef.current);
    setTopicPointer(null);
  };
  const holdTopicPointerOnTap = () => {
    if (topicPointerTimerRef.current) window.clearTimeout(topicPointerTimerRef.current);
    topicPointerTimerRef.current = window.setTimeout(() => setTopicPointer(null), 900);
  };
  const scrollSurveyQuestionTop = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
      if (surveyQuestionPanelRef.current) {
        const top = surveyQuestionPanelRef.current.getBoundingClientRect().top + window.scrollY - 80;
        window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
        return;
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
      });
    });
  };
  const toggleSurveyAnswer = (answer: SurveyAnswer) => {
    setSurveyAnswers((current) => {
      const selected = current[currentSurveyQuestion.id] ?? [];
      const isSelected = selected.includes(answer.id);
      if (currentSurveyQuestion.kind === "single") {
        return { ...current, [currentSurveyQuestion.id]: [answer.id] };
      }
      const max = currentSurveyQuestion.max ?? currentSurveyQuestion.answers.length;
      const next = isSelected ? selected.filter((id) => id !== answer.id) : selected.length >= max ? selected : [...selected, answer.id];
      return { ...current, [currentSurveyQuestion.id]: next };
    });
  };
  const continueSurvey = () => {
    if (!surveyCanContinue) return;
    if (surveyIndex < guidedSurveyQuestions.length - 1) {
      setSurveyIndex(surveyIndex + 1);
      setTopicPointer(null);
      scrollSurveyQuestionTop();
      return;
    }
    applyGuidedProfile();
    setClientJourneyStage("generating");
    window.setTimeout(() => setClientJourneyStage("result"), 1250);
  };
  const goBackSurvey = () => {
    if (surveyIndex > 0) {
      setSurveyIndex(surveyIndex - 1);
      setTopicPointer(null);
      scrollSurveyQuestionTop();
      return;
    }
    setClientJourneyStage("choice");
  };
  const addGuidedWorkshops = () => {
    addWorkshops(resultWorkshops.map((workshop) => workshop.id));
    setClientJourneyStage("manual");
    setClientStep("Personalizza");
  };
  const openGuidedCatalog = () => {
    applyGuidedProfile();
    setClientJourneyStage("manual");
    setClientStep("Workshop");
  };
  const clientMainAction = (() => {
    if (clientStep === "Interessi") {
      return {
        label: allCatalogActive ? "Vai al catalogo" : "Vedi consigli",
        disabled: activeTopics.length === 0,
        action: () => setClientStep(allCatalogActive ? "Workshop" : "Consigliati"),
      };
    }
    if (clientStep === "Consigliati") {
      return {
        label: selectedRecommendationCount === recommendedWorkshops.length && selectedRecommendationCount > 0 ? "Vai al catalogo" : "Aggiungi consigliati",
        disabled: recommendedWorkshops.length === 0,
        action: selectedRecommendationCount === recommendedWorkshops.length && selectedRecommendationCount > 0 ? () => setClientStep("Workshop") : addRecommendedWorkshops,
      };
    }
    if (clientStep === "Workshop") return { label: "Personalizza percorso", disabled: selectedWorkshopRows.length === 0, action: goNext };
    if (clientStep === "Personalizza") return { label: "Scegli le date", disabled: selectedWorkshopRows.length === 0, action: goNext };
    if (clientStep === "Date") return { label: "Carica materiali", disabled: !allDatesSelected, action: goNext };
    if (clientStep === "Materiali") return { label: "Vai all'invio", disabled: false, action: goNext };
    if (requestFinalized) return { label: "Richiesta inviata", disabled: true, action: () => {} };
    return { label: "Invia richiesta", disabled: sendingRequest || selectedWorkshopRows.length === 0, action: submitRequest };
  })();
  const refreshClientSection = (section: string) => {
    debugNotify("Sezione aggiornata", `${section}: dati locali e selezioni riletti nella vista corrente.`);
  };
  useEffect(() => {
    if (systemRefreshToken === 0) return;
    refreshClientSection(clientStep);
  }, [systemRefreshToken]);
  useEffect(() => {
    if (systemSettingsToken === 0) return;
    setClientStep(selectedWorkshopRows.length > 0 ? "Personalizza" : "Workshop");
  }, [systemSettingsToken]);
  useEffect(() => {
    if (clientJourneyStage !== "loader") return;
    const timer = window.setTimeout(() => setClientJourneyStage("choice"), 1500);
    return () => window.clearTimeout(timer);
  }, [clientJourneyStage]);
  useEffect(() => {
    if (clientJourneyStage !== "survey") return;
    setTopicPointer(null);
    scrollSurveyQuestionTop();
  }, [clientJourneyStage, surveyIndex]);
  useEffect(() => {
    onGuidedLayerChange?.(["survey", "generating", "result"].includes(clientJourneyStage));
    return () => onGuidedLayerChange?.(false);
  }, [clientJourneyStage, onGuidedLayerChange]);

  if (clientJourneyStage === "loader") {
    return (
      <section className="guided-loader" aria-label="Caricamento FunniFin">
        <div className="guided-loader-mark">
          <img src="/Logo.png" alt="FunniFin" width="60" height="60" decoding="async" fetchPriority="high" />
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }

  if (clientJourneyStage === "choice") {
    const activeChoiceSheet = choiceSheet === "guided"
      ? {
        badge: "Consigliato",
        title: "Percorso guidato",
        description: "Rispondi a poche domande e ricevi una proposta già pronta.",
        benefits: ["Topic consigliati", "Workshop suggeriti", "Esperti associati", "Modificabile in seguito"],
        time: "~2 minuti",
        cta: "Inizia percorso guidato",
        action: startGuidedJourney,
      }
      : choiceSheet === "catalog"
        ? {
          badge: "Manuale",
          title: "Catalogo completo",
          description: "Esplora l’intero catalogo e costruisci il percorso da zero.",
          benefits: ["Controllo totale", "Tutti i workshop disponibili", "Configurazione personalizzata"],
          time: "~5 minuti",
          cta: "Esplora catalogo",
          action: startManualJourney,
        }
        : null;

    return (
      <section className="guided-entry" aria-labelledby="client-entry-title">
        <div className="guided-entry-pattern" aria-hidden="true" />
        <div className="guided-choice-head">
          <span className="eyebrow guided-choice-eyebrow">Workshop planner</span>
          <h1 id="client-entry-title">
            Costruisci il <span>piano formativo</span> più adatto alla tua azienda
          </h1>
          <p>Scegli se partire da una proposta guidata oppure esplorare il catalogo completo. Potrai modificare workshop, esperti, date e costi in qualsiasi momento.</p>
        </div>
        <div className="guided-choice-grid">
          <article className="guided-choice-card recommended" aria-label="Percorso guidato consigliato">
            <BadgeCheck className="guided-choice-bg-icon" aria-hidden="true" />
            <div className="guided-card-topline">
              <span className="guided-card-badge">Consigliato · ~2 minuti</span>
            </div>
            <div>
              <strong>Percorso guidato</strong>
              <p>Rispondi a poche domande e ricevi una proposta già pronta, basata su obiettivi, popolazione aziendale e priorità formative.</p>
              <ul className="guided-choice-benefits" aria-label="Vantaggi percorso guidato">
                <li><Check size={16} aria-hidden="true" /> Proposta iniziale generata in pochi minuti</li>
                <li><Check size={16} aria-hidden="true" /> Temi suggeriti in base alle esigenze aziendali</li>
                <li><Check size={16} aria-hidden="true" /> Workshop modificabili dopo la generazione</li>
              </ul>
            </div>
            <footer>
              <span>Scelta rapida con proposta FunniFin</span>
              <AppButton className="guided-primary-cta" onClick={startGuidedJourney} rightIcon={<ArrowRight size={17} />}>
                Inizia percorso guidato
              </AppButton>
            </footer>
            <button type="button" className="guided-mobile-detail-button" onClick={() => setChoiceSheet("guided")}>
              Vedi dettagli
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </article>
          <article className="guided-choice-card secondary" aria-label="Catalogo completo">
            <BookOpen className="guided-choice-bg-icon" aria-hidden="true" />
            <div className="guided-card-topline">
              <span className="guided-card-badge neutral">Manuale · ~5 minuti</span>
            </div>
            <div>
              <strong>Catalogo completo</strong>
              <p>Accedi al catalogo e costruisci il percorso selezionando direttamente topic, workshop ed eventuali esperti.</p>
              <ul className="guided-choice-benefits muted" aria-label="Vantaggi catalogo completo">
                <li><Check size={16} aria-hidden="true" /> Controllo completo</li>
                <li><Check size={16} aria-hidden="true" /> Ideale se hai già un’idea precisa</li>
                <li><Check size={16} aria-hidden="true" /> Catalogo sempre modificabile</li>
              </ul>
            </div>
            <footer>
              <span>Per chi vuole partire dal catalogo</span>
              <AppButton variant="secondary" onClick={startManualJourney} rightIcon={<ArrowRight size={17} />}>
                Esplora catalogo
              </AppButton>
            </footer>
            <button type="button" className="guided-mobile-detail-button" onClick={() => setChoiceSheet("catalog")}>
              Vedi dettagli
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </article>
        </div>
        <aside className="guided-outcome-preview" aria-label="Cosa otterrai">
          <strong>Cosa otterrai</strong>
          <div>
            {guidedOutcomePreview.map(({ label, tooltip, icon: Icon }) => (
              <span key={label} className="guided-outcome-chip" title={tooltip} aria-label={tooltip} data-tooltip={tooltip}>
                <Icon size={16} aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </aside>
        {activeChoiceSheet && (
          <div className="guided-choice-sheet-backdrop" role="presentation" onClick={() => setChoiceSheet(null)}>
            <aside className="guided-choice-sheet" role="dialog" aria-modal="true" aria-labelledby="guided-choice-sheet-title" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="guided-choice-sheet-close" aria-label="Chiudi dettagli" onClick={() => setChoiceSheet(null)}>
                <X size={18} />
              </button>
              <span className={`guided-card-badge ${choiceSheet === "catalog" ? "neutral" : ""}`}>{activeChoiceSheet.badge}</span>
              <div>
                <h2 id="guided-choice-sheet-title">{activeChoiceSheet.title}</h2>
                <p>{activeChoiceSheet.description}</p>
              </div>
              <ul className="guided-choice-benefits" aria-label={`Vantaggi ${activeChoiceSheet.title}`}>
                {activeChoiceSheet.benefits.map((benefit) => (
                  <li key={benefit}><Check size={16} aria-hidden="true" /> {benefit}</li>
                ))}
              </ul>
              <div className="guided-choice-sheet-footer">
                <span>{activeChoiceSheet.time}</span>
                <AppButton onClick={activeChoiceSheet.action} rightIcon={<ArrowRight size={17} />}>
                  {activeChoiceSheet.cta}
                </AppButton>
              </div>
            </aside>
          </div>
        )}
      </section>
    );
  }

  if (clientJourneyStage === "survey") {
    return (
      <section className="survey-shell">
        <header className="survey-topbar">
          <button type="button" onClick={goBackSurvey} aria-label="Indietro">
            {surveyIndex === 0 ? <X size={24} /> : <ChevronLeft size={24} />}
          </button>
          <strong>{currentSurveyQuestion.id === "topics" ? "Temi" : currentSurveyQuestion.title}</strong>
        </header>
        <main className="survey-question-panel" ref={surveyQuestionPanelRef}>
          <div className="survey-question-box">
            <h1>{currentSurveyQuestion.title}</h1>
            {currentSurveyQuestion.subtitle && <p>{currentSurveyQuestion.subtitle}</p>}
          </div>
          <div className={currentSurveyQuestion.id === "topics" ? "survey-option-list survey-option-grid" : "survey-option-list"}>
            {currentSurveyQuestion.answers.map((answer, answerIndex) => {
              const selected = currentSurveyAnswers.includes(answer.id);
              const disabled =
                currentSurveyQuestion.kind === "multi" &&
                !selected &&
                currentSurveyAnswers.length >= (currentSurveyQuestion.max ?? currentSurveyQuestion.answers.length);
              return (
                <button
                  key={answer.id}
                  type="button"
                  className={`survey-option ${selected ? "selected" : ""}`}
                  style={{ "--survey-option-delay": `${Math.min(answerIndex, 8) * 90}ms` } as React.CSSProperties}
                  onClick={() => toggleSurveyAnswer(answer)}
                  onPointerEnter={(event) => showTopicPointer(answer, event)}
                  onPointerMove={(event) => showTopicPointer(answer, event)}
                  onPointerDown={(event) => {
                    showTopicPointer(answer, event);
                    if (event.pointerType !== "mouse") holdTopicPointerOnTap();
                  }}
                  onPointerLeave={hideTopicPointer}
                  disabled={disabled}
                >
                  <span>
                    <strong>{answer.label}</strong>
                    <small>{answer.description}</small>
                  </span>
                  {answer.meta && <em>{answer.meta}</em>}
                  {selected && <Check size={19} />}
                </button>
              );
            })}
          </div>
          {topicPointer && (
            <div
              className="survey-magic-pointer"
              aria-hidden="true"
              style={{ "--pointer-x": `${topicPointer.x}px`, "--pointer-y": `${topicPointer.y}px` } as React.CSSProperties}
            >
              <span>{topicPointer.emoji}</span>
            </div>
          )}
        </main>
        <aside className="survey-profile">
          <strong>Profilo percorso</strong>
          <div className="survey-profile-score">
            <span style={{ "--score": `${matchScore}%` } as React.CSSProperties} />
            <b>{matchScore}%</b>
          </div>
          <div className="survey-profile-grid">
            {profileGridItems.map((item) => (
              <div
                className={item.value === "Da definire" || item.value === "Non ancora definito" || item.value === "Consigliato da FunniFin" ? "" : "filled"}
                key={item.label}
                title={`${item.label}: ${item.value}`}
                aria-label={`${item.label}: ${item.value}`}
              >
                <span>{item.label}</span>
                <em>{item.value}</em>
              </div>
            ))}
          </div>
        </aside>
        <footer className="survey-footer">
          <div className="survey-progress">
            <span><i style={{ width: `${surveyProgress}%` }} /></span>
            <em>{surveyIndex + 1} su {guidedSurveyQuestions.length}</em>
          </div>
          <div className="survey-nav">
            <button type="button" onClick={goBackSurvey} aria-label="Indietro">
              <ChevronLeft size={23} />
            </button>
            <button type="button" onClick={continueSurvey} disabled={!surveyCanContinue} aria-label="Continua">
              <ArrowRight size={23} />
            </button>
          </div>
        </footer>
      </section>
    );
  }

  if (clientJourneyStage === "generating") {
    return (
      <section className="guided-generating">
        <div className="guided-generating-card">
          <Sparkles size={28} />
          <h1>Stiamo costruendo il tuo percorso</h1>
          <p>Analizziamo obiettivi, temi e formato.</p>
          <div className="animated-pill-row">
            {resultTopicTitles.map((title) => <span key={title}>{title}</span>)}
          </div>
        </div>
      </section>
    );
  }

  if (clientJourneyStage === "result") {
    return (
      <section className="guided-result">
        <div className="guided-result-head">
          <span className="eyebrow">Match {matchScore}%</span>
          <h1>Abbiamo trovato il percorso ideale</h1>
          <p>Azienda orientata a {outcomeLabel.toLowerCase()} con priorità su {formatList(resultTopicTitles)}.</p>
        </div>
        <div className="guided-result-grid">
          <article className="guided-profile-card">
            <strong>Profilo aziendale</strong>
            <dl>
              <div><dt>Temi prioritari</dt><dd>{resultTopicTitles.join(", ")}</dd></div>
              <div><dt>Dipendenti</dt><dd>{employeesLabel}</dd></div>
              <div><dt>Formato</dt><dd>{formatLabel}</dd></div>
              <div><dt>Budget</dt><dd>{budgetLabel}</dd></div>
            </dl>
          </article>
          <div className="guided-workshop-stack">
            {resultWorkshops.map((workshop) => {
              const topic = topics.find((item) => item.id === workshop.topicId);
              return (
                <article className="guided-workshop-card" key={workshop.id}>
                  <span className="topic-badge">{topic?.title ?? "Consigliato"}</span>
                  <strong>{workshop.title}</strong>
                  <p>{workshop.short}</p>
                  <em>{workshop.durationOptions[0]} · {workshop.formatOptions[0]} · {money(workshop.price1h)}</em>
                </article>
              );
            })}
          </div>
        </div>
        <BottomActionBar
          className="client-bottom-bar guided-result-bottom"
          context={`Match ${matchScore}%`}
          detail={`${resultWorkshops.length} workshop consigliati`}
          primaryLabel="Aggiungi percorso consigliato"
          onPrimary={addGuidedWorkshops}
          secondaryLabel="Modifica dal catalogo"
          onSecondary={openGuidedCatalog}
          backLabel="Torna alla survey"
          onBack={() => setClientJourneyStage("survey")}
        />
      </section>
    );
  }

  return (
    <section className="view-stack" aria-label="Planner workshop cliente FunniFin">
      <RoleHero
        className="client-path-hero"
        eyebrow="Crea il tuo percorso FunniFin"
        title="Scegli temi utili, proponi date e ricevi la conferma dal team."
        actions={
          <ToolIconButton
            onClick={() => {
              setClientStep("Date");
            }}
            label="Vai alle date"
          >
            <CalendarCheck size={22} />
          </ToolIconButton>
        }
      />

      <QuoteStrip
        selections={selections}
        quote={quote}
        coveredTopics={coveredTopics}
        coveredThemes={coveredThemes}
        totalHours={totalHours}
        onCta={() => setClientStep("Invio")}
      />

      <div className="client-commerce">
        <div className="client-shop">
      <Stepper
        steps={clientSteps}
        activeStep={clientStep}
        completedSteps={clientCompletedSteps}
        onStep={(step) => {
          setClientStep(step);
          if (step === "Personalizza") {
            debugNotify("Personalizzazione su misura", "Qui decidi se aggiungere il lavoro di co-design FunniFin con i nostri esperti.");
            return;
          }
          debugNotify("Step selezionato", `${step}: vai alla sezione operativa.`);
        }}
      >

      {clientStep === "Interessi" && (
          <Panel>
            <SectionTitle
              title="Scegli interessi e temi"
              icon={<BookOpen size={20} />}
              actions={
                <ToolIconButton onClick={() => refreshClientSection("Interessi e temi")} label="Ricarica interessi e temi">
                  <RefreshCw size={18} />
                </ToolIconButton>
              }
            />
            <div className="catalog-display-toolbar">
              <span>{topics.length} interessi · {allThemes.length} temi · {workshops.length} workshop</span>
            </div>
            <div className="topic-grid">
              <article className="topic-card all-topics-card topic-color-all" aria-labelledby="all-catalog-title">
                <span className="topic-icon"><BookOpen size={22} /></span>
                <span className="topic-badge">vedi tutti</span>
                <strong id="all-catalog-title">Tutto il catalogo</strong>
                <small>Salta i consigli e vai direttamente al catalogo completo →</small>
                <em>{allThemes.length} temi catalogo · {workshops.length} workshop</em>
                <AppButton className="all-topics-cta" variant="secondary" onClick={selectAllTopics} rightIcon={<ArrowRight size={16} />}>
                  Apri catalogo
                </AppButton>
              </article>
              {topics.map((topicItem) => {
                const themeIds = topicItem.themes.map((theme) => theme.id);
                const count = workshops.filter((workshop) => workshop.topicId === topicItem.id || themeIds.includes(workshop.themeId)).length;
                const selected = activeTopics.includes(topicItem.id);
                const expanded = expandedTopicCards.includes(topicItem.id);
                const visibleThemes = expanded ? topicItem.themes : topicItem.themes.slice(0, 2);
                return (
                  <article
                    key={topicItem.id}
                    className={`topic-card ${topicColorClass(topicItem.id)} ${selected ? "selected" : ""}`}
                  >
                    <button className="topic-card-main" type="button" onClick={() => toggleTopic(topicItem)}>
                      <span className="topic-icon">{iconFor(topicItem.icon)}</span>
                      <strong>{topicItem.title}</strong>
                      <small>{topicItem.description}</small>
                      <em className="topic-card-meta">
                        {topicItem.themes.length} temi catalogo · {count} workshop
                      </em>
                    </button>
                    {topicItem.badge !== "base" && <span className="topic-badge">{topicItem.badge}</span>}
                    <div className="topic-theme-preview" aria-label={`Temi ${topicItem.title}`}>
                      <span className="topic-theme-label">Temi inclusi</span>
                      {visibleThemes.map((theme) => (
                        <button
                          key={theme.id}
                          type="button"
                          className={activeThemes.includes(theme.id) ? "active" : ""}
                          onClick={() => {
                            if (!activeTopics.includes(topicItem.id)) setActiveTopics([...activeTopics, topicItem.id]);
                            setActiveThemes(
                              activeThemes.includes(theme.id)
                                ? activeThemes.filter((id) => id !== theme.id)
                                : [...new Set([...activeThemes, theme.id])],
                            );
                          }}
                        >
                          {theme.title}
                        </button>
                      ))}
                      {topicItem.themes.length > 2 && (
                        <button
                          type="button"
                          className="topic-theme-more"
                          aria-label={expanded ? `Comprimi temi ${topicItem.title}` : `Mostra tutti i temi ${topicItem.title}`}
                          onClick={() =>
                            setExpandedTopicCards((current) =>
                              current.includes(topicItem.id) ? current.filter((id) => id !== topicItem.id) : [...current, topicItem.id],
                            )
                          }
                        >
                          {expanded ? "meno" : "..."}
                        </button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </Panel>
      )}

      {clientStep === "Consigliati" && (
          <Panel>
            <SectionTitle
              title="Workshop consigliati"
              icon={<Sparkles size={20} />}
              actions={
                <ToolIconButton onClick={() => refreshClientSection("Workshop consigliati")} label="Ricarica workshop consigliati">
                  <RefreshCw size={18} />
                </ToolIconButton>
              }
            />
            <div className="recommendation-intro">
              <div>
                <span className="eyebrow">Dati dagli interessi scelti</span>
                <strong>Ti proponiamo una prima combinazione, poi decidi tu.</strong>
                <p>
                  I workshop qui sotto non sono ancora nel carrello: li aggiungi solo se confermi. Puoi anche saltare e scegliere manualmente dal catalogo.
                </p>
              </div>
              <div className="recommendation-meter">
                <span>{selectedTopics.length} interessi</span>
                <strong>{recommendedWorkshops.length} consigli</strong>
                {selectedRecommendationCount > 0
                  ? <em>{selectedRecommendationCount}/{recommendedWorkshops.length} già nel percorso</em>
                  : <em>Aggiungi questi {recommendedWorkshops.length} workshop con un clic</em>
                }
              </div>
            </div>
            {recommendedWorkshops.length > 0 ? (
              <div className="recommendation-grid">
                {recommendedWorkshops.map((workshop) => {
                  const topic = topics.find((item) => item.id === workshop.topicId);
                  const theme = topic?.themes.find((item) => item.id === workshop.themeId);
                  const selected = selections.some((selection) => selection.workshopId === workshop.id);
                  return (
                    <article className={`recommendation-card ${selected ? "selected" : ""}`} key={workshop.id}>
                      <div>
                        <span className="topic-badge">{theme?.title ?? topic?.title ?? "consigliato"}</span>
                        {selected && <span className="catalog-status active">nel percorso</span>}
                      </div>
                      <strong>{workshop.title}</strong>
                      <p>{workshop.short}</p>
                      <em>
                        Consigliato per {topic?.title ?? "gli interessi scelti"} · {workshop.durationOptions[0]} · {workshop.formatOptions[0]} / {workshop.level.toUpperCase()}
                      </em>
                      <footer>
                        <span>{money(workshop.price1h)}</span>
                        <AppButton
                          variant={selected ? "outline" : "secondary"}
                          onClick={() => toggleWorkshopWithFeedback(workshop)}
                        >
                          {selected ? <Check size={17} /> : <Plus size={17} />}
                          {selected ? "Aggiunto" : "Aggiungi"}
                        </AppButton>
                      </footer>
                    </article>
                  );
                })}
              </div>
            ) : (
              <EmptyWorkflowState
                title="Nessun consiglio disponibile"
                body="Scegli almeno un interesse o apri tutto il catalogo per vedere i workshop."
                cta="Vai al catalogo"
                onClick={() => setClientStep("Workshop")}
              />
            )}
          </Panel>
      )}

      {clientStep === "Workshop" && (
          <Panel>
            <SectionTitle
              title="Scegli workshop"
              icon={<Presentation size={20} />}
              actions={
                <ToolIconButton onClick={() => refreshClientSection("Catalogo workshop")} label="Ricarica catalogo workshop">
                  <RefreshCw size={18} />
                </ToolIconButton>
              }
            />
            <div className="workshop-command-bar">
              <div className="workshop-command-summary">
                <strong>{filteredWorkshops.length} workshop</strong>
                <span>
                  {hasCatalogQuery || allCatalogActive ? "Risultati dal catalogo completo" : "Filtrati dagli interessi scelti"}
                  {selectedWorkshopRows.length > 0 && ` · ${selectedWorkshopRows.length} selezionati`}
                </span>
              </div>
              <div className="workshop-command-controls">
                <label className="search-field" aria-label="Cerca workshop">
                  <Search size={20} />
                  <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca workshop, tema o descrizione" />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery("")} aria-label="Cancella ricerca">
                      <X size={20} />
                    </button>
                  )}
                </label>
                <div className="workshop-command-actions">
                  <button className={filtersOpen || activeStructuredFilterCount > 0 ? "active" : ""} onClick={() => setFiltersOpen(!filtersOpen)}>
                    <SlidersHorizontal size={17} />
                    <strong>Filtri</strong>
                    <em>
                      {activeStructuredFilterCount > 0
                        ? `${activeStructuredFilterCount} attivi`
                        : filtersOpen
                          ? "Aperti"
                          : "Inattivi"}
                    </em>
                  </button>
                </div>
              </div>
            </div>
            <div className={`workshop-filter-shell ${filtersOpen ? "open" : "closed"}`}>
              {filtersOpen && (
                <div className="filter-panel">
                  <div className="filter-panel-head">
                    <div>
                      <strong>Filtri catalogo</strong>
                      <span>Scegli ambito, tema e formato. La ricerca resta attiva sopra.</span>
                    </div>
                    <div>
                      <button onClick={clearWorkshopDiscovery} disabled={!searchQuery && activeStructuredFilterCount === 0}>
                        <X size={17} />
                        Pulisci
                      </button>
                      <button onClick={resetWorkshopDiscovery}>
                        <BookOpen size={17} />
                        Tutto il catalogo
                      </button>
                    </div>
                  </div>
                  <div className="filter-compact-summary">
                    <span>Base percorso</span>
                    <strong>{selectedTopics.length} interessi · {activeThemes.length} temi attivi</strong>
                  </div>
                  <div className="workshop-filters">
                    <label>
                      Interesse
                      <select value={workshopFilters.topic} onChange={(event) => setWorkshopFilters({ ...workshopFilters, topic: event.target.value })}>
                        <option value="all">Tutti gli interessi</option>
                        {topics.map((topicItem) => (
                          <option key={topicItem.id} value={topicItem.id}>{topicItem.title}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Tema
                      <select value={workshopFilters.theme} onChange={(event) => setWorkshopFilters({ ...workshopFilters, theme: event.target.value })}>
                        <option value="all">Tutti i temi</option>
                        {allThemes.map((theme) => (
                          <option key={theme.id} value={theme.id}>{theme.title}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Formato
                      <select value={workshopFilters.format} onChange={(event) => setWorkshopFilters({ ...workshopFilters, format: event.target.value })}>
                        <option value="all">Tutti i formati</option>
                        <option value="webinar">Webinar</option>
                        <option value="live">In presenza</option>
                        <option value="ibrido">Ibrido</option>
                      </select>
                    </label>
                  </div>
                  <div className="active-filter-row">
                    <span>
                      {hasCatalogQuery || allCatalogActive
                        ? `${filteredWorkshops.length} risultati su tutto il catalogo.`
                        : `${filteredWorkshops.length} risultati dagli interessi selezionati.`}
                    </span>
                    <em>{activeStructuredFilterCount || searchQuery ? "Filtri applicati" : "Nessun filtro extra"}</em>
                  </div>
                </div>
              )}
            </div>
            <div className="workshop-grid">
              {filteredWorkshops.map((workshop) => {
                const selection = selections.find((item) => item.workshopId === workshop.id);
                return (
                  <WorkshopCard
                    key={workshop.id}
                    workshop={workshop}
                    selection={selection}
                    topics={topics}
                    onToggle={(event) => toggleWorkshopWithFeedback(workshop, event)}
                    onChange={(patch) => updateSelection(workshop.id, patch)}
                    onCustomRequest={() => openCustomRequest(workshop)}
                    onCustomInfo={() => showCustomModal(workshop)}
                  />
                );
              })}
            </div>
            {filteredWorkshops.length === 0 && <p className="empty-selection">Nessun workshop con questi filtri. Usa “Vedi tutti”.</p>}
          </Panel>
      )}

      {clientStep === "Personalizza" && (
          <Panel>
            <SectionTitle
              title="Personalizzazione su misura"
              icon={<Sparkles size={20} />}
              actions={
                <ToolIconButton onClick={() => refreshClientSection("Personalizzazione")} label="Ricarica personalizzazione">
                  <RefreshCw size={18} />
                </ToolIconButton>
              }
            />
            {selectedWorkshopRows.length === 0 ? (
              <EmptyWorkflowState
                title="Nessun workshop da personalizzare"
                body="Aggiungi almeno un workshop al percorso per attivare il su misura."
                cta="Vai ai workshop"
                onClick={() => setClientStep("Workshop")}
              />
            ) : (
              <div className="personalize-list">
                {selectedWorkshopRows.map(({ selection, workshop }) => (
                <div className="personalize-row" key={workshop.id}>
                  <div>
                    <strong>{workshop.title}</strong>
                    <span>Co-design con FunniFin e migliori esperti: +{money(workshop.customExtra)}</span>
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
              </div>
            )}
          </Panel>
      )}

      {clientStep === "Date" && (
          <Panel>
            <SectionTitle
              title="Proponi date"
              icon={<CalendarCheck size={20} />}
              actions={
                <ToolIconButton onClick={() => refreshClientSection("Date")} label="Ricarica date">
                  <RefreshCw size={18} />
                </ToolIconButton>
              }
            />
            {selectedWorkshopRows.length === 0 ? (
              <EmptyWorkflowState
                title="Nessun workshop da pianificare"
                body="Aggiungi workshop al percorso, poi torna qui per scegliere le date."
                cta="Vai ai workshop"
                onClick={() => setClientStep("Workshop")}
              />
            ) : (
              <div className="date-choice-grid">
                {selections.map((selection) => {
                const workshop = workshops.find((item) => item.id === selection.workshopId)!;
                const hasDate = Boolean(selection.date);
                const isConfirmed = Boolean(selection.dateConfirmed);
                const dateStateClass = isConfirmed ? "done" : hasDate ? "proposed" : "";
                const dateIcon = isConfirmed ? <Check size={16} /> : hasDate ? <CalendarCheck size={16} /> : <Clock3 size={16} />;
                const dateLabel = isConfirmed
                  ? `${selection.date} · ${selection.time} · ${selection.duration}`
                  : hasDate
                    ? `${selection.date} · ${selection.time} — in attesa di conferma`
                    : "Data non ancora scelta";
                return (
                  <div className={`date-action-card ${dateStateClass}`} key={selection.workshopId}>
                    <span className="date-status">{dateIcon}</span>
                    <div>
                      <strong>{workshop.title}</strong>
                      <span>{dateLabel}</span>
                    </div>
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
            )}
          </Panel>
      )}

      {clientStep === "Materiali" && (
          <Panel>
            <SectionTitle
              title="Logo e note cliente"
              icon={<UploadCloud size={20} />}
              actions={
                <ToolIconButton onClick={() => refreshClientSection("Materiali cliente")} label="Ricarica materiali cliente">
                  <RefreshCw size={18} />
                </ToolIconButton>
              }
            />
          <div className="upload-box">
            <UploadCloud size={32} />
            <strong>Logo, brand guideline e note platea</strong>
            <span>
              Crea una cartella Drive draft chiamata <strong>{assetClientName} data</strong> per logo, linee guida e note.
            </span>
            <label className={`secondary-btn asset-upload-trigger ${uploadingAssets ? "app-btn-loading" : ""}`} aria-busy={uploadingAssets || undefined}>
              <input
                type="file"
                multiple
                disabled={uploadingAssets}
                onChange={(event) => {
                  void handleAssetFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              <span className="app-btn-icon-slot" aria-hidden={!uploadingAssets}>
                {uploadingAssets ? <Loader2 className="app-btn-spinner" size={16} aria-hidden="true" /> : <span className="app-btn-spinner-placeholder" />}
              </span>
              Carica materiali
            </label>
            {assetFolder && (
              <a className="asset-folder-link" href={assetFolder.url} target="_blank" rel="noreferrer">
                Apri cartella Drive: {assetFolder.name}
              </a>
            )}
            {uploadingAssets && (
              <div className="upload-skeleton-list" aria-hidden="true">
                {Array.from({ length: 2 }).map((_, index) => (
                  <span className="skeleton-row" key={index}>
                    <Skeleton className="skeleton-dot" />
                    <span className="skeleton-text">
                      <Skeleton className="skeleton-line" />
                      <Skeleton className="skeleton-line short" />
                    </span>
                    <Skeleton className="skeleton-button" />
                  </span>
                ))}
              </div>
            )}
            {!uploadingAssets && uploadedAssets.length > 0 && (
              <div className="asset-file-list">
                {uploadedAssets.map((asset, index) => (
                  <div key={`${asset.name}-${index}`} className="asset-file-row">
                    <FileCheck2 size={17} />
                    <span>{asset.name}</span>
                    <em>{Math.max(1, Math.round(asset.size / 1024))} KB</em>
                  </div>
                ))}
              </div>
            )}
            {assetUploadError && <p className="modal-warning">{assetUploadError}</p>}
            <small>Se chiudi o abbandoni senza inviare la richiesta, la cartella draft viene spostata nel cestino.</small>
          </div>
          </Panel>
      )}

      {clientStep === "Invio" && (
          <Panel>
            <SectionTitle
              title="Invio richiesta"
              icon={<FileCheck2 size={20} />}
              actions={
                <ToolIconButton onClick={() => refreshClientSection("Invio richiesta")} label="Ricarica riepilogo invio">
                  <RefreshCw size={18} />
                </ToolIconButton>
              }
            />
            <ReadinessPanel rows={selectedWorkshopRows} missingDateRows={missingDateRows} />
            {requestFinalized ? (
              <div className="request-success-card">
                <span className="success-check">
                  <Check size={38} />
                </span>
                <div>
                  <strong>Richiesta inviata</strong>
                  <p>
                    {emailDeliveryMode === "not_sent"
                      ? "Richiesta salvata sullo Sheet. Email non inviata."
                      : "Richiesta salvata sullo Sheet, email inviata al cliente e a FunniFin."}
                  </p>
                </div>
                <div className="submitted-email-box">
                  <span>{emailDeliveryMode === "not_sent" ? "Recap finale per" : "Inviata a"}</span>
                  <strong>{submittedEmail}</strong>
                  <AppButton
                    variant="ghost"
                    onClick={() => {
                      setRequestFinalized(false);
                      setClientStep("Invio");
                    }}
                  >
                    Modifica indirizzo
                  </AppButton>
                </div>
              </div>
            ) : (
              <>
                <div className="contact-card">
                  <div>
                    <strong>Dati per recap e contatto FunniFin</strong>
                    <span>Nessun account richiesto: inserisci i dati solo alla fine per inviare la richiesta.</span>
                  </div>
                  <div className="contact-grid">
                    <label className={contactTouched && !contact.firstName.trim() ? "has-error" : ""}>
                      Nome
                      <input value={contact.firstName} onChange={(event) => setContact({ ...contact, firstName: event.target.value })} autoComplete="given-name" />
                      {contactTouched && !contact.firstName.trim() && <small className="field-error">Campo obbligatorio</small>}
                    </label>
                    <label className={contactTouched && !contact.lastName.trim() ? "has-error" : ""}>
                      Cognome
                      <input value={contact.lastName} onChange={(event) => setContact({ ...contact, lastName: event.target.value })} autoComplete="family-name" />
                      {contactTouched && !contact.lastName.trim() && <small className="field-error">Campo obbligatorio</small>}
                    </label>
                    <label className={contactTouched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) ? "has-error" : ""}>
                      Email aziendale
                      <input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} autoComplete="email" />
                      {contactTouched && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim()) && <small className="field-error">Email non valida</small>}
                    </label>
                    <label className={contactTouched && !contact.company.trim() ? "has-error" : ""}>
                      Azienda
                      <input value={contact.company} onChange={(event) => setContact({ ...contact, company: event.target.value })} autoComplete="organization" />
                      {contactTouched && !contact.company.trim() && <small className="field-error">Campo obbligatorio</small>}
                    </label>
                    <label className={contactTouched && !contact.phone.trim() ? "has-error" : ""}>
                      Telefono
                      <input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} autoComplete="tel" />
                      {contactTouched && !contact.phone.trim() && <small className="field-error">Campo obbligatorio</small>}
                    </label>
                  </div>
                </div>
                <div className="approval-card">
                  <div>
                    <strong>Preventivo pronto per FunniFin</strong>
                    <span>Riceverai un recap via email; FunniFin verifichera date, esperti e fattibilita operativa.</span>
                  </div>
                </div>
                <label className={`approval-card privacy-consent ${contactTouched && !privacyAccepted ? "has-error" : ""}`}>
                  <input
                    type="checkbox"
                    checked={privacyAccepted}
                    onChange={(event) => setPrivacyAccepted(event.target.checked)}
                  />
                  <span>
                    Autorizzo FunniFin a trattare questi dati per gestire la richiesta workshop, ricontattarmi e preparare materiali/date collegati.
                    <small>Versione informativa: {PRIVACY_NOTICE_VERSION}</small>
                    {contactTouched && !privacyAccepted && <small className="field-error">Conferma obbligatoria</small>}
                  </span>
                </label>
              </>
            )}
          </Panel>
      )}
      </Stepper>
        </div>
        <EcommerceCart
          rows={selectedWorkshopRows}
          quote={quote}
          onRemove={removeWorkshop}
          onShare={handleShareCart}
          submitting={sharingCart}
        />
      </div>
      <BottomActionBar
        className="client-bottom-bar"
        context={`Step ${activeStepIndex + 1} — ${clientStep}`}
        detail={`${selectedWorkshopRows.length} workshop selezionati`}
        priceBefore={quote.saved > 0 ? money(quote.gross) : undefined}
        priceAfter={money(quote.total)}
        discountLabel={quote.saved > 0 ? `Sconto ${money(quote.saved)}` : undefined}
        caveat={
          selectedWorkshopRows.length > 0 && selectedWorkshopRows.length < 3
            ? `Aggiungi ${3 - selectedWorkshopRows.length} workshop per sconto del 20%`
            : undefined
        }
        primaryHint={
          clientStep === "Interessi" && clientMainAction.disabled
            ? "Seleziona almeno un interesse per continuare"
            : clientStep === "Workshop" && clientMainAction.disabled
              ? "Aggiungi almeno un workshop al percorso"
              : clientStep === "Date" && clientMainAction.disabled
                ? "Scegli la data per tutti i workshop"
                : undefined
        }
        primaryLabel={clientMainAction.label}
        primaryDisabled={clientMainAction.disabled}
        primaryLoading={sendingRequest && clientStep === "Invio"}
        onPrimary={clientMainAction.action}
        backLabel={activeStepIndex > 0 ? "Indietro" : undefined}
        onBack={activeStepIndex > 0 ? goBack : undefined}
        secondaryLabel={clientStep === "Consigliati" ? "Scegli manualmente" : undefined}
        onSecondary={clientStep === "Consigliati" ? () => setClientStep("Workshop") : undefined}
      />
      {flyToBar && (
        <div
          key={flyToBar.id}
          className="fly-to-bar"
          style={{ "--fly-x": `${flyToBar.x}px`, "--fly-y": `${flyToBar.y}px` } as React.CSSProperties}
        >
          <Plus size={15} />
          <span>{flyToBar.title}</span>
        </div>
      )}
    </section>
  );
}

export function iconFor(name: string) {
  const icons: Record<string, React.ReactNode> = {
    banknote: <Banknote size={22} />,
    sparkles: <Sparkles size={22} />,
    chart: <CircleDollarSign size={22} />,
    briefcase: <BriefcaseBusiness size={22} />,
    file: <FileCheck2 size={22} />,
    home: <FolderKanban size={22} />,
    shield: <BadgeCheck size={22} />,
    users: <UsersRound size={22} />,
    car: <CalendarCheck size={22} />,
    heart: <Sparkles size={22} />,
  };
  return icons[name] ?? <BookOpen size={22} />;
}
