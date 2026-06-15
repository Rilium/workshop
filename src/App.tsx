import { useEffect, useState } from "react";
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
import { Topbar, SystemBar } from "./components/layout/Topbar";
import { ClientView } from "./features/client/ClientView";
import { CustomModal, CustomRequestModal } from "./features/client/components/CustomWorkshopModals";
import { DatePickerModal } from "./features/client/components/DatePickerModal";
import { AdminView } from "./features/admin/AdminView";
import { ExpertView } from "./features/expert/ExpertView";
import { BrandView } from "./features/brand/BrandView";
import { AuthProvider, useAuth } from "./AuthContext";
import { LoginView } from "./features/auth/LoginView";

// ─── Inner app (dentro AuthProvider) ──────────────────────────────────────────

function AppInner() {
  const { currentUser, effectiveRole, session, loading, switchEffectiveRole, logout } = useAuth();

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
  const { toasts, notify, closeToast } = useToasts();
  const { selections, toggleWorkshop, addWorkshops, updateSelection } = useWorkshopSelection(workshops, notify);
  const quote = useQuote(selections, workshops, rules);

  useEffect(() => {
    if (window.location.hash === "#esperto-candidature") {
      if (currentUser?.actualRole === "Esperto") {
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    }
  }, [currentUser]);

  // Quando l'utente completa il login, nascondi il form e vai alla sua vista
  if (!loading && currentUser && showLogin) {
    setShowLogin(false);
  }

  // Mostra login per ruoli non-Cliente quando non autenticato
  if (loading) {
    return (
      <div className="app-shell role-cliente" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh" }}>
        <span style={{ color: "var(--color-muted)" }}>Caricamento…</span>
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

  return (
    <div className={"app-shell role-" + role.toLowerCase()}>
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
