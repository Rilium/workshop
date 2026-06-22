import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, X } from "./components/ui/FaIcons";
import { useDarkMode } from "./hooks/useDarkMode";
import { DarkModeToggle } from "./components/ui/DarkModeToggle";
import { initialRules } from "./data/pricing";
import { topics as initialTopics, workshops as initialWorkshops } from "./data/catalog";
import type { AppNotificationRole, PricingRule, ProjectStatus, Role, Selection, Topic, Workshop } from "./types/domain";
import { getPublicCatalog } from "./publicCatalogService";
import { useQuote } from "./hooks/useQuote";
import { useToasts } from "./hooks/useToasts";
import { useWorkshopSelection } from "./hooks/useWorkshopSelection";
import { buildLocalAdminProject, requestToAdminProject } from "./utils/workshop";
import type { AssetDraftFolder, UploadedAsset } from "./driveAssetService";
import type { WorkshopRequestRecord } from "./requestService";
import { FeedbackToastStack } from "./components/ui/Toast";
import { NotificationCenter } from "./components/ui/NotificationCenter";
import { AppButton } from "./components/ui/AppButton";
import { Topbar, SystemBar } from "./components/layout/Topbar";
import { ConfettiBurst } from "./components/ui/ConfettiBurst";
import { ClientView } from "./features/client/ClientView";
import { CustomModal, CustomRequestModal } from "./features/client/components/CustomWorkshopModals";
import { DatePickerModal } from "./features/client/components/DatePickerModal";
import { AuthProvider, AUTH_ENTRY_CONFETTI_EVENT, useAuth } from "./AuthContext";
import { Skeleton, SkeletonCard } from "./components/ui/Skeleton";

const AdminView = lazy(() => import("./features/admin/AdminView").then((module) => ({ default: module.AdminView })));
const ExpertView = lazy(() => import("./features/expert/ExpertView").then((module) => ({ default: module.ExpertView })));
const BrandView = lazy(() => import("./features/brand/BrandView").then((module) => ({ default: module.BrandView })));
const LoginView = lazy(() => import("./features/auth/LoginView").then((module) => ({ default: module.LoginView })));

function getWelcomeCopy(role: Role) {
  if (role === "FunniFin") {
    return {
      eyebrow: "Accesso FunniFin",
      title: "Console operativa",
      body: "Riprendi dalla coda progetti e dalle attività aperte.",
      primary: "Vai alla coda",
      secondary: "Chiudi",
      metric: "Progetti sotto controllo",
    };
  }
  if (role === "Esperto") {
    return {
      eyebrow: "Accesso esperto",
      title: "Area incarichi",
      body: "Controlla candidature, incarichi e materiali collegati.",
      primary: "Vedi candidature",
      secondary: "Chiudi",
      metric: "Workshop da valutare",
    };
  }
  if (role === "Brand") {
    return {
      eyebrow: "Accesso brand",
      title: "Revisioni aperte",
      body: "Rivedi deck, asset e approvazioni finali.",
      primary: "Apri revisioni",
      secondary: "Chiudi",
      metric: "Materiali da chiudere",
    };
  }
  return {
    eyebrow: "Accesso attivo",
    title: "Percorso cliente",
    body: "Completa i passaggi rimasti e aggiorna la richiesta.",
    primary: "Continua",
    secondary: "Chiudi",
    metric: "Percorso attivo",
  };
}

function WelcomeModal({
  role,
  name,
  onPrimary,
  onClose,
}: {
  role: Role;
  name: string;
  onPrimary: () => void;
  onClose: () => void;
}) {
  const copy = getWelcomeCopy(role);

  return (
    <section className="welcome-inline" aria-labelledby="welcome-title">
      <div className="welcome-main">
        <div className="welcome-copy">
          <span className="welcome-eyebrow">{copy.eyebrow}</span>
          <h2 id="welcome-title">{copy.title}</h2>
          <p>{copy.body}</p>
        </div>
        <div className="welcome-user-card">
          <span>
            <BadgeCheck size={18} />
            Accesso confermato
          </span>
          <strong>{name}</strong>
          <em>{role}</em>
        </div>
        <div className="welcome-mini-grid" aria-label="Contesto ingresso">
          <span>
            <BriefcaseBusiness size={17} />
            {copy.metric}
          </span>
          <span>
            <BadgeCheck size={17} />
            Sessione attiva
          </span>
        </div>
      </div>
      <footer className="welcome-actions">
        <AppButton variant="ghost" onClick={onClose} leftIcon={<X size={16} />}>
          {copy.secondary}
        </AppButton>
        <AppButton variant="primary" onClick={onPrimary} rightIcon={<ArrowRight size={17} />}>
          {copy.primary}
        </AppButton>
      </footer>
    </section>
  );
}

function ViewLoadingFallback() {
  return (
    <div className="view-stack" aria-busy="true" aria-label="Caricamento vista">
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
    </div>
  );
}

// ─── Inner app (dentro AuthProvider) ──────────────────────────────────────────

function AppInner() {
  const { currentUser, effectiveRole, session, loading, switchEffectiveRole, logout } = useAuth();
  const { isDark, toggle: toggleDark } = useDarkMode();

  // Il ruolo visualizzato: per utenti autenticati viene dall'effectiveRole;
  // per la vista Cliente pubblica usiamo "Cliente".
  const role: Role = effectiveRole ?? "Cliente";
  const isImpersonating = currentUser?.actualRole === "FunniFin" && effectiveRole !== "FunniFin" && effectiveRole !== null;

  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [systemRefreshToken, setSystemRefreshToken] = useState(0);
  const [systemSettingsToken, setSystemSettingsToken] = useState(0);
  const [activeTopics, setActiveTopics] = useState<string[]>([]);
  const [activeThemes, setActiveThemes] = useState<string[]>([]);
  const [brandFilter, setBrandFilter] = useState("Revisioni");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>("draft_cliente");
  const [customModalWorkshop, setCustomModalWorkshop] = useState<Workshop | null>(null);
  const [customRequestWorkshop, setCustomRequestWorkshop] = useState<Workshop | null>(null);
  const [dateModalSelection, setDateModalSelection] = useState<Selection | null>(null);
  const [catalogTopics, setCatalogTopics] = useState<Topic[]>(initialTopics);
  const [catalogWorkshops, setCatalogWorkshops] = useState<Workshop[]>(initialWorkshops);
  const [rules, setRules] = useState<PricingRule[]>(initialRules);
  const [clientAssetFolder, setClientAssetFolder] = useState<AssetDraftFolder | null>(null);
  const [clientUploadedAssets, setClientUploadedAssets] = useState<UploadedAsset[]>([]);
  const [currentRequest, setCurrentRequest] = useState<WorkshopRequestRecord | null>(null);
  const [requestRefreshToken, setRequestRefreshToken] = useState(0);
  const [clientGuidedLayerActive, setClientGuidedLayerActive] = useState(false);
  const [showCelebrationConfetti, setShowCelebrationConfetti] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const {
    toasts,
    notifications,
    notify,
    closeToast,
    closeNotification,
    reopenNotification,
    markNotificationRead,
    markVisibleNotificationsRead,
    markAllNotificationsRead,
    clearClosedNotifications,
    deleteClosedNotification,
  } = useToasts(role, currentUser?.id, currentUser?.email);
  const { selections, toggleWorkshop, addWorkshops, updateSelection } = useWorkshopSelection(catalogWorkshops, notify);
  const quote = useQuote(selections, catalogWorkshops, rules);
  const lastConfettiTokenRef = useRef<string | null>(null);
  const lastWelcomeTokenRef = useRef<string | null>(null);

  const fireConfetti = (duration = 2800) => {
    setShowCelebrationConfetti(false);
    window.setTimeout(() => setShowCelebrationConfetti(true), 0);
    window.setTimeout(() => setShowCelebrationConfetti(false), duration);
  };

  const openWelcome = (token: string | null) => {
    if (!token || lastWelcomeTokenRef.current === token) return;
    const seenKey = `funnifin_welcome_seen_${token}`;
    if (sessionStorage.getItem(seenKey)) return;
    sessionStorage.setItem(seenKey, "1");
    lastWelcomeTokenRef.current = token;
    setWelcomeOpen(true);
  };

  useEffect(() => {
    const handleHashIntent = () => {
      const hash = window.location.hash;
      const reservedHash = hash === "#login" || hash === "#funnifin" || hash === "#brand" || hash === "#esperto-candidature";
      if (!currentUser && reservedHash) {
        setShowLogin(true);
        return;
      }
      if (!currentUser) return;
      if (currentUser.actualRole === "FunniFin") {
        if (hash === "#funnifin" && role !== "FunniFin") switchEffectiveRole("FunniFin");
        if (hash === "#brand") {
          if (role !== "Brand") switchEffectiveRole("Brand");
          setBrandFilter("Revisioni");
        }
        if (hash === "#esperto-candidature" && role !== "Esperto") switchEffectiveRole("Esperto");
      }
      if (hash === "#brand" && currentUser.actualRole === "Brand") setBrandFilter("Revisioni");
      if (hash === "#esperto-candidature") window.scrollTo({ top: 0, behavior: "smooth" });
    };

    handleHashIntent();
    window.addEventListener("hashchange", handleHashIntent);
    return () => window.removeEventListener("hashchange", handleHashIntent);
  }, [currentUser, role, switchEffectiveRole]);

  useEffect(() => {
    let cancelled = false;
    getPublicCatalog()
      .then((catalog) => {
        if (cancelled) return;
        if (catalog.topics.length) setCatalogTopics(catalog.topics);
        if (catalog.workshops.length) setCatalogWorkshops(catalog.workshops);
        if (catalog.rules.length) setRules(catalog.rules);
        if (catalog.source === "local-fallback") {
          notify("Catalogo locale attivo", "Apps Script non disponibile: stai usando il seed locale di sviluppo.");
        }
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Catalogo Sheet non disponibile.";
        notify("Catalogo Sheet non disponibile", message);
      });
    return () => {
      cancelled = true;
    };
  }, [systemRefreshToken]);

  useEffect(() => {
    if (!loading && currentUser && showLogin) {
      setShowLogin(false);
    }
  }, [currentUser, loading, showLogin]);

  useEffect(() => {
    if (loading || !session || !currentUser) return;
    if (lastConfettiTokenRef.current === session.token) return;
    lastConfettiTokenRef.current = session.token;
    openWelcome(session.token);
  }, [currentUser, loading, session?.token]);

  useEffect(() => {
    const handleEntryConfetti = (event: Event) => {
      const token = (event as CustomEvent<{ token?: string }>).detail?.token ?? session?.token ?? null;
      if (!token || lastConfettiTokenRef.current === token) return;
      lastConfettiTokenRef.current = token;
      openWelcome(token);
    };
    window.addEventListener(AUTH_ENTRY_CONFETTI_EVENT, handleEntryConfetti as EventListener);
    return () => window.removeEventListener(AUTH_ENTRY_CONFETTI_EVENT, handleEntryConfetti as EventListener);
  }, [session?.token]);

  // Mostra login per ruoli non-Cliente quando non autenticato
  if (loading) {
    return (
      <div className="app-shell role-cliente app-boot-skeleton" aria-busy="true">
        <div className="app-boot-topbar">
          <Skeleton className="skeleton-title" />
          <Skeleton className="skeleton-button" />
        </div>
        <main className="app-boot-main">
          <SkeletonCard lines={3} />
          <SkeletonCard lines={2} />
          <SkeletonCard lines={2} />
        </main>
      </div>
    );
  }

  // Se l'utente ha cliccato "Accedi" o la vista richiede auth, mostra LoginView
  if (showLogin || (!currentUser && role !== "Cliente")) {
    return (
      <Suspense fallback={<ViewLoadingFallback />}>
        <LoginView onClose={currentUser ? () => setShowLogin(false) : undefined} />
      </Suspense>
    );
  }

  const selectedWorkshops = selections
    .map((selection) => ({ selection, workshop: catalogWorkshops.find((workshop) => workshop.id === selection.workshopId)! }))
    .filter(({ workshop }) => Boolean(workshop));
  const coveredTopics = new Set(selectedWorkshops.map(({ workshop }) => workshop.topicId)).size;
  const coveredThemes = new Set(selectedWorkshops.map(({ workshop }) => workshop.themeId)).size;
  const totalHours = selectedWorkshops.reduce((total, { selection }) => total + (selection.duration === "2h" ? 2 : 1), 0);

  const setStatusWithFeedback = (status: ProjectStatus, title: string, body: string) => {
    setProjectStatus(status);
    notify(title, body);
  };
  const syncProjectStatus = (status: ProjectStatus) => {
    setProjectStatus(status);
  };

  // Solo FunniFin può cambiare il ruolo visualizzato (incluso Cliente)
  const changeRole = (item: Role) => {
    const roleHash: Record<Role, string> = {
      Cliente: "",
      FunniFin: "#funnifin",
      Esperto: "#esperto-candidature",
      Brand: "#brand",
    };
    const nextHash = roleHash[item];
    if (window.location.hash !== nextHash) {
      window.history.replaceState(null, "", nextHash || `${window.location.pathname}${window.location.search}`);
    }
    switchEffectiveRole(item);
    setRoleMenuOpen(false);
    if (item === "Brand") setBrandFilter("Revisioni");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeWelcome = () => setWelcomeOpen(false);
  const runWelcomePrimary = () => {
    setWelcomeOpen(false);
    if (role === "Brand") setBrandFilter("Revisioni");
    if (role === "Esperto") window.history.replaceState(null, "", "#esperto-candidature");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const runNotificationAction = (notification: (typeof notifications)[number]) => {
    const action = notification.action;
    if (!action) return;
    if (action.role && action.role !== role && currentUser?.actualRole === "FunniFin") {
      switchEffectiveRole(action.role);
    }
    if (action.hash) window.history.replaceState(null, "", action.hash);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const isAuthenticated = Boolean(currentUser);
  const isClientView = role === "Cliente";
  const isPublicClientDemo = isClientView && !isAuthenticated;
  const showTopbarSettings = !isClientView;
  const showTopbarRefresh = !isClientView;
  const showTopbarThemeToggle = !isClientView;
  const showTopbarLogin = isPublicClientDemo;
  const showAppTopbar = !(isClientView && clientGuidedLayerActive);

  return (
    <div className={"app-shell role-" + role.toLowerCase()}>
      <ConfettiBurst active={showCelebrationConfetti} />
      {toasts.length > 0 && <FeedbackToastStack toasts={toasts} onClose={closeToast} />}
      {customModalWorkshop && <CustomModal workshop={customModalWorkshop} onClose={() => setCustomModalWorkshop(null)} />}
      {customRequestWorkshop && (
        <CustomRequestModal
          workshop={customRequestWorkshop}
          initialNote={selections.find((selection) => selection.workshopId === customRequestWorkshop.id)?.customNote ?? ""}
          onClose={() => setCustomRequestWorkshop(null)}
          onSave={(note) => {
            updateSelection(customRequestWorkshop.id, { custom: true, customNote: note });
            setCustomRequestWorkshop(null);
          }}
        />
      )}
      {dateModalSelection && (
        <DatePickerModal
          selection={dateModalSelection}
          selections={selections}
          workshop={catalogWorkshops.find((workshop) => workshop.id === dateModalSelection.workshopId)!}
          workshops={catalogWorkshops}
          onClose={() => setDateModalSelection(null)}
          onConfirm={(date, time) => {
            updateSelection(dateModalSelection.workshopId, { date, time, dateConfirmed: true, status: "date_proposte" });
            setDateModalSelection(null);
          }}
        />
      )}
      {showAppTopbar && (
      <Topbar
        projectStatus={projectStatus}
        notify={notify}
        showProjectStatus={role !== "Cliente" || projectStatus !== "draft_cliente" || Boolean(currentRequest)}
        projectStatusLabel={projectStatus === "draft_cliente" && currentRequest ? "Bozza salvata" : undefined}
        systemControls={
          <SystemBar
            role={role}
            userRole={role}
            actualRole={currentUser?.actualRole ?? null}
            roleMenuOpen={roleMenuOpen}
            onToggleRoleMenu={() => setRoleMenuOpen((open) => !open)}
            onRole={changeRole}
            onSettings={() => setSystemSettingsToken((value) => value + 1)}
            settingsLabel={role === "FunniFin" ? "Apri Google backend" : "Impostazioni sezione"}
            onRefresh={() => setSystemRefreshToken((value) => value + 1)}
            onLogout={logout}
            onLogin={() => setShowLogin(true)}
            currentUser={currentUser}
            isAuthenticated={isAuthenticated}
            showSettings={showTopbarSettings}
            showRefresh={showTopbarRefresh}
            showThemeToggle={showTopbarThemeToggle}
            showLogin={showTopbarLogin}
            darkModeToggle={<DarkModeToggle isDark={isDark} onToggle={toggleDark} />}
            notificationCenter={
              <NotificationCenter
                role={role}
                currentUserId={currentUser?.id}
                currentUserEmail={currentUser?.email}
                notifications={notifications}
                onCloseNotification={closeNotification}
                onReopenNotification={reopenNotification}
                onDeleteNotification={deleteClosedNotification}
                onMarkRead={markNotificationRead}
                onMarkVisibleRead={markVisibleNotificationsRead}
                onMarkAllRead={markAllNotificationsRead}
                onAction={runNotificationAction}
                onClearClosed={() => {
                  const r = role as AppNotificationRole;
                  clearClosedNotifications(r);
                }}
              />
            }
          />
        }
      />
      )}
      {welcomeOpen && currentUser && (
        <WelcomeModal
          role={role}
          name={currentUser.displayName || currentUser.email}
          onPrimary={runWelcomePrimary}
          onClose={closeWelcome}
        />
      )}
      {/* Banner impersonificazione */}
      {isImpersonating && (
        <div className="impersonation-banner">
          <span>
            Vista QA come <strong>{role}</strong>. Utente reale:{" "}
            <strong>Team FunniFin</strong>; notifiche e permessi restano FunniFin.
          </span>
          <button
            type="button"
            className="impersonation-back"
            onClick={() => switchEffectiveRole("FunniFin")}
          >
            ← Torna a FunniFin
          </button>
        </div>
      )}
      <main className="main-content">
        {role === "Cliente" && (
          <ClientView
            topics={catalogTopics}
            workshops={catalogWorkshops}
            activeTopics={activeTopics}
            activeThemes={activeThemes}
            selections={selections}
            quote={quote}
            coveredTopics={coveredTopics}
            coveredThemes={coveredThemes}
            totalHours={totalHours}
            setActiveTopics={setActiveTopics}
            setActiveThemes={setActiveThemes}
            toggleWorkshop={toggleWorkshop}
            addWorkshops={addWorkshops}
            updateSelection={updateSelection}
            setProjectStatus={setStatusWithFeedback}
            notify={notify}
            showCustomModal={(workshop: Workshop) => setCustomModalWorkshop(workshop)}
            openCustomRequest={(workshop: Workshop) => setCustomRequestWorkshop(workshop)}
            openDateModal={(selection: Selection) => setDateModalSelection(selection)}
            assetFolder={clientAssetFolder}
            setAssetFolder={setClientAssetFolder}
            uploadedAssets={clientUploadedAssets}
            setUploadedAssets={setClientUploadedAssets}
            systemRefreshToken={systemRefreshToken}
            systemSettingsToken={systemSettingsToken}
            onGuidedLayerChange={setClientGuidedLayerActive}
            onRequestCreated={(request) => {
              setCurrentRequest(request);
              setRequestRefreshToken((value) => value + 1);
              notify("Nuova richiesta cliente", `${request.company}: ${request.workshops.length} workshop da prendere in carico.`, {
                audience: ["FunniFin"],
                priority: "task",
                category: "task",
                action: { label: "Apri coda", role: "FunniFin", hash: "#funnifin", projectId: request.id },
              });
              fireConfetti(3200);
            }}
          />
        )}
        <Suspense fallback={<ViewLoadingFallback />}>
          {role === "FunniFin" && (
            <AdminView
              projectStatus={projectStatus}
              quote={quote}
              rules={rules}
              selections={selections}
              setRules={setRules}
              setProjectStatus={setStatusWithFeedback}
              updateSelection={updateSelection}
              notify={notify}
              syncProjectStatus={syncProjectStatus}
              clientAssetFolder={clientAssetFolder}
              clientUploadedAssets={clientUploadedAssets}
              currentRequest={currentRequest}
              currentUserId={currentUser?.id}
              currentUserEmail={currentUser?.email}
              requestRefreshToken={requestRefreshToken}
              systemRefreshToken={systemRefreshToken}
              systemSettingsToken={systemSettingsToken}
            />
          )}
          {role === "Esperto" && (
            <ExpertView
              selections={selections}
              updateSelection={updateSelection}
              setProjectStatus={setStatusWithFeedback}
              notify={notify}
              syncProjectStatus={syncProjectStatus}
              currentUserId={currentUser?.id}
              currentUserEmail={currentUser?.email}
              systemRefreshToken={systemRefreshToken}
              systemSettingsToken={systemSettingsToken}
              project={{
                ...(currentRequest ? requestToAdminProject(currentRequest) : buildLocalAdminProject(selections, quote.total, projectStatus)),
                status: projectStatus,
                quoteTotal: quote.total,
                workshopIds: selections.map((selection) => selection.workshopId),
              }}
            />
          )}
          {role === "Brand" && (
            <BrandView
              brandFilter={brandFilter}
              setBrandFilter={setBrandFilter}
              setProjectStatus={setStatusWithFeedback}
              syncProjectStatus={syncProjectStatus}
              notify={notify}
              currentUserId={currentUser?.id}
              currentUserEmail={currentUser?.email}
              systemRefreshToken={systemRefreshToken}
              systemSettingsToken={systemSettingsToken}
            />
          )}
        </Suspense>
      </main>
    </div>
  );
}

// ─── Root con AuthProvider ─────────────────────────────────────────────────────

function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

export default App;
