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
  ChevronDown,
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
import type { CatalogBundle, ClientContact, CommercialConfig, Format, ProjectStatus, Quote, Selection, SurveyProfile, Topic, Workshop } from "../../types/domain";
import { money } from "../../utils/money";
import { AppButton } from "../../components/ui/AppButton";
import { EmptyWorkflowState } from "../../components/ui/EmptyWorkflowState";
import { Panel } from "../../components/ui/Panel";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { RemoveWorkshopButton } from "../../components/ui/RemoveWorkshopButton";
import { Skeleton } from "../../components/ui/Skeleton";
import { Stepper } from "../../components/ui/Stepper";
import { ToolIconButton } from "../../components/ui/IconButton";
import { ExpandableCardText } from "../../components/ui/ExpandableCardText";
import { BottomActionBar } from "../../components/layout/BottomActionBar";
import { RoleHero } from "../../components/layout/RoleHero";
import { EcommerceCart } from "../../components/workshop/EcommerceCart";
import { QuoteStrip } from "../../components/workshop/QuoteStrip";
import { ReadinessPanel } from "../../components/workshop/ReadinessPanel";
import { WorkshopCard } from "../../components/workshop/WorkshopCard";
import { BundleCard } from "../../components/workshop/BundleCard";
import { getBundlePrice, getWorkshopSelectionPrice, topicColorClass } from "../../utils/workshop";
import { buildSurveyRecommendation } from "../../utils/recommendation";

type ClientJourneyStage = "loader" | "choice" | "survey" | "generating" | "result" | "manual";
type CatalogSort = "editorial" | "price-asc" | "price-desc" | "title-asc" | "title-desc" | "level-asc" | "duration-asc";
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

const catalogSortOptions: Array<{ value: CatalogSort; label: string }> = [
  { value: "editorial", label: "Consigliati da FunniFin" },
  { value: "price-asc", label: "Prezzo: dal più basso" },
  { value: "price-desc", label: "Prezzo: dal più alto" },
  { value: "title-asc", label: "Alfabetico: A–Z" },
  { value: "title-desc", label: "Alfabetico: Z–A" },
  { value: "level-asc", label: "Difficoltà: base → avanzato" },
  { value: "duration-asc", label: "Durata: più breve prima" },
];

const formatFilterOptions = [
  { value: "all", label: "Tutti i formati" },
  { value: "webinar", label: "Webinar" },
  { value: "live", label: "In presenza" },
  { value: "ibrido", label: "Ibrido" },
];

const PRIVACY_NOTICE_VERSION = "privacy-funnifin-mvp-2026-06-22";

const guidedSurveyQuestions: SurveyQuestion[] = [
  {
    id: "topics",
    title: "Su quali ambiti vuoi generare maggiore impatto?",
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
      { id: "sensibilizzazione", label: "Sensibilizzazione", description: "Aprire consapevolezza sugli ambiti finanziari chiave." },
      { id: "avanzata", label: "Avanzata", description: "Approfondire gli ambiti prioritari con un percorso strutturato." },
      { id: "completa", label: "Completa", description: "Coprire in modo organico le principali aree del benessere finanziario." },
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
      { id: "online", label: "Online", description: "Massima scalabilità e partecipazione da remoto." },
      { id: "in-person", label: "In presenza", description: "Esperienza più diretta presso la sede del cliente." },
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
  if (items.length === 0) return "ambiti da definire";
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

function workshopTopicIds(workshop: Workshop) {
  return workshop.topicIds?.length ? workshop.topicIds : [workshop.topicId];
}

export function ClientView({
  topics,
  workshops,
  bundles,
  commercialConfig,
  activeTopics,
  activeThemes,
  selections,
  quote,
  coveredTopics,
  totalHours,
  setActiveTopics,
  setActiveThemes,
  toggleWorkshop,
  addWorkshops,
  selectBundle,
  clearSelections,
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
  systemSettingsToken,
  onGuidedLayerChange,
  onRequestCreated,
}: {
  topics: Topic[];
  workshops: Workshop[];
  bundles: CatalogBundle[];
  commercialConfig: CommercialConfig;
  activeTopics: string[];
  activeThemes: string[];
  selections: Selection[];
  quote: Quote;
  coveredTopics: number;
  totalHours: number;
  setActiveTopics: (ids: string[]) => void;
  setActiveThemes: (ids: string[]) => void;
  toggleWorkshop: (id: string) => void;
  addWorkshops: (ids: string[], options?: { bundleId?: string; format?: Format }) => void;
  selectBundle: (bundle: CatalogBundle, format?: Format) => void;
  clearSelections: () => void;
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
  systemSettingsToken: number;
  onGuidedLayerChange?: (active: boolean) => void;
  onRequestCreated: (request: WorkshopRequestRecord) => void;
}) {
  const allClientSteps = ["Interessi", "Consigliati", "Workshop", "Personalizza", "Date", "Materiali", "Invio"];
  const debugNotify = (title: string, body: string) => {
    if (import.meta.env.DEV) notify(title, body);
  };
  const [clientStep, setClientStep] = useState(allClientSteps[0]);
  const [clientJourneyStage, setClientJourneyStage] = useState<ClientJourneyStage>("loader");
  const [choiceSheet, setChoiceSheet] = useState<"guided" | "catalog" | null>(null);
  const [topicPointer, setTopicPointer] = useState<{ emoji: string; x: number; y: number } | null>(null);
  const [surveyIndex, setSurveyIndex] = useState(0);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string[]>>({});
  const [workshopFilters, setWorkshopFilters] = useState<{ topics: string[]; format: string }>({ topics: [], format: "all" });
  const [catalogSort, setCatalogSort] = useState<CatalogSort>("editorial");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [surveyCompleted, setSurveyCompleted] = useState(false);
  const [surveyGateStep, setSurveyGateStep] = useState<"Interessi" | "Consigliati" | null>(null);
  const [preserveCatalogAfterSurvey, setPreserveCatalogAfterSurvey] = useState(false);
  const [commandBarFixed, setCommandBarFixed] = useState(false);
  const [commandBarHeight, setCommandBarHeight] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [catalogMode, setCatalogMode] = useState<"none" | "all" | "bundles" | "workshops">("none");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [assetUploadError, setAssetUploadError] = useState("");
  const [logoPreview, setLogoPreview] = useState<{ name: string; url: string } | null>(null);
  const [requestFinalized, setRequestFinalized] = useState(false);
  const [datesDeferred, setDatesDeferred] = useState(false);
  const [datePlanningMode, setDatePlanningMode] = useState<"now" | "later" | null>(null);
  const [dateSubmitGateOpen, setDateSubmitGateOpen] = useState(false);
  const [selectedSurveyProfile, setSelectedSurveyProfile] = useState<SurveyProfile | null>(null);
  const [sharingCart, setSharingCart] = useState(false);
  const [pathSummaryOpen, setPathSummaryOpen] = useState(false);
  const [contactTouched, setContactTouched] = useState(false);
  const [privacyAccepted, setPrivacyAccepted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [emailDeliveryMode, setEmailDeliveryMode] = useState<"sent" | "not_sent">("not_sent");
  const [flyToBar, setFlyToBar] = useState<{ id: number; title: string; x: number; y: number } | null>(null);
  const assetFolderRef = useRef<AssetDraftFolder | null>(null);
  const requestFinalizedRef = useRef(false);
  const topicPointerTimerRef = useRef<number | null>(null);
  const surveyQuestionPanelRef = useRef<HTMLElement | null>(null);
  const commandBarAnchorRef = useRef<HTMLDivElement | null>(null);
  const commandBarRef = useRef<HTMLDivElement | null>(null);
  const [contact, setContact] = useState<ClientContact>({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    phone: "",
  });
  const surveyQuestions = useMemo<SurveyQuestion[]>(
    () =>
      guidedSurveyQuestions.map((question) =>
        question.id === "topics"
          ? {
              ...question,
              answers: topics.map((topic) => ({
                id: topic.id,
                label: topic.title,
                description: topic.description || `Workshop dell’ambito ${topic.title}.`,
                meta: `${workshops.filter((workshop) => (workshop.topicIds?.length ? workshop.topicIds : [workshop.topicId]).includes(topic.id)).length} workshop`,
                topicIds: [topic.id],
              })),
            }
          : question,
      ),
    [topics, workshops],
  );
  const selectedTopics = topics.filter((item) => activeTopics.includes(item.id));
  const selectedTopicTitles = selectedTopics.map((item) => item.title).join(", ") || "nessun ambito";
  const allThemes = Array.from(new Map(topics.flatMap((item) => item.themes).map((theme) => [theme.id, theme])).values());
  const activeStructuredFilterCount = workshopFilters.topics.length + (workshopFilters.format === "all" ? 0 : 1);
  const activeOffcanvasControlCount = activeStructuredFilterCount + (catalogSort === "editorial" ? 0 : 1);
  const hasSearchQuery = searchQuery.trim() !== "";
  const hasCatalogQuery = hasSearchQuery || activeStructuredFilterCount > 0;
  const visibleWorkshops = workshops.filter(
    (workshop) =>
      hasCatalogQuery ||
      workshopTopicIds(workshop).some((topicId) => activeTopics.includes(topicId)) ||
      activeThemes.includes(workshop.themeId) ||
      selections.some((item) => item.workshopId === workshop.id),
  );
  const filteredWorkshops = visibleWorkshops.filter((workshop) => {
    const topic = topics.find((item) => workshopTopicIds(workshop).includes(item.id));
    const theme = topic?.themes.find((item) => item.id === workshop.themeId);
    const haystack = `${workshop.title} ${workshop.short} ${workshop.long} ${topic?.title ?? ""} ${theme?.title ?? ""}`.toLowerCase();
    const matchesSearch = searchQuery.trim() === "" || haystack.includes(searchQuery.trim().toLowerCase());
    return (
      matchesSearch &&
      (workshopFilters.topics.length === 0 || workshopTopicIds(workshop).some((topicId) => workshopFilters.topics.includes(topicId))) &&
      (workshopFilters.format === "all" || workshop.formatOptions.includes(workshopFilters.format as Format))
    );
  }).sort((left, right) => {
    if (catalogSort === "title-asc") return left.title.localeCompare(right.title, "it");
    if (catalogSort === "title-desc") return right.title.localeCompare(left.title, "it");
    if (catalogSort === "level-asc") {
      const levelOrder = { base: 0, intermedio: 1, avanzato: 2 };
      return levelOrder[left.level] - levelOrder[right.level] || left.title.localeCompare(right.title, "it");
    }
    if (catalogSort === "duration-asc") {
      const leftDuration = Math.min(...left.durationOptions.map((value) => Number.parseFloat(value.replace(",", ".")) || Number.POSITIVE_INFINITY));
      const rightDuration = Math.min(...right.durationOptions.map((value) => Number.parseFloat(value.replace(",", ".")) || Number.POSITIVE_INFINITY));
      return leftDuration - rightDuration || left.title.localeCompare(right.title, "it");
    }
    return 0;
  });
  const activeBundles = useMemo(() => bundles.filter((bundle) => bundle.active), [bundles]);
  const filteredBundles = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return activeBundles.filter((bundle) => {
      const members = bundle.workshopIds
        .map((workshopId) => workshops.find((workshop) => workshop.id === workshopId))
        .filter(Boolean) as Workshop[];
      const haystack = `${bundle.title} ${bundle.description ?? ""} ${members.map((workshop) => `${workshop.title} ${workshop.short}`).join(" ")}`.toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      const matchesTopic =
        workshopFilters.topics.length === 0 ||
        members.some((workshop) => workshopTopicIds(workshop).some((topicId) => workshopFilters.topics.includes(topicId)));
      return matchesSearch && matchesTopic;
    }).sort((left, right) => {
      if (catalogSort === "price-asc") return getBundlePrice(left, commercialConfig) - getBundlePrice(right, commercialConfig);
      if (catalogSort === "price-desc") return getBundlePrice(right, commercialConfig) - getBundlePrice(left, commercialConfig);
      if (catalogSort === "title-asc") return left.title.localeCompare(right.title, "it");
      if (catalogSort === "title-desc") return right.title.localeCompare(left.title, "it");
      return 0;
    });
  }, [activeBundles, catalogSort, commercialConfig, searchQuery, workshopFilters.topics, workshops]);
  const recommendedBundles = useMemo(() => {
    if (activeTopics.length === 0 && activeThemes.length === 0) return [];
    const activeTopicSet = new Set(activeTopics);
    const activeThemeSet = new Set(activeThemes);

    return activeBundles
      .map((bundle) => {
        const members = bundle.workshopIds
          .map((workshopId) => workshops.find((workshop) => workshop.id === workshopId))
          .filter(Boolean) as Workshop[];
        const matchingMembers = members.filter(
          (workshop) =>
            workshopTopicIds(workshop).some((topicId) => activeTopicSet.has(topicId)) ||
            activeThemeSet.has(workshop.themeId),
        );
        const coveredTopics = new Set(
          matchingMembers.flatMap((workshop) => workshopTopicIds(workshop).filter((topicId) => activeTopicSet.has(topicId))),
        ).size;
        const coverage = members.length > 0 ? matchingMembers.length / members.length : 0;
        return {
          bundle,
          score: coverage * 100 + coveredTopics * 12 + matchingMembers.length,
          matchingMembers: matchingMembers.length,
        };
      })
      .filter(({ matchingMembers }) => matchingMembers > 0)
      .sort((a, b) => b.score - a.score || b.matchingMembers - a.matchingMembers || a.bundle.title.localeCompare(b.bundle.title, "it"))
      .slice(0, 3)
      .map(({ bundle }) => bundle);
  }, [activeBundles, activeThemes, activeTopics, workshops]);
  const recommendedWorkshops = useMemo(() => {
    const activeTopicOrder = new Map(activeTopics.map((id, index) => [id, index]));
    const activeThemeOrder = new Map(activeThemes.map((id, index) => [id, index]));
    const orderedCandidates = workshops
      .map((workshop) => {
        const matchingTopicId = workshopTopicIds(workshop).find((topicId) => activeTopicOrder.has(topicId));
        const topicIndex = matchingTopicId ? activeTopicOrder.get(matchingTopicId) : undefined;
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
      const topicKey = workshopTopicIds(candidate.workshop).find((topicId) => activeTopicOrder.has(topicId)) ?? candidate.workshop.topicId;
      if (seenTopics.has(topicKey)) continue;
      picks.push(candidate.workshop);
      seenTopics.add(topicKey);
    }

    if (picks.length < 3) {
      for (const candidate of orderedCandidates) {
        if (picks.length >= 3) break;
        if (picks.some((workshop) => workshop.id === candidate.workshop.id)) continue;
        picks.push(candidate.workshop);
      }
    }

    return picks;
  }, [activeThemes, activeTopics, workshops]);
  const selectedWorkshopRows = selections
    .map((selection) => ({ selection, workshop: workshops.find((item) => item.id === selection.workshopId)! }))
    .filter(({ workshop }) => Boolean(workshop));
  const hasCustomizableSelections = selectedWorkshopRows.some(({ workshop }) => workshop.customAvailable);
  const customizableWorkshopRows = selectedWorkshopRows.filter(({ workshop }) => workshop.customAvailable);
  const fixedWorkshopRows = selectedWorkshopRows.filter(({ workshop }) => !workshop.customAvailable);
  const clientSteps = hasCustomizableSelections
    ? allClientSteps
    : allClientSteps.filter((step) => step !== "Personalizza");
  const selectedBundleIds = new Set(selections.flatMap((selection) =>
    selection.bundleIds ?? (selection.bundleId ? [selection.bundleId] : []),
  ));
  const allCatalogActive = activeTopics.length === topics.length && activeThemes.length === allThemes.length;
  const selectedRecommendationCount = recommendedWorkshops.filter((workshop) => selections.some((selection) => selection.workshopId === workshop.id)).length;
  const missingDateRows = selectedWorkshopRows.filter(({ selection }) => !selection.dateConfirmed);
  const allDatesSelected = selectedWorkshopRows.length > 0 && missingDateRows.length === 0;
  const activeStepIndex = clientSteps.indexOf(clientStep);
  const goNext = () => setClientStep(clientSteps[Math.min(activeStepIndex + 1, clientSteps.length - 1)]);
  const goBack = () => setClientStep(clientSteps[Math.max(activeStepIndex - 1, 0)]);
  const clientCompletedSteps = new Set<string>([
    ...(coveredTopics > 0 || selections.length > 0 ? ["Interessi"] : []),
    ...(selectedWorkshopRows.length > 0 ? ["Consigliati", "Workshop", "Personalizza"] : []),
    ...(allDatesSelected || datesDeferred ? ["Date"] : []),
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
  useEffect(() => () => {
    if (logoPreview?.url) URL.revokeObjectURL(logoPreview.url);
  }, [logoPreview]);
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (assetFolderRef.current && !requestFinalizedRef.current) void deleteAssetDraftFolder(assetFolderRef.current.id, assetFolderRef.current.draftToken);
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []);
  useEffect(() => {
    if (clientStep !== "Workshop") {
      setCommandBarFixed(false);
      return;
    }

    let frame = 0;
    const updateCommandBar = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const anchor = commandBarAnchorRef.current;
        const bar = commandBarRef.current;
        if (!anchor || !bar) return;
        const stickyTop = 0;
        const willBeFixed = anchor.getBoundingClientRect().top <= stickyTop;
        setCommandBarHeight(bar.offsetHeight);
        setCommandBarFixed(willBeFixed);
      });
    };

    updateCommandBar();
    const resizeObserver = new ResizeObserver(updateCommandBar);
    if (commandBarRef.current) resizeObserver.observe(commandBarRef.current);
    window.addEventListener("scroll", updateCommandBar, { passive: true });
    window.addEventListener("resize", updateCommandBar);
    return () => {
      cancelAnimationFrame(frame);
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateCommandBar);
      window.removeEventListener("resize", updateCommandBar);
    };
  }, [clientStep]);
  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [filtersOpen]);
  useEffect(() => {
    if (!dateSubmitGateOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDateSubmitGateOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [dateSubmitGateOpen]);
  const handleAssetFiles = async (files: FileList | File[] | null) => {
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
  const submitRequest = async (deferMissingDates = false) => {
    if (selectedWorkshopRows.length === 0) {
      setClientStep("Workshop");
      notify("Aggiungi almeno un workshop", "Scegli un workshop dal catalogo prima di inviare la richiesta.");
      return;
    }
    if (!allDatesSelected && !datesDeferred && !deferMissingDates) {
      setDateSubmitGateOpen(true);
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
        price: getWorkshopSelectionPrice(workshop, selection, commercialConfig).total,
        custom: selection.custom,
        recordingIncluded: selection.recordingIncluded !== false,
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
          recordingIncluded: workshop.recordingIncluded,
        })),
        quote: {
          gross: quote.gross,
          discount: quote.quantityDiscount,
          promoDiscount: quote.promoDiscount,
          customTotal: quote.customTotal,
          total: quote.total,
          saved: quote.saved,
          packageName: quote.rule.name,
          recordingDiscount: quote.recordingDiscount,
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
          recordingDiscount: quote.recordingDiscount,
        },
        surveyProfile: selectedSurveyProfile ?? undefined,
        datesDeferred: datesDeferred || deferMissingDates,
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
      const price = getWorkshopSelectionPrice(workshop, selection, commercialConfig);
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
        const price = getWorkshopSelectionPrice(workshop, selection, commercialConfig);
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
    toggleWorkshop(workshopId);
  };
  const toggleCatalogFilters = () => {
    setFiltersOpen((current) => !current);
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
    if (!alreadySelected && window.matchMedia("(max-width: 820px)").matches) {
      window.requestAnimationFrame(() => {
        window.requestAnimationFrame(() => {
          const card = document.querySelector<HTMLElement>(`[data-workshop-id="${CSS.escape(workshop.id)}"]`);
          const fixedBar = commandBarRef.current;
          if (!card || !fixedBar?.classList.contains("is-fixed")) return;
          const minimumTop = fixedBar.getBoundingClientRect().bottom + 12;
          const cardTop = card.getBoundingClientRect().top;
          if (cardTop < minimumTop) window.scrollBy({ top: cardTop - minimumTop, behavior: "smooth" });
        });
      });
    }
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
  const toggleWorkshopFilterTopic = (topicId: string) => {
    setWorkshopFilters((current) => ({
      ...current,
      topics: current.topics.includes(topicId)
        ? current.topics.filter((id) => id !== topicId)
        : [...current.topics, topicId],
    }));
  };
  const selectAllTopics = () => {
    setActiveTopics(topics.map((item) => item.id));
    setActiveThemes([...new Set(topics.flatMap((item) => item.themes.map((theme) => theme.id)))]);
    setClientStep("Workshop");
  };
  const clearWorkshopDiscovery = () => {
    setWorkshopFilters({ topics: [], format: "all" });
    setCatalogSort("editorial");
    setSearchQuery("");
  };
  const resetWorkshopDiscovery = () => {
    setActiveTopics(topics.map((item) => item.id));
    setActiveThemes([...new Set(topics.flatMap((item) => item.themes.map((theme) => theme.id)))]);
    clearWorkshopDiscovery();
    setFiltersOpen(false);
  };
  const currentSurveyQuestion = surveyQuestions[surveyIndex];
  const currentSurveyAnswers = surveyAnswers[currentSurveyQuestion.id] ?? [];
  const surveyProgress = Math.round(((surveyIndex + 1) / surveyQuestions.length) * 100);
  const allSelectedSurveyAnswers = surveyQuestions.flatMap((question) => {
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
  const selectedOutcome = (surveyAnswers.outcome?.[0] === "avanzata" || surveyAnswers.outcome?.[0] === "completa"
    ? surveyAnswers.outcome[0]
    : "sensibilizzazione") as SurveyProfile["outcome"];
  const requestedFormat: SurveyProfile["requestedFormat"] =
    surveyAnswers.format?.[0] === "in-person"
      ? "in-person"
      : surveyAnswers.format?.[0] === "online"
        ? "online"
        : "recommend";
  const surveyProfile = useMemo(
    () =>
      buildSurveyRecommendation({
        topicIds: resultTopicIds,
        outcome: selectedOutcome,
        employees: surveyAnswers.employees?.[0] ?? "",
        requestedFormat,
        budget: surveyAnswers.budget?.[0] ?? "unknown",
        workshops,
        bundles,
        commercialConfig,
      }),
    [bundles, commercialConfig, requestedFormat, resultTopicIds.join("|"), selectedOutcome, surveyAnswers.budget, surveyAnswers.employees, workshops],
  );
  const resultWorkshops = surveyProfile.recommendedWorkshopIds
    .map((workshopId) => workshops.find((workshop) => workshop.id === workshopId))
    .filter(Boolean) as Workshop[];
  const resultBundle = bundles.find((bundle) => bundle.id === surveyProfile.recommendedBundleId);
  const outcomeLabel = surveyQuestions.find((question) => question.id === "outcome")?.answers.find((answer) => surveyAnswers.outcome?.includes(answer.id))?.label ?? "Sensibilizzazione";
  const employeesLabel = surveyQuestions.find((question) => question.id === "employees")?.answers.find((answer) => surveyAnswers.employees?.includes(answer.id))?.label ?? "Da definire";
  const formatLabel = surveyQuestions.find((question) => question.id === "format")?.answers.find((answer) => surveyAnswers.format?.includes(answer.id))?.label ?? "Consigliato da FunniFin";
  const budgetLabel = surveyQuestions.find((question) => question.id === "budget")?.answers.find((answer) => surveyAnswers.budget?.includes(answer.id))?.label ?? "Non ancora definito";
  const topicProfileLabel =
    surveyQuestions
      .find((question) => question.id === "topics")
      ?.answers.filter((answer) => surveyAnswers.topics?.includes(answer.id))
      .map((answer) => answer.label)
      .join(", ") || "Da definire";
  const profileGridItems = [
    { label: "Ambiti prioritari", value: topicProfileLabel },
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
    setActiveTopics(topics.map((topic) => topic.id));
    setActiveThemes([...new Set(topics.flatMap((topic) => topic.themes.map((theme) => theme.id)))]);
    clearWorkshopDiscovery();
    setFiltersOpen(false);
    setCatalogMode("none");
    setClientJourneyStage("manual");
    setClientStep("Workshop");
  };
  const startGuidedJourney = (preserveCatalog = false) => {
    setChoiceSheet(null);
    setSurveyGateStep(null);
    setPreserveCatalogAfterSurvey(preserveCatalog);
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
    if (surveyIndex < surveyQuestions.length - 1) {
      setSurveyIndex(surveyIndex + 1);
      setTopicPointer(null);
      scrollSurveyQuestionTop();
      return;
    }
    if (preserveCatalogAfterSurvey) {
      setActiveTopics(resultTopicIds);
      setActiveThemes(resultThemeIds);
    } else {
      applyGuidedProfile();
    }
    setSurveyCompleted(true);
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
    const recommendedBundle = bundles.find((bundle) => bundle.id === surveyProfile.recommendedBundleId);
    if (recommendedBundle) {
      selectBundle(recommendedBundle, requestedFormat === "online" ? "webinar" : undefined);
    } else {
      addWorkshops(resultWorkshops.map((workshop) => workshop.id), {
        format: requestedFormat === "online" ? "webinar" : undefined,
      });
    }
    resultWorkshops.forEach((workshop) => {
      updateSelection(workshop.id, {
        ...(requestedFormat === "online" ? { format: "webinar" as Format } : {}),
        recordingIncluded: commercialConfig.recordingDefault,
      });
    });
    setSelectedSurveyProfile(surveyProfile);
    setClientJourneyStage("manual");
    setClientStep(resultWorkshops.some((workshop) => workshop.customAvailable) ? "Personalizza" : "Date");
  };
  const openGuidedCatalog = () => {
    setActiveTopics(resultTopicIds);
    setActiveThemes(resultThemeIds);
    if (!preserveCatalogAfterSurvey) {
      clearWorkshopDiscovery();
      setCatalogMode(surveyProfile.recommendedBundleId ? "bundles" : "none");
    }
    setClientJourneyStage("manual");
    setClientStep("Workshop");
  };
  const handleClientStep = (step: string) => {
    if (!surveyCompleted && (step === "Interessi" || step === "Consigliati")) {
      setSurveyGateStep(step);
      return;
    }
    setClientStep(step);
    if (step === "Personalizza") {
      debugNotify("Personalizzazione su misura", "Qui decidi se aggiungere il lavoro di co-design FunniFin con i nostri esperti.");
      return;
    }
    debugNotify("Step selezionato", `${step}: vai alla sezione operativa.`);
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
        label: "Continua al catalogo",
        disabled: recommendedBundles.length === 0 && recommendedWorkshops.length === 0,
        action: () => setClientStep("Workshop"),
      };
    }
    if (clientStep === "Workshop") return {
      label: hasCustomizableSelections ? "Personalizza percorso" : "Procedi",
      disabled: selectedWorkshopRows.length === 0,
      action: goNext,
    };
    if (clientStep === "Personalizza") return { label: "Procedi", disabled: selectedWorkshopRows.length === 0, action: goNext };
    if (clientStep === "Date") return { label: "Materiali opzionali", disabled: !allDatesSelected && !datesDeferred, action: goNext };
    if (clientStep === "Materiali") return { label: uploadedAssets.length > 0 ? "Vai all'invio" : "Salta e vai all'invio", disabled: false, action: goNext };
    if (requestFinalized) return { label: "Richiesta inviata", disabled: true, action: () => {} };
    return { label: "Invia richiesta", disabled: sendingRequest || selectedWorkshopRows.length === 0, action: () => void submitRequest() };
  })();
  useEffect(() => {
    if (systemSettingsToken === 0) return;
    setClientStep(selectedWorkshopRows.length > 0 && hasCustomizableSelections ? "Personalizza" : "Workshop");
  }, [systemSettingsToken]);
  useEffect(() => {
    if (clientStep !== "Personalizza" || hasCustomizableSelections) return;
    setClientStep(selectedWorkshopRows.length > 0 ? "Date" : "Workshop");
  }, [clientStep, hasCustomizableSelections, selectedWorkshopRows.length]);
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
        action: () => startGuidedJourney(),
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
          <img className="guided-brand-lockup" src="/funnifin-logo.svg" alt="FunniFin" />
          <h1 id="client-entry-title">
            Costruisci il <span>piano formativo</span> più adatto alla tua azienda
          </h1>
          <p>Scegli se partire da una proposta guidata oppure esplorare il catalogo completo. Potrai modificare workshop, esperti, date e costi in qualsiasi momento.</p>
        </div>
        <div className="guided-choice-grid">
          <article className="guided-choice-card recommended" aria-label="Percorso guidato consigliato">
            <BadgeCheck className="guided-choice-bg-icon" aria-hidden="true" />
            <button
              type="button"
              className="guided-card-info-button"
              onClick={() => setChoiceSheet("guided")}
              aria-label="Mostra i dettagli del percorso guidato"
              title="Dettagli percorso guidato"
            >
              <InfoIcon size={18} aria-hidden="true" />
            </button>
            <div className="guided-card-topline">
              <span className="guided-card-badge">Consigliato</span>
              <span className="guided-card-time">~2 minuti</span>
            </div>
            <div>
              <strong>Percorso guidato</strong>
              <p>Rispondi a poche domande e ricevi una proposta già pronta, basata su obiettivi, popolazione aziendale e priorità formative.</p>
              <ul className="guided-choice-benefits" aria-label="Vantaggi percorso guidato">
                <li><Check size={16} aria-hidden="true" /> Proposta iniziale generata in pochi minuti</li>
                <li><Check size={16} aria-hidden="true" /> Ambiti suggeriti in base alle esigenze aziendali</li>
                <li><Check size={16} aria-hidden="true" /> Workshop modificabili dopo la generazione</li>
              </ul>
            </div>
            <footer>
              <span>Scelta rapida con proposta FunniFin</span>
              <AppButton className="guided-primary-cta" onClick={() => startGuidedJourney()} rightIcon={<ArrowRight size={17} />}>
                Inizia percorso guidato
              </AppButton>
            </footer>
            <AppButton className="guided-mobile-cta" onClick={() => startGuidedJourney()} rightIcon={<ArrowRight size={17} />}>
              Inizia percorso guidato
            </AppButton>
          </article>
          <article className="guided-choice-card secondary" aria-label="Catalogo completo">
            <BookOpen className="guided-choice-bg-icon" aria-hidden="true" />
            <button
              type="button"
              className="guided-card-info-button"
              onClick={() => setChoiceSheet("catalog")}
              aria-label="Mostra i dettagli del catalogo completo"
              title="Dettagli catalogo completo"
            >
              <InfoIcon size={18} aria-hidden="true" />
            </button>
            <div className="guided-card-topline">
              <span className="guided-card-badge neutral">Manuale</span>
              <span className="guided-card-time">~5 minuti</span>
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
            <AppButton className="guided-mobile-cta" variant="secondary" onClick={startManualJourney} rightIcon={<ArrowRight size={17} />}>
              Esplora catalogo
            </AppButton>
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
          <strong>{currentSurveyQuestion.id === "topics" ? "Ambiti" : currentSurveyQuestion.title}</strong>
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
                  {selected && <Check className="survey-option-check" size={20} aria-hidden="true" />}
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
            <em>{surveyIndex + 1} su {surveyQuestions.length}</em>
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
          <p>Analizziamo obiettivi, ambiti e formato.</p>
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
              <div><dt>Ambiti prioritari</dt><dd>{resultTopicTitles.join(", ")}</dd></div>
              <div><dt>Dipendenti</dt><dd>{employeesLabel}</dd></div>
              <div><dt>Formato</dt><dd>{formatLabel}</dd></div>
              <div><dt>Budget</dt><dd>{budgetLabel}</dd></div>
            </dl>
          </article>
          {resultBundle ? (
            <div className="guided-bundle-recommendation">
              <span className="eyebrow">Pacchetto consigliato</span>
              <BundleCard
                bundle={resultBundle}
                workshops={workshops}
                commercialConfig={commercialConfig}
                selected={false}
                onSelect={addGuidedWorkshops}
                onOpenWorkshop={(workshop) => {
                  openGuidedCatalog();
                  setCatalogMode("workshops");
                  setSearchQuery(workshop.title);
                }}
              />
              <p className="guided-recommendation-reason">{surveyProfile.reason}</p>
            </div>
          ) : (
            <div className="guided-workshop-stack">
              {resultWorkshops.map((workshop) => {
              const topic = topics.find((item) => workshopTopicIds(workshop).includes(item.id));
              const previewFormat = requestedFormat === "online" ? "webinar" : workshop.formatOptions[0];
              const previewPrice = getWorkshopSelectionPrice(
                workshop,
                {
                  duration: workshop.durationOptions[0],
                  format: previewFormat,
                  custom: false,
                  recordingIncluded: commercialConfig.recordingDefault,
                },
                commercialConfig,
              ).total;
              return (
                <article className="guided-workshop-card" key={workshop.id}>
                  <span className={`card-taxonomy-eyebrow topic-outline-badge ${topicColorClass(topic?.id ?? "all")}`}>
                    {topic?.title ?? "Workshop consigliato"}
                  </span>
                  <strong>{workshop.title}</strong>
                  <p>{workshop.short}</p>
                  <em>{workshop.durationOptions[0]} · {previewFormat === "webinar" ? "Online" : "In presenza"} · {money(previewPrice)}</em>
                </article>
              );
              })}
              <p className="guided-recommendation-reason">{surveyProfile.reason}</p>
            </div>
          )}
        </div>
        <BottomActionBar
          className="client-bottom-bar guided-result-bottom"
          context={`Match ${matchScore}%`}
          detail={resultBundle ? resultBundle.title : `${resultWorkshops.length} workshop consigliati`}
          primaryLabel={resultBundle ? "Aggiungi il pacchetto consigliato" : "Aggiungi i workshop consigliati"}
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
    <section className="view-stack client-planner-view" aria-label="Planner workshop cliente FunniFin">
      <RoleHero
        className="client-path-hero"
        eyebrow="Crea il tuo percorso FunniFin"
        title="Scegli gli ambiti, proponi date e ricevi la conferma dal team."
        actions={
          <>
            <ToolIconButton
              onClick={() => {
                setChoiceSheet(null);
                setClientJourneyStage("choice");
              }}
              label="Torna alla scelta guidata/manuale"
            >
              <Sparkles size={22} />
            </ToolIconButton>
            <ToolIconButton
              onClick={() => {
                setClientStep("Date");
              }}
              label="Vai alle date"
            >
              <CalendarCheck size={22} />
            </ToolIconButton>
          </>
        }
      />

      <QuoteStrip
        selections={selections}
        quote={quote}
        coveredTopics={coveredTopics}
        totalHours={totalHours}
        onCta={() => setClientStep("Invio")}
      />

      <div className="client-commerce">
        <div className="client-shop">
      <Stepper
        steps={clientSteps}
        activeStep={clientStep}
        completedSteps={clientCompletedSteps}
        gatedSteps={!surveyCompleted ? new Set(["Interessi", "Consigliati"]) : undefined}
        onStep={handleClientStep}
      >

      {clientStep === "Interessi" && (
          <Panel>
            <SectionTitle
              title="Scegli gli ambiti di interesse"
              icon={<span className="section-title-emoji" aria-hidden="true">🧭</span>}
            />
            <div className="catalog-display-toolbar">
              <span>{topics.length} ambiti · {workshops.length} workshop</span>
            </div>
            <div className="topic-grid">
              <article className="topic-card all-topics-card topic-color-all" aria-labelledby="all-catalog-title">
                <div className="topic-card-main all-topics-main">
                  <span className="topic-icon"><BookOpen size={22} /></span>
                  <span className="topic-card-copy">
                    <strong id="all-catalog-title">Tutto il catalogo</strong>
                    <small>Vai direttamente al catalogo completo.</small>
                  </span>
                  <span className="topic-badge">vedi tutti</span>
                  <em className="topic-card-meta">{topics.length} ambiti · {workshops.length} workshop</em>
                </div>
                <AppButton className="all-topics-cta" variant="secondary" onClick={selectAllTopics} rightIcon={<ArrowRight size={16} />}>
                  Apri catalogo
                </AppButton>
              </article>
              {topics.map((topicItem) => {
                const themeIds = topicItem.themes.map((theme) => theme.id);
                const count = workshops.filter((workshop) => workshopTopicIds(workshop).includes(topicItem.id) || themeIds.includes(workshop.themeId)).length;
                const selected = activeTopics.includes(topicItem.id);
                return (
                  <article
                    key={topicItem.id}
                    className={`topic-card ${topicColorClass(topicItem.id)} ${selected ? "selected" : ""}`}
                  >
                    <button className="topic-card-main" type="button" onClick={() => toggleTopic(topicItem)}>
                      <span className="topic-icon">{iconFor(topicItem.icon)}</span>
                      <span className="topic-card-copy">
                        <strong>{topicItem.title}</strong>
                        <small>{topicItem.description}</small>
                      </span>
                      {selected ? (
                        <span className="topic-selection-indicator" aria-hidden="true"><Check size={16} /></span>
                      ) : (
                        topicItem.badge !== "base" && <span className="topic-badge">{topicItem.badge}</span>
                      )}
                      <em className="topic-card-meta"><Presentation size={14} /> {count} workshop</em>
                    </button>
                  </article>
                );
              })}
            </div>
          </Panel>
      )}

      {clientStep === "Consigliati" && (
          <Panel>
            <SectionTitle
              title="Percorsi consigliati"
              icon={<span className="section-title-emoji" aria-hidden="true">✨</span>}
            />
            <div className="recommendation-intro">
              <div>
                <span className="eyebrow">Dati dagli interessi scelti</span>
                <strong>Parti da un pacchetto coerente oppure scegli i singoli workshop.</strong>
                <p>
                  Nulla viene aggiunto automaticamente: confronta i percorsi FunniFin e scegli la soluzione più adatta.
                </p>
              </div>
              <div className="recommendation-meter">
                <span>{selectedTopics.length} interessi</span>
                <strong>{recommendedBundles.length} pacchetti coerenti</strong>
                {selectedRecommendationCount > 0
                  ? <em>{selectedRecommendationCount}/{recommendedWorkshops.length} già nel percorso</em>
                  : <em>{recommendedWorkshops.length} workshop alternativi</em>
                }
              </div>
            </div>
            {recommendedBundles.length > 0 && (
              <section className="catalog-result-section recommendation-section" aria-labelledby="recommended-bundles-title">
                <div className="catalog-result-heading">
                  <div>
                    <span className="eyebrow">Proposta principale</span>
                    <h3 id="recommended-bundles-title">Pacchetti più coerenti</h3>
                  </div>
                  <span>{recommendedBundles.length} risultati</span>
                </div>
                <div className="bundle-grid">
                  {recommendedBundles.map((bundle) => (
                    <BundleCard
                      key={bundle.id}
                      bundle={bundle}
                      workshops={workshops}
                      commercialConfig={commercialConfig}
                      selected={selectedBundleIds.has(bundle.id)}
                      onSelect={() => selectBundle(bundle, selectedSurveyProfile?.requestedFormat === "online" ? "webinar" : undefined)}
                      onOpenWorkshop={(workshop) => {
                        setClientStep("Workshop");
                        setCatalogMode("workshops");
                        setSearchQuery(workshop.title);
                        window.requestAnimationFrame(() =>
                          document.querySelector<HTMLElement>(`[data-workshop-id="${CSS.escape(workshop.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }),
                        );
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
            {recommendedWorkshops.length > 0 && (
              <section className="catalog-result-section recommendation-section" aria-labelledby="recommended-workshops-title">
                <div className="catalog-result-heading">
                  <div>
                    <span className="eyebrow">Alternativa flessibile</span>
                    <h3 id="recommended-workshops-title">Workshop singoli consigliati</h3>
                  </div>
                  <span>{recommendedWorkshops.length} risultati</span>
                </div>
                <div className="recommendation-grid">
                  {recommendedWorkshops.map((workshop) => {
                    const topic = topics.find((item) => workshopTopicIds(workshop).includes(item.id));
                    const selected = selections.some((selection) => selection.workshopId === workshop.id);
                    return (
                      <article className={`recommendation-card ${selected ? "selected" : ""}`} key={workshop.id}>
                        <div>
                          <span className={`card-taxonomy-eyebrow topic-outline-badge ${topicColorClass(topic?.id ?? "all")}`}>
                            {topic?.title ?? "Workshop consigliato"}
                          </span>
                          {selected && <span className="catalog-status active">nel percorso</span>}
                        </div>
                        <strong>{workshop.title}</strong>
                        <ExpandableCardText text={workshop.short} />
                        <em className="recommendation-card-context eyebrow">
                          {workshop.durationOptions[0]} · {workshop.formatOptions[0] === "webinar" ? "Online" : "In presenza"} · Livello {workshop.level}
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
              </section>
            )}
            {recommendedBundles.length === 0 && recommendedWorkshops.length === 0 && (
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
              icon={<span className="section-title-emoji" aria-hidden="true">🎓</span>}
            />
            <div ref={commandBarAnchorRef} className="workshop-command-anchor" aria-hidden="true" />
            <div
              className={`workshop-command-slot ${commandBarFixed ? "is-fixed" : ""}`}
              style={commandBarFixed ? { minHeight: commandBarHeight } : undefined}
            >
              <div ref={commandBarRef} className={`workshop-command-bar ${commandBarFixed ? "is-fixed" : ""}`}>
                <div className="catalog-mode-pills" aria-label="Filtra il tipo di proposta">
                  <button
                    type="button"
                    className={catalogMode === "bundles" || catalogMode === "all" ? "active" : ""}
                    aria-pressed={catalogMode === "bundles" || catalogMode === "all"}
                    onClick={() =>
                      setCatalogMode((current) =>
                        current === "none"
                          ? "bundles"
                          : current === "bundles"
                            ? "none"
                            : current === "workshops"
                              ? "all"
                              : "workshops",
                      )
                    }
                  >
                    Pacchetti <span>{activeBundles.length}</span>
                  </button>
                  <button
                    type="button"
                    className={catalogMode === "workshops" || catalogMode === "all" ? "active" : ""}
                    aria-pressed={catalogMode === "workshops" || catalogMode === "all"}
                    onClick={() =>
                      setCatalogMode((current) =>
                        current === "none"
                          ? "workshops"
                          : current === "workshops"
                            ? "none"
                            : current === "bundles"
                              ? "all"
                              : "bundles",
                      )
                    }
                  >
                    Workshop <span>{filteredWorkshops.length}</span>
                  </button>
                </div>
                <div className="workshop-command-controls">
                  <label className="search-field" aria-label="Cerca workshop">
                    <Search size={20} />
                    <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca nel catalogo" />
                    {searchQuery && (
                      <button type="button" onClick={() => setSearchQuery("")} aria-label="Cancella ricerca">
                        <X size={20} />
                      </button>
                    )}
                  </label>
                  <div className="workshop-command-actions">
                    <button
                      type="button"
                      className={filtersOpen || activeOffcanvasControlCount > 0 ? "active" : ""}
                      onClick={toggleCatalogFilters}
                      aria-label={filtersOpen ? "Chiudi filtri catalogo" : "Apri filtri catalogo"}
                      title={filtersOpen ? "Chiudi filtri" : "Apri filtri"}
                    >
                      <SlidersHorizontal size={17} />
                      <strong>Filtri</strong>
                      <em>
                        {activeOffcanvasControlCount > 0
                          ? `${activeOffcanvasControlCount} attivi`
                          : filtersOpen
                            ? "Aperti"
                            : "Inattivi"}
                      </em>
                    </button>
                  </div>
                </div>
                <div className="workshop-command-summary">
                  <strong>
                    {catalogMode === "bundles"
                      ? `${filteredBundles.length} pacchetti`
                      : catalogMode === "workshops"
                        ? `${filteredWorkshops.length} workshop`
                        : `${filteredBundles.length} pacchetti · ${filteredWorkshops.length} workshop`}
                  </strong>
                  <span aria-hidden="true">·</span>
                  <span className="workshop-command-view-label">
                    {catalogMode === "all" || catalogMode === "none" ? "Tutte le proposte FunniFin" : "Vista filtrata per tipologia"}
                  </span>
                  <span className="workshop-command-view-label-mobile">
                    {catalogMode === "all" || catalogMode === "none" ? "Tutte le proposte" : "Per tipologia"}
                  </span>
                  {selectedWorkshopRows.length > 0 && (
                    <>
                      <span aria-hidden="true">·</span>
                      <em className="workshop-command-summary-selected">
                        {selectedWorkshopRows.length} {selectedWorkshopRows.length === 1 ? "selezionato" : "selezionati"}
                      </em>
                    </>
                  )}
                </div>
                {activeOffcanvasControlCount > 0 && (
                  <div className="workshop-command-filter-chips" aria-label="Filtri e ordinamento applicati">
                    {workshopFilters.topics.map((topicId) => {
                      const topicItem = topics.find((item) => item.id === topicId);
                      if (!topicItem) return null;
                      return (
                        <button key={topicId} type="button" className={topicColorClass(topicId)} onClick={() => toggleWorkshopFilterTopic(topicId)}>
                          {topicItem.title}<X size={13} aria-hidden="true" />
                        </button>
                      );
                    })}
                    {workshopFilters.format !== "all" && (
                      <button type="button" onClick={() => setWorkshopFilters((current) => ({ ...current, format: "all" }))}>
                        {formatFilterOptions.find((option) => option.value === workshopFilters.format)?.label}<X size={13} aria-hidden="true" />
                      </button>
                    )}
                    {catalogSort !== "editorial" && (
                      <button type="button" onClick={() => setCatalogSort("editorial")}>
                        {catalogSortOptions.find((option) => option.value === catalogSort)?.label}<X size={13} aria-hidden="true" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
            {filtersOpen && (
              <button
                type="button"
                className="workshop-filter-backdrop"
                aria-label="Chiudi pannello filtri"
                onClick={() => setFiltersOpen(false)}
              />
            )}
            <div
              className={`workshop-filter-shell ${filtersOpen ? "open" : "closed"} ${commandBarFixed ? "is-command-fixed" : ""}`}
              role={filtersOpen ? "dialog" : undefined}
              aria-modal={filtersOpen ? true : undefined}
              aria-label={filtersOpen ? "Filtri catalogo" : undefined}
              style={{
                "--fixed-command-height": `${commandBarHeight}px`,
              } as React.CSSProperties}
            >
              {filtersOpen && (
                <div className="filter-panel">
                  <div className="filter-panel-head">
                    <div className="filter-panel-title-row">
                      <div>
                        <strong>Filtri catalogo</strong>
                        <span>Scegli ambito e formato. La ricerca resta attiva sopra.</span>
                      </div>
                      <button
                        type="button"
                        className="filter-panel-close"
                        onClick={() => setFiltersOpen(false)}
                        aria-label="Chiudi filtri"
                        title="Chiudi filtri"
                      >
                        <X size={20} />
                      </button>
                    </div>
                    <div>
                      <button onClick={clearWorkshopDiscovery} disabled={!searchQuery && activeOffcanvasControlCount === 0}>
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
                    <span>Ambiti del filtro</span>
                    <strong>{workshopFilters.topics.length > 0 ? `${workshopFilters.topics.length} selezionati` : "Tutti gli ambiti"}</strong>
                  </div>
                  <div className="workshop-filters">
                    <fieldset className="workshop-topic-filter">
                      <legend>Ambito</legend>
                      <div className="workshop-topic-filter-grid">
                        {topics.map((topicItem) => {
                          const selected = workshopFilters.topics.includes(topicItem.id);
                          return (
                            <button
                              key={topicItem.id}
                              type="button"
                              className={`${topicColorClass(topicItem.id)} ${selected ? "active" : ""}`}
                              aria-pressed={selected}
                              onClick={() => toggleWorkshopFilterTopic(topicItem.id)}
                            >
                              <span>{topicItem.title}</span>
                              {selected && <Check size={15} aria-hidden="true" />}
                            </button>
                          );
                        })}
                      </div>
                    </fieldset>
                    <label>
                      Formato
                      <select value={workshopFilters.format} onChange={(event) => setWorkshopFilters((current) => ({ ...current, format: event.target.value }))}>
                        {formatFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                    <label>
                      Ordina per
                      <select value={catalogSort} onChange={(event) => setCatalogSort(event.target.value as CatalogSort)}>
                        {catalogSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                      </select>
                    </label>
                  </div>
                  <div className="active-filter-row">
                    <span>
                      {hasCatalogQuery || allCatalogActive
                        ? `${filteredWorkshops.length} risultati su tutto il catalogo.`
                        : `${filteredWorkshops.length} risultati dagli interessi selezionati.`}
                    </span>
                    <em>{activeOffcanvasControlCount || searchQuery ? "Filtri applicati" : "Nessun filtro extra"}</em>
                  </div>
                </div>
              )}
            </div>
            {(catalogMode === "none" || catalogMode === "all" || catalogMode === "bundles") && (
              <section className="catalog-result-section" aria-labelledby="bundle-results-title">
                <div className="catalog-result-heading">
                  <div>
                    <span className="eyebrow">Pacchetti pronti</span>
                    <h3 id="bundle-results-title">Percorsi curati con prezzo dedicato</h3>
                  </div>
                  <span>{filteredBundles.length} risultati</span>
                </div>
                <div className="bundle-grid">
                  {filteredBundles.map((bundle) => (
                    <BundleCard
                      key={bundle.id}
                      bundle={bundle}
                      workshops={workshops}
                      commercialConfig={commercialConfig}
                      selected={selectedBundleIds.has(bundle.id)}
                      onSelect={() => selectBundle(bundle, selectedSurveyProfile?.requestedFormat === "online" ? "webinar" : undefined)}
                      onOpenWorkshop={(workshop) => {
                        setCatalogMode("workshops");
                        setSearchQuery(workshop.title);
                        window.requestAnimationFrame(() => document.querySelector<HTMLElement>(`[data-workshop-id="${CSS.escape(workshop.id)}"]`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
                      }}
                    />
                  ))}
                </div>
                {filteredBundles.length === 0 && <p className="empty-selection">Nessun pacchetto corrisponde alla ricerca.</p>}
              </section>
            )}
            {(catalogMode === "none" || catalogMode === "all" || catalogMode === "workshops") && (
              <section className="catalog-result-section" aria-labelledby="workshop-results-title">
                <div className="catalog-result-heading">
                  <div>
                    <span className="eyebrow">Catalogo workshop</span>
                    <h3 id="workshop-results-title">Scegli anche singoli workshop</h3>
                  </div>
                  <span>{filteredWorkshops.length} risultati</span>
                </div>
                <div className="workshop-grid">
                  {filteredWorkshops.map((workshop) => {
                    const selection = selections.find((item) => item.workshopId === workshop.id);
                    const memberships = activeBundles.filter((bundle) => bundle.workshopIds.includes(workshop.id));
                    return (
                      <WorkshopCard
                        key={workshop.id}
                        workshop={workshop}
                        selection={selection}
                        topics={topics}
                        commercialConfig={commercialConfig}
                        bundleMemberships={memberships}
                        onOpenBundle={(bundle) => {
                          setCatalogMode("bundles");
                          setSearchQuery("");
                          window.requestAnimationFrame(() => document.getElementById(`bundle-${bundle.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }));
                        }}
                        onToggle={(event) => toggleWorkshopWithFeedback(workshop, event)}
                        onChange={(patch) => updateSelection(workshop.id, patch)}
                        onCustomRequest={() => openCustomRequest(workshop)}
                        onCustomInfo={() => showCustomModal(workshop)}
                      />
                    );
                  })}
                </div>
                {filteredWorkshops.length === 0 && <p className="empty-selection">Nessun workshop con questi filtri. Usa “Tutto il catalogo”.</p>}
              </section>
            )}
          </Panel>
      )}

      {clientStep === "Personalizza" && (
          <Panel>
            <SectionTitle
              title="Personalizzazione su misura"
              icon={<span className="section-title-emoji" aria-hidden="true">✍️</span>}
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
      )}

      {clientStep === "Date" && (
          <Panel>
            <SectionTitle
              title="Quando vuoi definire le date?"
              icon={<span className="section-title-emoji" aria-hidden="true">📅</span>}
            />
            {selectedWorkshopRows.length === 0 ? (
              <EmptyWorkflowState
                title="Nessun workshop da pianificare"
                body="Aggiungi workshop al percorso, poi torna qui per scegliere le date."
                cta="Vai ai workshop"
                onClick={() => setClientStep("Workshop")}
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
                  <span>
                    <strong>Le conosco già</strong>
                    <small>Inseriscile ora per ciascun workshop.</small>
                  </span>
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
                  <span>
                    <strong>Le definirò in seguito</strong>
                    <small>Invia la richiesta e concordale poi con FunniFin.</small>
                  </span>
                </button>
              </div>
              {datePlanningMode === "later" && (
                <div className="date-planning-confirmation" role="status">
                  <span><Check size={18} /></span>
                  <div>
                    <strong>Perfetto, le date restano da concordare</strong>
                    <small>FunniFin le verificherà insieme a esperti e fattibilità operativa.</small>
                  </div>
                </div>
              )}
              {datePlanningMode === "now" && (
                <>
                <div className="date-list-intro">
                  <strong>Scegli una data per ogni workshop</strong>
                  <span>Potrai modificarle finché la richiesta non viene inviata.</span>
                </div>
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
                </>
              )}
              </>
            )}
          </Panel>
      )}

      {clientStep === "Materiali" && (
          <Panel>
            <SectionTitle
              title="Logo e note cliente facoltativi"
              icon={<span className="section-title-emoji" aria-hidden="true">🖼️</span>}
            />
          <div className="upload-box">
            <UploadCloud size={32} />
            <strong>Carica il logo aziendale</strong>
            <span>
              È facoltativo. Puoi selezionare un’immagine, verificarla in anteprima e sostituirla con un clic.
            </span>
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
            <small>Il caricamento non e obbligatorio. Se chiudi o abbandoni senza inviare la richiesta, l'eventuale cartella draft viene spostata nel cestino.</small>
          </div>
          </Panel>
      )}

      {clientStep === "Invio" && (
          <Panel>
            <SectionTitle
              title="Invio richiesta"
              icon={<span className="section-title-emoji" aria-hidden="true">✅</span>}
            />
            <ReadinessPanel rows={selectedWorkshopRows} missingDateRows={missingDateRows} datesDeferred={datesDeferred} />
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
                <div className="approval-card submission-preview-card">
                  <span className="submission-preview-icon" aria-hidden="true">
                    <BadgeCheck size={22} />
                  </span>
                  <div className="submission-preview-copy">
                    <strong>Preventivo pronto per FunniFin</strong>
                    <span>Riceverai un recap via email. FunniFin verificherà date, esperti e fattibilità operativa.</span>
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
        {surveyGateStep && (
          <div className="survey-gate-backdrop" role="presentation" onClick={() => setSurveyGateStep(null)}>
            <section
              className="survey-gate-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="survey-gate-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="survey-gate-close" aria-label="Chiudi" onClick={() => setSurveyGateStep(null)}>
                <X size={19} />
              </button>
              <span className="survey-gate-icon" aria-hidden="true"><Sparkles size={24} /></span>
              <div>
                <span className="eyebrow">Proposta guidata</span>
                <h2 id="survey-gate-title">
                  {surveyGateStep === "Interessi" ? "Definisci prima i tuoi interessi" : "Genera i workshop consigliati"}
                </h2>
                <p>Questa sezione nasce dalle risposte della survey. Completala per ottenere indicazioni pertinenti; il catalogo e il percorso che hai già configurato resteranno invariati.</p>
              </div>
              <div className="survey-gate-actions">
                <AppButton variant="secondary" onClick={() => setSurveyGateStep(null)}>Continua nel catalogo</AppButton>
                <AppButton onClick={() => startGuidedJourney(true)} rightIcon={<ArrowRight size={17} />}>Inizia la survey</AppButton>
              </div>
            </section>
          </div>
        )}
        {dateSubmitGateOpen && (
          <div className="survey-gate-backdrop" role="presentation" onClick={() => setDateSubmitGateOpen(false)}>
            <section
              className="survey-gate-modal"
              role="dialog"
              aria-modal="true"
              aria-labelledby="date-submit-gate-title"
              onClick={(event) => event.stopPropagation()}
            >
              <button type="button" className="survey-gate-close" aria-label="Chiudi" onClick={() => setDateSubmitGateOpen(false)}>
                <X size={19} />
              </button>
              <span className="survey-gate-icon" aria-hidden="true"><Clock3 size={24} /></span>
              <div>
                <span className="eyebrow">Date da definire</span>
                <h2 id="date-submit-gate-title">Quando vuoi scegliere le date?</h2>
                <p>Mancano le date per {missingDateRows.length} {missingDateRows.length === 1 ? "workshop" : "workshop"}. Puoi inserirle ora oppure inviare la richiesta e concordarle in seguito con FunniFin.</p>
              </div>
              <div className="survey-gate-actions date-submit-gate-actions">
                <AppButton
                  variant="secondary"
                  onClick={() => {
                    setDateSubmitGateOpen(false);
                    setDatePlanningMode("now");
                    setDatesDeferred(false);
                    setClientStep("Date");
                  }}
                >
                  Le scelgo ora
                </AppButton>
                <AppButton
                  onClick={() => {
                    setDateSubmitGateOpen(false);
                    setDatePlanningMode("later");
                    setDatesDeferred(true);
                    void submitRequest(true);
                  }}
                  rightIcon={<ArrowRight size={17} />}
                >
                  Le definirò in seguito
                </AppButton>
              </div>
            </section>
          </div>
        )}
        </div>
        <EcommerceCart
          rows={selectedWorkshopRows}
          quote={quote}
          onRemove={removeWorkshop}
          onClear={clearSelections}
          onShare={handleShareCart}
          submitting={sharingCart}
          commercialConfig={commercialConfig}
          expanded={pathSummaryOpen}
          onExpandedChange={setPathSummaryOpen}
        />
      </div>
      <BottomActionBar
        className="client-bottom-bar"
        context={`Step ${activeStepIndex + 1} — ${clientStep}`}
        detail={`${selectedWorkshopRows.length} ${selectedWorkshopRows.length === 1 ? "selezionato" : "selezionati"}`}
        priceBefore={quote.saved > 0 ? money(quote.gross) : undefined}
        priceAfter={money(quote.total)}
        discountLabel={quote.saved > 0 ? `Sconto ${money(quote.saved)}` : undefined}
        caveat={
          quote.bundleTitles?.length
            ? `${quote.bundleTitles.length === 1 ? quote.bundleTitles[0] : `${quote.bundleTitles.length} pacchetti`}: prezzo dedicato applicato`
            : selectedWorkshopRows.length > 0
              ? "Totale calcolato sui workshop selezionati"
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
        onSummaryClick={() => setPathSummaryOpen(true)}
        summaryAriaLabel={`Apri il percorso: ${selectedWorkshopRows.length} workshop, totale ${money(quote.total)}`}
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
