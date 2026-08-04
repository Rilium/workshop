import type { WorkflowNotificationRecipientRole } from "../emailService";
import type { WorkspaceSetting } from "../googleAdminService";
import type { BrandPresentationStatus } from "../googleDriveService";
import type { WorkshopRequestRecord } from "../requestService";

export type Role = "FunniFin" | "Cliente" | "Esperto" | "Brand";
export type AppNotificationRole = Exclude<Role, "Cliente">;
export type NotificationPriority = "critical" | "task" | "info";
export type NotificationCategory = "task" | "mail" | "system" | "feedback";
export type NotificationStatus = "open" | "closed";
export type NotificationAction = {
  label: string;
  role?: AppNotificationRole;
  hash?: string;
  section?: string;
  projectId?: string;
};
export type AppNotification = {
  id: string;
  toastId?: number;
  title: string;
  body: string;
  createdAt: string;
  updatedAt: string;
  sourceRole?: Role;
  audience: AppNotificationRole[];
  audienceUserIds?: string[];
  audienceEmails?: string[];
  priority: NotificationPriority;
  category: NotificationCategory;
  status: NotificationStatus;
  readBy: AppNotificationRole[];
  readByUserIds?: string[];
  action?: NotificationAction;
};
export type NotifyOptions = {
  audience?: AppNotificationRole[];
  audienceUserIds?: string[];
  audienceEmails?: string[];
  priority?: NotificationPriority;
  category?: NotificationCategory;
  action?: NotificationAction;
  persist?: boolean;
  toast?: boolean;
};
export type Duration = "1h" | "1.5h" | "2h";
export type Format = "live" | "webinar" | "ibrido";
export type ProjectStatus =
  | "draft_cliente"
  | "richiesta_inviata"
  | "in_verifica_funnifin"
  | "date_approvate"
  | "aperto_a_esperti"
  | "esperto_assegnato"
  | "materiali_cliente_in_attesa"
  | "in_preparazione_esperto"
  | "in_revisione_brand"
  | "approvazione_finale"
  | "evento_provvisorio"
  | "confermato";

export type Topic = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  badge: string;
  themes: Theme[];
};

export type Theme = {
  id: string;
  title: string;
  description: string;
};

export type Workshop = {
  id: string;
  topicId: string;
  topicIds?: string[];
  themeId: string;
  title: string;
  short: string;
  long: string;
  durationOptions: Duration[];
  formatOptions: Format[];
  level: "base" | "intermedio" | "avanzato";
  target: string;
  participants: string;
  price1h: number;
  price2h: number;
  packageAvailable: boolean;
  customAvailable: boolean;
  customExtra: number;
  masterSlide: string;
  experts: string[];
  state: "attivo" | "nascosto" | "da aggiornare";
  durationLabel?: string;
  adminNotes?: string;
  productionStatus?: "published" | "draft";
};

export type Selection = {
  workshopId: string;
  bundleId?: string;
  bundleIds?: string[];
  duration: Duration;
  format: Format;
  custom: boolean;
  customNote?: string;
  promo: boolean;
  date: string;
  time: string;
  dateConfirmed: boolean;
  recordingIncluded?: boolean;
  status: string;
};

export type CatalogBundle = {
  id: string;
  title: string;
  size: 3 | 6 | 10;
  workshopIds: string[];
  active: boolean;
  fixedPrice?: number;
  topicIds?: string[];
  description?: string;
};

export type CommercialConfig = {
  workshopBasePrice: number;
  inPersonExtra: number;
  customExtra: number;
  recordingOptOutDiscount: number;
  recordingDefault: boolean;
  bundlePrices: {
    3: number;
    6: number;
    10: number;
  };
  outcomeSizes: {
    sensibilizzazione: 3;
    avanzata: 6;
    completa: 10;
  };
};

export type SurveyProfile = {
  topicIds: string[];
  outcome: "sensibilizzazione" | "avanzata" | "completa";
  employees: string;
  requestedFormat: "online" | "in-person" | "recommend";
  resolvedFormat: "webinar" | "live";
  budget: string;
  bundleIds: string[];
  recommendedBundleId?: string;
  recommendedWorkshopIds: string[];
  estimatedTotal: number;
  budgetGap: number;
  reason: string;
};

export type PricingRule = {
  id: string;
  name: string;
  min: number;
  max: number;
  discountPercent: number;
  specialQuote?: boolean;
};

export type Quote = {
  gross: number;
  customTotal: number;
  rule: PricingRule;
  catalogTargetPrice: number | null;
  isBasicBundle: boolean;
  quantityDiscount: number;
  promoDiscount: number;
  total: number;
  saved: number;
  recordingDiscount: number;
  bundleId?: string;
  bundleTitle?: string;
  bundleIds?: string[];
  bundleTitles?: string[];
  bundleSummaries?: Array<{ id: string; title: string; discount: number }>;
  sharedBundleWorkshopCount?: number;
};

export type Toast = {
  id: number;
  title: string;
  body: string;
};

export type ClientContact = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
};

export type AdminProject = {
  id: string;
  company: string;
  manager: string;
  email: string;
  phone: string;
  status: ProjectStatus;
  workshopIds: string[];
  quoteTotal: number;
  dateCount: number;
  assignedExpert?: string;
  source?: "sheet" | "local";
  request?: WorkshopRequestRecord;
};

export type AdminWorkspacePanel = "workshops" | "calendar" | "experts" | "folder" | "confirm";
export type BrandDeckStatus = BrandPresentationStatus;
export type DateDecision = "approved" | "rejected" | "change_requested";
export type DateApproval = DateDecision | "pending";

export type CalendarEventRecord = {
  id: string;
  mode?: "tentative" | "confirmed";
  meetLink: string;
  createdAt: string;
  workshops: number;
  source: "google-calendar" | "mock";
  htmlLink?: string;
  calendarId?: string;
  fallback?: boolean;
  fallbackReason?: string;
};

export type DriveSlideLink = {
  fileId: string;
  name: string;
  url: string;
  modifiedAt: string;
  status: "manuale" | "aggiornata";
};

export type ExpertProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photo: string;
  bio: string;
  topicIds: string[];
  themeIds: string[];
  availability: string;
  calendarId?: string;
};

export type AdminProjectWorkshopRow = {
  workshop: Workshop;
  date: string;
  time: string;
  format: Format;
  duration: Duration;
  approval: DateApproval;
  assignedExpert?: string;
};

export type WorkspaceSettingDefinition = WorkspaceSetting & {
  helper: string;
  inputType?: "text" | "email" | "password" | "url" | "textarea";
  placeholder?: string;
  sensitive?: boolean;
  readOnly?: boolean;
};

export type WorkflowRecipientRole = WorkflowNotificationRecipientRole;
