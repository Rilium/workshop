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
} from "lucide-react";
import { createAssetDraftFolder, deleteAssetDraftFolder, uploadAssetFiles, type AssetDraftFolder, type UploadedAsset } from "../../driveAssetService";
import { createWorkshopRequest, type RequestWorkshopRecord, type WorkshopRequestRecord } from "../../requestService";
import { sendWorkshopRequestEmail } from "../../emailService";
import { topics, workshops } from "../../data/catalog";
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
import { SelectedInterestSummary } from "../../components/workshop/SelectedInterestSummary";
import { WorkshopCard } from "../../components/workshop/WorkshopCard";
import { getWorkshopSelectionPrice, topicColorClass } from "../../utils/workshop";

export function ClientView({
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
  onRequestCreated,
}: {
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
  onRequestCreated: (request: WorkshopRequestRecord) => void;
}) {
  const clientSteps = ["Interessi", "Consigliati", "Workshop", "Personalizza", "Date", "Materiali", "Invio"];
  const [clientStep, setClientStep] = useState(clientSteps[0]);
  const [workshopFilters, setWorkshopFilters] = useState({ topic: "all", theme: "all", format: "all" });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sendingRequest, setSendingRequest] = useState(false);
  const [uploadingAssets, setUploadingAssets] = useState(false);
  const [assetUploadError, setAssetUploadError] = useState("");
  const [requestFinalized, setRequestFinalized] = useState(false);
  const [contactTouched, setContactTouched] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [emailDeliveryMode, setEmailDeliveryMode] = useState<"sent" | "not_sent">("not_sent");
  const [flyToBar, setFlyToBar] = useState<{ id: number; title: string; x: number; y: number } | null>(null);
  const [expandedTopicCards, setExpandedTopicCards] = useState<string[]>([]);
  const assetFolderRef = useRef<AssetDraftFolder | null>(null);
  const requestFinalizedRef = useRef(false);
  const [contact, setContact] = useState<ClientContact>({
    firstName: "",
    lastName: "",
    email: "",
    company: "",
    phone: "",
  });
  const selectedTopics = topics.filter((item) => activeTopics.includes(item.id));
  const availableThemes = Array.from(new Map(selectedTopics.flatMap((item) => item.themes).map((theme) => [theme.id, theme])).values());
  const selectedThemes = availableThemes.filter((theme) => activeThemes.includes(theme.id));
  const unselectedThemes = availableThemes.filter((theme) => !activeThemes.includes(theme.id));
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
    notify("Consigli aggiunti", `${recommendedWorkshops.length} workshop consigliati sono nel percorso. Puoi modificarli o sostituirli dal catalogo.`);
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
      if (assetFolderRef.current && !requestFinalizedRef.current) void deleteAssetDraftFolder(assetFolderRef.current.id);
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
      const uploaded = await uploadAssetFiles(folder.id, list);
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
  const removeTopic = (topicId: string) => {
    const nextTopics = activeTopics.filter((id) => id !== topicId);
    const removedThemeIds = topics.find((item) => item.id === topicId)?.themes.map((theme) => theme.id) ?? [];
    setActiveTopics(nextTopics);
    setActiveThemes(activeThemes.filter((themeId) => !removedThemeIds.includes(themeId)));
    notify("Interesse rimosso", "I temi collegati sono stati tolti dal percorso.");
  };
  const removeTheme = (themeId: string) => {
    setActiveThemes(activeThemes.filter((id) => id !== themeId));
    notify("Tema rimosso", "Il tema e stato tolto dai filtri del percorso.");
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
    const count = workshops.filter((workshop) => workshop.topicId === topicItem.id || themeIds.includes(workshop.themeId)).length;
    notify("Interesse aggiunto", `${topicItem.title}: ${topicItem.themes.length} temi e ${count} workshop disponibili.`);
  };
  const selectAllTopics = () => {
    setActiveTopics(topics.map((item) => item.id));
    setActiveThemes([...new Set(topics.flatMap((item) => item.themes.map((theme) => theme.id)))]);
    setClientStep("Workshop");
    notify("Tutto il catalogo", "Salto i consigli: stai esplorando tutto il catalogo, ora scegli i workshop.");
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
    notify("Vedi tutti i workshop", "Filtri azzerati: stai guardando tutto il catalogo.");
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
    notify("Sezione aggiornata", `${section}: dati locali e selezioni riletti nella vista corrente.`);
  };
  useEffect(() => {
    if (systemRefreshToken === 0) return;
    refreshClientSection(clientStep);
  }, [systemRefreshToken]);
  useEffect(() => {
    if (systemSettingsToken === 0) return;
    setClientStep(selectedWorkshopRows.length > 0 ? "Personalizza" : "Workshop");
  }, [systemSettingsToken]);

  return (
    <section className="view-stack">
      <RoleHero
        eyebrow="Crea il tuo percorso FunniFin"
        title="Scegli temi utili, proponi date e ricevi la conferma dal team."
        actions={
          <ToolIconButton
            onClick={() => {
              setClientStep("Date");
              notify("Vai alle date", "Compila almeno una proposta per ogni workshop selezionato.");
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
        onCta={submitRequest}
        submitting={sendingRequest}
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
            notify("Personalizzazione su misura", "Qui decidi se aggiungere il lavoro di co-design FunniFin con i nostri esperti.");
            return;
          }
          notify("Step selezionato", `${step}: vai alla sezione operativa.`);
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
              <button className="topic-card all-topics-card topic-color-all" onClick={selectAllTopics}>
                <span className="topic-icon"><BookOpen size={22} /></span>
                <span className="topic-badge">vedi tutti</span>
                <strong>Tutto il catalogo</strong>
                <small>Salta i consigli e vai direttamente al catalogo completo →</small>
                <em>{allThemes.length} temi catalogo · {workshops.length} workshop</em>
              </button>
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
                      <em>
                        {topicItem.themes.length} temi catalogo · {count} workshop
                      </em>
                    </button>
                    {topicItem.badge !== "base" && <span className="topic-badge">{topicItem.badge}</span>}
                    <div className="topic-theme-preview" aria-label={`Temi ${topicItem.title}`}>
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
            <div className="interest-theme-block">
            {selectedTopics.length === 0 ? (
              <div className="empty-state">
                <strong>Nessun interesse selezionato</strong>
                <span>Scegli almeno un interesse del catalogo per vedere i temi disponibili.</span>
              <AppButton variant="secondary" onClick={selectAllTopics}>
                Scegli interessi
              </AppButton>
              </div>
            ) : (
              <>
            <SelectedInterestSummary topics={selectedTopics} activeThemeIds={activeThemes} onRemoveTopic={removeTopic} onRemoveTheme={removeTheme} />
            <div className="step-toolbar">
              <AppButton
                variant="secondary"
                onClick={() => {
                  setActiveThemes(availableThemes.map((theme) => theme.id));
                  notify("Vedi tutti i temi", "Tutti i temi degli interessi selezionati sono attivi.");
                }}
              >
                Vedi tutti
              </AppButton>
              <AppButton
                variant="ghost"
                onClick={() => {
                  setActiveThemes([]);
                  notify("Temi svuotati", "Nessun tema attivo: puoi selezionarli manualmente.");
                }}
              >
                Svuota
              </AppButton>
            </div>
            <div className="theme-picker-section">
              <div>
                <strong>Aggiungi temi</strong>
                <span>{unselectedThemes.length ? `${unselectedThemes.length} disponibili` : "Tutti i temi degli interessi sono gia selezionati"}</span>
              </div>
              {unselectedThemes.length > 0 && (
                <div className="chip-row">
                  {unselectedThemes.map((theme) => (
                  <button
                    key={theme.id}
                    className="theme-chip"
                    onClick={() => {
                      setActiveThemes([...activeThemes, theme.id]);
                      notify("Tema aggiunto", `${theme.title} aggiunto al percorso.`);
                    }}
                  >
                    <Plus size={15} />
                    {theme.title}
                  </button>
                  ))}
                </div>
              )}
            </div>
              </>
            )}
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
          onSubmit={submitRequest}
          submitting={sendingRequest}
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
