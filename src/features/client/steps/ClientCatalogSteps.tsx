import type { CSSProperties, Dispatch, MouseEvent, ReactNode, RefObject, SetStateAction } from "react";
import { ArrowRight, BookOpen, Check, Plus, Presentation, Search, SlidersHorizontal, X } from "../../../components/ui/FaIcons";
import { AppButton } from "../../../components/ui/AppButton";
import { EmptyWorkflowState } from "../../../components/ui/EmptyWorkflowState";
import { ExpandableCardText } from "../../../components/ui/ExpandableCardText";
import { Panel } from "../../../components/ui/Panel";
import { SectionTitle } from "../../../components/ui/SectionTitle";
import { BundleCard } from "../../../components/workshop/BundleCard";
import { WorkshopCard } from "../../../components/workshop/WorkshopCard";
import type { CatalogBundle, CommercialConfig, Format, Selection, SurveyProfile, Topic, Workshop } from "../../../types/domain";
import { money } from "../../../utils/money";
import { topicColorClass } from "../../../utils/workshop";
import type { CatalogSort } from "../clientFlowState";

function workshopTopicIds(workshop: Workshop) {
  return workshop.topicIds?.length ? workshop.topicIds : [workshop.topicId];
}

export function ClientInterestsStep({
  topics,
  workshops,
  activeTopics,
  renderTopicIcon,
  selectAllTopics,
  toggleTopic,
}: {
  topics: Topic[];
  workshops: Workshop[];
  activeTopics: string[];
  renderTopicIcon: (name: string) => ReactNode;
  selectAllTopics: () => void;
  toggleTopic: (topic: Topic) => void;
}) {
  return (
    <Panel>
      <SectionTitle title="Scegli gli ambiti di interesse" icon={<span className="section-title-emoji" aria-hidden="true">🧭</span>} />
      <div className="catalog-display-toolbar"><span>{topics.length} ambiti · {workshops.length} workshop</span></div>
      <div className="topic-grid">
        <article className="topic-card all-topics-card topic-color-all" aria-labelledby="all-catalog-title">
          <div className="topic-card-main all-topics-main">
            <span className="topic-icon"><BookOpen size={22} /></span>
            <span className="topic-card-copy"><strong id="all-catalog-title">Tutto il catalogo</strong><small>Vai direttamente al catalogo completo.</small></span>
            <span className="topic-badge">vedi tutti</span>
            <em className="topic-card-meta">{topics.length} ambiti · {workshops.length} workshop</em>
          </div>
          <AppButton className="all-topics-cta" variant="secondary" onClick={selectAllTopics} rightIcon={<ArrowRight size={16} />}>Apri catalogo</AppButton>
        </article>
        {topics.map((topicItem) => {
          const themeIds = topicItem.themes.map((theme) => theme.id);
          const count = workshops.filter((workshop) => workshopTopicIds(workshop).includes(topicItem.id) || themeIds.includes(workshop.themeId)).length;
          const selected = activeTopics.includes(topicItem.id);
          return (
            <article key={topicItem.id} className={`topic-card ${topicColorClass(topicItem.id)} ${selected ? "selected" : ""}`}>
              <button className="topic-card-main" type="button" onClick={() => toggleTopic(topicItem)}>
                <span className="topic-icon">{renderTopicIcon(topicItem.icon)}</span>
                <span className="topic-card-copy"><strong>{topicItem.title}</strong><small>{topicItem.description}</small></span>
                {selected
                  ? <span className="topic-selection-indicator" aria-hidden="true"><Check size={16} /></span>
                  : topicItem.badge !== "base" && <span className="topic-badge">{topicItem.badge}</span>}
                <em className="topic-card-meta"><Presentation size={14} /> {count} workshop</em>
              </button>
            </article>
          );
        })}
      </div>
    </Panel>
  );
}

export function ClientRecommendationsStep({
  selectedTopics,
  recommendedBundles,
  recommendedWorkshops,
  selectedRecommendationCount,
  selectedBundleIds,
  workshops,
  topics,
  selections,
  commercialConfig,
  selectedSurveyProfile,
  selectBundle,
  openWorkshop,
  toggleWorkshop,
  onEmpty,
}: {
  selectedTopics: Topic[];
  recommendedBundles: CatalogBundle[];
  recommendedWorkshops: Workshop[];
  selectedRecommendationCount: number;
  selectedBundleIds: Set<string>;
  workshops: Workshop[];
  topics: Topic[];
  selections: Selection[];
  commercialConfig: CommercialConfig;
  selectedSurveyProfile: SurveyProfile | null;
  selectBundle: (bundle: CatalogBundle, format?: "webinar") => void;
  openWorkshop: (workshop: Workshop) => void;
  toggleWorkshop: (workshop: Workshop, event?: MouseEvent<HTMLButtonElement>) => void;
  onEmpty: () => void;
}) {
  return (
    <Panel>
      <SectionTitle title="Percorsi consigliati" icon={<span className="section-title-emoji" aria-hidden="true">✨</span>} />
      <div className="recommendation-intro">
        <div>
          <span className="eyebrow">Dati dagli interessi scelti</span>
          <strong>Parti da un pacchetto coerente oppure scegli i singoli workshop.</strong>
          <p>Nulla viene aggiunto automaticamente: confronta i percorsi FunniFin e scegli la soluzione più adatta.</p>
        </div>
        <div className="recommendation-meter">
          <span>{selectedTopics.length} interessi</span>
          <strong>{recommendedBundles.length} pacchetti coerenti</strong>
          {selectedRecommendationCount > 0
            ? <em>{selectedRecommendationCount}/{recommendedWorkshops.length} già nel percorso</em>
            : <em>{recommendedWorkshops.length} workshop alternativi</em>}
        </div>
      </div>
      {recommendedBundles.length > 0 && (
        <section className="catalog-result-section recommendation-section" aria-labelledby="recommended-bundles-title">
          <div className="catalog-result-heading">
            <div><span className="eyebrow">Proposta principale</span><h3 id="recommended-bundles-title">Pacchetti più coerenti</h3></div>
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
                onOpenWorkshop={openWorkshop}
              />
            ))}
          </div>
        </section>
      )}
      {recommendedWorkshops.length > 0 && (
        <section className="catalog-result-section recommendation-section" aria-labelledby="recommended-workshops-title">
          <div className="catalog-result-heading">
            <div><span className="eyebrow">Alternativa flessibile</span><h3 id="recommended-workshops-title">Workshop singoli consigliati</h3></div>
            <span>{recommendedWorkshops.length} risultati</span>
          </div>
          <div className="recommendation-grid">
            {recommendedWorkshops.map((workshop) => {
              const topic = topics.find((item) => workshopTopicIds(workshop).includes(item.id));
              const selected = selections.some((selection) => selection.workshopId === workshop.id);
              return (
                <article className={`recommendation-card ${selected ? "selected" : ""}`} key={workshop.id}>
                  <div>
                    <span className={`card-taxonomy-eyebrow topic-outline-badge ${topicColorClass(topic?.id ?? "all")}`}>{topic?.title ?? "Workshop consigliato"}</span>
                    {selected && <span className="catalog-status active">nel percorso</span>}
                  </div>
                  <strong>{workshop.title}</strong>
                  <ExpandableCardText text={workshop.short} />
                  <em className="recommendation-card-context eyebrow">{workshop.durationOptions[0]} · {workshop.formatOptions[0] === "webinar" ? "Online" : "In presenza"} · Livello {workshop.level}</em>
                  <footer>
                    <span>{money(workshop.price1h)}</span>
                    <AppButton variant={selected ? "outline" : "secondary"} onClick={(event) => toggleWorkshop(workshop, event)}>
                      {selected ? <Check size={17} /> : <Plus size={17} />}{selected ? "Aggiunto" : "Aggiungi"}
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
          onClick={onEmpty}
        />
      )}
    </Panel>
  );
}

type CatalogMode = "none" | "all" | "bundles" | "workshops";
type WorkshopFilters = { topics: string[]; format: string };

export function ClientWorkshopStep({
  commandBarAnchorRef,
  commandBarRef,
  commandBarFixed,
  commandBarHeight,
  catalogMode,
  setCatalogMode,
  activeBundles,
  filteredBundles,
  filteredWorkshops,
  searchQuery,
  setSearchQuery,
  filtersOpen,
  setFiltersOpen,
  activeOffcanvasControlCount,
  toggleCatalogFilters,
  selectedWorkshopCount,
  workshopFilters,
  setWorkshopFilters,
  catalogSort,
  setCatalogSort,
  catalogSortOptions,
  formatFilterOptions,
  topics,
  toggleWorkshopFilterTopic,
  clearWorkshopDiscovery,
  resetWorkshopDiscovery,
  hasCatalogQuery,
  allCatalogActive,
  selectedBundleIds,
  workshops,
  commercialConfig,
  selectedSurveyProfile,
  selectBundle,
  selections,
  toggleWorkshop,
  updateSelection,
  openCustomRequest,
  showCustomModal,
}: {
  commandBarAnchorRef: RefObject<HTMLDivElement | null>;
  commandBarRef: RefObject<HTMLDivElement | null>;
  commandBarFixed: boolean;
  commandBarHeight: number;
  catalogMode: CatalogMode;
  setCatalogMode: Dispatch<SetStateAction<CatalogMode>>;
  activeBundles: CatalogBundle[];
  filteredBundles: CatalogBundle[];
  filteredWorkshops: Workshop[];
  searchQuery: string;
  setSearchQuery: Dispatch<SetStateAction<string>>;
  filtersOpen: boolean;
  setFiltersOpen: Dispatch<SetStateAction<boolean>>;
  activeOffcanvasControlCount: number;
  toggleCatalogFilters: () => void;
  selectedWorkshopCount: number;
  workshopFilters: WorkshopFilters;
  setWorkshopFilters: Dispatch<SetStateAction<WorkshopFilters>>;
  catalogSort: CatalogSort;
  setCatalogSort: Dispatch<SetStateAction<CatalogSort>>;
  catalogSortOptions: Array<{ value: CatalogSort; label: string }>;
  formatFilterOptions: Array<{ value: string; label: string }>;
  topics: Topic[];
  toggleWorkshopFilterTopic: (topicId: string) => void;
  clearWorkshopDiscovery: () => void;
  resetWorkshopDiscovery: () => void;
  hasCatalogQuery: boolean;
  allCatalogActive: boolean;
  selectedBundleIds: Set<string>;
  workshops: Workshop[];
  commercialConfig: CommercialConfig;
  selectedSurveyProfile: SurveyProfile | null;
  selectBundle: (bundle: CatalogBundle, format?: Format) => void;
  selections: Selection[];
  toggleWorkshop: (workshop: Workshop, event?: MouseEvent<HTMLButtonElement>) => void;
  updateSelection: (workshopId: string, patch: Partial<Selection>) => void;
  openCustomRequest: (workshop: Workshop) => void;
  showCustomModal: (workshop: Workshop) => void;
}) {
  return (
    <Panel>
      <SectionTitle title="Scegli workshop" icon={<span className="section-title-emoji" aria-hidden="true">🎓</span>} />
      <div ref={commandBarAnchorRef} className="workshop-command-anchor" aria-hidden="true" />
      <div className={`workshop-command-slot ${commandBarFixed ? "is-fixed" : ""}`} style={commandBarFixed ? { minHeight: commandBarHeight } : undefined}>
        <div ref={commandBarRef} className={`workshop-command-bar ${commandBarFixed ? "is-fixed" : ""}`}>
          <div className="catalog-mode-pills" aria-label="Filtra il tipo di proposta">
            <button
              type="button"
              className={catalogMode === "bundles" || catalogMode === "all" ? "active" : ""}
              aria-pressed={catalogMode === "bundles" || catalogMode === "all"}
              onClick={() => setCatalogMode((current) => current === "none" ? "bundles" : current === "bundles" ? "none" : current === "workshops" ? "all" : "workshops")}
            >
              Pacchetti <span>{activeBundles.length}</span>
            </button>
            <button
              type="button"
              className={catalogMode === "workshops" || catalogMode === "all" ? "active" : ""}
              aria-pressed={catalogMode === "workshops" || catalogMode === "all"}
              onClick={() => setCatalogMode((current) => current === "none" ? "workshops" : current === "workshops" ? "none" : current === "bundles" ? "all" : "bundles")}
            >
              Workshop <span>{filteredWorkshops.length}</span>
            </button>
          </div>
          <div className="workshop-command-controls">
            <label className="search-field" aria-label="Cerca workshop">
              <Search size={20} />
              <input value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Cerca nel catalogo" />
              {searchQuery && <button type="button" onClick={() => setSearchQuery("")} aria-label="Cancella ricerca"><X size={20} /></button>}
            </label>
            <div className="workshop-command-actions">
              <button
                type="button"
                className={filtersOpen || activeOffcanvasControlCount > 0 ? "active" : ""}
                onClick={toggleCatalogFilters}
                aria-label={filtersOpen ? "Chiudi filtri catalogo" : "Apri filtri catalogo"}
                title={filtersOpen ? "Chiudi filtri" : "Apri filtri"}
              >
                <SlidersHorizontal size={17} /><strong>Filtri</strong>
                <em>{activeOffcanvasControlCount > 0 ? `${activeOffcanvasControlCount} attivi` : filtersOpen ? "Aperti" : "Inattivi"}</em>
              </button>
            </div>
          </div>
          <div className="workshop-command-summary">
            <strong>{catalogMode === "bundles" ? `${filteredBundles.length} pacchetti` : catalogMode === "workshops" ? `${filteredWorkshops.length} workshop` : `${filteredBundles.length} pacchetti · ${filteredWorkshops.length} workshop`}</strong>
            <span aria-hidden="true">·</span>
            <span className="workshop-command-view-label">{catalogMode === "all" || catalogMode === "none" ? "Tutte le proposte FunniFin" : "Vista filtrata per tipologia"}</span>
            <span className="workshop-command-view-label-mobile">{catalogMode === "all" || catalogMode === "none" ? "Tutte le proposte" : "Per tipologia"}</span>
            {selectedWorkshopCount > 0 && <><span aria-hidden="true">·</span><em className="workshop-command-summary-selected">{selectedWorkshopCount} {selectedWorkshopCount === 1 ? "selezionato" : "selezionati"}</em></>}
          </div>
          {activeOffcanvasControlCount > 0 && (
            <div className="workshop-command-filter-chips" aria-label="Filtri e ordinamento applicati">
              {workshopFilters.topics.map((topicId) => {
                const topicItem = topics.find((item) => item.id === topicId);
                return topicItem ? <button key={topicId} type="button" className={topicColorClass(topicId)} onClick={() => toggleWorkshopFilterTopic(topicId)}>{topicItem.title}<X size={13} aria-hidden="true" /></button> : null;
              })}
              {workshopFilters.format !== "all" && <button type="button" onClick={() => setWorkshopFilters((current) => ({ ...current, format: "all" }))}>{formatFilterOptions.find((option) => option.value === workshopFilters.format)?.label}<X size={13} aria-hidden="true" /></button>}
              {catalogSort !== "editorial" && <button type="button" onClick={() => setCatalogSort("editorial")}>{catalogSortOptions.find((option) => option.value === catalogSort)?.label}<X size={13} aria-hidden="true" /></button>}
            </div>
          )}
        </div>
      </div>
      {filtersOpen && <button type="button" className="workshop-filter-backdrop" aria-label="Chiudi pannello filtri" onClick={() => setFiltersOpen(false)} />}
      <div
        className={`workshop-filter-shell ${filtersOpen ? "open" : "closed"} ${commandBarFixed ? "is-command-fixed" : ""}`}
        role={filtersOpen ? "dialog" : undefined}
        aria-modal={filtersOpen ? true : undefined}
        aria-label={filtersOpen ? "Filtri catalogo" : undefined}
        style={{ "--fixed-command-height": `${commandBarHeight}px` } as CSSProperties}
      >
        {filtersOpen && (
          <div className="filter-panel">
            <div className="filter-panel-head">
              <div className="filter-panel-title-row">
                <div><strong>Filtri catalogo</strong><span>Scegli ambito e formato. La ricerca resta attiva sopra.</span></div>
                <button type="button" className="filter-panel-close" onClick={() => setFiltersOpen(false)} aria-label="Chiudi filtri" title="Chiudi filtri"><X size={20} /></button>
              </div>
              <div>
                <button onClick={clearWorkshopDiscovery} disabled={!searchQuery && activeOffcanvasControlCount === 0}><X size={17} />Pulisci</button>
                <button onClick={resetWorkshopDiscovery}><BookOpen size={17} />Tutto il catalogo</button>
              </div>
            </div>
            <div className="filter-compact-summary"><span>Ambiti del filtro</span><strong>{workshopFilters.topics.length > 0 ? `${workshopFilters.topics.length} selezionati` : "Tutti gli ambiti"}</strong></div>
            <div className="workshop-filters">
              <fieldset className="workshop-topic-filter">
                <legend>Ambito</legend>
                <div className="workshop-topic-filter-grid">
                  {topics.map((topicItem) => {
                    const selected = workshopFilters.topics.includes(topicItem.id);
                    return <button key={topicItem.id} type="button" className={`${topicColorClass(topicItem.id)} ${selected ? "active" : ""}`} aria-pressed={selected} onClick={() => toggleWorkshopFilterTopic(topicItem.id)}><span>{topicItem.title}</span>{selected && <Check size={15} aria-hidden="true" />}</button>;
                  })}
                </div>
              </fieldset>
              <label>Formato<select value={workshopFilters.format} onChange={(event) => setWorkshopFilters((current) => ({ ...current, format: event.target.value }))}>{formatFilterOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label>Ordina per<select value={catalogSort} onChange={(event) => setCatalogSort(event.target.value as CatalogSort)}>{catalogSortOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
            </div>
            <div className="active-filter-row">
              <span>{hasCatalogQuery || allCatalogActive ? `${filteredWorkshops.length} risultati su tutto il catalogo.` : `${filteredWorkshops.length} risultati dagli interessi selezionati.`}</span>
              <em>{activeOffcanvasControlCount || searchQuery ? "Filtri applicati" : "Nessun filtro extra"}</em>
            </div>
          </div>
        )}
      </div>
      {(catalogMode === "none" || catalogMode === "all" || catalogMode === "bundles") && (
        <section className="catalog-result-section" aria-labelledby="bundle-results-title">
          <div className="catalog-result-heading"><div><span className="eyebrow">Pacchetti pronti</span><h3 id="bundle-results-title">Percorsi curati con prezzo dedicato</h3></div><span>{filteredBundles.length} risultati</span></div>
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
          <div className="catalog-result-heading"><div><span className="eyebrow">Catalogo workshop</span><h3 id="workshop-results-title">Scegli anche singoli workshop</h3></div><span>{filteredWorkshops.length} risultati</span></div>
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
                  onToggle={(event) => toggleWorkshop(workshop, event)}
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
  );
}
