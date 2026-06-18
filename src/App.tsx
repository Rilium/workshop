import { useEffect, useRef, useState } from "react";
import { ArrowRight, BadgeCheck, BriefcaseBusiness, Sparkles, X } from "lucide-react";
import { useDarkMode } from "./hooks/useDarkMode";
import { DarkModeToggle } from "./components/ui/DarkModeToggle";
import { initialRules } from "./data/pricing";
import { workshops } from "./data/catalog";
import type { ProjectStatus, Role, Selection, Workshop } from "./types/domain";
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
import { AdminView } from "./features/admin/AdminView";
import { ExpertView } from "./features/expert/ExpertView";
import { BrandView } from "./features/brand/BrandView";
import { AuthProvider, AUTH_ENTRY_CONFETTI_EVENT, useAuth } from "./AuthContext";
import { LoginView } from "./features/auth/LoginView";
import { Skeleton, SkeletonCard } from "./components/ui/Skeleton";

function getWelcomeCopy(role: Role) {
  if (role === "FunniFin") {
    return {
      eyebrow: "Bentornato, operations",
      title: "La console FunniFin e pronta.",
      body: "Coda, calendario, esperti e materiali sono allineati nello stesso flusso operativo.",
      primary: "Vai alla coda",
      secondary: "Resta qui",
      metric: "Progetti sotto controllo",
    };
  }
  if (role === "Esperto") {
    return {
      eyebrow: "Bentornato, esperto",
      title: "Nuove opportunita, senza rumore.",
      body: "Trovi candidature, incarichi e materiali collegati nel punto giusto del percorso.",
      primary: "Vedi candidature",
      secondary: "Resta qui",
      metric: "Workshop da valutare",
    };
  }
  if (role === "Brand") {
    return {
      eyebrow: "Bentornato, brand",
      title: "Revisioni pronte da rifinire.",
      body: "Deck, asset e approvazioni finali sono raccolti nella vista dedicata al controllo qualita.",
      primary: "Apri revisioni",
      secondary: "Resta qui",
      metric: "Materiali da chiudere",
    };
  }
  return {
    eyebrow: "Bentornato",
    title: "Il tuo spazio e pronto.",
    body: "Riprendi il percorso e completa i passaggi rimasti quando vuoi.",
    primary: "Continua",
    secondary: "Resta qui",
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
    <div className="modal-backdrop welcome-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <section className="welcome-modal">
        <button className="welcome-close" type="button" onClick={onClose} aria-label="Chiudi benvenuto">
          <X size={18} />
        </button>
        <div className="welcome-orbit" aria-hidden="true">
          <Sparkles size={28} />
        </div>
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
            <Sparkles size={17} />
            Sessione avviata
          </span>
        </div>
        <footer className="welcome-actions">
          <AppButton variant="ghost" onClick={onClose}>
            {copy.secondary}
          </AppButton>
          <AppButton variant="primary" onClick={onPrimary}>
            {copy.primary} <ArrowRight size={17} />
          </AppButton>
        </footer>
      </section>
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
  const [activeTopics, setActiveTopics] = useState<string[]>(["budget", "benessere"]);
  const [activeThemes, setActiveThemes] = useState<string[]>(["budget-mensile", "fondo-emergenza", "abitudini", "mutuo", "etf", "rischio", "welfare"]);
  const [brandFilter, setBrandFilter] = useState("Revisioni");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>("draft_cliente");
  const [customModalWorkshop, setCustomModalWorkshop] = useState<Workshop | null>(null);
  const [customRequestWorkshop, setCustomRequestWorkshop] = useState<Workshop | null>(null);
  const [dateModalSelection, setDateModalSelection] = useState<Selection | null>(null);
  const [rules, setRules] = useState(initialRules);
  const [clientAssetFolder, setClientAssetFolder] = useState<AssetDraftFolder | null>(null);
  const [clientUploadedAssets, setClientUploadedAssets] = useState<UploadedAsset[]>([]);
  const [currentRequest, setCurrentRequest] = useState<WorkshopRequestRecord | null>(null);
  const [requestRefreshToken, setRequestRefreshToken] = useState(0);
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
  } = useToasts(role);
  const { selections, toggleWorkshop, addWorkshops, updateSelection } = useWorkshopSelection(workshops, notify);
  const quote = useQuote(selections, workshops, rules);
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
    if (!loading && currentUser && showLogin) {
      setShowLogin(false);
    }
  }, [currentUser, loading, showLogin]);

  useEffect(() => {
    if (loading || !session || !currentUser) return;
    if (lastConfettiTokenRef.current === session.token) return;
    lastConfettiTokenRef.current = session.token;
    fireConfetti();
    openWelcome(session.token);
  }, [currentUser, loading, session?.token]);

  useEffect(() => {
    const handleEntryConfetti = (event: Event) => {
      const token = (event as CustomEvent<{ token?: string }>).detail?.token ?? session?.token ?? null;
      if (!token || lastConfettiTokenRef.current === token) return;
      lastConfettiTokenRef.current = token;
      fireConfetti();
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
    return <LoginView onClose={currentUser ? () => setShowLogin(false) : undefined} />;
  }

  const selectedWorkshops = selections
    .map((selection) => ({ selection, workshop: workshops.find((workshop) => workshop.id === selection.workshopId)! }))
    .filter(({ workshop }) => Boolean(workshop));
  const coveredTopics = new Set(selectedWorkshops.map(({ workshop }) => workshop.topicId)).size;
  const coveredThemes = new Set(selectedWorkshops.map(({ workshop }) => workshop.themeId)).size;
  const totalHours = selectedWorkshops.reduce((total, { selection }) => total + (selection.duration === "2h" ? 2 : 1), 0);

  const topbarContext = (() => {
    if (role === "Cliente") {
      return currentRequest ? "Cliente - " + currentRequest.company + " / richiesta inviata" : "Cliente · nuovo percorso";
    }
    if (role === "FunniFin") {
      return currentRequest ? "FunniFin - " + currentRequest.company + " / " + currentRequest.workshops.length + " workshop" : "FunniFin · coda richieste";
    }
    if (role === "Esperto") return "Esperto · candidature e incarichi";
    return "Brand · revisioni materiali";
  })();

  const setStatusWithFeedback = (status: ProjectStatus, title: string, body: string) => {
    setProjectStatus(status);
    notify(title, body);
  };
  const syncProjectStatus = (status: ProjectStatus) => {
    setProjectStatus(status);
  };

  // Solo FunniFin può cambiare il ruolo visualizzato (incluso Cliente)
  const changeRole = (item: Role) => {
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

  return (
    <div className={"app-shell role-" + role.toLowerCase()}>
      <ConfettiBurst active={showCelebrationConfetti} />
      {welcomeOpen && currentUser && (
        <WelcomeModal
          role={role}
          name={currentUser.displayName || currentUser.email}
          onPrimary={runWelcomePrimary}
          onClose={closeWelcome}
        />
      )}
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
            notify("Su misura attivato", "Note salvate per " + customRequestWorkshop.title + ".");
          }}
        />
      )}
      {dateModalSelection && (
        <DatePickerModal
          selection={dateModalSelection}
          selections={selections}
          workshop={workshops.find((workshop) => workshop.id === dateModalSelection.workshopId)!}
          onClose={() => setDateModalSelection(null)}
          onConfirm={(date, time) => {
            updateSelection(dateModalSelection.workshopId, { date, time, dateConfirmed: true, status: "date_proposte" });
            setDateModalSelection(null);
            notify("Date scelte", "La proposta è stata salvata nel progetto. FunniFin verificherà la disponibilità prima della conferma.");
          }}
        />
      )}
      <DarkModeToggle isDark={isDark} onToggle={toggleDark} />
      <Topbar role={role} context={topbarContext} projectStatus={projectStatus} notify={notify} />
      {/* Banner impersonificazione */}
      {isImpersonating && (
        <div className="impersonation-banner">
          <span>
            Stai visualizzando come <strong>{role}</strong>. Utente reale:{" "}
            <strong>Team FunniFin</strong>.
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
      <SystemBar
        role={role}
        actualRole={currentUser?.actualRole ?? null}
        context={topbarContext}
        roleMenuOpen={roleMenuOpen}
        onToggleRoleMenu={() => setRoleMenuOpen((open) => !open)}
        onRole={changeRole}
        onSettings={() => setSystemSettingsToken((value) => value + 1)}
        settingsLabel={role === "FunniFin" ? "Apri Google backend" : "Impostazioni sezione"}
        onRefresh={() => setSystemRefreshToken((value) => value + 1)}
        onLogout={logout}
        onLogin={() => setShowLogin(true)}
        currentUser={currentUser}
        notificationCenter={
          <NotificationCenter
            role={role}
            notifications={notifications}
            onCloseNotification={closeNotification}
            onReopenNotification={reopenNotification}
            onMarkRead={markNotificationRead}
            onMarkVisibleRead={markVisibleNotificationsRead}
            onMarkAllRead={markAllNotificationsRead}
            onAction={runNotificationAction}
            onClearClosed={() => {
              const r = role as import("./types/domain").AppNotificationRole;
              clearClosedNotifications(r);
            }}
          />
        }
      />

      <main className="main-content">
        {role === "Cliente" && (
          <ClientView
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
            systemRefreshToken={systemRefreshToken}
            systemSettingsToken={systemSettingsToken}
          />
        )}
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
