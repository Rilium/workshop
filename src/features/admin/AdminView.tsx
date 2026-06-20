import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
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
import { sendWorkflowNotification, type WorkflowNotificationPayload, type WorkflowNotificationRecipientRole } from "../../emailService";
import { createWorkshopCalendarEvent, getWorkshopAvailability } from "../../googleCalendarService";
import type { AssetDraftFolder, UploadedAsset } from "../../driveAssetService";
import { deleteExpert, getGoogleHealth, listCatalogConfig, listCatalogWorkshops, listExperts, listPricingRules, listWorkspaceSettings, updateCatalogTopic, updateExpert, updatePricingRule, updateWorkspaceSetting, type CatalogWorkshopConfig, type GoogleHealth, type WorkspaceSetting } from "../../googleAdminService";
import { getDriveFolderPreview, type DriveFolderResponse } from "../../googleDriveService";
import { deleteWorkshopRequest, listWorkshopRequests, updateWorkshopRequest, type RequestWorkshopRecord, type WorkshopRequestRecord } from "../../requestService";
import { listAuthUsers, listAccessRequests, requestLoginCode, reviewAccessRequest } from "../../authService";
import type { AuthRole, AuthUser, AccessRequest } from "../../types/auth";
import { SECRET_SETTINGS } from "../../secretSettings";
import { adminSettingDefinitions, adminSettingGroups, appEnv, projectStatuses, statusLabel } from "../../data/workflow";
import { canvaCatalogSource, experts, initialExpertProfiles, topics, workshops } from "../../data/catalog";
import type { AdminProject, AdminProjectWorkshopRow, AdminWorkspacePanel, AppNotificationRole, CalendarEventRecord, DateApproval, DateDecision, DriveSlideLink, ExpertProfile, Format, NotifyOptions, PricingRule, ProjectStatus, Quote, Selection, Theme, Workshop } from "../../types/domain";
import type { AdminActionModalState, NotificationChoice } from "../../types/ui";
import { money } from "../../utils/money";
import { buildLocalAdminProject, requestToAdminProject, topicColorClass } from "../../utils/workshop";
import { getFriendlyErrorMessage } from "../../utils/status";
import { AppButton } from "../../components/ui/AppButton";
import { ActionIconButton, ToolIconButton } from "../../components/ui/IconButton";
import { EventLink } from "../../components/ui/EventLink";
import { Info } from "../../components/ui/Info";
import { Panel } from "../../components/ui/Panel";
import { SectionTitle } from "../../components/ui/SectionTitle";
import { ModalBackdrop } from "../../components/ui/Modal";
import { Skeleton, SkeletonCard } from "../../components/ui/Skeleton";
import { BottomActionBar } from "../../components/layout/BottomActionBar";
import { OperationalStrip } from "../../components/layout/OperationalStrip";
import { OperatorIdentityCard } from "../../components/layout/OperatorIdentityCard";
import { RoleHero } from "../../components/layout/RoleHero";
import { WorkshopSessionView } from "../../components/workshop/WorkshopSessionView";
import { roleIdentities } from "../../data/mockData";
import { AdminActionModal } from "./components/AdminActionModal";
import { AdminFlowStepper } from "./components/AdminFlowStepper";
import { AdminSectionNav, type AdminSectionNavItem } from "./components/AdminSectionNav";
import { CatalogEditModal } from "./components/CatalogEditModal";
import { ExpertProfileModal } from "./components/ExpertProfileModal";
import { readCachedGoogleHealth, writeCachedGoogleHealth } from "./adminHealthCache";
import { getWorkshopSelectionPrice } from "../../utils/workshop";
import { updateAuthUser } from "../../authService";

type AdminQueueFilter = "tutti" | "da-fare" | "oggi" | "da-fissare" | "produzione" | "in-calendario" | "chiusi";
type AdminQueueSort = "recenti" | "vecchi" | "prezzo_alto" | "date_vicine" | "date_lontane";
type QueueCardTone = "neutral" | "today" | "late" | "soon" | "calendar" | "closed";
type AdminTodoLabel = "verifica" | "date" | "date da rivedere" | "esperti" | "materiali" | "deck" | "brand" | "evento";

const queueFilterOptions: Array<{ id: AdminQueueFilter; label: string }> = [
  { id: "tutti", label: "Tutti" },
  { id: "da-fare", label: "Da fare" },
  { id: "oggi", label: "Oggi" },
  { id: "da-fissare", label: "Da fissare" },
  { id: "produzione", label: "Produzione" },
  { id: "in-calendario", label: "In calendario" },
  { id: "chiusi", label: "Chiusi" },
];

const queueSortOptions: Array<{ id: AdminQueueSort; label: string }> = [
  { id: "recenti", label: "Più recenti" },
  { id: "vecchi", label: "Più vecchi" },
  { id: "prezzo_alto", label: "Prezzo più alto" },
  { id: "date_vicine", label: "Date più vicine" },
  { id: "date_lontane", label: "Date più lontane" },
];
const USER_MANUAL_URL = "/FunniFin_Manuale_Utente.docx";
const todoLabelPriority: AdminTodoLabel[] = ["date da rivedere", "date", "verifica", "esperti", "materiali", "deck", "brand", "evento"];
const todoLabelCopy: Record<AdminTodoLabel, string> = {
  verifica: "verifica",
  date: "date",
  "date da rivedere": "date da rivedere",
  esperti: "esperti",
  materiali: "materiali",
  deck: "deck",
  brand: "brand",
  evento: "evento",
};

function notificationRoleFromRecipient(role: WorkflowNotificationRecipientRole): AppNotificationRole | null {
  if (role === "funnifin") return "FunniFin";
  if (role === "expert") return "Esperto";
  if (role === "brand") return "Brand";
  return null;
}

function workflowNotificationAction(audience: AppNotificationRole[]): NotifyOptions["action"] {
  if (audience.includes("Brand")) return { label: "Apri revisioni", role: "Brand", hash: "#brand" };
  if (audience.includes("Esperto")) return { label: "Vai alle candidature", role: "Esperto", hash: "#esperto-candidature" };
  return { label: "Apri progetto", role: "FunniFin", hash: "#funnifin" };
}

function parseQueueDate(value?: string) {
  if (!value) return null;
  const dateOnly = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const date = dateOnly ? new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]), 12) : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function formatQueueDate(date: Date | null, now = new Date()) {
  if (!date) return { label: "Senza data", distance: "da fissare", dayOffset: null as number | null };
  const dayOffset = Math.round((startOfLocalDay(date).getTime() - startOfLocalDay(now).getTime()) / 86400000);
  if (dayOffset === 0) return { label: "Oggi", distance: "oggi", dayOffset };
  if (dayOffset === -1) return { label: "Ieri", distance: "ieri", dayOffset };
  if (dayOffset === 1) return { label: "Domani", distance: "domani", dayOffset };

  const label = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "numeric", month: "short" }).format(date);
  const distance = dayOffset < 0 ? `${Math.abs(dayOffset)} gg fa` : `tra ${dayOffset} gg`;
  return { label, distance, dayOffset };
}

export function AdminView({
  projectStatus,
  quote,
  rules,
  selections,
  setRules,
  setProjectStatus,
  updateSelection,
  notify,
  syncProjectStatus,
  clientAssetFolder,
  clientUploadedAssets,
  currentRequest,
  currentUserId,
  currentUserEmail,
  requestRefreshToken,
  systemRefreshToken,
  systemSettingsToken,
}: {
  projectStatus: ProjectStatus;
  quote: Quote;
  rules: PricingRule[];
  selections: Selection[];
  setRules: (rules: PricingRule[]) => void;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  notify: (title: string, body: string, options?: NotifyOptions) => void;
  syncProjectStatus: (status: ProjectStatus) => void;
  clientAssetFolder: AssetDraftFolder | null;
  clientUploadedAssets: UploadedAsset[];
  currentRequest: WorkshopRequestRecord | null;
  currentUserId?: string;
  currentUserEmail?: string;
  requestRefreshToken: number;
  systemRefreshToken: number;
  systemSettingsToken: number;
}) {
  const [adminTab, setAdminTab] = useState("Operativo");
  const [catalogView, setCatalogView] = useState<"sheet" | "drive">("sheet");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminQueueFilter, setAdminQueueFilter] = useState<AdminQueueFilter>("tutti");
  const [adminQueueSort, setAdminQueueSort] = useState<AdminQueueSort>("recenti");
  const [bottomProjectMenuOpen, setBottomProjectMenuOpen] = useState(false);
  const localProject = buildLocalAdminProject(selections, quote.total, projectStatus);
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>(() => (currentRequest ? [requestToAdminProject(currentRequest)] : []));
  const [selectedProjectId, setSelectedProjectId] = useState(currentRequest?.id ?? "");
  const [requestSyncState, setRequestSyncState] = useState<{ loading: boolean; error: string; source: "sheet" | "local" }>({
    loading: false,
    error: "",
    source: "sheet",
  });
  const [assignmentWorkshopId, setAssignmentWorkshopId] = useState(selections[0]?.workshopId ?? "ws-budget-step");
  const [expertDraft, setExpertDraft] = useState(experts[0].name);
  const [calendarCheck, setCalendarCheck] = useState<{ checked: boolean; loading: boolean; freeSlots: number; source: string; error?: string }>({
    checked: false,
    loading: false,
    freeSlots: 0,
    source: "",
  });
  const [adminWorkspacePanel, setAdminWorkspacePanel] = useState<AdminWorkspacePanel>("workshops");
  const [editingTopicId, setEditingTopicId] = useState(topics[0].id);
  const [catalogModalTopicId, setCatalogModalTopicId] = useState<string | null>(null);
  const [catalogSaving, setCatalogSaving] = useState(false);
  const [pricingSavedAt, setPricingSavedAt] = useState("");
  const [expertsSyncedAt, setExpertsSyncedAt] = useState("");
  const [catalogRefreshedAt, setCatalogRefreshedAt] = useState("");
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [pricingLoading, setPricingLoading] = useState(false);
  const [expertsLoading, setExpertsLoading] = useState(false);
  const [sheetCatalogWorkshops, setSheetCatalogWorkshops] = useState<CatalogWorkshopConfig[]>([]);
  const [driveSlidesSyncedAt, setDriveSlidesSyncedAt] = useState("");
  const [driveSlidesRoot, setDriveSlidesRoot] = useState("Drive/FunniFin/Presentazioni operative");
  const [driveSlideLinks, setDriveSlideLinks] = useState<Partial<Record<string, DriveSlideLink>>>({});
  const [expertDirectory, setExpertDirectory] = useState<ExpertProfile[]>(initialExpertProfiles);
  const [selectedExpertProfileId, setSelectedExpertProfileId] = useState<string | null>(null);
  const [expertProfileSaving, setExpertProfileSaving] = useState(false);
  const [expertProfileDeleting, setExpertProfileDeleting] = useState(false);
  const [workspaceSettings, setWorkspaceSettings] = useState<WorkspaceSetting[]>([]);
  const [sensitiveSettingDrafts, setSensitiveSettingDrafts] = useState<Record<string, string>>({});
  const [dirtyWorkspaceSettingKeys, setDirtyWorkspaceSettingKeys] = useState<Record<string, boolean>>({});
  const [googleHealth, setGoogleHealth] = useState<GoogleHealth | null>(() => readCachedGoogleHealth());
  const [googleHealthError, setGoogleHealthError] = useState("");
  const [googleHealthLoading, setGoogleHealthLoading] = useState(false);
  const googleHealthStatusLabel = googleHealthLoading && googleHealth
    ? "Aggiorno live"
    : googleHealthLoading
      ? "Controllo"
      : googleHealth
        ? googleHealth.cached
          ? "Cache pronta"
          : "Live"
        : googleHealthError
          ? "Errore"
          : "Health";
  const [adminActionModal, setAdminActionModal] = useState<AdminActionModalState | null>(null);
  const [requestDeleteConfirm, setRequestDeleteConfirm] = useState<AdminProject | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState("");
  const [calendarEvents, setCalendarEvents] = useState<Record<string, CalendarEventRecord>>({});
  const [driveFolderPreview, setDriveFolderPreview] = useState<DriveFolderResponse | null>(null);
  const [driveFolderStatus, setDriveFolderStatus] = useState<{ loading: boolean; error: string }>({ loading: false, error: "" });
  const [catalogEdits, setCatalogEdits] = useState<Record<string, { title: string; description: string; badge: string; active: boolean }>>(() =>
    Object.fromEntries(topics.map((topic) => [topic.id, { title: topic.title, description: topic.description, badge: topic.badge, active: true }])),
  );
  const [dateApprovals, setDateApprovals] = useState<Record<string, DateApproval>>({});
  const [workshopExperts, setWorkshopExperts] = useState<Record<string, string>>({});
  const [authUsers, setAuthUsers] = useState<AuthUser[]>([]);
  const [accessRequests, setAccessRequests] = useState<AccessRequest[]>([]);
  const [authLoading, setAuthLoading] = useState(false);
  const [authSectionTab, setAuthSectionTab] = useState<"utenti" | "richieste">("utenti");
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"create" | "edit">("create");
  const [authModalTargetId, setAuthModalTargetId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteDisplayName, setInviteDisplayName] = useState("");
  const [inviteRole, setInviteRole] = useState<AuthRole>("Brand");
  const [inviteExpertId, setInviteExpertId] = useState("");
  const [inviteDisabled, setInviteDisabled] = useState(false);
  const [inviteSendMail, setInviteSendMail] = useState(true);
  const [inviteBusy, setInviteBusy] = useState(false);
  useEffect(() => {
    let alive = true;

    const loadAuth = async () => {
      setAuthLoading(true);
      try {
        const [users, requests] = await Promise.all([listAuthUsers(), listAccessRequests()]);
        if (!alive) return;
        setAuthUsers(users);
        setAccessRequests(requests);
      } catch {
        if (!alive) return;
        setAuthUsers([]);
        setAccessRequests([]);
      } finally {
        if (alive) setAuthLoading(false);
      }
    };

    void loadAuth();

    return () => {
      alive = false;
    };
  }, [requestRefreshToken, systemRefreshToken]);

  const refreshAuthData = async () => {
    setAuthLoading(true);
    try {
      const [users, requests] = await Promise.all([listAuthUsers(), listAccessRequests()]);
      setAuthUsers(users);
      setAccessRequests(requests);
    } catch (error) {
      notify("Auth", error instanceof Error ? error.message : "Aggiornamento utenti non riuscito.");
    } finally {
      setAuthLoading(false);
    }
  };

  const resetAuthModal = () => {
    setAuthModalOpen(false);
    setAuthModalMode("create");
    setAuthModalTargetId("");
    setInviteEmail("");
    setInviteDisplayName("");
    setInviteRole("Brand");
    setInviteExpertId("");
    setInviteDisabled(false);
    setInviteSendMail(true);
  };

  const openCreateAuthModal = () => {
    setAuthModalMode("create");
    setAuthModalTargetId("");
    setInviteEmail("");
    setInviteDisplayName("");
    setInviteRole("Brand");
    setInviteExpertId("");
    setInviteDisabled(false);
    setInviteSendMail(true);
    setAuthModalOpen(true);
  };

  const openEditAuthModal = (user: AuthUser) => {
    setAuthModalMode("edit");
    setAuthModalTargetId(user.id);
    setInviteEmail(user.email);
    setInviteDisplayName(user.displayName);
    setInviteRole(user.actualRole);
    setInviteExpertId(user.expertId ?? "");
    setInviteDisabled(user.disabled);
    setInviteSendMail(true);
    setAuthModalOpen(true);
  };

  const handleInviteUser = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!inviteEmail.trim()) return;
    setInviteBusy(true);
    try {
      if (authModalMode === "create") {
        await requestLoginCode(inviteEmail.trim(), {
          sendMail: inviteSendMail,
          requestedRole: inviteRole,
          displayName: inviteDisplayName.trim() || inviteEmail.trim(),
          invitedBy: "FunniFin",
        });
        notify("Invito inviato", `Invito ${inviteSendMail ? "con mail" : "senza mail"} preparato per ${inviteEmail.trim()}.`);
      } else {
        await updateAuthUser(authModalTargetId, {
          email: inviteEmail.trim(),
          actualRole: inviteRole,
          displayName: inviteDisplayName.trim() || inviteEmail.trim(),
          expertId: inviteExpertId.trim(),
          invitedBy: "FunniFin",
          disabled: inviteDisabled,
        });
        notify("Utente aggiornato", `${inviteDisplayName.trim() || inviteEmail.trim()} salvato su Google Sheets.`);
      }
      resetAuthModal();
      await refreshAuthData();
    } catch (error) {
      notify(authModalMode === "create" ? "Invito non riuscito" : "Aggiornamento non riuscito", error instanceof Error ? error.message : "Non sono riuscito a salvare l'utente.");
    } finally {
      setInviteBusy(false);
    }
  };

  const handleReviewAccessRequest = async (req: AccessRequest, status: "approved" | "rejected") => {
    setInviteBusy(true);
    try {
      await reviewAccessRequest(req.id, {
        status,
        sendMail: req.sendMail,
        reviewedBy: "FunniFin",
      });
      notify(status === "approved" ? "Richiesta approvata" : "Richiesta rifiutata", req.email);
      await refreshAuthData();
    } catch (error) {
      notify("Aggiornamento accesso non riuscito", error instanceof Error ? error.message : "Controlla il backend auth.");
    } finally {
      setInviteBusy(false);
    }
  };

  const workspaceSettingMap = useMemo(
    () => new Map(workspaceSettings.map((setting) => [setting.key, setting])),
    [workspaceSettings],
  );
  const getWorkspaceSettingValue = (key: string, fallback = "") => workspaceSettingMap.get(key)?.value || fallback;
  const workspaceRecipientEmails = useMemo<Partial<Record<WorkflowNotificationRecipientRole, string>>>(
    () => ({
      funnifin: getWorkspaceSettingValue("mail.funnifin", SECRET_SETTINGS.google.email.testRecipients.funnifin),
      expert: getWorkspaceSettingValue("mail.expert", SECRET_SETTINGS.google.email.testRecipients.expert),
      brand: getWorkspaceSettingValue("mail.brand", SECRET_SETTINGS.google.email.testRecipients.brand),
    }),
    [workspaceSettingMap],
  );
  const getAudienceUsers = (role: AppNotificationRole, email?: string) => {
    const normalizedEmail = email?.trim().toLowerCase();
    const candidates = authUsers.filter((user) => !user.disabled && user.actualRole === role);
    const emailMatches = normalizedEmail ? candidates.filter((user) => user.email.toLowerCase() === normalizedEmail) : [];
    const users = emailMatches.length ? emailMatches : candidates;
    return {
      userIds: users.map((user) => user.id),
      emails: normalizedEmail ? [normalizedEmail] : users.map((user) => user.email.toLowerCase()),
    };
  };
  const getExpertAudienceUsers = (expertName?: string) => {
    if (!expertName) return getAudienceUsers("Esperto", workspaceRecipientEmails.expert);
    const normalizedName = expertName.trim().toLowerCase();
    const profile = expertDirectory.find((expert) => expertFullName(expert).toLowerCase() === normalizedName);
    const matchedUsers = authUsers.filter((user) => (
      !user.disabled &&
      user.actualRole === "Esperto" &&
      ((profile?.id && user.expertId === profile.id) || (profile?.email && user.email.toLowerCase() === profile.email.toLowerCase()))
    ));
    if (matchedUsers.length > 0) {
      return {
        userIds: matchedUsers.map((user) => user.id),
        emails: matchedUsers.map((user) => user.email.toLowerCase()),
      };
    }
    if (profile?.email) return getAudienceUsers("Esperto", profile.email);
    return getAudienceUsers("Esperto", workspaceRecipientEmails.expert);
  };
  const workflowCopyForRole = (
    phase: WorkflowNotificationPayload["phase"],
    targetRole: AppNotificationRole,
    company: string,
  ) => {
    if (phase === "request_updated") {
      return {
        actorTitle: "Richiesta aggiornata",
        actorBody: `Hai aggiornato richiesta, workshop o preventivo per ${company}.`,
        targetTitle: "FunniFin ha aggiornato la richiesta",
        targetBody: `${company}: controlla workshop, date e prossima azione aggiornata.`,
      };
    }
    if (phase === "dates_approved") {
      return {
        actorTitle: "Date approvate",
        actorBody: `Hai approvato le date per ${company}.`,
        targetTitle: "FunniFin ha approvato le date",
        targetBody: `${company}: le date sono approvate, prosegui con la prossima fase.`,
      };
    }
    if (phase === "date_change_requested") {
      return {
        actorTitle: "Modifica date richiesta",
        actorBody: `Hai richiesto una modifica date per ${company}.`,
        targetTitle: "FunniFin chiede una modifica date",
        targetBody: `${company}: apri la task e aggiorna la proposta date.`,
      };
    }
    if (phase === "candidacies_open" && targetRole === "Esperto") {
      return {
        actorTitle: "Candidature aperte agli esperti",
        actorBody: `Hai aperto le candidature esperti per ${company}.`,
        targetTitle: "FunniFin ha aperto una candidatura",
        targetBody: `${company}: valuta i workshop disponibili e candidati se sei compatibile.`,
      };
    }
    if (phase === "brand_review" && targetRole === "Brand") {
      return {
        actorTitle: "Presentazione assegnata al Brand",
        actorBody: `Hai assegnato a Brand la revisione materiali per ${company}.`,
        targetTitle: "FunniFin ti ha assegnato una presentazione",
        targetBody: `${company}: controlla deck, note e abilitazione finale per Calendar.`,
      };
    }
    if (phase === "expert_assigned" && targetRole === "Esperto") {
      return {
        actorTitle: "Workshop assegnato all'esperto",
        actorBody: `Hai assegnato l'incarico esperto per ${company}.`,
        targetTitle: "FunniFin ti ha assegnato un workshop",
        targetBody: `${company}: trovi incarico, date e materiali nella tua area esperto.`,
      };
    }
    if (phase === "event_tentative") {
      return {
        actorTitle: "Evento provvisorio creato",
        actorBody: `Hai creato l'evento provvisorio per ${company}.`,
        targetTitle: "FunniFin ha creato un evento provvisorio",
        targetBody: `${company}: controlla invito, Meet e dettagli evento.`,
      };
    }
    if (phase === "event_confirmed") {
      return {
        actorTitle: "Evento confermato",
        actorBody: `Hai confermato l'evento per ${company}.`,
        targetTitle: "FunniFin ha confermato l'evento",
        targetBody: `${company}: evento, Meet e materiali finali sono pronti.`,
      };
    }
    if (phase === "final_approval") {
      return {
        actorTitle: "Approvazione finale inviata",
        actorBody: `Hai inviato l'approvazione finale per ${company}.`,
        targetTitle: "FunniFin ha inviato l'approvazione finale",
        targetBody: `${company}: controlla l'ultima conferma prima dell'evento.`,
      };
    }
    return {
      actorTitle: "Notifica workflow inviata",
      actorBody: `Hai inviato un aggiornamento a ${targetRole} per ${company}.`,
      targetTitle: "FunniFin ti ha inviato un aggiornamento",
      targetBody: `${company}: apri la task collegata per continuare il workflow.`,
    };
  };
  const effectiveAdminSettingDefinitions = useMemo(
    () =>
      adminSettingDefinitions.map((definition) => {
        const runtimeValue =
          definition.key === "calendar.id"
            ? googleHealth?.calendar.id || appEnv[SECRET_SETTINGS.google.env.funnifinCalendarId] || ""
            : definition.key === "calendar.name"
              ? googleHealth?.calendar.name || appEnv[SECRET_SETTINGS.google.env.funnifinCalendarName] || ""
              : definition.key === "drive.rootFolderId"
                ? googleHealth?.drive.rootFolderId || appEnv[SECRET_SETTINGS.google.env.driveRootFolderId] || ""
                : definition.key === "drive.slidesRootFolderId"
                  ? googleHealth?.drive.slidesRootFolderId || appEnv[SECRET_SETTINGS.google.env.slidesTemplateFolderId] || ""
                  : definition.key === "env.appScriptDeploymentUrl"
                    ? appEnv[SECRET_SETTINGS.google.env.appScriptDeploymentUrl] || ""
                    : definition.key === "env.driveRootFolderId"
                      ? appEnv[SECRET_SETTINGS.google.env.driveRootFolderId] || ""
                      : definition.key === "env.slidesTemplateFolderId"
                        ? appEnv[SECRET_SETTINGS.google.env.slidesTemplateFolderId] || ""
                        : definition.value;
        return { ...definition, value: runtimeValue };
      }),
    [googleHealth],
  );
  useEffect(() => {
    let alive = true;
    listPricingRules()
      .then((remoteRules) => {
        if (!alive || remoteRules.length === 0) return;
        setRules(remoteRules.map((rule) => ({
          id: rule.id,
          name: rule.name,
          min: rule.min,
          max: rule.max,
          discountPercent: rule.discountPercent,
          specialQuote: rule.specialQuote,
        })));
        setPricingSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch((error) => {
        if (!alive) return;
        notify("Prezzi Google non letti", error instanceof Error ? error.message : "Sheet prezzi non disponibile.");
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    Promise.all([listCatalogConfig(), listCatalogWorkshops()])
      .then(([remoteTopics, remoteWorkshops]) => {
        if (!alive || (remoteTopics.length === 0 && remoteWorkshops.length === 0)) return;
        if (remoteTopics.length > 0) {
          setCatalogEdits((current) => {
            const next = { ...current };
            remoteTopics.forEach((topic) => {
              next[topic.id] = {
                title: topic.title,
                description: topic.description,
                badge: topic.badge,
                active: topic.active,
              };
            });
            return next;
          });
        }
        if (remoteWorkshops.length > 0) {
          setSheetCatalogWorkshops(remoteWorkshops);
        }
        setCatalogRefreshedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch((error) => {
        if (!alive) return;
        notify("Catalogo Google non letto", error instanceof Error ? error.message : "Sheet catalogo non disponibile.");
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    listExperts()
      .then((remoteExperts) => {
        if (!alive || remoteExperts.length === 0) return;
        setExpertDirectory(remoteExperts.map((expert) => ({
          id: expert.id,
          firstName: expert.firstName,
          lastName: expert.lastName,
          email: expert.email,
          photo: expert.photo,
          bio: expert.bio,
          topicIds: expert.topicIds,
          themeIds: expert.themeIds,
          availability: expert.availability,
        })));
        setExpertsSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch((error) => {
        if (!alive) return;
        notify("Esperti Google non letti", error instanceof Error ? error.message : "Sheet esperti non disponibile.");
      });
    return () => {
      alive = false;
    };
  }, []);
  useEffect(() => {
    let alive = true;
    listWorkspaceSettings()
      .then((settings) => {
        if (!alive) return;
        setWorkspaceSettings(settings);
      })
      .catch((error) => {
        if (!alive) return;
        notify("Settings Google non letti", error instanceof Error ? error.message : "Sheet impostazioni non disponibile.");
      });
    return () => {
      alive = false;
    };
  }, []);
  const selectedExpertProfile = selectedExpertProfileId ? expertDirectory.find((expert) => expert.id === selectedExpertProfileId) : undefined;
  const selectedProject = adminProjects.find((project) => project.id === selectedProjectId) ?? adminProjects[0] ?? localProject;
  const selectedProjectRows = selectedProject.workshopIds
    .map((id) => workshops.find((workshop) => workshop.id === id))
    .filter(Boolean) as Workshop[];
  const projectWorkshopKey = (workshopId: string) => `${selectedProject.id}:${workshopId}`;
  const currentProjectSelections: AdminProjectWorkshopRow[] = selectedProjectRows.map((workshop, index) => {
    const liveSelection = selectedProject.source === "local" ? selections.find((selection) => selection.workshopId === workshop.id) : undefined;
    const requestWorkshop = selectedProject.request?.workshops.find((item) => item.workshopId === workshop.id);
    return {
      workshop,
      date: liveSelection?.date || requestWorkshop?.date || "",
      time: liveSelection?.time || requestWorkshop?.time || "10:00",
      format: liveSelection?.format || requestWorkshop?.format || workshop.formatOptions[0],
      duration: liveSelection?.duration || requestWorkshop?.duration || workshop.durationOptions[0],
      approval: dateApprovals[projectWorkshopKey(workshop.id)] ?? requestWorkshop?.approval ?? "pending",
      assignedExpert: workshopExperts[projectWorkshopKey(workshop.id)] ?? requestWorkshop?.expertName ?? (index === 0 ? selectedProject.assignedExpert : undefined),
    };
  });
  const allProjectDatesApproved = currentProjectSelections.length > 0 && currentProjectSelections.every((row) => row.approval === "approved");
  const activeAdminStatus = selectedProject.source === "local" ? projectStatus : selectedProject.status;
  const activeAdminQuote = selectedProject.source === "local" ? quote.total : selectedProject.quoteTotal;
  const notifyWorkflowRecipients = ({
    phase,
    recipients,
    deliveredRecipients,
    deliveryLabel,
    expertName,
  }: {
    phase: WorkflowNotificationPayload["phase"];
    recipients: WorkflowNotificationRecipientRole[];
    deliveredRecipients: string[];
    deliveryLabel: string;
    expertName?: string;
  }) => {
    const audience = Array.from(
      new Set(recipients.map(notificationRoleFromRecipient).filter((item): item is AppNotificationRole => Boolean(item))),
    );
    const actorCopy = workflowCopyForRole(phase, audience[0] ?? "FunniFin", selectedProject.company);
    notify(actorCopy.actorTitle, `${actorCopy.actorBody} ${deliveryLabel}: ${deliveredRecipients.join(", ") || "nessun destinatario operativo"}.`, {
      audience: ["FunniFin"],
      audienceUserIds: currentUserId ? [currentUserId] : undefined,
      audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
      priority: audience.length > 0 ? "task" : "info",
      category: "mail",
      action: { label: "Apri progetto", role: "FunniFin", hash: "#funnifin", projectId: selectedProject.id },
    });
    audience.forEach((targetRole) => {
      if (targetRole === "FunniFin") return;
      const recipientRole = targetRole === "Esperto" ? "expert" : "brand";
      const targetUsers = targetRole === "Esperto" && expertName
        ? getExpertAudienceUsers(expertName)
        : getAudienceUsers(targetRole, workspaceRecipientEmails[recipientRole]);
      const copy = workflowCopyForRole(phase, targetRole, selectedProject.company);
      notify(copy.targetTitle, copy.targetBody, {
        audience: [targetRole],
        audienceUserIds: targetUsers.userIds.length ? targetUsers.userIds : undefined,
        audienceEmails: targetUsers.emails.length ? targetUsers.emails : undefined,
        priority: "task",
        category: "mail",
        action: workflowNotificationAction([targetRole]),
        toast: false,
      });
    });
  };
  useEffect(() => {
    syncProjectStatus(activeAdminStatus);
  }, [activeAdminStatus, syncProjectStatus]);
  useEffect(() => {
    let alive = true;
    setRequestSyncState((current) => ({ ...current, loading: true, error: "" }));
    listWorkshopRequests()
      .then((requests) => {
        if (!alive) return;
        const projects = requests.map(requestToAdminProject);
        const hasCurrent = currentRequest ? projects.some((project) => project.id === currentRequest.id) : true;
        const nextProjects = currentRequest && !hasCurrent ? [requestToAdminProject(currentRequest), ...projects] : projects;
        setAdminProjects(nextProjects);
        setSelectedProjectId((current) => (nextProjects.some((project) => project.id === current) ? current : nextProjects[0]?.id ?? ""));
        setRequestSyncState({ loading: false, error: "", source: "sheet" });
      })
      .catch((error) => {
        if (!alive) return;
        const projects = currentRequest ? [requestToAdminProject(currentRequest)] : [];
        setAdminProjects(projects);
        setSelectedProjectId((current) => (projects.some((project) => project.id === current) ? current : projects[0]?.id ?? ""));
        setRequestSyncState({ loading: false, error: error instanceof Error ? error.message : "Registro richieste non disponibile.", source: "sheet" });
      });
    return () => {
      alive = false;
    };
  }, [requestRefreshToken, currentRequest?.id]);
  useEffect(() => {
    if (adminWorkspacePanel !== "folder" || clientAssetFolder) return;
    let alive = true;
    setDriveFolderStatus({ loading: true, error: "" });
    getDriveFolderPreview()
      .then((result) => {
        if (!alive) return;
        setDriveFolderPreview(result);
        setDriveFolderStatus({ loading: false, error: result ? "" : "Cartella Drive non configurata." });
      })
      .catch((error) => {
        if (!alive) return;
        setDriveFolderPreview(null);
        setDriveFolderStatus({ loading: false, error: getFriendlyErrorMessage(error, "Lettura Drive non riuscita.") });
      });
    return () => {
      alive = false;
    };
  }, [adminWorkspacePanel, selectedProject.id, clientAssetFolder]);
  const persistAdminProjectPatch = (projectId: string, patch: Partial<WorkshopRequestRecord>, eventType: string, note: string) => {
    const target = adminProjects.find((project) => project.id === projectId);
    if (target?.source !== "sheet") return;
    void updateWorkshopRequest(projectId, patch, { type: eventType, note, payload: patch })
      .then((request) => {
        setAdminProjects((current) =>
          current.map((project) => {
            if (project.id !== projectId) return project;
            const remoteProject = requestToAdminProject(request);
            const status = patch.status ?? project.status;
            return {
              ...remoteProject,
              status,
              request: remoteProject.request ? { ...remoteProject.request, status } : remoteProject.request,
            };
          }),
        );
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Aggiornamento richiesta non salvato";
        notify("Registro richieste non aggiornato", message);
      });
  };
  const updateAdminProject = (projectId: string, patch: Partial<AdminProject>, eventType = "request_updated", note = "Richiesta aggiornata da FunniFin") => {
    setAdminProjects((current) => current.map((project) => (project.id === projectId ? { ...project, ...patch } : project)));
    const requestPatch: Partial<WorkshopRequestRecord> = {};
    if (patch.status) requestPatch.status = patch.status;
    if (patch.assignedExpert !== undefined) requestPatch.assignedExpert = patch.assignedExpert;
    if (patch.quoteTotal !== undefined) requestPatch.quoteTotal = patch.quoteTotal;
    if (patch.workshopIds) requestPatch.workshopIds = patch.workshopIds;
    if (patch.dateCount !== undefined) requestPatch.dateCount = patch.dateCount;
    if (Object.keys(requestPatch).length) persistAdminProjectPatch(projectId, requestPatch, eventType, note);
  };
  const buildRequestWorkshopRecords = (
    overrides: Record<string, Partial<RequestWorkshopRecord>> = {},
  ): RequestWorkshopRecord[] =>
    currentProjectSelections.map((row) => {
      const existing = selectedProject.request?.workshops.find((workshop) => workshop.workshopId === row.workshop.id);
      const override = overrides[row.workshop.id] ?? {};
      return {
        workshopId: row.workshop.id,
        title: row.workshop.title,
        duration: row.duration,
        format: row.format,
        date: row.date,
        time: row.time,
        price: getWorkshopSelectionPrice(row.workshop, { duration: row.duration, format: row.format, custom: existing?.custom ?? false }).total,
        custom: existing?.custom ?? false,
        customNote: existing?.customNote,
        status: existing?.status ?? "selezionato",
        approval: row.approval,
        expertName: row.assignedExpert,
        ...override,
      };
    });
  const persistSelectedProjectWorkshops = (records: RequestWorkshopRecord[], eventType: string, note: string) => {
    if (selectedProject.source !== "sheet") return;
    const assignedExpert = records.find((record) => record.expertName)?.expertName;
    persistAdminProjectPatch(
      selectedProject.id,
      {
        workshops: records,
        workshopIds: records.map((record) => record.workshopId),
        dateCount: records.filter((record) => record.date).length,
        assignedExpert,
      },
      eventType,
      note,
    );
  };
  const buildEditedRequestPatch = (records: RequestWorkshopRecord[]) => {
    const quoteTotal = records.reduce((total, record) => {
      const workshop = workshops.find((item) => item.id === record.workshopId);
      if (!workshop) return total;
      return total + getWorkshopSelectionPrice(workshop, { duration: record.duration, format: record.format, custom: record.custom }).total;
    }, 0);
    return {
      workshops: records,
      workshopIds: records.map((record) => record.workshopId),
      dateCount: records.filter((record) => record.date).length,
      quoteTotal,
      quote: {
        ...(selectedProject.request?.quote ?? {
          gross: 0,
          discount: 0,
          promoDiscount: 0,
          customTotal: 0,
          total: 0,
          saved: 0,
          packageName: "",
        }),
        gross: quoteTotal,
        total: quoteTotal,
        discount: 0,
        promoDiscount: 0,
        saved: 0,
        packageName: "Modifica FunniFin",
      },
    } satisfies Partial<WorkshopRequestRecord>;
  };
  const confirmRequestEdit = async (records: RequestWorkshopRecord[], phase: ProjectStatus, notification: NotificationChoice) => {
    const patch = buildEditedRequestPatch(records);
    const adminPatch: Partial<AdminProject> = {
      workshopIds: patch.workshopIds ?? [],
      dateCount: patch.dateCount ?? 0,
      quoteTotal: patch.quoteTotal ?? 0,
      status: phase,
      request: selectedProject.request ? { ...selectedProject.request, ...patch, status: phase } : selectedProject.request,
    };
    updateAdminProject(selectedProject.id, adminPatch, "request_admin_edited", "FunniFin ha modificato workshop, date o preventivo della richiesta.");
    setProjectStatus(phase, "Fase progetto aggiornata", selectedProject.source === "local" ? statusLabel[phase] : `${selectedProject.company}: ${statusLabel[phase]}`);
    setDateApprovals((current) => {
      const next = { ...current };
      Object.keys(next).forEach((key) => {
        if (key.startsWith(`${selectedProject.id}:`) && !records.some((record) => key.endsWith(`:${record.workshopId}`))) delete next[key];
      });
      records.forEach((record) => {
        if (record.approval) next[projectWorkshopKey(record.workshopId)] = record.approval;
      });
      return next;
    });
    if (selectedProject.source === "sheet") {
      persistAdminProjectPatch(
        selectedProject.id,
        { ...patch, status: phase },
        "request_admin_edited",
        "FunniFin ha modificato la richiesta cliente.",
      );
    }
    if (notification.send && notification.recipients.length > 0) {
      const result = await sendWorkflowNotification({
        phase: "request_updated",
        project: {
          id: selectedProject.id,
          company: selectedProject.company,
          manager: selectedProject.manager,
          email: selectedProject.email,
          phone: selectedProject.phone,
          status: statusLabel[phase],
          quoteTotal: patch.quoteTotal ?? activeAdminQuote,
        },
        workshops: records.map((record) => ({
          title: record.title,
          date: record.date,
          time: record.time,
          duration: record.duration,
          format: record.format,
          expertName: record.expertName,
        })),
        recipients: notification.recipients,
        recipientEmails: workspaceRecipientEmails,
        fromName: getWorkspaceSettingValue("mail.fromName", SECRET_SETTINGS.google.email.fromName),
        note: notification.note,
      });
      notifyWorkflowRecipients({
        phase: "request_updated",
        recipients: notification.recipients,
        deliveredRecipients: result.recipients,
        deliveryLabel: result.sent ? "Email inviata" : "Email non inviata",
      });
    } else {
      notify("Richiesta modificata", `Fase: ${statusLabel[phase]}. Salvata senza inviare email.`, {
        audience: ["FunniFin"],
        audienceUserIds: currentUserId ? [currentUserId] : undefined,
        audienceEmails: currentUserEmail ? [currentUserEmail] : undefined,
        priority: "info",
        category: "task",
        action: { label: "Apri progetto", role: "FunniFin", hash: "#funnifin", projectId: selectedProject.id },
      });
    }
    setAdminActionModal(null);
  };
  const runProjectStatus = (status: ProjectStatus, title: string, body: string) => {
    updateAdminProject(selectedProject.id, { status });
    setProjectStatus(status, title, selectedProject.source === "local" ? body : `${selectedProject.company}: ${body}`);
  };
  const expertFullName = (expert: ExpertProfile) => `${expert.firstName} ${expert.lastName}`.trim();
  const updateExpertProfile = (expertId: string, patch: Partial<ExpertProfile>) => {
    setExpertDirectory((current) => current.map((expert) => (expert.id === expertId ? { ...expert, ...patch } : expert)));
  };
  const saveExpertProfile = (expert: ExpertProfile) => {
    setExpertProfileSaving(true);
    void updateExpert({ ...expert, active: true })
      .then((savedExpert) => {
        setExpertDirectory((current) => current.map((item) => (item.id === savedExpert.id ? {
          id: savedExpert.id,
          firstName: savedExpert.firstName,
          lastName: savedExpert.lastName,
          email: savedExpert.email,
          photo: savedExpert.photo,
          bio: savedExpert.bio,
          topicIds: savedExpert.topicIds,
          themeIds: savedExpert.themeIds,
          availability: savedExpert.availability,
        } : item)));
        setExpertsSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Profilo esperto salvato su Google", `${expertFullName(savedExpert)} aggiornato nel pool esperti.`);
        setSelectedExpertProfileId(null);
      })
      .catch((error) => {
        notify("Profilo esperto non salvato", error instanceof Error ? error.message : "Google Sheets non disponibile.");
        setSelectedExpertProfileId(null);
      })
      .finally(() => setExpertProfileSaving(false));
  };
  const createExpertProfile = () => {
    const id = `esperto-${Date.now()}`;
    const topicId = topics[0]?.id ?? "";
    const themeIds = topics[0]?.themes.map((theme) => theme.id) ?? [];
    const next: ExpertProfile = {
      id,
      firstName: "Nuovo",
      lastName: "Esperto",
      email: `rinaldi.rilio+${expertDirectory.length + 3}@gmail.com`,
      photo: "",
      bio: "Descrizione breve del profilo e delle competenze.",
      topicIds: topicId ? [topicId] : [],
      themeIds,
      availability: "da configurare",
    };
    setExpertDirectory((current) => [...current, next]);
    setSelectedExpertProfileId(id);
    notify("Esperto creato", "Completa anagrafica, mail e associazioni al catalogo.");
  };
  const deleteExpertProfile = (expertId: string) => {
    if (expertProfileDeleting) return;
    setExpertProfileDeleting(true);
    const expert = expertDirectory.find((item) => item.id === expertId);
    const nextDirectory = expertDirectory.filter((item) => item.id !== expertId);
    setExpertDirectory(nextDirectory);
    setSelectedExpertProfileId(null);
    void deleteExpert(expertId)
      .then(() => {
        setExpertsSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        if (expert) notify("Esperto eliminato da Google", `${expertFullName(expert)} rimosso dal pool esperti.`);
      })
      .catch((error) => {
        if (expert) notify("Esperto non eliminato dallo Sheet", error instanceof Error ? error.message : "Google Sheets non disponibile.");
      })
      .finally(() => setExpertProfileDeleting(false));
  };
  const syncDriveSlidesFromRoot = () => {
    const today = new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" });
    setDriveSlideLinks((current) =>
      Object.fromEntries(
        workshops.map((workshop) => [
          workshop.id,
          {
            fileId: current[workshop.id]?.fileId ?? `drive-${workshop.id}`,
            name: workshop.masterSlide,
            url: current[workshop.id]?.url ?? "https://drive.google.com/",
            modifiedAt: today,
            status: "aggiornata",
          } satisfies DriveSlideLink,
        ]),
      ),
    );
    setDriveSlidesSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
    notify("Slide Drive sincronizzate", `Letta root ${driveSlidesRoot}: match per nome applicato a ${workshops.length} workshop.`);
  };
  const sendPhaseNotification = async (
    phase: WorkflowNotificationPayload["phase"],
    choice: NotificationChoice,
    event?: WorkflowNotificationPayload["event"],
    context?: { expertName?: string },
  ) => {
    if (!choice.send || choice.recipients.length === 0) return;
    try {
      const result = await sendWorkflowNotification({
        phase,
        project: {
          id: selectedProject.id,
          company: selectedProject.company,
          manager: selectedProject.manager,
          email: selectedProject.email,
          phone: selectedProject.phone,
          status: statusLabel[activeAdminStatus],
          quoteTotal: activeAdminQuote,
        },
        workshops: currentProjectSelections.map((row) => ({
          title: row.workshop.title,
          date: row.date,
          time: row.time,
          duration: row.duration,
          format: row.format,
          expertName: row.assignedExpert,
        })),
        recipients: choice.recipients,
        recipientEmails: workspaceRecipientEmails,
        fromName: getWorkspaceSettingValue("mail.fromName", SECRET_SETTINGS.google.email.fromName),
        note: choice.note,
        event,
      });
      const mailTitle = result.sent ? "Email inviata" : "Email non inviata";
      notifyWorkflowRecipients({
        phase,
        recipients: choice.recipients,
        deliveredRecipients: result.recipients,
        deliveryLabel: mailTitle,
        expertName: context?.expertName,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invio notifica non riuscito";
      notify("Email non inviata", message, {
        audience: ["FunniFin"],
        priority: "critical",
        category: "mail",
        action: { label: "Verifica Google", role: "FunniFin", hash: "#funnifin" },
      });
    }
  };
  const selectProject = (project: AdminProject) => {
    setSelectedProjectId(project.id);
    setAssignmentWorkshopId(project.workshopIds[0] ?? "");
    if (project.source === "local") setProjectStatus(projectStatus, "Richiesta locale", "Non ancora salvata sul registro richieste.");
    else notify("Progetto selezionato", `${project.company}: ${statusLabel[project.status]}.`);
  };
  const confirmDeleteRequest = async () => {
    if (!requestDeleteConfirm) return;
    const project = requestDeleteConfirm;
    setDeletingRequestId(project.id);
    try {
      if (project.source !== "local") {
        await deleteWorkshopRequest(project.id);
      }
      const nextProjects = adminProjects.filter((item) => item.id !== project.id);
      const fallbackProjects = nextProjects.length ? nextProjects : [buildLocalAdminProject(selections, quote.total, projectStatus)];
      setAdminProjects(fallbackProjects);
      setSelectedProjectId((current) => (current === project.id ? fallbackProjects[0].id : current));
      setDateApprovals((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${project.id}:`))));
      setWorkshopExperts((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${project.id}:`))));
      setCalendarEvents((current) => {
        const next = { ...current };
        delete next[project.id];
        return next;
      });
      setRequestDeleteConfirm(null);
      setRequestSyncState((current) => ({ ...current, source: nextProjects.length ? current.source : "local" }));
      notify("Richiesta eliminata", `${project.company} rimossa dalla coda clienti.`);
    } catch (error) {
      notify("Richiesta non eliminata", getFriendlyErrorMessage(error, "Eliminazione non riuscita."));
    } finally {
      setDeletingRequestId("");
    }
  };
  const assignExpertTo = (workshopId: string, expertName = expertDraft) => {
    const workshop = workshops.find((item) => item.id === workshopId);
    setAssignmentWorkshopId(workshopId);
    setExpertDraft(expertName);
    setWorkshopExperts((current) => ({ ...current, [projectWorkshopKey(workshopId)]: expertName }));
    updateAdminProject(selectedProject.id, { assignedExpert: expertName, status: "esperto_assegnato" });
    persistSelectedProjectWorkshops(
      buildRequestWorkshopRecords({ [workshopId]: { expertName, status: "esperto_assegnato" } }),
      "expert_assigned",
      `${expertName} assegnato a ${workshop?.title ?? "workshop selezionato"}.`,
    );
    if (selectedProject.source === "local" && workshopId) updateSelection(workshopId, { status: "esperto_assegnato" });
    runProjectStatus("esperto_assegnato", "Esperto assegnato", `${expertName} assegnato a ${workshop?.title ?? "workshop selezionato"}.`);
  };
  const confirmExpertAssignment = async (workshopId: string, expertName: string, mode: "assign" | "reassign", choice: NotificationChoice) => {
    if (mode === "reassign") reassignWorkshop(workshopId);
    else assignExpertTo(workshopId, expertName);
    await sendPhaseNotification(mode === "reassign" ? "candidacies_open" : "expert_assigned", choice, undefined, { expertName });
  };
  const verifyCalendars = async () => {
    setCalendarCheck({ checked: false, loading: true, freeSlots: 0, source: "Google Calendar FreeBusy" });
    setAdminWorkspacePanel("calendar");
    try {
      const results = await Promise.all(
        currentProjectSelections.map((row) =>
          getWorkshopAvailability({
            date: row.date,
            duration: row.duration,
            format: row.format,
            expertIds: row.workshop.experts,
          }),
        ),
      );
      const freeSlots = results.reduce((total, result) => total + result.slots.filter((slot) => slot.status === "available" || slot.status === "promo").length, 0);
      const source = "Google Calendar FreeBusy";
      setCalendarCheck({ checked: true, loading: false, freeSlots, source });
      runProjectStatus("in_verifica_funnifin", "Calendari verificati", `${freeSlots} slot compatibili trovati da ${source}. Ora approva o chiedi modifica alle singole date.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Errore verifica calendario";
      setCalendarCheck({ checked: false, loading: false, freeSlots: 0, source: "Google Calendar FreeBusy", error: message });
      runProjectStatus("in_verifica_funnifin", "Verifica calendario non riuscita", message);
    }
  };
  const setDateDecision = (workshopId: string, approval: DateDecision) => {
    setDateApprovals((current) => ({ ...current, [projectWorkshopKey(workshopId)]: approval }));
    if (selectedProject.source === "local") {
      updateSelection(workshopId, { status: approval === "approved" ? "date_approvate" : "date_proposte" });
    }
    persistSelectedProjectWorkshops(
      buildRequestWorkshopRecords({
        [workshopId]: {
          approval,
          status: approval === "approved" ? "date_approvate" : approval === "change_requested" ? "date_modifica_richiesta" : "date_rifiutate",
        },
      }),
      approval === "approved" ? "date_approved" : "date_change_requested",
      `${approval === "approved" ? "Data approvata" : "Modifica data richiesta"} per ${workshops.find((item) => item.id === workshopId)?.title ?? workshopId}.`,
    );
    const nextApprovals = currentProjectSelections.map((row) => (row.workshop.id === workshopId ? approval : row.approval));
    if (nextApprovals.every((item) => item === "approved")) {
      runProjectStatus("date_approvate", "Date approvate", "Tutte le date del progetto sono state approvate. Ora puoi aprire le candidature.");
    } else if (approval === "change_requested") {
      runProjectStatus("in_verifica_funnifin", "Modifica date richiesta", "Il cliente deve proporre una nuova opzione per il workshop selezionato.");
    }
  };
  const confirmDateDecision = async (workshopId: string, decision: DateDecision, choice: NotificationChoice) => {
    setDateDecision(workshopId, decision);
    const nextApprovals = currentProjectSelections.map((row) => (row.workshop.id === workshopId ? decision : row.approval));
    const completesAllDates = decision === "approved" && nextApprovals.every((item) => item === "approved");
    if (decision === "approved" && !completesAllDates) return;
    await sendPhaseNotification(decision === "approved" ? "dates_approved" : "date_change_requested", choice, undefined);
  };
  const openCandidacies = () => {
    if (!allProjectDatesApproved) {
      setAdminWorkspacePanel("calendar");
      notify("Date non complete", "Approva tutte le date del progetto prima di aprire le candidature agli esperti.");
      return;
    }
    setAdminWorkspacePanel("experts");
    runProjectStatus("aperto_a_esperti", "Candidature aperte", "Gli esperti compatibili vedono le opportunita e possono candidarsi.");
  };
  const inviteExpertsToCandidacy = async (choice: NotificationChoice) => {
    openCandidacies();
    await sendPhaseNotification("candidacies_open", choice, undefined);
  };
  const reassignWorkshop = (workshopId: string) => {
    setAssignmentWorkshopId(workshopId);
    setWorkshopExperts((current) => {
      const next = { ...current };
      delete next[projectWorkshopKey(workshopId)];
      return next;
    });
    if (selectedProject.source === "local") updateSelection(workshopId, { status: "esperto_da_assegnare" });
    persistSelectedProjectWorkshops(
      buildRequestWorkshopRecords({ [workshopId]: { expertName: "", status: "esperto_da_assegnare" } }),
      "expert_reopened",
      "Workshop riaperto a candidature esperti.",
    );
    runProjectStatus("aperto_a_esperti", "Riassegnazione aperta", "Il workshop torna in candidatura: scegli un nuovo esperto compatibile.");
    setAdminWorkspacePanel("experts");
  };
  const currentProjectEvent = calendarEvents[selectedProject.id];
  const calendarDeckEnabled = Boolean(selectedProject.request?.materials?.calendarDeckEnabled && selectedProject.request.materials.finalDeckUrl);
  const calendarDeckTitle = selectedProject.request?.materials?.finalDeckTitle || selectedProject.request?.materials?.folderName || "";
  const calendarDeckUrl = calendarDeckEnabled ? selectedProject.request?.materials?.finalDeckUrl : undefined;
  const currentProjectSessionItems = currentProjectSelections.map((row) => ({
    id: row.workshop.id,
    title: row.workshop.title,
    date: row.date,
    time: row.time,
    duration: row.duration,
    format: row.format,
    expertName: row.assignedExpert,
  }));
  const eventPrechecks = [
    { label: "Date approvate", done: allProjectDatesApproved },
    { label: "Esperti assegnati", done: currentProjectSelections.length > 0 && currentProjectSelections.every((row) => row.assignedExpert) },
    { label: "Materiali passati a brand", done: projectStatuses.indexOf(activeAdminStatus) >= projectStatuses.indexOf("in_revisione_brand") },
  ];
  const canConfirmEvent = eventPrechecks.every((item) => item.done);
  const brandApprovedForCalendar = Boolean(
    calendarDeckUrl && projectStatuses.indexOf(activeAdminStatus) >= projectStatuses.indexOf("approvazione_finale"),
  );
  const sendBrandHandoff = async (choice: NotificationChoice) => {
    runProjectStatus("in_revisione_brand", "In revisione brand", "Il deck passa al team brand/design.");
    setAdminWorkspacePanel("confirm");
    await sendPhaseNotification("brand_review", choice, undefined);
  };
  const createCalendarEvent = async (choice?: NotificationChoice) => {
    if (!canConfirmEvent) return;
    try {
      const eventMode = choice?.eventMode ?? "confirmed";
      const bypassBrandApproval = eventMode === "confirmed" && Boolean(choice?.bypassBrandApproval);
      if (eventMode === "confirmed" && !brandApprovedForCalendar && !bypassBrandApproval) {
        notify("Brand non approvato", "Conferma il bypass Brand nella modale per creare comunque il definitivo.");
        return;
      }
      const eventRecord = await createWorkshopCalendarEvent({
        projectId: selectedProject.id,
        company: selectedProject.company,
        manager: selectedProject.manager,
        managerEmail: selectedProject.email,
        managerPhone: selectedProject.phone,
        quoteTotal: activeAdminQuote,
        eventMode,
        driveFolderUrl: selectedProject.request?.materials?.folderUrl,
        finalDeckUrl: eventMode === "confirmed" && !bypassBrandApproval ? calendarDeckUrl : undefined,
        finalDeckTitle: eventMode === "confirmed" && !bypassBrandApproval ? calendarDeckTitle : undefined,
        sendCalendarInvites: eventMode === "confirmed" && Boolean(choice?.send),
        includeClientInCalendar: Boolean(choice?.addClientToCalendar),
        existingEventId: eventMode === "confirmed" ? currentProjectEvent?.id : undefined,
        workshops: currentProjectSelections.map((row) => ({
          title: row.workshop.title,
          date: row.date,
          time: row.time,
          duration: row.duration,
          format: row.format,
          expertName: row.assignedExpert,
        })),
      });
      setCalendarEvents((current) => ({ ...current, [selectedProject.id]: eventRecord }));
      persistAdminProjectPatch(
        selectedProject.id,
        {
          calendarEvent: {
            id: eventRecord.id,
            mode: eventRecord.mode,
            htmlLink: eventRecord.htmlLink,
            meetLink: eventRecord.meetLink,
          },
        },
        eventMode === "tentative" ? "calendar_tentative_created" : "calendar_confirmed_created",
        `Evento ${eventRecord.id} creato a calendario.`,
      );
      currentProjectSelections.forEach((row) => {
        if (selectedProject.source === "local") updateSelection(row.workshop.id, { status: "calendar_created" });
      });
      runProjectStatus(
        eventMode === "tentative" ? "approvazione_finale" : "confermato",
        eventMode === "tentative" ? "Evento provvisorio creato" : "Evento confermato",
        `Evento ${eventRecord.id} creato con Meet${
          eventMode === "confirmed" && calendarDeckUrl && !bypassBrandApproval ? " e link deck finale" : ""
        }${bypassBrandApproval ? ". Bypass Brand registrato: deck finale non allegato" : ""}.`,
      );
      if (choice) {
        await sendPhaseNotification(eventMode === "tentative" ? "event_tentative" : "event_confirmed", choice, {
          mode: eventMode,
          id: eventRecord.id,
          htmlLink: eventRecord.htmlLink,
          meetLink: eventRecord.meetLink,
        });
      }
      setAdminActionModal(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Creazione evento non riuscita";
      runProjectStatus("approvazione_finale", "Creazione evento non riuscita", message);
    }
  };
  const getProjectTodoLabels = (project: AdminProject): AdminTodoLabel[] => {
    const status = project.source === "local" ? projectStatus : project.status;
    const statusIndex = projectStatuses.indexOf(status);
    const scheduleRows =
      project.source === "local"
        ? selections.map((selection) => ({
            date: selection.date,
            approval: selection.dateConfirmed ? "approved" : "pending",
            expertName: project.assignedExpert,
          }))
        : project.request?.workshops.map((workshop) => ({
            date: workshop.date,
            approval: workshop.approval ?? "pending",
            expertName: workshop.expertName,
          })) ?? [];
    const confirmedEvent = status === "confermato" || project.request?.calendarEvent?.mode === "confirmed" || calendarEvents[project.id]?.mode === "confirmed";
    const tentativeEvent = status === "evento_provvisorio" || project.request?.calendarEvent?.mode === "tentative" || calendarEvents[project.id]?.mode === "tentative";
    const missingDates = project.dateCount < project.workshopIds.length || scheduleRows.some((row) => !row.date);
    const dateIssue = scheduleRows.some((row) => row.approval === "rejected" || row.approval === "change_requested");
    const pendingDateApproval = scheduleRows.some((row) => row.date && row.approval !== "approved");
    const missingExperts =
      statusIndex >= projectStatuses.indexOf("date_approvate") &&
      !confirmedEvent &&
      (scheduleRows.length > 0 ? scheduleRows.some((row) => !row.expertName && !project.assignedExpert) : !project.assignedExpert);
    const needsBrandApproval =
      status === "in_revisione_brand" &&
      !project.request?.materials?.calendarDeckEnabled;

    const labels: AdminTodoLabel[] = [];
    if (dateIssue) labels.push("date da rivedere");
    else if (missingDates || pendingDateApproval) labels.push("date");
    else if (["richiesta_inviata", "in_verifica_funnifin"].includes(status)) labels.push("verifica");
    if (missingExperts) labels.push("esperti");
    if (status === "materiali_cliente_in_attesa") labels.push("materiali");
    if (status === "in_preparazione_esperto") labels.push("deck");
    if (needsBrandApproval) labels.push("brand");
    if (!confirmedEvent && (status === "approvazione_finale" || tentativeEvent)) labels.push("evento");

    return todoLabelPriority.filter((label) => labels.includes(label));
  };
  const formatTodoLabels = (labels: AdminTodoLabel[], limit = 3) => {
    if (labels.length === 0) return "Tutto pronto";
    const visible = labels.slice(0, limit).map((label) => todoLabelCopy[label]);
    return labels.length > limit ? `${visible.join(" · ")} · altro` : visible.join(" · ");
  };
  const projectTodoCards = adminProjects
    .map((project) => ({ project, labels: getProjectTodoLabels(project) }))
    .filter((item) => item.labels.length > 0);
  const todoSummary = (() => {
    if (projectTodoCards.length === 0) return "Nessun blocco evidente nella coda.";
    const counts = new Map<AdminTodoLabel, number>();
    projectTodoCards.forEach(({ labels }) => {
      labels.forEach((label) => counts.set(label, (counts.get(label) ?? 0) + 1));
    });
    const parts = todoLabelPriority
      .filter((label) => counts.has(label))
      .slice(0, 3)
      .map((label) => `${todoLabelCopy[label]} su ${counts.get(label)}`);
    return `Mancano ${parts.join(", ")}.`;
  })();
  const getProjectQueueMeta = (project: AdminProject) => {
    const status = project.source === "local" ? projectStatus : project.status;
    const scheduleRows =
      project.source === "local"
        ? selections.map((selection) => ({ date: selection.date, time: selection.time, approval: selection.dateConfirmed ? "approved" : "pending" }))
        : project.request?.workshops.map((workshop) => ({ date: workshop.date, time: workshop.time, approval: workshop.approval ?? "pending" })) ?? [];
    const datedRows = scheduleRows
      .map((row) => ({ ...row, parsedDate: parseQueueDate(row.date) }))
      .filter((row): row is typeof row & { parsedDate: Date } => Boolean(row.parsedDate))
      .sort((a, b) => a.parsedDate.getTime() - b.parsedDate.getTime());
    const today = startOfLocalDay(new Date());
    const nextDatedRow = datedRows.find((row) => startOfLocalDay(row.parsedDate).getTime() >= today.getTime()) ?? datedRows[0];
    const createdAt = parseQueueDate(project.request?.createdAt);
    const displayDate = nextDatedRow?.parsedDate ?? createdAt;
    const formattedDate = formatQueueDate(displayDate);
    const hasCalendarEvent = status === "confermato" || project.request?.calendarEvent?.mode === "confirmed";
    const hasTentativeEvent = status === "evento_provvisorio" || project.request?.calendarEvent?.mode === "tentative";
    const hasMissingDates = project.dateCount < project.workshopIds.length || scheduleRows.some((row) => !row.date);
    const hasDateIssue = scheduleRows.some((row) => row.approval === "rejected" || row.approval === "change_requested");
    const datesApproved = scheduleRows.length > 0 && scheduleRows.every((row) => row.approval === "approved");
    const needsScheduling = !hasCalendarEvent && (hasMissingDates || hasDateIssue || ["richiesta_inviata", "in_verifica_funnifin"].includes(status));
    const statusIndex = projectStatuses.indexOf(status);
    const productionIndex = projectStatuses.indexOf("date_approvate");
    const isProduction = !hasCalendarEvent && !needsScheduling && statusIndex >= productionIndex;
    const dayOffset = formattedDate.dayOffset;
    const isClosed = hasCalendarEvent && dayOffset !== null && dayOffset < 0;
    const tone: QueueCardTone = isClosed
      ? "closed"
      : hasCalendarEvent
      ? "calendar"
      : dayOffset === 0
        ? "today"
        : dayOffset !== null && dayOffset < 0
          ? "late"
          : dayOffset !== null && dayOffset <= 7
            ? "soon"
            : "neutral";
    const dateCaption = isClosed ? "chiuso" : hasCalendarEvent ? "calendario" : nextDatedRow ? "sessione" : "richiesta";
    const detail = isClosed
      ? "Sessione passata"
      : hasCalendarEvent
        ? "Evento definitivo"
      : hasTentativeEvent
        ? "Evento provvisorio"
        : hasDateIssue
          ? "Data da rivedere"
          : hasMissingDates
            ? "Date mancanti"
            : datesApproved
              ? "Date approvate"
              : statusLabel[status];

    return {
      dateLabel: formattedDate.label,
      dateDistance: formattedDate.distance,
      dateCaption,
      detail,
      dayOffset,
      hasCalendarEvent,
      isClosed,
      isProduction,
      needsScheduling,
      tone,
    };
  };
  const matchesProjectQueueFilter = (project: AdminProject, meta: ReturnType<typeof getProjectQueueMeta>, filter: AdminQueueFilter) => {
    if (filter === "tutti") return true;
    if (filter === "da-fare") return getProjectTodoLabels(project).length > 0;
    if (filter === "oggi") return meta.dayOffset === 0;
    if (filter === "da-fissare") return meta.needsScheduling;
    if (filter === "produzione") return meta.isProduction;
    if (filter === "in-calendario") return meta.hasCalendarEvent && !meta.isClosed;
    return meta.isClosed;
  };
  const projectSortTimestamp = (project: AdminProject) => {
    const raw = project.request?.updatedAt || project.request?.createdAt || "";
    const parsed = raw ? new Date(raw.replace(" ", "T")).getTime() : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  };
  const queueDateSortValue = (meta: ReturnType<typeof getProjectQueueMeta>) => (
    meta.dayOffset === null ? Number.POSITIVE_INFINITY : meta.dayOffset
  );
  const sortProjectQueueCards = (cards: Array<{ project: AdminProject; meta: ReturnType<typeof getProjectQueueMeta> }>) => {
    const sorted = [...cards];
    sorted.sort((a, b) => {
      if (adminQueueSort === "prezzo_alto") return b.project.quoteTotal - a.project.quoteTotal;
      if (adminQueueSort === "vecchi") return projectSortTimestamp(a.project) - projectSortTimestamp(b.project);
      if (adminQueueSort === "date_vicine") return queueDateSortValue(a.meta) - queueDateSortValue(b.meta);
      if (adminQueueSort === "date_lontane") {
        const aDate = queueDateSortValue(a.meta);
        const bDate = queueDateSortValue(b.meta);
        if (!Number.isFinite(aDate) && !Number.isFinite(bDate)) return 0;
        if (!Number.isFinite(aDate)) return 1;
        if (!Number.isFinite(bDate)) return -1;
        return bDate - aDate;
      }
      return projectSortTimestamp(b.project) - projectSortTimestamp(a.project);
    });
    return sorted;
  };
  const searchedAdminProjects = adminProjects.filter((project) => {
    const text = `${project.company} ${project.manager} ${project.email}`.toLowerCase();
    return adminSearch.trim() === "" || text.includes(adminSearch.trim().toLowerCase());
  });
  const adminQueueCards = sortProjectQueueCards(searchedAdminProjects.map((project) => ({ project, meta: getProjectQueueMeta(project) })));
  const filteredAdminProjectCards = adminQueueCards.filter(({ project, meta }) => matchesProjectQueueFilter(project, meta, adminQueueFilter));
  const countQueueFilter = (filter: AdminQueueFilter) => adminQueueCards.filter(({ project, meta }) => matchesProjectQueueFilter(project, meta, filter)).length;
  const bottomProjectMenuItems = [...adminProjects.map((project) => ({ project, meta: getProjectQueueMeta(project) }))]
    .sort((a, b) => projectSortTimestamp(a.project) - projectSortTimestamp(b.project));
  const adminFlowSteps = [
    { id: "workshops", title: "Richiesta", body: "Workshop, prezzo e coerenza" },
    { id: "calendar", title: "Date", body: "FreeBusy e approvazioni" },
    { id: "experts", title: "Esperti", body: "Candidati e assegnazioni" },
    { id: "folder", title: "Materiali", body: "Logo, deck e review" },
    { id: "confirm", title: "Conferma", body: "Evento finale" },
  ] as const;
  const catalogThemeRows = topics.flatMap((topic) => topic.themes.map((theme) => ({ ...theme, topicId: topic.id, topicTitle: topic.title })));
  const catalogWorkshopsForAdmin = sheetCatalogWorkshops.length > 0 ? sheetCatalogWorkshops : workshops;
  const catalogSourceLabel = sheetCatalogWorkshops.length > 0 ? "Google Sheet" : "Sheet vuoto";
  const sheetPreviewUrl = googleHealth?.spreadsheet.id
    ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(googleHealth.spreadsheet.id)}/preview`
    : "";
  const googleHealthMode = googleHealthLoading
    ? "refresh"
    : googleHealthError
      ? "error"
      : googleHealth?.cached
        ? "cache"
        : googleHealth
          ? "live"
          : "idle";
  const googleHealthModeLabel = googleHealthMode === "refresh"
    ? googleHealth
      ? "Aggiornamento live"
      : "Verifica live"
    : googleHealthMode === "error"
      ? "Errore"
      : googleHealthMode === "cache"
        ? "Cache health"
        : googleHealthMode === "live"
          ? "Live Google"
          : "Non verificato";
  const googleBackendCards = [
    {
      title: "Google Sheets",
      status: googleHealth ? "Attivo" : "Da verificare",
      detail: googleHealth
        ? `${googleHealth.spreadsheet.requests} richieste · ${googleHealth.spreadsheet.events} eventi log · ${googleHealth.spreadsheet.settings} settings`
        : "Nessun dato live disponibile in questa sessione.",
      meta: googleHealth?.spreadsheet.id || "ID non letto",
      ok: Boolean(googleHealth?.spreadsheet.id),
      actionLabel: "Apri Sheet",
      actionUrl: googleHealth?.spreadsheet.url || "",
    },
    {
      title: "Google Calendar",
      status: googleHealth?.calendar.configured ? "Configurato" : googleHealth ? "Non configurato" : "Da verificare",
      detail: googleHealth?.calendar.configured
        ? `${googleHealth.calendar.name || "Calendario"} pronto per FreeBusy ed eventi`
        : "Serve calendar.id o calendar.name nei settings Google.",
      meta: googleHealth?.calendar.id || googleHealth?.calendar.name || "Nessun calendario",
      ok: Boolean(googleHealth?.calendar.configured),
    },
    {
      title: "Google Drive",
      status: googleHealth?.drive.configured ? "Configurato" : googleHealth ? "Non configurato" : "Da verificare",
      detail: googleHealth?.drive.configured
        ? "Root materiali e/o slide operative lette dai settings"
        : "Serve una root Drive o una root slide per collegare i materiali.",
      meta: googleHealth?.drive.slidesRootFolderId || googleHealth?.drive.rootFolderId || "Nessuna cartella",
      ok: Boolean(googleHealth?.drive.configured),
    },
    {
      title: "MailApp",
      status: googleHealth ? `${googleHealth.mail.remainingDailyQuota} rimaste` : "Da verificare",
      detail: googleHealth ? "Quota giornaliera letta da Apps Script." : "Quota mail non letta.",
      meta: "Invii template workshop e accessi",
      ok: Boolean(googleHealth && googleHealth.mail.remainingDailyQuota > 0),
    },
    {
      title: "Accessi",
      status: googleHealth ? `${googleHealth.spreadsheet.authUsers} utenti` : "Da verificare",
      detail: googleHealth ? `${googleHealth.spreadsheet.accessRequests} richieste accesso registrate` : "Dati auth non letti.",
      meta: "AuthUsers + AccessRequests",
      ok: Boolean(googleHealth),
    },
  ];
  const orphanWorkshops = catalogWorkshopsForAdmin.filter((workshop) => {
    const topic = topics.find((item) => item.id === workshop.topicId);
    return !topic || !topic.themes.some((theme) => theme.id === workshop.themeId);
  });
  const catalogAudit = topics.map((topic) => {
    const topicWorkshops = catalogWorkshopsForAdmin.filter((workshop) => workshop.topicId === topic.id);
    const themeIds = new Set(topic.themes.map((theme) => theme.id));
    return {
      topic,
      workshops: topicWorkshops,
      mappedThemes: topic.themes.filter((theme) => topicWorkshops.some((workshop) => workshop.themeId === theme.id)),
      orphanThemeCount: topicWorkshops.filter((workshop) => !themeIds.has(workshop.themeId)).length,
    };
  });
  const driveLinkedCount = workshops.filter((workshop) => driveSlideLinks[workshop.id]).length;
  const activeAdminFlowIndex = adminFlowSteps.findIndex((step) => step.id === adminWorkspacePanel);
  const goAdminFlow = (delta: number) => {
    const next = adminFlowSteps[Math.min(Math.max(activeAdminFlowIndex + delta, 0), adminFlowSteps.length - 1)];
    setAdminWorkspacePanel(next.id);
  };
  const adminSections: AdminSectionNavItem[] = [
    {
      id: "Operativo",
      title: "Richieste cliente",
      meta: `${adminProjects.filter((project) => project.status !== "confermato").length} aperte · ${projectTodoCards.length} da fare`,
      body: projectTodoCards.length > 0 ? todoSummary : "Coda, dettaglio progetto, date, assegnazioni e avanzamento stato.",
      icon: <BriefcaseBusiness size={18} />,
    },
    {
      id: "DaFare",
      title: "Da fare adesso",
      meta: projectTodoCards.length > 0 ? `${projectTodoCards.length} progetti` : "tutto ok",
      body: projectTodoCards.length > 0 ? todoSummary : "Nessun blocco evidente: passa agli eventi o alla revisione finale.",
      icon: <FileCheck2 size={18} />,
      tone: projectTodoCards.length > 0 ? "todo" : "ok",
    },
    {
      id: "Catalogo",
      title: "Catalogo vendibile",
      meta: `${catalogWorkshopsForAdmin.length} workshop`,
      body: "Ambiti, categorie e tag da Sheet; presentazioni operative da Drive.",
      icon: <BookOpen size={18} />,
    },
    {
      id: "Prezzi",
      title: "Regole prezzo",
      meta: `${rules.length} regole`,
      body: "Bundle, sconti quantita, promo e preventivo dinamico.",
      icon: <CircleDollarSign size={18} />,
    },
    {
      id: "Esperti",
      title: "Pool esperti",
      meta: `${expertDirectory.length} profili`,
      body: "Competenze, disponibilita e assegnazioni ai workshop.",
      icon: <UsersRound size={18} />,
    },
    {
      id: "Google",
      title: "Google backend",
      meta: googleHealth ? `${googleHealth.spreadsheet.requests} richieste · ${googleHealthStatusLabel}` : googleHealthStatusLabel,
      body: "Sheets, Calendar, Drive, Mail quota e settings operative.",
      icon: <Settings2 size={18} />,
    },
    {
      id: "Manuale",
      title: "Manuale utente",
      meta: "DOCX v2.2",
      body: "Guida FunniFin con flussi, notifiche, mail e atlante UI annotato.",
      icon: <BookOpen size={18} />,
    },
    {
      id: "Utenti",
      title: "Utenti e inviti",
      meta: `${authUsers.length} utenti`,
      body: "Account autorizzati, ruoli, inviti e richieste di accesso.",
      icon: <BadgeCheck size={18} />,
    },
  ];
  const activeAdminSection = adminSections.find((section) => section.id === adminTab) ?? adminSections[0];
  const activeAdminNavSection = adminTab === "Operativo" && adminQueueFilter === "da-fare" ? "DaFare" : adminTab;
  const handleAdminSection = (section: string) => {
    if (section === "DaFare") {
      setAdminTab("Operativo");
      setAdminQueueFilter("da-fare");
      setAdminQueueSort("date_vicine");
      return;
    }
    setAdminTab(section);
    if (section === "Operativo" && adminQueueFilter === "da-fare") setAdminQueueFilter("tutti");
  };
  const adminMainAction = (() => {
    if (adminTab === "Utenti") {
      return {
        label: "Aggiungi utente",
        disabled: false,
        action: openCreateAuthModal,
      };
    }
    if (adminTab !== "Operativo") {
      if (adminTab === "Catalogo") {
        if (catalogView === "drive") {
          return {
            label: "Sincronizza slide Drive",
            disabled: false,
            action: () => {
              setDriveSlidesSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
              notify("Slide Drive sincronizzate", `${driveLinkedCount}/${workshops.length} workshop hanno una slide operativa collegata.`);
            },
          };
        }
        return {
          label: "Ricarica catalogo Sheet",
          disabled: catalogLoading,
          loading: catalogLoading,
          action: () => refreshCatalogSection(),
        };
      }
      if (adminTab === "Prezzi") {
        return {
          label: "Modifica regola prezzo",
          disabled: false,
          action: () => setAdminActionModal({ type: "price", ruleId: rules[0].id }),
        };
      }
      if (adminTab === "Google") {
        return {
          label: googleHealthLoading ? "Controllo Google..." : "Ricarica stato Google",
          disabled: googleHealthLoading,
          loading: googleHealthLoading,
          action: () => refreshGoogleHealth({ refresh: true }),
        };
      }
      if (adminTab === "Manuale") {
        return {
          label: "Apri manuale",
          disabled: false,
          action: () => {
            window.open(USER_MANUAL_URL, "_blank", "noopener,noreferrer");
            notify("Manuale utente", "Aperto il manuale FunniFin v2.2 in una nuova scheda.");
          },
        };
      }
      if (adminTab === "Utenti") {
        return {
          label: accessRequests.length > 0 ? "Rivedi richieste accesso" : "Utenti aggiornati",
          disabled: accessRequests.length === 0,
          action: () => notify("Richieste accesso", `${accessRequests.length} richieste in attesa nella vista utenti.`),
        };
      }
      return {
        label: "Aggiorna vista esperti",
        disabled: false,
        action: () => {
          setExpertsSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
          setAdminQueueFilter("produzione");
          notify("Vista esperti aggiornata", `${expertDirectory.length} profili riletti dalla rubrica interna. La coda mostra i progetti in produzione.`);
        },
      };
      }
    if (adminWorkspacePanel === "workshops") {
      return {
        label: "Verifica e vai alle date",
        disabled: false,
        action: () => {
          runProjectStatus("in_verifica_funnifin", "Richiesta verificata", "Prezzo, workshop e dati cliente sono stati controllati.");
          setAdminWorkspacePanel("calendar");
        },
      };
    }
    if (adminWorkspacePanel === "calendar") {
      return { label: "Invita esperti", disabled: !allProjectDatesApproved, action: () => setAdminActionModal({ type: "open_candidacies" }) };
    }
    if (adminWorkspacePanel === "experts") {
      return {
        label: "Vai ai materiali",
        disabled: !currentProjectSelections.every((row) => row.assignedExpert),
        action: () => setAdminWorkspacePanel("folder"),
      };
    }
    if (adminWorkspacePanel === "folder") {
      return {
        label: "Manda a brand",
        disabled: false,
        action: () => setAdminActionModal({ type: "brand_handoff" }),
      };
    }
    return {
      label: currentProjectEvent ? "Rivedi evento" : "Conferma evento",
      disabled: false,
      action: () => setAdminActionModal({ type: "confirm_event" }),
    };
  })();
  const adminBackAction = (() => {
    if (adminTab !== "Operativo") return undefined;
    const panels: AdminWorkspacePanel[] = ["workshops", "calendar", "experts", "folder", "confirm"];
    const idx = panels.indexOf(adminWorkspacePanel);
    if (idx <= 0) return undefined;
    return () => setAdminWorkspacePanel(panels[idx - 1]);
  })();
  const currentRule = quote.rule;
  const currentRuleRange = `${currentRule.min}-${currentRule.max === 99 ? "6+" : currentRule.max}`;
  const currentRuleMode = currentRule.specialQuote ? "su preventivo" : `${currentRule.discountPercent}% sconto`;
  const adminBottomState = (() => {
    if (adminTab === "Operativo") {
      if (adminWorkspacePanel === "workshops") {
        return {
          eyebrow: `Step ${activeAdminFlowIndex + 1} - Richiesta`,
          title: selectedProject.company,
          detail: `${selectedProjectRows.length} workshop · registro Google`,
          meta: money(activeAdminQuote),
        };
      }
      if (adminWorkspacePanel === "calendar") {
        const approved = currentProjectSelections.filter((row) => row.approval === "approved").length;
        return {
          eyebrow: `Step ${activeAdminFlowIndex + 1} - Date`,
          title: selectedProject.company,
          detail: calendarCheck.loading
            ? "Verifica Calendar FreeBusy in corso"
            : `${approved}/${currentProjectSelections.length} date approvate`,
          meta: allProjectDatesApproved ? "date ok" : "da verificare",
        };
      }
      if (adminWorkspacePanel === "experts") {
        const assigned = currentProjectSelections.filter((row) => row.assignedExpert).length;
        return {
          eyebrow: `Step ${activeAdminFlowIndex + 1} - Esperti`,
          title: selectedProject.company,
          detail: `${assigned}/${currentProjectSelections.length} workshop assegnati`,
          meta: assigned === currentProjectSelections.length ? "pool ok" : "assegna esperti",
        };
      }
      if (adminWorkspacePanel === "folder") {
        const driveCount = clientAssetFolder ? clientUploadedAssets.length : (driveFolderPreview?.folders.length ?? 0) + (driveFolderPreview?.files.length ?? 0);
        return {
          eyebrow: `Step ${activeAdminFlowIndex + 1} - Materiali`,
          title: clientAssetFolder?.name ?? driveFolderPreview?.folder.name ?? selectedProject.company,
          detail: driveFolderStatus.loading ? "Lettura Drive in corso" : `${driveCount} elementi materiali`,
          meta: activeAdminStatus === "in_revisione_brand" ? "brand" : "Drive",
        };
      }
      return {
        eyebrow: `Step ${activeAdminFlowIndex + 1} - Conferma`,
        title: selectedProject.company,
        detail: currentProjectEvent ? `Evento ${currentProjectEvent.id}` : "Evento Calendar da creare",
        meta: currentProjectEvent ? "live" : "precheck",
      };
    }
    if (adminTab === "Catalogo") {
      return {
        eyebrow: catalogView === "drive" ? "Catalogo - Slide Drive" : "Catalogo - Sheet",
        title: catalogView === "drive" ? `${driveLinkedCount}/${workshops.length} slide collegate` : `${catalogWorkshopsForAdmin.length} workshop vendibili`,
        detail: catalogView === "drive"
          ? driveSlidesSyncedAt ? `Sincronizzato alle ${driveSlidesSyncedAt}` : "Collega presentazioni operative ai workshop"
          : catalogRefreshedAt ? `Riletto alle ${catalogRefreshedAt}` : `${catalogSourceLabel} attivo`,
        meta: catalogView === "drive" ? "Drive" : "Sheet",
      };
    }
    if (adminTab === "Prezzi") {
      return {
        eyebrow: "Prezzi - Regole",
        title: `${rules.length} regole prezzo`,
        detail: pricingSavedAt ? `Ultimo salvataggio ${pricingSavedAt}` : `${currentRule.name} · ${currentRuleMode}`,
        meta: currentRuleRange,
      };
    }
    if (adminTab === "Esperti") {
      return {
        eyebrow: "Esperti - Pool",
        title: `${expertDirectory.length} profili`,
        detail: expertsSyncedAt ? `Aggiornati alle ${expertsSyncedAt}` : `${currentProjectSelections.length} workshop nel progetto attivo`,
        meta: `${currentProjectSelections.filter((row) => row.assignedExpert).length} assegnati`,
      };
    }
    if (adminTab === "Google") {
      return {
        eyebrow: "Google backend",
        title: googleHealth ? "Workspace connesso" : googleHealthLoading ? "Controllo in corso" : googleHealthError ? "Errore verifica" : "Verifica non eseguita",
        detail: googleHealth?.checkedAt ? `${googleHealth.checkedAt} · ${googleHealthStatusLabel}` : googleHealthError || "Sheets, Calendar, Drive e MailApp",
        meta: googleHealth ? `${googleHealth.spreadsheet.requests} richieste` : googleHealthStatusLabel,
      };
    }
    if (adminTab === "Manuale") {
      return {
        eyebrow: "Manuale utente",
        title: "FunniFin Manuale v2.2",
        detail: "Flussi Cliente, FunniFin, Esperto, Brand, notifiche, mail e atlante UI",
        meta: "DOCX",
      };
    }
    return {
      eyebrow: "Utenti - Accessi",
      title: `${authUsers.length} account attivi`,
      detail: accessRequests.length > 0 ? `${accessRequests.length} richieste in attesa` : "Nessuna richiesta di accesso in attesa",
      meta: `${authUsers.filter((user) => !user.disabled).length} attivi`,
    };
  })();
  const refreshRequestQueue = () => {
    setRequestSyncState((current) => ({ ...current, loading: true, error: "" }));
    listWorkshopRequests()
      .then((requests) => {
        const projects = requests.map(requestToAdminProject);
        setAdminProjects(projects);
        setSelectedProjectId((current) => (projects.some((project) => project.id === current) ? current : projects[0]?.id ?? ""));
        setRequestSyncState({ loading: false, error: "", source: "sheet" });
        notify(projects.length ? "Coda aggiornata" : "Nessuna richiesta nello Sheet", projects.length ? `${projects.length} richieste lette dal registro.` : "Il registro Google non contiene richieste.");
      })
      .catch((error) => {
        const message = getFriendlyErrorMessage(error, "Lettura richieste non riuscita");
        setAdminProjects([]);
        setSelectedProjectId("");
        setRequestSyncState({ loading: false, error: message, source: "sheet" });
        notify("Coda non aggiornata", message);
      });
  };
  const refreshCatalogSection = () => {
    if (catalogView === "drive") {
      setDriveSlidesSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      notify("Slide Drive sincronizzate", `${driveLinkedCount}/${workshops.length} workshop hanno una slide operativa collegata.`);
      return;
    }
    setCatalogLoading(true);
    void Promise.all([listCatalogConfig(), listCatalogWorkshops()])
      .then(([remoteTopics, remoteWorkshops]) => {
        if (remoteTopics.length > 0) {
          setCatalogEdits((current) => {
            const next = { ...current };
            remoteTopics.forEach((topic) => {
              next[topic.id] = {
                title: topic.title,
                description: topic.description,
                badge: topic.badge,
                active: topic.active,
              };
            });
            return next;
          });
        }
        if (remoteWorkshops.length > 0) {
          setSheetCatalogWorkshops(remoteWorkshops);
        }
        setCatalogRefreshedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify(
          "Catalogo Sheet aggiornato",
          remoteTopics.length + remoteWorkshops.length > 0
            ? `${remoteTopics.length || topics.length} ambiti e ${remoteWorkshops.length || catalogWorkshopsForAdmin.length} workshop letti da Google Sheets. Canva resta solo reference visuale.`
            : "Lo Sheet catalogo ha risposto senza righe vendibili.",
        );
      })
      .catch((error) => {
        setCatalogRefreshedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Catalogo Sheet non letto", error instanceof Error ? error.message : "Google Sheets non disponibile.");
      })
      .finally(() => setCatalogLoading(false));
  };
  const refreshPricingSection = () => {
    setPricingLoading(true);
    void listPricingRules()
      .then((remoteRules) => {
        if (remoteRules.length > 0) {
          setRules(remoteRules.map((rule) => ({
            id: rule.id,
            name: rule.name,
            min: rule.min,
            max: rule.max,
            discountPercent: rule.discountPercent,
            specialQuote: rule.specialQuote,
          })));
        }
        setPricingSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Regole prezzo aggiornate", remoteRules.length > 0 ? `${remoteRules.length} regole lette da Google Sheets.` : "Lo Sheet prezzi ha risposto senza regole.");
      })
      .catch((error) => {
        setPricingSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Prezzi Sheet non letti", error instanceof Error ? error.message : "Google Sheets non disponibile.");
      })
      .finally(() => setPricingLoading(false));
  };
  const refreshExpertsSection = () => {
    setExpertsLoading(true);
    void listExperts()
      .then((remoteExperts) => {
        if (remoteExperts.length > 0) {
          setExpertDirectory(remoteExperts.map((expert) => ({
            id: expert.id,
            firstName: expert.firstName,
            lastName: expert.lastName,
            email: expert.email,
            photo: expert.photo,
            bio: expert.bio,
            topicIds: expert.topicIds,
            themeIds: expert.themeIds,
            availability: expert.availability,
          })));
        }
        setExpertsSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Vista esperti aggiornata", remoteExperts.length > 0 ? `${remoteExperts.length} profili letti da Google Sheets.` : "Lo Sheet esperti ha risposto senza profili.");
      })
      .catch((error) => {
        setExpertsSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Esperti Sheet non letti", error instanceof Error ? error.message : "Google Sheets non disponibile.");
      })
      .finally(() => setExpertsLoading(false));
  };
  const refreshGoogleHealth = (options?: { silent?: boolean; refresh?: boolean; preserveCurrent?: boolean }) => {
    setGoogleHealthLoading(true);
    setGoogleHealthError("");
    void Promise.all([getGoogleHealth({ refresh: options?.refresh }), listWorkspaceSettings().catch(() => workspaceSettings)])
      .then(([health, settings]) => {
        setGoogleHealth(health);
        writeCachedGoogleHealth(health);
        setWorkspaceSettings(settings);
        setGoogleHealthLoading(false);
        if (!options?.silent) {
          notify("Google Health aggiornata", health ? `${health.spreadsheet.requests} richieste, ${health.spreadsheet.events} eventi, quota mail ${health.mail.remainingDailyQuota}.` : "Endpoint Google non configurato.");
        }
      })
      .catch((error) => {
        if (!options?.preserveCurrent) setGoogleHealth(null);
        setGoogleHealthLoading(false);
        setGoogleHealthError(error instanceof Error ? error.message : "Health Google non disponibile.");
      });
  };
  useEffect(() => {
    if (adminTab !== "Google" || googleHealthLoading) return;
    refreshGoogleHealth({ silent: true, refresh: true, preserveCurrent: Boolean(googleHealth) });
  }, [adminTab]);
  useEffect(() => {
    if (adminTab !== "Catalogo" || catalogView !== "sheet" || googleHealthLoading) return;
    refreshGoogleHealth({ silent: true, refresh: true, preserveCurrent: Boolean(googleHealth) });
  }, [adminTab, catalogView]);
  const saveWorkspaceSetting = (setting: WorkspaceSetting) => {
    void updateWorkspaceSetting(setting)
      .then((savedSetting) => {
        setWorkspaceSettings((current) => {
          const exists = current.some((item) => item.key === savedSetting.key);
          return exists ? current.map((item) => (item.key === savedSetting.key ? savedSetting : item)) : [...current, savedSetting];
        });
        setSensitiveSettingDrafts((current) => {
          const next = { ...current };
          delete next[savedSetting.key];
          return next;
        });
        setDirtyWorkspaceSettingKeys((current) => {
          const next = { ...current };
          delete next[savedSetting.key];
          return next;
        });
        notify("Setting salvata su Google", `${savedSetting.label || savedSetting.key} aggiornata.`);
      })
      .catch((error) => {
        notify("Setting non salvata", error instanceof Error ? error.message : "Google Sheets non disponibile.");
      });
  };
  const refreshAdminWorkspacePanel = () => {
    if (adminWorkspacePanel === "calendar") {
      void verifyCalendars();
      return;
    }
    if (adminWorkspacePanel === "folder") {
      notify("Materiali aggiornati", "Vista cartella e materiali riletta per il progetto attivo.");
      return;
    }
    if (adminWorkspacePanel === "experts") {
      refreshExpertsSection();
      return;
    }
    if (adminWorkspacePanel === "confirm") {
      notify("Conferma aggiornata", "Precheck evento, date, esperti e materiali riletti nella vista corrente.");
      return;
    }
    refreshRequestQueue();
  };
  useEffect(() => {
    if (systemRefreshToken === 0) return;
    if (adminTab === "Catalogo") {
      if (catalogView === "drive") syncDriveSlidesFromRoot();
      else refreshCatalogSection();
      return;
    }
    if (adminTab === "Prezzi") {
      refreshPricingSection();
      return;
    }
    if (adminTab === "Esperti") {
      refreshExpertsSection();
      return;
    }
    if (adminTab === "Google") {
      refreshGoogleHealth({ refresh: true });
      return;
    }
    refreshAdminWorkspacePanel();
  }, [systemRefreshToken]);
  useEffect(() => {
    if (systemSettingsToken === 0) return;
    setAdminTab("Google");
  }, [systemSettingsToken]);
  const automaticPricingRules = rules.filter((rule) => !rule.specialQuote);
  const quoteOnlyRules = rules.filter((rule) => rule.specialQuote);
  const maxAutomaticDiscount = automaticPricingRules.reduce((max, rule) => Math.max(max, rule.discountPercent), 0);
  const showRequestSkeleton = requestSyncState.loading;
  return (
    <section className="admin-console">
      <RoleHero
        eyebrow="FunniFin system"
        title="Gestione richieste workshop"
        subtitle={`${selectedProject.company} · ${selectedProjectRows.length} workshop · ${statusLabel[activeAdminStatus]}`}
      />
      <OperatorIdentityCard identity={roleIdentities.FunniFin} />

      <AdminSectionNav sections={adminSections} activeSection={activeAdminNavSection} onSection={handleAdminSection} />

      {adminTab === "Operativo" && (
        <>
          <SectionTitle
            title="Richieste cliente"
            icon={<BriefcaseBusiness size={20} />}
            meta={activeAdminSection?.meta}
            actions={
              <ToolIconButton active={requestSyncState.source === "sheet"} onClick={refreshAdminWorkspacePanel} loading={requestSyncState.loading} label="Ricarica richieste cliente">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          />
        <div className="admin-workbench-v2">
          <aside className="admin-project-queue" aria-label="Coda progetti cliente">
            <div className="queue-control-panel">
              <div className="queue-top-row">
                <div className="queue-head">
                  <div>
                    <strong>Coda progetti</strong>
                    <span>
                      {requestSyncState.loading && "Lettura registro..."}
                      {!requestSyncState.loading && requestSyncState.source === "sheet" && `${filteredAdminProjectCards.length} di ${adminProjects.length}`}
                      {!requestSyncState.loading && requestSyncState.error && "Registro non disponibile"}
                    </span>
                  </div>
                </div>
                <label className="admin-search-field">
                  <Search size={16} />
                  <input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Cerca azienda o referente" />
                  {adminSearch && (
                    <button type="button" onClick={() => setAdminSearch("")} aria-label="Cancella ricerca">
                      <X size={16} />
                    </button>
                  )}
                </label>
                <label className="admin-sort-field">
                  <span>Ordina per</span>
                  <select value={adminQueueSort} onChange={(event) => setAdminQueueSort(event.target.value as AdminQueueSort)}>
                    {queueSortOptions.map((option) => (
                      <option key={option.id} value={option.id}>{option.label}</option>
                    ))}
                  </select>
                </label>
              </div>
              {requestSyncState.error && requestSyncState.source === "sheet" && (
                <div className="inline-status-card warning">
                  <AlertCircle size={18} />
                  <span>{requestSyncState.error}</span>
                </div>
              )}
              <div className="admin-filter-pills">
                {queueFilterOptions.map(({ id, label }) => (
                  <button key={id} className={adminQueueFilter === id ? "active" : ""} onClick={() => setAdminQueueFilter(id)}>
                    <span>{label}</span>
                    <em>{countQueueFilter(id)}</em>
                  </button>
                ))}
              </div>
            </div>
            <div className="project-choice-list" aria-label="Progetti in coda" aria-busy={requestSyncState.loading}>
              {showRequestSkeleton ? (
                Array.from({ length: 4 }).map((_, index) => <SkeletonCard key={index} className="project-choice-skeleton" lines={2} />)
              ) : filteredAdminProjectCards.length === 0 ? (
                <div className="queue-empty-state">
                  <strong>Nessun progetto qui</strong>
                  <span>Prova Tutti o cambia ricerca.</span>
                </div>
              ) : filteredAdminProjectCards.map(({ project, meta }) => {
                const activeStatus = project.source === "local" ? projectStatus : project.status;
                const selected = selectedProject.id === project.id;
                const deleting = deletingRequestId === project.id;
                const todoLabels = getProjectTodoLabels(project);
                return (
                  <article key={project.id} className={`project-choice-card ${selected ? "active" : ""} ${meta.tone}`}>
                    <button type="button" className="project-choice-main" onClick={() => selectProject(project)}>
                      <span className="queue-date-badge">
                        <strong>{meta.dateLabel}</strong>
                        <em>{meta.dateCaption}</em>
                      </span>
                      <div className="queue-project-copy">
                        <strong>{project.company}</strong>
                        <em>{project.manager} · {project.workshopIds.length} workshop</em>
                        <span>
                          <Clock3 size={14} />
                          {meta.dateDistance} · {meta.detail}
                        </span>
                        {todoLabels.length > 0 && (
                          <span className="queue-missing-line">
                            <AlertCircle size={14} />
                            Manca: {formatTodoLabels(todoLabels)}
                          </span>
                        )}
                      </div>
                      <div className="queue-card-side">
                        <small>{statusLabel[activeStatus]}</small>
                        <b>{money(project.source === "local" ? quote.total : project.quoteTotal)}</b>
                      </div>
                    </button>
                    {project.source !== "local" && (
                      <button
                        type="button"
                        className="project-choice-delete"
                        onClick={() => setRequestDeleteConfirm(project)}
                        aria-label={`Elimina richiesta ${project.company}`}
                        title={`Elimina richiesta ${project.company}`}
                        disabled={deleting}
                      >
                        {deleting ? <RefreshCw size={14} /> : <Trash2 size={14} />}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </aside>

          <section className="admin-detail-workspace">
            <div className="admin-detail-header">
              <div>
                <span className="eyebrow">Progetto attivo</span>
                <h2>{selectedProject.company}</h2>
                <p>{selectedProject.manager} · {selectedProject.email} · {selectedProject.phone}</p>
              </div>
              <div className="admin-detail-total">
                <span>{statusLabel[activeAdminStatus]}</span>
                <strong>{money(activeAdminQuote)}</strong>
                <small>+ IVA</small>
              </div>
            </div>

            <AdminFlowStepper
              steps={adminFlowSteps}
              activeStep={adminWorkspacePanel}
              completed={{
                workshops: projectStatuses.indexOf(activeAdminStatus) >= projectStatuses.indexOf("in_verifica_funnifin"),
                calendar: allProjectDatesApproved,
                experts: currentProjectSelections.length > 0 && currentProjectSelections.every((row) => row.assignedExpert),
                folder: projectStatuses.indexOf(activeAdminStatus) >= projectStatuses.indexOf("in_revisione_brand"),
                confirm: activeAdminStatus === "confermato",
              }}
              onStep={(step) => setAdminWorkspacePanel(step)}
            />

            <div className="admin-detail-grid">
              <section className="admin-section-card">
                <div className="section-card-head">
                  <div>
                    <strong className="section-card-title">
                      {activeAdminSection?.icon}
                      <span>
                        {adminWorkspacePanel === "calendar" && "Date proposte"}
                        {adminWorkspacePanel === "experts" && "Esperti compatibili"}
                        {adminWorkspacePanel === "folder" && "Cartella progetto"}
                        {adminWorkspacePanel === "confirm" && "Conferma evento"}
                        {adminWorkspacePanel === "workshops" && "Workshop del progetto"}
                      </span>
                    </strong>
                    <span>
                      {adminWorkspacePanel === "calendar" && (allProjectDatesApproved ? "Tutte approvate" : "Da verificare")}
                      {adminWorkspacePanel === "experts" && "Scegli o riassegna"}
                      {adminWorkspacePanel === "folder" && "Materiali, deck e versioni"}
                      {adminWorkspacePanel === "confirm" && "Ultimo controllo"}
                      {adminWorkspacePanel === "workshops" && `${selectedProjectRows.length} unita operative`}
                    </span>
                  </div>
                  <div className="section-card-actions">
                    {adminWorkspacePanel === "workshops" && (
                      <ActionIconButton onClick={() => setAdminActionModal({ type: "edit_request" })} label="Modifica richiesta cliente">
                        <Settings2 size={18} />
                      </ActionIconButton>
                    )}
                  </div>
                </div>
                {adminWorkspacePanel === "workshops" && (
                  <div className="admin-workshop-flow-panel">
                    <div className="admin-workshop-list">
                      {selectedProjectRows.map((workshop, index) => (
                        <article key={workshop.id}>
                          <div>
                            <strong>{workshop.title}</strong>
                            <em>{workshop.durationOptions.join(" / ")} · {workshop.formatOptions.join(" / ")} / {workshop.level.toUpperCase()}</em>
                          </div>
                          <small>{index < selectedProject.dateCount ? "Date proposte" : "Date mancanti"}</small>
                        </article>
                      ))}
                    </div>
                  </div>
                )}
                {adminWorkspacePanel === "calendar" && (
                  <div className="date-review-list">
                    <div className="date-review-head">
                      <span>
                        {calendarCheck.loading && "Lettura calendari in corso..."}
                        {!calendarCheck.loading && calendarCheck.checked && `${calendarCheck.freeSlots} slot liberi trovati · ${calendarCheck.source}`}
                        {!calendarCheck.loading && calendarCheck.error && `Errore: ${calendarCheck.error}`}
                        {!calendarCheck.loading && !calendarCheck.checked && !calendarCheck.error && "Calendari non ancora verificati"}
                      </span>
                      <AppButton variant="secondary" onClick={verifyCalendars} disabled={calendarCheck.loading} loading={calendarCheck.loading}>
                        <CalendarCheck size={17} /> Verifica FreeBusy
                      </AppButton>
                    </div>
                    {calendarCheck.loading ? Array.from({ length: Math.max(currentProjectSelections.length, 2) }).map((_, index) => (
                      <article className="date-review-skeleton" key={`calendar-skeleton-${index}`} aria-hidden="true">
                        <div>
                          <Skeleton className="skeleton-title" />
                          <Skeleton className="skeleton-line" />
                        </div>
                        <Skeleton className="skeleton-button" />
                        <div className="row-actions compact-actions">
                          <Skeleton className="skeleton-dot" />
                          <Skeleton className="skeleton-dot" />
                          <Skeleton className="skeleton-dot" />
                        </div>
                      </article>
                    )) : currentProjectSelections.map((row) => (
                      <article className={row.approval} key={row.workshop.id}>
                        <div>
                          <strong>{row.workshop.title}</strong>
                          <span>{row.date} · {row.time} · {row.duration} · {row.format}</span>
                        </div>
                        <em>
                          {row.approval === "approved" && "approvata"}
                          {row.approval === "rejected" && "rifiutata"}
                          {row.approval === "change_requested" && "modifica richiesta"}
                          {row.approval === "pending" && (calendarCheck.checked ? `${calendarCheck.source}` : "da verificare")}
                        </em>
                        <div className="row-actions compact-actions" aria-label={`Azioni date per ${row.workshop.title}`}>
                          <ActionIconButton variant="success" onClick={() => setAdminActionModal({ type: "date", workshopId: row.workshop.id, decision: "approved" })} label={`Approva ${row.workshop.title}`}>
                            <Check size={18} />
                          </ActionIconButton>
                          <ActionIconButton onClick={() => setAdminActionModal({ type: "date", workshopId: row.workshop.id, decision: "change_requested" })} label={`Chiedi modifica per ${row.workshop.title}`}>
                            <CalendarCheck size={18} />
                          </ActionIconButton>
                          <ActionIconButton variant="danger" onClick={() => setAdminActionModal({ type: "date", workshopId: row.workshop.id, decision: "rejected" })} label={`Rifiuta ${row.workshop.title}`}>
                            <X size={18} />
                          </ActionIconButton>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
                {adminWorkspacePanel === "experts" && (
                  <div className="expert-assignment-list">
                    {currentProjectSelections.map((row) => {
                      const compatibleExperts = experts.filter((expert) => expert.skills.includes(row.workshop.topicId));
                      const candidates = compatibleExperts.length ? compatibleExperts : experts;
                      return (
                        <article key={row.workshop.id}>
                          <div>
                            <strong>{row.workshop.title}</strong>
                            <span>{row.assignedExpert ? `Assegnato a ${row.assignedExpert}` : "Nessun esperto assegnato"}</span>
                          </div>
                          <div className="expert-choice-row">
                            {candidates.map((expert) => (
                              <button
                                key={expert.id}
                                className={row.assignedExpert === expert.name ? "active" : ""}
                                onClick={() => setAdminActionModal({ type: "expert", workshopId: row.workshop.id, expertName: expert.name, mode: "assign" })}
                              >
                                <strong>{expert.name}</strong>
                                <span>{expert.availability}</span>
                              </button>
                            ))}
                          </div>
                          {row.assignedExpert && (
                            <div className="row-actions compact-actions">
                              <ActionIconButton onClick={() => setAdminActionModal({ type: "expert", workshopId: row.workshop.id, expertName: row.assignedExpert ?? "", mode: "reassign" })} label={`Riassegna ${row.workshop.title}`}>
                                <UsersRound size={18} />
                              </ActionIconButton>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
                {adminWorkspacePanel === "folder" && (
                  <div className="admin-context-panel folder-panel">
                    <div className="folder-preview-head">
                      <div>
                        <strong>{clientAssetFolder?.name ?? driveFolderPreview?.folder.name ?? "Materiali cliente"}</strong>
                        <span>
                          {clientAssetFolder && `${clientUploadedAssets.length} file caricati dal cliente`}
                          {!clientAssetFolder && driveFolderStatus.loading && "Lettura Drive in corso..."}
                          {!clientAssetFolder && !driveFolderStatus.loading && driveFolderStatus.error && driveFolderStatus.error}
                          {!clientAssetFolder && !driveFolderStatus.loading && !driveFolderStatus.error && driveFolderPreview && `${driveFolderPreview.folders.length} cartelle · ${driveFolderPreview.files.length} file`}
                        </span>
                      </div>
                      {(clientAssetFolder?.url || driveFolderPreview?.folder.url) && (
                        <ActionIconButton onClick={() => window.open(clientAssetFolder?.url || driveFolderPreview?.folder.url, "_blank", "noopener,noreferrer")} label="Apri cartella in Drive">
                          <ExternalLink size={18} />
                        </ActionIconButton>
                      )}
                    </div>
                    {clientAssetFolder ? (
                      <div className="folder-preview-list">
                        {clientUploadedAssets.length > 0 ? (
                          clientUploadedAssets.map((asset, index) => (
                            <button
                              key={`${asset.name}-${index}`}
                              className="folder-preview-row"
                              onClick={() => {
                                if (asset.url) window.open(asset.url, "_blank", "noopener,noreferrer");
                                else if (clientAssetFolder.url) window.open(clientAssetFolder.url, "_blank", "noopener,noreferrer");
                              }}
                            >
                              <FileCheck2 size={18} />
                              <div>
                                <strong>{asset.name}</strong>
                                <span>{asset.mimeType || "File cliente"}</span>
                              </div>
                              <em>{Math.max(1, Math.round(asset.size / 1024))} KB</em>
                            </button>
                          ))
                        ) : (
                          <div className="folder-empty-state">
                            <FolderKanban size={34} />
                            <strong>Cartella cliente creata</strong>
                            <span>Il cliente ha creato {clientAssetFolder.name}, ma non risultano ancora file caricati.</span>
                          </div>
                        )}
                      </div>
                    ) : driveFolderStatus.loading ? (
                      <div className="folder-preview-list" aria-hidden="true">
                        {Array.from({ length: 3 }).map((_, index) => (
                          <span className="skeleton-row" key={`drive-folder-skeleton-${index}`}>
                            <Skeleton className="skeleton-dot" />
                            <span className="skeleton-text">
                              <Skeleton className="skeleton-line" />
                              <Skeleton className="skeleton-line short" />
                            </span>
                            <Skeleton className="skeleton-button" />
                          </span>
                        ))}
                      </div>
                    ) : driveFolderPreview && driveFolderPreview.folders.length + driveFolderPreview.files.length > 0 ? (
                      <div className="folder-preview-list">
                        {[...driveFolderPreview.folders, ...driveFolderPreview.files].map((item) => (
                          <button key={item.id} className="folder-preview-row" onClick={() => window.open(item.url, "_blank", "noopener,noreferrer")}>
                            <FolderKanban size={18} />
                            <div>
                              <strong>{item.name}</strong>
                              <span>{item.type === "folder" ? "Cartella" : item.type === "presentation" ? "Presentazione" : item.mimeType || "File"}</span>
                            </div>
                            <em>{item.role || "materiale"}</em>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="folder-empty-state">
                        <FolderKanban size={34} />
                        <strong>Nessun materiale nella cartella</strong>
                        <span>Quando cliente, esperto o brand caricano file, compariranno qui con link diretto a Drive.</span>
                      </div>
                    )}
                  </div>
                )}
                {adminWorkspacePanel === "confirm" && (
                  <div className="confirm-flow-panel">
                    <Info label="Date" value={allProjectDatesApproved ? "approvate" : "ancora da approvare"} />
                    <Info label="Esperti" value={currentProjectSelections.every((row) => row.assignedExpert) ? "assegnati" : "mancanti"} />
                    <Info label="Deck Calendar" value={calendarDeckEnabled ? calendarDeckTitle || "abilitato da Brand" : "non abilitato da Brand"} />
                    <Info label="Evento" value={currentProjectEvent ? currentProjectEvent.id : "da creare"} />
                    <WorkshopSessionView
                      title="Workshop live"
                      subtitle="Meet, deck e materiali del progetto corrente."
                      statusLabel={currentProjectEvent ? "Sessione attiva" : "In attesa di evento"}
                      items={currentProjectSessionItems}
                      event={currentProjectEvent}
                      deckTitle={calendarDeckEnabled ? calendarDeckTitle || "abilitato da Brand" : ""}
                      deckUrl={calendarDeckUrl}
                      driveFolderUrl={selectedProject.request?.materials?.folderUrl}
                    />
                  </div>
                )}
              </section>

            </div>
          </section>
        </div>
        </>
      )}

      {adminTab === "Catalogo" && (
        <>
          <SectionTitle
            title="Catalogo"
            icon={<Settings2 size={20} />}
            actions={
              <>
                <ToolIconButton onClick={catalogView === "drive" ? syncDriveSlidesFromRoot : refreshCatalogSection} loading={catalogView === "sheet" && catalogLoading} label={catalogView === "drive" ? "Ricarica slide Drive" : "Ricarica catalogo Sheet"}>
                  <RefreshCw size={18} />
                </ToolIconButton>
                <ToolIconButton
                  label="Come funziona Catalogo Sheet e Slide Drive"
                  onClick={() =>
                    notify(
                      "Catalogo Sheet e Slide Drive",
                      "Lo Sheet governa ambiti, categorie, tag e workshop vendibili. Canva resta una reference visuale consultabile dal link. Drive collega le presentazioni operative ai workshop.",
                    )
                  }
                >
                  <InfoIcon size={18} />
                </ToolIconButton>
              </>
            }
          />
          <div className="catalog-tabs" aria-label="Sezioni catalogo">
            <button className={catalogView === "sheet" ? "active" : ""} onClick={() => setCatalogView("sheet")}>
              <BookOpen size={17} />
              <span>Catalogo Sheet</span>
              <em>{catalogWorkshopsForAdmin.length} workshop</em>
            </button>
            <button className={catalogView === "drive" ? "active" : ""} onClick={() => setCatalogView("drive")}>
              <Presentation size={17} />
              <span>Slide Drive</span>
              <em>{driveLinkedCount}/{workshops.length}</em>
            </button>
          </div>

          {catalogView === "sheet" && (
            <div className="catalog-sync-view">
              <div className="catalog-source-card">
                <div>
                  <span className="eyebrow">Fonte dati vendibile</span>
                  <strong>Google Sheet · {catalogSourceLabel}</strong>
                  <em>
                    {catalogRefreshedAt
                      ? `Riletto alle ${catalogRefreshedAt}`
                      : "Ambiti, categorie/tag e workshop arrivano dallo Sheet quando Apps Script risponde."}
                  </em>
                </div>
                <div className="catalog-master-actions">
                  <AppButton variant="ghost" onClick={() => window.open(canvaCatalogSource.url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink size={17} /> Apri reference Canva
                  </AppButton>
                </div>
              </div>

              <div className="sheet-preview-card">
                <div className="sheet-preview-head">
                  <div>
                    <span className="eyebrow">Preview Sheet</span>
                    <strong>{googleHealth?.spreadsheet.id ? "FunniFin Workshop Requests" : googleHealthLoading ? "Carico Google Sheet..." : "Sheet non ancora verificato"}</strong>
                    <em>{googleHealth?.spreadsheet.url ?? googleHealthError ?? "La preview appare appena Apps Script conferma lo Sheet collegato."}</em>
                  </div>
                  <div className="catalog-master-actions">
                    {googleHealth?.spreadsheet.url && (
                      <AppButton variant="ghost" onClick={() => window.open(googleHealth.spreadsheet.url, "_blank", "noopener,noreferrer")}>
                        <ExternalLink size={17} /> Apri Sheet
                      </AppButton>
                    )}
                  </div>
                </div>
                {sheetPreviewUrl ? (
                  <iframe title="Preview Google Sheet catalogo FunniFin" src={sheetPreviewUrl} loading="lazy" />
                ) : googleHealthLoading ? (
                  <Skeleton className="sheet-preview-skeleton" large />
                ) : (
                  <div className="sheet-preview-empty">
                    <FolderKanban size={20} />
                    <span>{googleHealthLoading ? "Sto leggendo lo Sheet collegato..." : "Premi Verifica Sheet per caricare la preview."}</span>
                  </div>
                )}
              </div>

              <div className="catalog-health-grid" aria-label="Controlli catalogo cliente">
                <Info label="Fonte" value={catalogSourceLabel} />
                <Info label="Workshop vendibili" value={String(catalogWorkshopsForAdmin.length)} />
                <Info label="Ambiti" value={String(topics.length)} />
                <Info label="Categorie/tag" value={String(catalogThemeRows.length)} />
                <Info label="Correlazioni rotte" value={String(orphanWorkshops.length)} />
              </div>

              <div className="inline-status-card">
                <ExternalLink size={18} />
                <span>{canvaCatalogSource.label}: reference visuale, non sorgente dati. Lo Sheet resta la fonte operativa del catalogo vendibile.</span>
                <AppButton variant="outline" onClick={() => window.open(canvaCatalogSource.url, "_blank", "noopener,noreferrer")}>
                  <ExternalLink size={17} /> Apri Canva
                </AppButton>
              </div>

              <div className="catalog-map-list">
                {catalogAudit.map(({ topic, workshops: topicWorkshops, mappedThemes, orphanThemeCount }) => (
                  <article className="catalog-map-card" key={topic.id}>
                    <div className="catalog-map-head">
                      <span className={`color-dot ${topicColorClass(topic.id)}`} />
                      <div>
                        <strong>{catalogEdits[topic.id]?.title ?? topic.title}</strong>
                        <em>{topic.themes.length} temi · {topicWorkshops.length} workshop · {mappedThemes.length} temi con workshop</em>
                      </div>
                      <span className={orphanThemeCount === 0 ? "catalog-status active" : "catalog-status hidden"}>
                        {orphanThemeCount === 0 ? "relazioni ok" : `${orphanThemeCount} da sistemare`}
                      </span>
                      <ActionIconButton
                        onClick={() => {
                          setEditingTopicId(topic.id);
                          setCatalogModalTopicId(topic.id);
                        }}
                        label={`Modifica ${topic.title}`}
                      >
                        <Settings2 size={17} />
                      </ActionIconButton>
                    </div>
                    <div className="catalog-theme-chips" aria-label={`Temi ${topic.title}`}>
                      {topic.themes.map((theme) => (
                        <span key={theme.id} className={topicWorkshops.some((workshop) => workshop.themeId === theme.id) ? "active" : ""}>
                          {theme.title}
                        </span>
                      ))}
                    </div>
                    <div className="catalog-workshop-mini-list">
                      {topicWorkshops.map((workshop) => {
                        const theme = topic.themes.find((item) => item.id === workshop.themeId);
                        return (
                          <div key={workshop.id}>
                            <strong>{workshop.title}</strong>
                            <span>{theme?.title ?? "Tema mancante"} · {workshop.durationOptions.join(" / ")} · {workshop.formatOptions.join(" / ")} · {money(workshop.price1h)}</span>
                          </div>
                        );
                      })}
                      {topicWorkshops.length === 0 && <span className="empty-selection">Nessun workshop collegato a questo interesse.</span>}
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}

          {catalogView === "drive" && (
            <div className="catalog-master-list" aria-label="Slide operative Drive">
              <div className="drive-root-card">
                <div>
                  <span className="eyebrow">Root presentazioni</span>
                  <strong>{driveSlidesRoot}</strong>
                  <em>La sincronizzazione cerca file con lo stesso nome della slide master e aggiorna il collegamento.</em>
                </div>
                <label>
                  Cartella root Drive
                  <input value={driveSlidesRoot} onChange={(event) => setDriveSlidesRoot(event.target.value)} />
                </label>
              </div>
              <div className="catalog-master-head">
                <div>
                  <strong>Slide operative Drive</strong>
                  <span>
                    {driveSlidesSyncedAt
                      ? `Sincronizzate alle ${driveSlidesSyncedAt}`
                      : `${driveLinkedCount} slide collegate su ${workshops.length} workshop`}
                  </span>
                </div>
              </div>
              {workshops.map((workshop) => {
                const linkedSlide = driveSlideLinks[workshop.id];
                return (
                  <div className={linkedSlide ? "catalog-master-row linked" : "catalog-master-row"} key={workshop.id}>
                    <div>
                      <strong>{workshop.title}</strong>
                      <span>{linkedSlide ? `${linkedSlide.name} · modificata ${linkedSlide.modifiedAt}` : `${workshop.masterSlide} · da collegare a Drive`}</span>
                    </div>
                    {linkedSlide?.status === "aggiornata" && <span className="catalog-status active">aggiornata da sync</span>}
                    {linkedSlide ? (
                      <div className="catalog-master-actions">
                        <AppButton variant="ghost" onClick={() => window.open(linkedSlide.url, "_blank", "noopener,noreferrer")}>
                          <ExternalLink size={17} /> Apri Drive
                        </AppButton>
                        <AppButton
                          variant="secondary"
                          onClick={() => {
                            setDriveSlidesSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
                            notify("Slide verificata", `${workshop.title}: file Drive collegato al workflow operativo.`);
                          }}
                        >
                          <Check size={17} /> Verifica
                        </AppButton>
                      </div>
                    ) : (
                      <AppButton
                        variant="secondary"
                        onClick={() => {
                          setDriveSlideLinks((current) => ({
                            ...current,
                            [workshop.id]: {
                              fileId: `drive-${workshop.id}`,
                              name: workshop.masterSlide,
                              url: "https://drive.google.com/",
                              modifiedAt: new Date().toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" }),
                              status: "manuale",
                            },
                          }));
                          notify("Slide collegata", `${workshop.title}: file Drive salvato nella mappa slide operative.`);
                        }}
                      >
                        <FolderKanban size={17} /> Collega da Drive
                      </AppButton>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {catalogModalTopicId && (
            <CatalogEditModal
              topic={topics.find((topic) => topic.id === catalogModalTopicId) ?? topics[0]}
              draft={catalogEdits[catalogModalTopicId]}
              onChange={(patch) =>
                setCatalogEdits((current) => ({
                  ...current,
                  [catalogModalTopicId]: { ...current[catalogModalTopicId], ...patch },
                }))
              }
              onReset={() => {
                const topic = topics.find((item) => item.id === catalogModalTopicId) ?? topics[0];
                setCatalogEdits((current) => ({
                  ...current,
                  [topic.id]: { title: topic.title, description: topic.description, badge: topic.badge, active: true },
                }));
              }}
              onClose={() => setCatalogModalTopicId(null)}
              saving={catalogSaving}
              onSave={() => {
                setCatalogSaving(true);
                const draft = catalogEdits[catalogModalTopicId];
                void updateCatalogTopic({
                  id: catalogModalTopicId,
                  title: draft.title,
                  description: draft.description,
                  badge: draft.badge,
                  active: draft.active,
                })
                  .then((topic) => {
                    setCatalogEdits((current) => ({
                      ...current,
                      [topic.id]: {
                        title: topic.title,
                        description: topic.description,
                        badge: topic.badge,
                        active: topic.active,
                      },
                    }));
                    setCatalogRefreshedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
                    notify("Catalogo salvato su Google", `${topic.title} aggiornato nella configurazione catalogo.`);
                    setCatalogModalTopicId(null);
                  })
                  .catch((error) => {
                    notify("Catalogo non salvato", error instanceof Error ? error.message : "Google Sheets non disponibile.");
                    setCatalogModalTopicId(null);
                  })
                  .finally(() => setCatalogSaving(false));
              }}
            />
          )}
        </>
      )}

      {adminTab === "Prezzi" && (
        <>
          <SectionTitle
            title="Regole prezzo"
            icon={<CircleDollarSign size={20} />}
            actions={
              <>
                <ToolIconButton onClick={refreshPricingSection} loading={pricingLoading} label="Ricarica regole prezzo">
                  <RefreshCw size={18} />
                </ToolIconButton>
                <ToolIconButton
                  label="Modifica prima regola prezzo"
                  onClick={() => setAdminActionModal({ type: "price", ruleId: rules[0].id })}
                >
                  <Settings2 size={18} />
                </ToolIconButton>
              </>
            }
          />
          {pricingSavedAt && (
            <div className="inline-status-card">
              <Check size={18} />
              <span>Regole prezzo salvate alle {pricingSavedAt}. Il preventivo cliente usa questi valori.</span>
            </div>
          )}
          <div className="pricing-console">
            <div className="pricing-hero-card">
              <div>
                <span className="eyebrow">Preventivo cliente</span>
                <strong>{money(quote.total)}</strong>
                <em>
                  Regola attiva: {currentRule.name} · {currentRuleRange} workshop · {currentRuleMode}
                </em>
              </div>
              <div className="pricing-hero-metrics" aria-label="Sintesi regole prezzo">
                <Info label="Regole" value={String(rules.length)} />
                <Info label="Automatiche" value={String(automaticPricingRules.length)} />
                <Info label="Su preventivo" value={String(quoteOnlyRules.length)} />
                <Info label="Sconto max" value={`${maxAutomaticDiscount}%`} />
              </div>
            </div>

            <div className="pricing-rule-grid" aria-label="Regole commerciali configurate">
              {rules.map((rule) => {
                const rangeLabel = `${rule.min}-${rule.max === 99 ? "6+" : rule.max} workshop`;
                const previewCount = rule.max >= 99 ? Math.max(rule.min, 6) : rule.max;
                const previewGross = previewCount * 1000;
                const previewTotal = Math.round(previewGross * (1 - rule.discountPercent / 100));
                const isActiveRule = currentRule.id === rule.id;
                return (
                  <article className={`pricing-rule-card ${isActiveRule ? "active" : ""}`} key={rule.id}>
                    <div className="pricing-rule-head">
                      <div>
                        <span className="pricing-rule-kicker">{isActiveRule ? "In uso ora" : rule.specialQuote ? "Preventivo manuale" : "Automatica"}</span>
                        <strong>{rule.name}</strong>
                        <em>{rangeLabel}</em>
                      </div>
                      <ActionIconButton onClick={() => setAdminActionModal({ type: "price", ruleId: rule.id })} label={`Modifica ${rule.name}`}>
                        <Settings2 size={17} />
                      </ActionIconButton>
                    </div>
                    <div className="pricing-rule-body">
                      <div>
                        <span>Sconto</span>
                        <strong>{rule.specialQuote ? "nascosto" : `${rule.discountPercent}%`}</strong>
                      </div>
                      <div>
                        <span>Cliente vede</span>
                        <strong>{rule.specialQuote ? "Preventivo" : money(previewTotal)}</strong>
                      </div>
                      <div>
                        <span>Scenario</span>
                        <strong>{previewCount} ws</strong>
                      </div>
                    </div>
                    <p>
                      {rule.specialQuote
                        ? "Usata quando serve valutazione commerciale prima di mostrare un totale finale."
                        : `Listino ${money(previewGross)}: il preventivo applica automaticamente lo sconto configurato.`}
                    </p>
                  </article>
                );
              })}
            </div>
          </div>
        </>
      )}

      {adminTab === "Esperti" && (
        <>
          <SectionTitle
            title="Esperti e candidature"
            icon={<UsersRound size={20} />}
            actions={
              <>
                <ToolIconButton onClick={refreshExpertsSection} loading={expertsLoading} label="Ricarica esperti">
                  <RefreshCw size={18} />
                </ToolIconButton>
                <AppButton variant="secondary" onClick={createExpertProfile}>
                  <Plus size={17} /> Nuovo esperto
                </AppButton>
              </>
            }
          />
          {expertsSyncedAt && (
            <div className="inline-status-card">
              <Check size={18} />
              <span>Vista esperti aggiornata alle {expertsSyncedAt}: profili e associazioni catalogo riletti in app; la coda mostra i progetti senza esperto.</span>
            </div>
          )}
          <div className="expert-management-grid">
            <div className="candidate-grid">
            {expertDirectory.map((expert) => {
              const fullName = expertFullName(expert);
              const compatibleRows = currentProjectSelections.filter(
                (row) => expert.topicIds.includes(row.workshop.topicId) || row.assignedExpert === fullName,
              );
              const assignableRows = compatibleRows.length ? compatibleRows : currentProjectSelections;
              return (
                <div className={`candidate-card expert-pool-card ${selectedExpertProfileId === expert.id ? "active" : ""}`} key={expert.id}>
                  <div className="expert-pool-head">
                    <div className="expert-avatar">{expert.photo ? <img src={expert.photo} alt="" /> : `${expert.firstName[0] ?? ""}${expert.lastName[0] ?? ""}`}</div>
                    <div>
                      <strong>{fullName}</strong>
                      <span>{expert.email} · {expert.topicIds.length} interessi · {expert.themeIds.length} temi</span>
                    </div>
                  </div>
                  <p>{expert.bio}</p>
                  <div className="expert-pool-workshops" aria-label={`Workshop assegnabili a ${fullName}`}>
                    {assignableRows.map((row) => {
                      const assignedHere = row.assignedExpert === fullName;
                      return (
                        <div
                          key={row.workshop.id}
                          className={assignedHere ? "active" : ""}
                        >
                          <span>{assignedHere ? "assegnato" : "compatibile"}</span>
                          <strong>{row.workshop.title}</strong>
                          <em>{row.duration} · {row.format} / {row.workshop.level.toUpperCase()}</em>
                        </div>
                      );
                    })}
                  </div>
                  <div className="expert-card-footer">
                    <AppButton
                      variant="secondary"
                      onClick={() =>
                        setAdminActionModal({
                          type: "expert",
                          expertName: fullName,
                          mode: "assign",
                        })
                      }
                    >
                      <UsersRound size={17} /> <span>Assegna workshop</span>
                    </AppButton>
                    <ActionIconButton onClick={() => setSelectedExpertProfileId(expert.id)} label={`Modifica profilo ${fullName}`}>
                      <Settings2 size={17} />
                    </ActionIconButton>
                  </div>
                </div>
              );
            })}
            </div>
          </div>
          {selectedExpertProfile && (
            <ExpertProfileModal
              expert={selectedExpertProfile}
              catalogThemeRows={catalogThemeRows}
              onClose={() => setSelectedExpertProfileId(null)}
              onDelete={() => deleteExpertProfile(selectedExpertProfile.id)}
              onChange={(patch) => updateExpertProfile(selectedExpertProfile.id, patch)}
              onSave={() => saveExpertProfile(selectedExpertProfile)}
              saving={expertProfileSaving}
              deleting={expertProfileDeleting}
            />
          )}
        </>
      )}

      {adminTab === "Google" && (
        <>
          <SectionTitle
            title="Google backend"
            icon={<Settings2 size={20} />}
            actions={
              <ToolIconButton onClick={() => refreshGoogleHealth({ refresh: true })} loading={googleHealthLoading} label="Ricarica stato Google">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          />
          <div className="google-backend-console">
            <div className={`google-health-hero ${googleHealthMode}`}>
              <div className="google-health-copy">
                <span className="eyebrow">Workspace Google</span>
                <strong>{googleHealth ? "Backend collegato" : googleHealthLoading ? "Controllo backend" : googleHealthError ? "Backend non verificato" : "Stato da verificare"}</strong>
                <em>
                  {googleHealth?.checkedAt
                    ? `${googleHealth.checkedAt} · ${googleHealthModeLabel}`
                    : googleHealthError || "Usa il refresh per leggere Sheets, Calendar, Drive, Mail e accessi dal backend reale."}
                </em>
              </div>
              <div className="google-health-status">
                <span>{googleHealthModeLabel}</span>
                <strong>{googleHealth ? `${googleHealth.spreadsheet.requests} richieste` : "--"}</strong>
              </div>
            </div>

            {googleHealthError && (
              <div className="inline-status-card warning">
                <AlertCircle size={18} />
                <div className="inline-status-copy">
                  <span>{googleHealthError}</span>
                  <small>Il backend ha risposto con errore oppure la sessione FunniFin non è valida. I numeri sotto non vengono simulati.</small>
                </div>
              </div>
            )}

            <div className="google-health-grid" aria-label="Controlli backend Google" aria-busy={googleHealthLoading}>
              {googleHealthLoading && !googleHealth ? (
                Array.from({ length: 5 }).map((_, index) => (
                  <article className="google-health-card skeleton-google-card" key={`google-card-skeleton-${index}`} aria-hidden="true">
                    <Skeleton />
                    <Skeleton />
                    <Skeleton />
                  </article>
                ))
              ) : (
                googleBackendCards.map((card) => (
                  <article className={`google-health-card ${card.ok ? "ok" : "missing"}`} key={card.title}>
                    <div className="google-health-card-head">
                      {card.ok ? <Check size={17} /> : <AlertCircle size={17} />}
                      <span>{card.status}</span>
                    </div>
                    <strong>{card.title}</strong>
                    <p>{card.detail}</p>
                    <em>{card.meta}</em>
                    {card.actionUrl && (
                      <AppButton variant="outline" onClick={() => window.open(card.actionUrl, "_blank", "noopener,noreferrer")}>
                        <ExternalLink size={17} /> {card.actionLabel}
                      </AppButton>
                    )}
                  </article>
                ))
              )}
            </div>

            {googleHealth && (
              <div className="google-data-strip" aria-label="Conteggi letti da Google Sheets">
                <Info label="Interessi" value={String(googleHealth.spreadsheet.catalogTopics)} />
                <Info label="Workshop" value={String(googleHealth.spreadsheet.catalogWorkshops)} />
                <Info label="Prezzi" value={String(googleHealth.spreadsheet.pricingRules)} />
                <Info label="Esperti" value={String(googleHealth.spreadsheet.experts)} />
                <Info label="Clienti" value={String(googleHealth.spreadsheet.clientUsers)} />
                <Info label="Utenti" value={String(googleHealth.spreadsheet.authUsers)} />
                <Info label="Accessi" value={String(googleHealth.spreadsheet.accessRequests)} />
              </div>
            )}

            <div className="admin-settings-stack" aria-label="Settings operative Google">
              {adminSettingGroups.map((group) => {
                const groupSettings = effectiveAdminSettingDefinitions.filter((definition) => definition.group === group.id);
                const GroupIcon = group.icon === "send" ? Send : group.icon === "users" ? UsersRound : Settings2;
                return (
                  <section className="admin-settings-section" key={group.id}>
                    <div className="admin-settings-section-head">
                      <GroupIcon size={19} />
                      <div>
                        <strong>{group.title}</strong>
                        <span>{group.description}</span>
                      </div>
                    </div>
                    <div className="admin-settings-grid">
                      {groupSettings.map((definition) => {
                        const setting = workspaceSettingMap.get(definition.key) ?? definition;
                        const isSensitive = Boolean(definition.sensitive);
                        const draftValue = sensitiveSettingDrafts[setting.key] ?? "";
                        const hasStoredValue = Boolean(setting.value);
                        const isDirty = isSensitive ? draftValue.trim().length > 0 : Boolean(dirtyWorkspaceSettingKeys[setting.key]);
                        return (
                          <article className={`admin-setting-card ${isDirty ? "dirty" : ""}`} key={setting.key}>
                            <div className="pricing-rule-head">
                              <div>
                                <span className="pricing-rule-kicker">{definition.group}</span>
                                <strong>{setting.label || definition.label}</strong>
                                <em>{definition.helper}</em>
                              </div>
                              {!definition.readOnly && (
                                <ActionIconButton
                                  disabled={!isDirty}
                                  onClick={() => {
                                    if (isSensitive && !draftValue.trim()) {
                                      notify("Valore non modificato", hasStoredValue ? "Il valore esiste gia: scrivi un nuovo valore per sostituirlo." : "Scrivi un valore prima di salvarlo.");
                                      return;
                                    }
                                    saveWorkspaceSetting({
                                      ...definition,
                                      ...setting,
                                      group: definition.group,
                                      label: definition.label,
                                      value: isSensitive ? draftValue : setting.value,
                                    });
                                  }}
                                  label={isDirty ? `Salva ${setting.label || definition.label}` : `${setting.label || definition.label}: nessuna modifica da salvare`}
                                >
                                  <Check size={17} />
                                </ActionIconButton>
                              )}
                            </div>
                            {isSensitive && (
                              <div className={`admin-secret-state ${hasStoredValue ? "set" : ""}`}>
                                <InfoIcon size={15} />
                                <span>{hasStoredValue ? "Codice attivo: non viene mostrato. Scrivi qui sotto solo se vuoi sostituirlo." : "Accesso libero: nessun codice richiesto, i flussi restano operativi."}</span>
                              </div>
                            )}
                            <label className="full-field">
                              {isSensitive ? "Nuovo valore" : "Valore"}
                              <input
                                type={definition.inputType || "text"}
                                value={isSensitive ? draftValue : setting.value}
                                placeholder={isSensitive && hasStoredValue ? "Lascia vuoto per non modificare" : definition.placeholder}
                                readOnly={definition.readOnly}
                                autoComplete="off"
                                onChange={(event) => {
                                  if (isSensitive) {
                                    setSensitiveSettingDrafts((current) => ({ ...current, [setting.key]: event.target.value }));
                                    return;
                                  }
                                  const next = { ...definition, ...setting, group: definition.group, label: definition.label, value: event.target.value };
                                  setDirtyWorkspaceSettingKeys((current) => ({ ...current, [next.key]: true }));
                                  setWorkspaceSettings((current) => {
                                    const exists = current.some((item) => item.key === next.key);
                                    return exists ? current.map((item) => (item.key === next.key ? next : item)) : [...current, next];
                                  });
                                }}
                              />
                            </label>
                            {isDirty && <small className="admin-setting-dirty">Da salvare</small>}
                            <small className="admin-setting-key">{setting.key}</small>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                );
              })}
            </div>
          </div>
        </>
      )}

      {adminTab === "Manuale" && (
        <>
          <SectionTitle
            title="Manuale utente"
            icon={<BookOpen size={20} />}
            meta="DOCX v2.2"
            actions={
              <a className="app-btn app-btn-primary" href={USER_MANUAL_URL} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Apri manuale
              </a>
            }
          />
          <div className="pricing-console">
            <div className="pricing-hero-card auth-invite-card auth-invite-card--compact">
              <div>
                <span className="eyebrow">Guida operativa FunniFin</span>
                <strong>Manuale completo consultabile dagli utenti FunniFin</strong>
                <em>
                  Include flusso Cliente end-to-end, console FunniFin, Esperto, Brand, fixed bottom sheet,
                  centro notifiche, tipi di mail, destinatari, fallback backend e atlante UI con pallini numerati.
                </em>
              </div>
              <div className="auth-invite-actions">
                <a className="app-btn app-btn-primary" href={USER_MANUAL_URL} target="_blank" rel="noreferrer">
                  <ExternalLink size={16} />
                  Apri DOCX
                </a>
                <a className="app-btn app-btn-ghost" href={USER_MANUAL_URL} download>
                  Scarica
                </a>
              </div>
            </div>
          </div>
        </>
      )}

      {adminTab === "Utenti" && (
        <>
          <SectionTitle title="Utenti e inviti" icon={<UsersRound size={20} />} />
          <div className="pricing-console">
            <div className="pricing-hero-card">
              <div>
                <span className="eyebrow">Accessi autorizzati</span>
                <strong>{authUsers.length} account attivi</strong>
                <em>Inviti e codici gestiti da FunniFin con Google Sheets.</em>
              </div>
              <div className="pricing-hero-metrics">
                <Info label="FunniFin" value={String(authUsers.filter((u) => u.actualRole === "FunniFin").length)} />
                <Info label="Esperti" value={String(authUsers.filter((u) => u.actualRole === "Esperto").length)} />
                <Info label="Brand" value={String(authUsers.filter((u) => u.actualRole === "Brand").length)} />
                <Info label="In attesa" value={String(accessRequests.filter((r) => r.status === "pending").length)} />
              </div>
            </div>
            <div className="pricing-hero-card auth-invite-card auth-invite-card--compact">
              <div>
                <span className="eyebrow">Nuovo invito</span>
                <strong>Invia accesso con codice</strong>
                <em>FunniFin crea il record su Sheet e, se attivo, invia la mail con il codice.</em>
              </div>
              <div className="auth-invite-actions">
                <span className="auth-invite-hint">Il comando principale sta nel footer fisso qui sotto.</span>
              </div>
            </div>
            <div className="admin-auth-tabs" role="tablist" aria-label="Sezione utenti">
              <button type="button" role="tab" aria-selected={authSectionTab === "utenti"} className={authSectionTab === "utenti" ? "active" : ""} onClick={() => setAuthSectionTab("utenti")}>
                Utenti
              </button>
              <button type="button" role="tab" aria-selected={authSectionTab === "richieste"} className={authSectionTab === "richieste" ? "active" : ""} onClick={() => setAuthSectionTab("richieste")}>
                Richieste di accesso
              </button>
            </div>
            {authLoading && <p style={{ color: "var(--color-muted)", marginTop: "0.5rem" }}>Carico utenti da Google Sheets...</p>}
            {authSectionTab === "utenti" ? (
              <table className="auth-users-table">
                <thead>
                  <tr>
                    <th>Nome</th>
                    <th>Email</th>
                    <th>Ruolo</th>
                    <th>Expert ID</th>
                    <th>Stato</th>
                    <th>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {authUsers.map((user) => (
                    <tr key={user.id}>
                      <td><strong>{user.displayName}</strong></td>
                      <td><em>{user.email}</em></td>
                      <td>
                        <span className={`role-title-badge role-${user.actualRole.toLowerCase()}`}>{user.actualRole}</span>
                      </td>
                      <td>{user.expertId ?? "—"}</td>
                      <td>
                        <span className={`user-status-badge ${user.disabled ? "disabled" : "active"}`}>
                          {user.disabled ? "Disabilitato" : "Attivo"}
                        </span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <ActionIconButton
                            variant="neutral"
                            onClick={() => openEditAuthModal(user)}
                            disabled={inviteBusy}
                            label={`Modifica ${user.displayName}`}
                          >
                            <Settings2 size={15} />
                          </ActionIconButton>
                          <ActionIconButton
                            variant={user.disabled ? "success" : "danger"}
                            onClick={() => {
                              setInviteBusy(true);
                              void updateAuthUser(user.id, {
                                email: user.email,
                                actualRole: user.actualRole,
                                displayName: user.displayName,
                                expertId: user.expertId ?? "",
                                invitedBy: user.invitedBy ?? "FunniFin",
                                disabled: !user.disabled,
                              })
                                .then(() => refreshAuthData())
                                .then(() => notify(user.disabled ? "Utente riattivato" : "Utente disabilitato", user.email))
                                .catch((error: unknown) => notify("Aggiornamento non riuscito", error instanceof Error ? error.message : "Impossibile aggiornare l'utente."))
                                .finally(() => setInviteBusy(false));
                            }}
                            disabled={inviteBusy}
                            loading={inviteBusy}
                            label={user.disabled ? `Riattiva ${user.displayName}` : `Disabilita ${user.displayName}`}
                          >
                            {user.disabled ? <Check size={15} /> : <X size={15} />}
                          </ActionIconButton>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="auth-requests-tab">
                {accessRequests.length === 0 ? (
                  <p style={{ color: "var(--color-muted)", marginTop: "1.5rem", fontSize: "0.875rem" }}>
                    Nessuna richiesta di accesso in attesa.
                  </p>
                ) : (
                  <table className="auth-users-table auth-requests-table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Ruolo</th>
                        <th>Codice</th>
                        <th>Stato</th>
                        <th>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessRequests.map((req) => (
                        <tr key={req.id}>
                          <td>
                            <strong>{req.email}</strong>
                            <small>
                              {req.requestedRole ? `${req.requestedRole} · ` : ""}
                              {req.refCode ? `ref: ${req.refCode}` : "accesso diretto"}
                            </small>
                          </td>
                          <td>
                            <span className={`role-title-badge role-${(req.requestedRole ?? "Brand").toLowerCase()}`}>{req.requestedRole ?? "Brand"}</span>
                          </td>
                          <td>
                            <span>{req.codeStatus ?? "pending"}</span>
                            <small>{req.sendMail === false ? "mail disattivata" : "mail attiva"}</small>
                          </td>
                          <td>
                            <span className={`user-status-badge ${req.status === "approved" ? "active" : req.status === "rejected" ? "disabled" : ""}`}>
                              {req.status}
                            </span>
                          </td>
                          <td>
                            <div className="table-actions">
                              <ActionIconButton
                                variant="success"
                                onClick={() => void handleReviewAccessRequest(req, "approved")}
                                disabled={inviteBusy}
                                loading={inviteBusy}
                                label={`Approva ${req.email}`}
                              >
                                <Check size={15} />
                              </ActionIconButton>
                              <ActionIconButton
                                variant="danger"
                                onClick={() => void handleReviewAccessRequest(req, "rejected")}
                                disabled={inviteBusy}
                                loading={inviteBusy}
                                label={`Rifiuta ${req.email}`}
                              >
                                <X size={15} />
                              </ActionIconButton>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {authModalOpen && (
        <ModalBackdrop labelledBy="auth-user-modal-title" className="auth-user-modal-backdrop">
          <form className="custom-modal admin-action-modal auth-user-modal" onSubmit={handleInviteUser}>
            <header className="modal-header">
              <div>
                <span className="eyebrow">{authModalMode === "create" ? "Nuovo invito" : "Utente esistente"}</span>
                <strong id="auth-user-modal-title">{authModalMode === "create" ? "Invia accesso con codice" : "Modifica utente autorizzato"}</strong>
                <p>FunniFin crea il record su Sheet e, se attivo, invia la mail con il codice.</p>
              </div>
              <button type="button" className="modal-close" onClick={resetAuthModal} aria-label="Chiudi modal">
                <X size={18} />
              </button>
            </header>
            <div className="modal-body auth-user-modal-body">
              <div className="modal-stack">
                <div className="workflow-impact-panel">
                  <div>
                    <strong>{authModalMode === "create" ? "Crea accesso" : "Aggiorna accesso"}</strong>
                    <span>
                      {authModalMode === "create"
                        ? "Invito, codice e mail restano gestiti da FunniFin."
                        : "Puoi correggere ruolo, nome visualizzato, Expert ID e stato account."}
                    </span>
                  </div>
                  <ul className="modal-points single">
                    <li>
                      <Check size={16} />
                      <span>Record scritto su Google Sheets</span>
                    </li>
                    <li>
                      <Check size={16} />
                      <span>{authModalMode === "create" ? "Codice di accesso generato da FunniFin" : "Modifiche immediatamente salvate"}</span>
                    </li>
                    <li>
                      <Check size={16} />
                      <span>{authModalMode === "create" ? "Mail opzionale con codice" : "Stato utente modificabile"}</span>
                    </li>
                  </ul>
                </div>
                <div className="auth-invite-grid auth-invite-grid--modal">
                  <label className="auth-invite-field">
                    Email
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(event) => setInviteEmail(event.target.value)}
                      placeholder="nome@azienda.it"
                      autoComplete="email"
                      required
                      disabled={inviteBusy}
                    />
                  </label>
                  <label className="auth-invite-field">
                    Nome visualizzato
                    <input
                      type="text"
                      value={inviteDisplayName}
                      onChange={(event) => setInviteDisplayName(event.target.value)}
                      placeholder="Nome Cognome o team"
                      disabled={inviteBusy}
                    />
                  </label>
                  <label className="auth-invite-field">
                    Ruolo
                    <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as AuthRole)} disabled={inviteBusy}>
                      <option value="FunniFin">FunniFin</option>
                      <option value="Esperto">Esperto</option>
                      <option value="Brand">Brand</option>
                    </select>
                  </label>
                  <label className="auth-invite-field">
                    Expert ID
                    <input
                      type="text"
                      value={inviteExpertId}
                      onChange={(event) => setInviteExpertId(event.target.value)}
                      placeholder="solo per esperti"
                      disabled={inviteBusy}
                    />
                  </label>
                  <label className="auth-invite-toggle">
                    <input
                      type="checkbox"
                      checked={inviteDisabled}
                      onChange={(event) => setInviteDisabled(event.target.checked)}
                      disabled={inviteBusy}
                    />
                    <span>Account disabilitato</span>
                  </label>
                  {authModalMode === "create" && (
                    <label className="auth-invite-toggle">
                      <input
                        type="checkbox"
                        checked={inviteSendMail}
                        onChange={(event) => setInviteSendMail(event.target.checked)}
                        disabled={inviteBusy}
                      />
                      <span>Manda mail con codice</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
            <footer className="modal-footer auth-user-modal-footer">
              <AppButton type="button" variant="ghost" onClick={resetAuthModal} disabled={inviteBusy}>
                Annulla
              </AppButton>
              <AppButton type="submit" variant="primary" loading={inviteBusy} disabled={!inviteEmail.trim()}>
                {authModalMode === "create" ? "Invia invito" : "Salva utente"}
              </AppButton>
            </footer>
          </form>
        </ModalBackdrop>
      )}

      {requestDeleteConfirm && (
        <ModalBackdrop labelledBy="request-delete-modal-title" className="request-delete-modal-backdrop">
          <section className="custom-modal admin-action-modal request-delete-modal">
            <header className="modal-header">
              <div>
                <span className="eyebrow">Coda clienti</span>
                <strong id="request-delete-modal-title">Eliminare questa richiesta?</strong>
                <p>La richiesta sparisce dalla coda operativa e dal registro Google.</p>
              </div>
              <button
                type="button"
                className="modal-close"
                onClick={() => setRequestDeleteConfirm(null)}
                aria-label="Chiudi modal"
                disabled={deletingRequestId === requestDeleteConfirm.id}
              >
                <X size={18} />
              </button>
            </header>
            <div className="modal-body">
              <div className="modal-stack">
                <div className="request-delete-summary">
                  <Info label="Cliente" value={requestDeleteConfirm.company} />
                  <Info label="Referente" value={requestDeleteConfirm.manager || requestDeleteConfirm.email} />
                  <Info label="Workshop" value={`${requestDeleteConfirm.workshopIds.length} selezionati`} />
                  <Info label="Totale" value={`${money(requestDeleteConfirm.quoteTotal)} + IVA`} />
                </div>
                <p className="modal-warning">Non viene inviata nessuna email al cliente.</p>
              </div>
            </div>
            <footer className="modal-footer">
              <AppButton
                type="button"
                variant="ghost"
                onClick={() => setRequestDeleteConfirm(null)}
                disabled={deletingRequestId === requestDeleteConfirm.id}
              >
                Annulla
              </AppButton>
              <AppButton
                type="button"
                variant="primary"
                className="request-delete-confirm-btn"
                onClick={() => void confirmDeleteRequest()}
                loading={deletingRequestId === requestDeleteConfirm.id}
              >
                Elimina richiesta
              </AppButton>
            </footer>
          </section>
        </ModalBackdrop>
      )}

      {adminActionModal && (
        <AdminActionModal
          modal={adminActionModal}
          rows={currentProjectSelections}
          project={selectedProject}
          recipientEmails={workspaceRecipientEmails}
          eventPrechecks={eventPrechecks}
          eventRecord={currentProjectEvent}
          canConfirmEvent={canConfirmEvent}
          brandApprovedForCalendar={brandApprovedForCalendar}
          rules={rules}
          expertCount={expertDirectory.length}
          onClose={() => setAdminActionModal(null)}
          onConfirmDate={(workshopId, decision, notification) => confirmDateDecision(workshopId, decision, notification)}
          onConfirmExpert={(workshopId, expertName, mode, notification) => confirmExpertAssignment(workshopId, expertName, mode, notification)}
          onInviteExperts={(notification) => inviteExpertsToCandidacy(notification)}
          onConfirmBrandHandoff={(notification) => sendBrandHandoff(notification)}
          onConfirmEvent={createCalendarEvent}
          onSaveRequestEdit={(records, phase, notification) => confirmRequestEdit(records, phase, notification)}
          onSaveRule={async (ruleId, patch) => {
            const nextRules = rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule));
            const nextRule = nextRules.find((rule) => rule.id === ruleId);
            setRules(nextRules);
            setPricingSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
            if (nextRule) {
              try {
                const savedRule = await updatePricingRule(nextRule);
                setRules(nextRules.map((rule) => (rule.id === savedRule.id ? { ...rule, ...savedRule } : rule)));
                notify("Prezzi salvati su Google", "Nome, range, sconto e logica preventivo sono ora usati dal preventivo dinamico.");
              } catch (error) {
                notify("Prezzi non salvati", error instanceof Error ? error.message : "Google Sheets non disponibile.");
              }
            }
          }}
        />
      )}
      <BottomActionBar
        leftContent={
          <div className="bottom-action-copy bottom-action-copy--project bottom-action-copy--admin">
            <div
              className="bottom-project-summary-card"
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                  setBottomProjectMenuOpen(false);
                }
              }}
            >
              <div className="bottom-project-step-row">
                <span className="bottom-project-eyebrow">
                  {adminBottomState.eyebrow}
                </span>
              </div>
              <div className="bottom-project-main-row">
                <div className="bottom-project-info">
                  <strong className="bottom-project-company">{adminBottomState.title}</strong>
                  <small className="bottom-project-detail">{adminBottomState.detail}</small>
                </div>
                <div className="bottom-project-meta">
                  <strong className="bottom-project-price">{adminBottomState.meta}</strong>
                </div>
                {adminTab === "Operativo" && adminProjects.length > 1 && (
                  <div className="bottom-project-menu">
                    <button
                      type="button"
                      className="bottom-project-menu-trigger"
                      aria-label="Cambia richiesta"
                      aria-expanded={bottomProjectMenuOpen}
                      onClick={() => setBottomProjectMenuOpen((open) => !open)}
                    >
                      <ChevronDown size={18} />
                    </button>
                    {bottomProjectMenuOpen && (
                      <div className="bottom-project-menu-popover" role="menu" aria-label="Cambia richiesta">
                        <div className="bottom-project-menu-head">
                          <strong>Coda progetti</strong>
                          <span>Ordine cronologico</span>
                        </div>
                        {bottomProjectMenuItems.map(({ project, meta }) => (
                          <button
                            key={project.id}
                            type="button"
                            className={project.id === selectedProject.id ? "active" : ""}
                            role="menuitem"
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={() => {
                              selectProject(project);
                              setBottomProjectMenuOpen(false);
                            }}
                          >
                            <span>
                              <strong>{project.company}</strong>
                              <small>{project.workshopIds.length} workshop · {meta.dateDistance}</small>
                            </span>
                            <em>{money(project.quoteTotal)}</em>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {(adminTab !== "Operativo" || adminProjects.length <= 1) && (
                  <span className="bottom-project-menu-spacer" aria-hidden="true" />
                )}
              </div>
            </div>
          </div>
        }
        context={
          adminTab === "Utenti"
            ? "Utenti e inviti"
            : adminTab === "Catalogo"
            ? `Catalogo · ${catalogView === "drive" ? "Slide Drive" : "Sheet"}`
            : adminTab === "Manuale"
              ? "Manuale utente"
            : adminTab === "Google"
              ? "Google backend"
              : adminTab
        }
        detail={
          adminTab === "Utenti"
            ? `${authUsers.filter((user) => !user.disabled).length} attivi · ${accessRequests.filter((request) => request.status === "pending").length} in attesa`
            : adminTab === "Catalogo" && catalogView === "drive"
            ? `${driveLinkedCount}/${workshops.length} slide collegate`
            : adminTab === "Manuale"
              ? "DOCX v2.2 · flussi e atlante UI"
            : adminTab === "Google"
              ? `Workspace Google · ${googleHealthStatusLabel.toLowerCase()}`
              : `${selectedProject.company} · ${statusLabel[activeAdminStatus]}`
        }
        backLabel={adminBackAction ? "Indietro" : undefined}
        onBack={adminBackAction ?? undefined}
        primaryLabel={adminMainAction.label}
        primaryDisabled={adminMainAction.disabled}
        primaryLoading={"loading" in adminMainAction ? adminMainAction.loading : false}
        onPrimary={adminMainAction.action}
        secondaryLabel={adminTab === "Utenti" ? "Ricarica utenti" : undefined}
        onSecondary={adminTab === "Utenti" ? () => void refreshAuthData() : undefined}
        secondaryLoading={adminTab === "Utenti" ? authLoading : false}
      />
    </section>
  );
}
