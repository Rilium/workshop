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
import { sendWorkflowNotification, type WorkflowNotificationPayload, type WorkflowNotificationRecipientRole } from "../../emailService";
import { createWorkshopCalendarEvent, getWorkshopAvailability } from "../../googleCalendarService";
import type { AssetDraftFolder, UploadedAsset } from "../../driveAssetService";
import { deleteExpert, getGoogleHealth, listCatalogConfig, listCatalogWorkshops, listExperts, listPricingRules, listWorkspaceSettings, updateCatalogTopic, updateExpert, updatePricingRule, updateWorkspaceSetting, type CatalogWorkshopConfig, type GoogleHealth, type WorkspaceSetting } from "../../googleAdminService";
import { getDriveFolderPreview, type DriveFolderResponse } from "../../googleDriveService";
import { listWorkshopRequests, updateWorkshopRequest, type RequestWorkshopRecord, type WorkshopRequestRecord } from "../../requestService";
import { listAuthUsers, listAccessRequests, requestLoginCode, reviewAccessRequest } from "../../authService";
import type { AuthRole, AuthUser, AccessRequest } from "../../types/auth";
import { SECRET_SETTINGS } from "../../secretSettings";
import { adminSettingDefinitions, adminSettingGroups, appEnv, projectStatuses, statusLabel } from "../../data/workflow";
import { canvaCatalogSource, experts, initialExpertProfiles, topics, workshops } from "../../data/catalog";
import type { AdminProject, AdminProjectWorkshopRow, AdminWorkspacePanel, CalendarEventRecord, DateApproval, DateDecision, DriveSlideLink, ExpertProfile, Format, PricingRule, ProjectStatus, Quote, Selection, Theme, Workshop } from "../../types/domain";
import type { AdminActionModalState, NotificationChoice } from "../../types/ui";
import { money } from "../../utils/money";
import { buildLocalAdminProject, requestToAdminProject, topicColorClass } from "../../utils/workshop";
import { getFriendlyErrorMessage } from "../../utils/status";
import { AppButton } from "../../components/ui/AppButton";
import { ActionIconButton, ToolIconButton } from "../../components/ui/IconButton";
import { EventLink } from "../../components/ui/EventLink";
import { Info } from "../../components/ui/Info";
import { Panel } from "../../components/ui/Panel";
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
import { AdminSectionNav } from "./components/AdminSectionNav";
import { CatalogEditModal } from "./components/CatalogEditModal";
import { ExpertProfileModal } from "./components/ExpertProfileModal";
import { getWorkshopSelectionPrice } from "../../utils/workshop";
import { updateAuthUser } from "../../authService";

const GOOGLE_HEALTH_CACHE_KEY = "funnifin.googleHealth.v1";
type AdminQueueFilter = "tutti" | "oggi" | "da-fissare" | "produzione" | "in-calendario" | "chiusi";
type QueueCardTone = "neutral" | "today" | "late" | "soon" | "calendar" | "closed";

const queueFilterOptions: Array<{ id: AdminQueueFilter; label: string }> = [
  { id: "tutti", label: "Tutti" },
  { id: "oggi", label: "Oggi" },
  { id: "da-fissare", label: "Da fissare" },
  { id: "produzione", label: "Produzione" },
  { id: "in-calendario", label: "In calendario" },
  { id: "chiusi", label: "Chiusi" },
];

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

function readCachedGoogleHealth() {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(GOOGLE_HEALTH_CACHE_KEY);
    if (!raw) return null;
    const health = JSON.parse(raw) as GoogleHealth;
    return health?.source === "google-workspace" && health.spreadsheet?.id ? { ...health, cached: true } : null;
  } catch (error) {
    window.localStorage.removeItem(GOOGLE_HEALTH_CACHE_KEY);
    return null;
  }
}

function writeCachedGoogleHealth(health: GoogleHealth | null) {
  if (typeof window === "undefined" || !health) return;
  window.localStorage.setItem(GOOGLE_HEALTH_CACHE_KEY, JSON.stringify(health));
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
  notify: (title: string, body: string) => void;
  syncProjectStatus: (status: ProjectStatus) => void;
  clientAssetFolder: AssetDraftFolder | null;
  clientUploadedAssets: UploadedAsset[];
  currentRequest: WorkshopRequestRecord | null;
  requestRefreshToken: number;
  systemRefreshToken: number;
  systemSettingsToken: number;
}) {
  const [adminTab, setAdminTab] = useState("Operativo");
  const [catalogView, setCatalogView] = useState<"sheet" | "drive">("sheet");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminQueueFilter, setAdminQueueFilter] = useState<AdminQueueFilter>("tutti");
  const localProject = buildLocalAdminProject(selections, quote.total, projectStatus);
  const [adminProjects, setAdminProjects] = useState<AdminProject[]>(() => (currentRequest ? [requestToAdminProject(currentRequest)] : [localProject]));
  const [selectedProjectId, setSelectedProjectId] = useState(currentRequest?.id ?? localProject.id);
  const [requestSyncState, setRequestSyncState] = useState<{ loading: boolean; error: string; source: "sheet" | "local" }>({
    loading: false,
    error: "",
    source: currentRequest ? "sheet" : "local",
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
  const [pricingSavedAt, setPricingSavedAt] = useState("");
  const [expertsSyncedAt, setExpertsSyncedAt] = useState("");
  const [catalogRefreshedAt, setCatalogRefreshedAt] = useState("");
  const [sheetCatalogWorkshops, setSheetCatalogWorkshops] = useState<CatalogWorkshopConfig[]>([]);
  const [driveSlidesSyncedAt, setDriveSlidesSyncedAt] = useState("");
  const [driveSlidesRoot, setDriveSlidesRoot] = useState("Drive/FunniFin/Presentazioni operative");
  const [driveSlideLinks, setDriveSlideLinks] = useState<Partial<Record<string, DriveSlideLink>>>({});
  const [expertDirectory, setExpertDirectory] = useState<ExpertProfile[]>(initialExpertProfiles);
  const [selectedExpertProfileId, setSelectedExpertProfileId] = useState<string | null>(null);
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
    try {
      const [users, requests] = await Promise.all([listAuthUsers(), listAccessRequests()]);
      setAuthUsers(users);
      setAccessRequests(requests);
    } catch (error) {
      notify("Auth", error instanceof Error ? error.message : "Aggiornamento utenti non riuscito.");
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
        notify("Prezzi Google non letti", error instanceof Error ? error.message : "Uso le regole locali.");
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
        notify("Catalogo Google non letto", error instanceof Error ? error.message : "Uso la configurazione locale.");
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
        notify("Esperti Google non letti", error instanceof Error ? error.message : "Uso la rubrica locale.");
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
        notify("Settings Google non letti", error instanceof Error ? error.message : "Uso configurazione locale/env.");
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
        const fallbackProjects = nextProjects.length ? nextProjects : [buildLocalAdminProject(selections, quote.total, projectStatus)];
        setAdminProjects(fallbackProjects);
        setSelectedProjectId((current) => (fallbackProjects.some((project) => project.id === current) ? current : fallbackProjects[0].id));
        setRequestSyncState({ loading: false, error: "", source: nextProjects.length ? "sheet" : "local" });
      })
      .catch((error) => {
        if (!alive) return;
        const fallbackProjects = currentRequest ? [requestToAdminProject(currentRequest)] : [buildLocalAdminProject(selections, quote.total, projectStatus)];
        setAdminProjects(fallbackProjects);
        setSelectedProjectId((current) => (fallbackProjects.some((project) => project.id === current) ? current : fallbackProjects[0].id));
        setRequestSyncState({ loading: false, error: "", source: "local" });
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
      await sendWorkflowNotification({
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
      notify("Richiesta modificata", `Fase: ${statusLabel[phase]}. Email inviata a ${notification.recipients.join(", ")}.`);
    } else {
      notify("Richiesta modificata", `Fase: ${statusLabel[phase]}. Salvata senza inviare email.`);
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
        notify("Profilo esperto salvato solo in locale", error instanceof Error ? error.message : "Google Sheets non disponibile.");
        setSelectedExpertProfileId(null);
      });
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
        if (expert) notify("Esperto eliminato solo in locale", error instanceof Error ? error.message : `${expertFullName(expert)} rimosso dalla vista corrente.`);
      });
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
  ) => {
    if (phase !== "event_confirmed") return;
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
      notify(
        result.sent ? (result.opaque ? "Email inoltrata, consegna da verificare" : "Email inviata") : "Email pronta in demo",
        `${choice.recipients.join(", ")} · ${result.recipients.join(", ")}`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invio notifica non riuscito";
      notify("Email non inviata", message);
    }
  };
  const selectProject = (project: AdminProject) => {
    setSelectedProjectId(project.id);
    setAssignmentWorkshopId(project.workshopIds[0] ?? "");
    if (project.source === "local") setProjectStatus(projectStatus, "Richiesta locale", "Non ancora salvata sul registro richieste.");
    else notify("Progetto selezionato", `${project.company}: ${statusLabel[project.status]}.`);
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
    await sendPhaseNotification(mode === "reassign" ? "candidacies_open" : "expert_assigned", choice, undefined);
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
      const source = results.some((result) => result.source === "google-freebusy") ? "Google Calendar FreeBusy" : "Disponibilita demo";
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
  const sendBrandHandoff = async (choice: NotificationChoice) => {
    runProjectStatus("in_revisione_brand", "In revisione brand", "Il deck passa al team brand/design.");
    setAdminWorkspacePanel("confirm");
    await sendPhaseNotification("brand_review", choice, undefined);
  };
  const createCalendarEvent = async (choice?: NotificationChoice) => {
    if (!canConfirmEvent) return;
    try {
      const eventMode = choice?.eventMode ?? "confirmed";
      if (eventMode === "confirmed" && !calendarDeckUrl) {
        notify("Deck finale non abilitato", "Il Brand deve abilitare esplicitamente il link deck per Calendar prima del definitivo.");
        return;
      }
      if (eventMode === "confirmed" && projectStatuses.indexOf(activeAdminStatus) < projectStatuses.indexOf("approvazione_finale")) {
        notify("Brand non approvato", "Crea il definitivo solo dopo approvazione Brand e abilitazione del deck Calendar.");
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
        finalDeckUrl: eventMode === "confirmed" ? calendarDeckUrl : undefined,
        finalDeckTitle: eventMode === "confirmed" ? calendarDeckTitle : undefined,
        sendCalendarInvites: eventMode === "confirmed" && Boolean(choice?.send),
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
        `Evento ${eventRecord.id} creato con Meet${eventMode === "confirmed" && calendarDeckUrl ? " e link deck finale" : ""}.`,
      );
      if (choice && eventMode === "confirmed") {
        await sendPhaseNotification("event_confirmed", choice, {
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
  const matchesProjectQueueFilter = (meta: ReturnType<typeof getProjectQueueMeta>, filter: AdminQueueFilter) => {
    if (filter === "tutti") return true;
    if (filter === "oggi") return meta.dayOffset === 0;
    if (filter === "da-fissare") return meta.needsScheduling;
    if (filter === "produzione") return meta.isProduction;
    if (filter === "in-calendario") return meta.hasCalendarEvent && !meta.isClosed;
    return meta.isClosed;
  };
  const searchedAdminProjects = adminProjects.filter((project) => {
    const text = `${project.company} ${project.manager} ${project.email}`.toLowerCase();
    return adminSearch.trim() === "" || text.includes(adminSearch.trim().toLowerCase());
  });
  const adminQueueCards = searchedAdminProjects.map((project) => ({ project, meta: getProjectQueueMeta(project) }));
  const filteredAdminProjectCards = adminQueueCards.filter(({ meta }) => matchesProjectQueueFilter(meta, adminQueueFilter));
  const countQueueFilter = (filter: AdminQueueFilter) => adminQueueCards.filter(({ meta }) => matchesProjectQueueFilter(meta, filter)).length;
  const adminFlowSteps = [
    { id: "workshops", title: "Richiesta", body: "Workshop, prezzo e coerenza" },
    { id: "calendar", title: "Date", body: "FreeBusy e approvazioni" },
    { id: "experts", title: "Esperti", body: "Candidati e assegnazioni" },
    { id: "folder", title: "Materiali", body: "Logo, deck e review" },
    { id: "confirm", title: "Conferma", body: "Evento finale" },
  ] as const;
  const catalogThemeRows = topics.flatMap((topic) => topic.themes.map((theme) => ({ ...theme, topicId: topic.id, topicTitle: topic.title })));
  const catalogWorkshopsForAdmin = sheetCatalogWorkshops.length > 0 ? sheetCatalogWorkshops : workshops;
  const catalogSourceLabel = sheetCatalogWorkshops.length > 0 ? "Google Sheet" : "fallback locale";
  const sheetPreviewUrl = googleHealth?.spreadsheet.id
    ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(googleHealth.spreadsheet.id)}/preview`
    : "";
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
  const adminSections = [
    {
      id: "Operativo",
      title: "Richieste cliente",
      meta: `${adminProjects.filter((project) => project.status !== "confermato").length} aperte`,
      body: "Coda, dettaglio progetto, date, assegnazioni e avanzamento stato.",
      icon: <BriefcaseBusiness size={18} />,
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
      id: "Utenti",
      title: "Utenti e inviti",
      meta: `${authUsers.length} utenti`,
      body: "Account autorizzati, ruoli, inviti e richieste di accesso.",
      icon: <BadgeCheck size={18} />,
    },
  ];
  const activeAdminSection = adminSections.find((section) => section.id === adminTab) ?? adminSections[0];
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
          disabled: false,
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
          action: () => refreshGoogleHealth({ refresh: true }),
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
          detail: `${selectedProjectRows.length} workshop · ${requestSyncState.source === "sheet" ? "registro Google" : "vista locale"}`,
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
        const fallbackProjects = projects.length ? projects : [buildLocalAdminProject(selections, quote.total, projectStatus)];
        setAdminProjects(fallbackProjects);
        setSelectedProjectId((current) => (fallbackProjects.some((project) => project.id === current) ? current : fallbackProjects[0].id));
        setRequestSyncState({ loading: false, error: "", source: projects.length ? "sheet" : "local" });
        notify(projects.length ? "Coda aggiornata" : "Nessuna richiesta salvata", projects.length ? `${projects.length} richieste lette dal registro.` : "Mostro solo la richiesta locale.");
      })
      .catch((error) => {
        const message = getFriendlyErrorMessage(error, "Lettura richieste non riuscita");
        setRequestSyncState({ loading: false, error: message, source: "local" });
        notify("Coda non aggiornata", message);
      });
  };
  const refreshCatalogSection = () => {
    if (catalogView === "drive") {
      setDriveSlidesSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      notify("Slide Drive sincronizzate", `${driveLinkedCount}/${workshops.length} workshop hanno una slide operativa collegata.`);
      return;
    }
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
            : `${topics.length} interessi, ${catalogThemeRows.length} temi e ${catalogWorkshopsForAdmin.length} workshop disponibili in fallback locale.`,
        );
      })
      .catch((error) => {
        setCatalogRefreshedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Catalogo locale verificato", error instanceof Error ? error.message : "Google Sheets non disponibile, uso configurazione locale.");
      });
  };
  const refreshPricingSection = () => {
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
        notify("Regole prezzo aggiornate", remoteRules.length > 0 ? `${remoteRules.length} regole lette da Google Sheets.` : `${rules.length} regole locali disponibili; preventivo cliente ricalcolato.`);
      })
      .catch((error) => {
        setPricingSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Prezzi locali verificati", error instanceof Error ? error.message : "Google Sheets non disponibile, uso regole locali.");
      });
  };
  const refreshExpertsSection = () => {
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
        notify("Vista esperti aggiornata", remoteExperts.length > 0 ? `${remoteExperts.length} profili letti da Google Sheets.` : `${expertDirectory.length} profili locali disponibili.`);
      })
      .catch((error) => {
        setExpertsSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
        notify("Esperti locali verificati", error instanceof Error ? error.message : "Google Sheets non disponibile, uso rubrica locale.");
      });
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
    notify("Impostazioni Google", "Aperto Google backend: qui gestisci invii, Sheet, Calendar, Drive e runtime.");
  }, [systemSettingsToken]);
  const automaticPricingRules = rules.filter((rule) => !rule.specialQuote);
  const quoteOnlyRules = rules.filter((rule) => rule.specialQuote);
  const maxAutomaticDiscount = automaticPricingRules.reduce((max, rule) => Math.max(max, rule.discountPercent), 0);
  const showRequestSkeleton = requestSyncState.loading && requestSyncState.source === "local";
  return (
    <section className="admin-console">
      <RoleHero
        eyebrow="FunniFin system"
        title="Gestione richieste workshop"
        subtitle={`${selectedProject.company} · ${selectedProjectRows.length} workshop · ${statusLabel[activeAdminStatus]}`}
      />
      <OperatorIdentityCard identity={roleIdentities.FunniFin} />

      <AdminSectionNav sections={adminSections} activeSection={adminTab} onSection={setAdminTab} />

      {adminTab === "Operativo" && (
        <Panel
          title="Richieste cliente"
          icon={<BriefcaseBusiness size={20} />}
          actions={
            <ToolIconButton active={requestSyncState.source === "sheet"} onClick={refreshAdminWorkspacePanel} label="Ricarica richieste cliente">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
        <div className="admin-workbench-v2">
          <aside className="admin-project-queue" aria-label="Coda progetti cliente">
            <div className="queue-control-panel">
              <div className="queue-head">
                <div>
                  <strong>Coda progetti</strong>
                  <span>
                    {requestSyncState.loading && "Lettura registro..."}
                    {!requestSyncState.loading && requestSyncState.source === "sheet" && `${filteredAdminProjectCards.length} progetti visibili`}
                    {!requestSyncState.loading && requestSyncState.source === "local" && "Vista locale temporanea"}
                  </span>
                </div>
                {adminSearch && (
                  <ToolIconButton active onClick={() => setAdminSearch("")} label="Reset ricerca progetti">
                    <X size={20} />
                  </ToolIconButton>
                )}
              </div>
              {requestSyncState.error && requestSyncState.source === "sheet" && (
                <div className="inline-status-card warning">
                  <AlertCircle size={18} />
                  <span>{requestSyncState.error}</span>
                </div>
              )}
              <div className="queue-controls">
                <label className="admin-search-field">
                  <Search size={18} />
                  <input value={adminSearch} onChange={(event) => setAdminSearch(event.target.value)} placeholder="Cerca azienda o referente" />
                  {adminSearch && (
                    <button type="button" onClick={() => setAdminSearch("")} aria-label="Cancella ricerca">
                      <X size={18} />
                    </button>
                  )}
                </label>
                <div className="admin-filter-pills">
                  {queueFilterOptions.map(({ id, label }) => (
                    <button key={id} className={adminQueueFilter === id ? "active" : ""} onClick={() => setAdminQueueFilter(id)}>
                      <span>{label}</span>
                      <em>{countQueueFilter(id)}</em>
                    </button>
                  ))}
                </div>
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
                return (
                  <button key={project.id} className={`project-choice-card ${selected ? "active" : ""} ${meta.tone}`} onClick={() => selectProject(project)}>
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
                    </div>
                    <div className="queue-card-side">
                      <small>{statusLabel[activeStatus]}</small>
                      <b>{money(project.source === "local" ? quote.total : project.quoteTotal)}</b>
                    </div>
                  </button>
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
                      <AppButton variant="secondary" onClick={verifyCalendars} disabled={calendarCheck.loading}>
                        <CalendarCheck size={17} /> {calendarCheck.loading ? "Verifico..." : "Verifica FreeBusy"}
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
        </Panel>
      )}

      {adminTab === "Catalogo" && (
        <Panel
          title="Catalogo"
          icon={<Settings2 size={20} />}
          actions={
            <>
              <ToolIconButton onClick={catalogView === "drive" ? syncDriveSlidesFromRoot : refreshCatalogSection} label={catalogView === "drive" ? "Ricarica slide Drive" : "Ricarica catalogo Sheet"}>
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
        >
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
              onSave={() => {
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
                    notify("Catalogo salvato solo in locale", error instanceof Error ? error.message : "Redeploy Apps Script necessario per salvare su Google Sheets.");
                    setCatalogModalTopicId(null);
                  });
              }}
            />
          )}
        </Panel>
      )}

      {adminTab === "Prezzi" && (
        <Panel
          title="Regole prezzo"
          icon={<CircleDollarSign size={20} />}
          actions={
            <>
              <ToolIconButton onClick={refreshPricingSection} label="Ricarica regole prezzo">
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
        >
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
        </Panel>
      )}

      {adminTab === "Esperti" && (
        <Panel
          title="Esperti e candidature"
          icon={<UsersRound size={20} />}
          actions={
            <>
              <ToolIconButton onClick={refreshExpertsSection} label="Ricarica esperti">
                <RefreshCw size={18} />
              </ToolIconButton>
              <AppButton variant="secondary" onClick={createExpertProfile}>
                <Plus size={17} /> Nuovo esperto
              </AppButton>
            </>
          }
        >
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
            />
          )}
        </Panel>
      )}

      {adminTab === "Google" && (
        <Panel
          title="Google backend"
          icon={<Settings2 size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshGoogleHealth({ refresh: true })} label="Ricarica stato Google">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          <div className="pricing-console">
            <div className="pricing-hero-card">
              <div>
                <span className="eyebrow">Workspace Google</span>
                <strong>{googleHealthLoading && googleHealth ? "Aggiorno..." : googleHealthLoading ? "Controllo..." : googleHealth ? "Connesso" : googleHealthError ? "Errore verifica" : "Verifica non eseguita"}</strong>
                <em>{googleHealth?.checkedAt ? `${googleHealth.checkedAt}${googleHealth.cached ? " · cache" : ""}${googleHealthLoading ? " · refresh live" : ""}` : googleHealthError || "Sheets, Calendar, Drive e MailApp"}</em>
              </div>
              <div className="pricing-hero-metrics" aria-label="Stato backend Google" aria-busy={googleHealthLoading}>
                {googleHealthLoading && !googleHealth ? (
                  Array.from({ length: 7 }).map((_, index) => (
                    <span className="skeleton-metric" key={`google-metric-skeleton-${index}`} aria-hidden="true">
                      <Skeleton />
                      <Skeleton />
                    </span>
                  ))
                ) : (
                  <>
                    <Info label="Richieste" value={String(googleHealth?.spreadsheet.requests ?? adminProjects.length)} />
                    <Info label="Eventi log" value={String(googleHealth?.spreadsheet.events ?? 0)} />
                    <Info label="Interessi" value={String(googleHealth?.spreadsheet.catalogTopics ?? Object.keys(catalogEdits).length)} />
                    <Info label="Workshop" value={String(googleHealth?.spreadsheet.catalogWorkshops ?? workshops.length)} />
                    <Info label="Prezzi" value={String(googleHealth?.spreadsheet.pricingRules ?? rules.length)} />
                    <Info label="Esperti" value={String(googleHealth?.spreadsheet.experts ?? expertDirectory.length)} />
                    <Info label="Mail quota" value={String(googleHealth?.mail.remainingDailyQuota ?? "-")} />
                  </>
                )}
              </div>
            </div>

            {googleHealth?.spreadsheet.url && (
              <div className="inline-status-card">
                <FolderKanban size={18} />
                <span>DB Google Sheets collegato: {googleHealth.spreadsheet.id}</span>
                <AppButton variant="outline" onClick={() => window.open(googleHealth.spreadsheet.url, "_blank", "noopener,noreferrer")}>
                  <ExternalLink size={17} /> Apri Sheet
                </AppButton>
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
        </Panel>
      )}
      {adminTab === "Utenti" && (
        <Panel title="Utenti e inviti" icon={<UsersRound size={20} />}>
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
              <table className="auth-users-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Nome</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Email</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Ruolo</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Expert ID</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Stato</th>
                    <th style={{ padding: "0.5rem 0.75rem" }}>Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {authUsers.map((user) => (
                    <tr key={user.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                      <td style={{ padding: "0.5rem 0.75rem" }}><strong>{user.displayName}</strong></td>
                      <td style={{ padding: "0.5rem 0.75rem" }}><em>{user.email}</em></td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span className={`role-title-badge role-${user.actualRole.toLowerCase()}`}>{user.actualRole}</span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>{user.expertId ?? "—"}</td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <span style={{ color: user.disabled ? "var(--color-error)" : "var(--color-success)" }}>
                          {user.disabled ? "Disabilitato" : "Attivo"}
                        </span>
                      </td>
                      <td style={{ padding: "0.5rem 0.75rem" }}>
                        <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            className="app-button app-button-secondary"
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                            onClick={() => openEditAuthModal(user)}
                            disabled={inviteBusy}
                            aria-label={`Modifica ${user.displayName}`}
                          >
                            <Settings2 size={14} />
                          </button>
                          <button
                            type="button"
                            className="app-button"
                            style={{ fontSize: "0.78rem", padding: "0.3rem 0.7rem" }}
                            onClick={() => void updateAuthUser(user.id, {
                              email: user.email,
                              actualRole: user.actualRole,
                              displayName: user.displayName,
                              expertId: user.expertId ?? "",
                              invitedBy: user.invitedBy ?? "FunniFin",
                              disabled: !user.disabled,
                            }).then(() => refreshAuthData()).then(() => notify(user.disabled ? "Utente riattivato" : "Utente disabilitato", user.email)).catch((error: unknown) => notify("Aggiornamento non riuscito", error instanceof Error ? error.message : "Impossibile aggiornare l'utente."))}
                            disabled={inviteBusy}
                            aria-label={user.disabled ? `Riattiva ${user.displayName}` : `Disabilita ${user.displayName}`}
                          >
                            {user.disabled ? <Check size={14} /> : <X size={14} />}
                          </button>
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
                  <table className="auth-users-table auth-requests-table" style={{ width: "100%", borderCollapse: "collapse", marginTop: "1rem" }}>
                    <thead>
                      <tr style={{ textAlign: "left", borderBottom: "1px solid var(--color-border)" }}>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Email</th>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Ruolo</th>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Codice</th>
                        <th style={{ padding: "0.5rem 0.75rem" }}>Stato</th>
                        <th style={{ padding: "0.5rem 0.75rem", textAlign: "right" }}>Azioni</th>
                      </tr>
                    </thead>
                    <tbody>
                      {accessRequests.map((req) => (
                        <tr key={req.id} style={{ borderBottom: "1px solid var(--color-border-subtle)" }}>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            <strong>{req.email}</strong>
                            <small style={{ display: "block", color: "var(--color-muted)", marginTop: "0.2rem" }}>
                              {req.requestedRole ? `${req.requestedRole} · ` : ""}
                              {req.refCode ? `ref: ${req.refCode}` : "accesso diretto"}
                            </small>
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            <span className={`role-title-badge role-${(req.requestedRole ?? "Brand").toLowerCase()}`}>{req.requestedRole ?? "Brand"}</span>
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            <span>{req.codeStatus ? req.codeStatus : "pending"}</span>
                            <small style={{ display: "block", color: "var(--color-muted)", marginTop: "0.2rem" }}>
                              {req.sendMail === false ? "mail disattivata" : "mail attiva"}
                            </small>
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            <span style={{ color: req.status === "rejected" ? "var(--color-error)" : req.status === "approved" ? "var(--color-success)" : "var(--color-muted)" }}>
                              {req.status}
                            </span>
                          </td>
                          <td style={{ padding: "0.5rem 0.75rem" }}>
                            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
                              <button
                                type="button"
                                className="app-button app-button-primary"
                                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                                onClick={() => void handleReviewAccessRequest(req, "approved")}
                                disabled={inviteBusy}
                                aria-label={`Approva ${req.email}`}
                              >
                                <Check size={14} />
                              </button>
                              <button
                                type="button"
                                className="app-button"
                                style={{ fontSize: "0.8rem", padding: "0.3rem 0.75rem" }}
                                onClick={() => void handleReviewAccessRequest(req, "rejected")}
                                disabled={inviteBusy}
                                aria-label={`Rifiuta ${req.email}`}
                              >
                                <X size={14} />
                              </button>
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
        </Panel>
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
                      <span>{authModalMode === "create" ? "Codice OTP generato da FunniFin" : "Modifiche immediatamente salvate"}</span>
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

      {adminActionModal && (
        <AdminActionModal
          modal={adminActionModal}
          rows={currentProjectSelections}
          project={selectedProject}
          recipientEmails={workspaceRecipientEmails}
          eventPrechecks={eventPrechecks}
          eventRecord={currentProjectEvent}
          canConfirmEvent={canConfirmEvent}
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
                notify("Prezzi salvati solo in locale", error instanceof Error ? error.message : "Redeploy Apps Script necessario per salvare su Google Sheets.");
              }
            }
          }}
        />
      )}
      <BottomActionBar
        leftContent={
          <div className="bottom-action-copy bottom-action-copy--project bottom-action-copy--admin">
            <div className="bottom-project-info">
              <span className="bottom-project-eyebrow">
                {adminBottomState.eyebrow}
              </span>
              <strong className="bottom-project-company">{adminBottomState.title}</strong>
              <small className="bottom-project-detail">{adminBottomState.detail}</small>
            </div>
            <div className="bottom-project-meta">
              <strong className="bottom-project-price">{adminBottomState.meta}</strong>
            </div>
          </div>
        }
        context={
          adminTab === "Utenti"
            ? "Utenti e inviti"
            : adminTab === "Catalogo"
            ? `Catalogo · ${catalogView === "drive" ? "Slide Drive" : "Sheet"}`
            : adminTab === "Google"
              ? "Google backend"
              : adminTab
        }
        detail={
          adminTab === "Utenti"
            ? `${authUsers.filter((user) => !user.disabled).length} attivi · ${accessRequests.filter((request) => request.status === "pending").length} in attesa`
            : adminTab === "Catalogo" && catalogView === "drive"
            ? `${driveLinkedCount}/${workshops.length} slide collegate`
            : adminTab === "Google"
              ? `Workspace Google · ${googleHealthStatusLabel.toLowerCase()}`
              : `${selectedProject.company} · ${statusLabel[activeAdminStatus]}`
        }
        backLabel={adminBackAction ? "Indietro" : undefined}
        onBack={adminBackAction ?? undefined}
        primaryLabel={adminMainAction.label}
        primaryDisabled={adminMainAction.disabled}
        onPrimary={adminMainAction.action}
        secondaryLabel={adminTab === "Utenti" ? "Ricarica utenti" : undefined}
        onSecondary={adminTab === "Utenti" ? () => void refreshAuthData() : undefined}
      />
    </section>
  );
}
