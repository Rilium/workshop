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
import { useEffect, useMemo, useRef, useState } from "react";
import { sendWorkflowNotification, sendWorkshopRequestEmail, type WorkflowNotificationPayload, type WorkflowNotificationRecipientRole } from "./emailService";
import { createWorkshopCalendarEvent, getWorkshopAvailability } from "./googleCalendarService";
import { createAssetDraftFolder, deleteAssetDraftFolder, uploadAssetFiles, type AssetDraftFolder, type UploadedAsset } from "./driveAssetService";
import {
  deleteExpert,
  getGoogleHealth,
  listCatalogConfig,
  listCatalogWorkshops,
  listExperts,
  listPricingRules,
  listWorkspaceSettings,
  updateCatalogTopic,
  updateExpert,
  updatePricingRule,
  updateWorkspaceSetting,
  type CatalogWorkshopConfig,
  type GoogleHealth,
  type WorkspaceSetting,
} from "./googleAdminService";
import { getBrandPresentations, getDriveFolderPreview, type BrandPresentation, type BrandPresentationStatus, type DriveFolderItem, type DriveFolderResponse } from "./googleDriveService";
import { createWorkshopRequest, listWorkshopRequests, updateWorkshopRequest, type RequestWorkshopRecord, type WorkshopRequestRecord } from "./requestService";
import { SECRET_SETTINGS } from "./secretSettings";

type Role = "FunniFin" | "Cliente" | "Esperto" | "Brand";
type Duration = "1h" | "2h";
type Format = "live" | "webinar" | "ibrido";
type ProjectStatus =
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

type Topic = {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  badge: string;
  themes: Theme[];
};

type Theme = {
  id: string;
  title: string;
  description: string;
};

type Workshop = {
  id: string;
  topicId: string;
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
};

type Selection = {
  workshopId: string;
  duration: Duration;
  format: Format;
  custom: boolean;
  customNote?: string;
  promo: boolean;
  date: string;
  time: string;
  dateConfirmed: boolean;
  status: string;
};

type PricingRule = {
  id: string;
  name: string;
  min: number;
  max: number;
  discountPercent: number;
  specialQuote?: boolean;
};

type Toast = {
  id: number;
  title: string;
  body: string;
};

type ClientContact = {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  phone: string;
};

type AdminProject = {
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

type AdminWorkspacePanel = "workshops" | "calendar" | "experts" | "folder" | "confirm";
type BrandDeckStatus = BrandPresentationStatus;
type ButtonVariant = "primary" | "secondary" | "ghost" | "outline" | "dangerIcon" | "icon";
type DateDecision = "approved" | "rejected" | "change_requested";
type DateApproval = DateDecision | "pending";
type AdminActionModalState =
  | { type: "edit_request" }
  | { type: "date"; workshopId: string; decision: DateDecision }
  | { type: "expert"; workshopId?: string; expertName: string; mode: "assign" | "reassign" }
  | { type: "open_candidacies" }
  | { type: "brand_handoff" }
  | { type: "confirm_event" }
  | { type: "price"; ruleId: string };
type NotificationChoice = {
  send: boolean;
  recipients: WorkflowNotificationRecipientRole[];
  note: string;
  eventMode?: "tentative" | "confirmed";
};
type CalendarEventRecord = {
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
type DriveSlideLink = {
  fileId: string;
  name: string;
  url: string;
  modifiedAt: string;
  status: "manuale" | "aggiornata";
};
type ExpertProfile = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photo: string;
  bio: string;
  topicIds: string[];
  themeIds: string[];
  availability: string;
};
type AdminProjectWorkshopRow = {
  workshop: Workshop;
  date: string;
  time: string;
  format: Format;
  duration: Duration;
  approval: DateApproval;
  assignedExpert?: string;
};
type WorkspaceSettingDefinition = WorkspaceSetting & {
  helper: string;
  inputType?: "text" | "email" | "password" | "url";
  placeholder?: string;
  sensitive?: boolean;
  readOnly?: boolean;
};

const adminSettingGroups: Array<{ id: string; title: string; description: string; icon: "settings" | "send" | "users" }> = [
  {
    id: "mail",
    title: "Gmail e invii",
    description: "Destinatari e mittente usati adesso dalle notifiche del pannello FunniFin.",
    icon: "send",
  },
  {
    id: "provider",
    title: "Google Workspace",
    description: "Calendar e Drive letti dal backend Apps Script. Questi valori sostituiscono le Script Properties.",
    icon: "users",
  },
  {
    id: "runtime",
    title: "Runtime app",
    description: "Endpoint e variabili Vercel che la build pubblica sta usando. Si modificano da Vercel/env.",
    icon: "settings",
  },
];

const adminSettingDefinitions: WorkspaceSettingDefinition[] = [
  {
    key: "mail.provider",
    value: "Google MailApp",
    group: "mail",
    label: "Provider invii",
    helper: "Provider logico usato dal backend. Oggi invia tramite Apps Script MailApp/Gmail.",
    placeholder: "Google MailApp",
    updatedAt: "",
  },
  {
    key: "mail.fromName",
    value: SECRET_SETTINGS.google.email.fromName,
    group: "mail",
    label: "Nome mittente",
    helper: "Nome visibile nelle email inviate dal flusso.",
    placeholder: "FunniFin Workshop Planner",
    updatedAt: "",
  },
  {
    key: "mail.internalRecipient",
    value: SECRET_SETTINGS.google.email.internalRecipient,
    group: "mail",
    label: "Inbox interna",
    helper: "CC operativo per richieste cliente e fallback FunniFin.",
    inputType: "email",
    placeholder: "team@azienda.it",
    updatedAt: "",
  },
  {
    key: "mail.funnifin",
    value: SECRET_SETTINGS.google.email.testRecipients.funnifin,
    group: "mail",
    label: "Email FunniFin",
    helper: "Riceve notifiche interne, candidature e handoff.",
    inputType: "email",
    placeholder: "funnifin@azienda.it",
    updatedAt: "",
  },
  {
    key: "mail.expert",
    value: SECRET_SETTINGS.google.email.testRecipients.expert,
    group: "mail",
    label: "Email Esperti",
    helper: "Destinatario per inviti candidatura esperto.",
    inputType: "email",
    placeholder: "esperti@azienda.it",
    updatedAt: "",
  },
  {
    key: "mail.brand",
    value: SECRET_SETTINGS.google.email.testRecipients.brand,
    group: "mail",
    label: "Email Brand",
    helper: "Destinatario per revisioni materiali e deck.",
    inputType: "email",
    placeholder: "brand@azienda.it",
    updatedAt: "",
  },
  {
    key: "funnifin.name",
    value: "Team FunniFin",
    group: "provider",
    label: "Nome FunniFin",
    helper: "Identita mostrata nelle viste operative.",
    updatedAt: "",
  },
  {
    key: "brand.name",
    value: "Brand Review",
    group: "provider",
    label: "Nome Brand",
    helper: "Nome usato nel pannello brand.",
    updatedAt: "",
  },
  {
    key: "calendar.id",
    value: "",
    group: "provider",
    label: "Calendar ID",
    helper: "Calendario target per eventi workshop.",
    placeholder: "primary o calendar-id@group.calendar.google.com",
    updatedAt: "",
  },
  {
    key: "calendar.name",
    value: "",
    group: "provider",
    label: "Calendar name",
    helper: "Nome calendario usato come fallback se l'ID non e presente.",
    placeholder: "FunniFin Workshop",
    updatedAt: "",
  },
  {
    key: "drive.rootFolderId",
    value: "",
    group: "provider",
    label: "Drive root materiali",
    helper: "Cartella parent per materiali cliente e upload.",
    placeholder: "ID cartella Drive",
    updatedAt: "",
  },
  {
    key: "drive.slidesRootFolderId",
    value: "",
    group: "provider",
    label: "Drive root Slides",
    helper: "Cartella root dove cercare presentazioni e master.",
    placeholder: "ID cartella Drive",
    updatedAt: "",
  },
  {
    key: "env.appScriptDeploymentUrl",
    value: "",
    group: "runtime",
    label: "Apps Script endpoint",
    helper: "Endpoint chiamato da richieste, mail, Calendar e Drive.",
    inputType: "url",
    readOnly: true,
    updatedAt: "",
  },
  {
    key: "env.driveRootFolderId",
    value: "",
    group: "runtime",
    label: "Vercel Drive root",
    helper: "Fallback frontend letto da VITE_DRIVE_ROOT_FOLDER_ID.",
    readOnly: true,
    updatedAt: "",
  },
  {
    key: "env.slidesTemplateFolderId",
    value: "",
    group: "runtime",
    label: "Vercel Slides root",
    helper: "Fallback frontend letto da VITE_SLIDES_TEMPLATE_FOLDER_ID.",
    readOnly: true,
    updatedAt: "",
  },
];

const appEnv = (import.meta as unknown as { env: Record<string, string | undefined> }).env;

const experts = [
  { id: "laura-bianchi", name: "Laura Bianchi", skills: ["budget", "previdenza", "investimenti"], availability: "3 slot liberi" },
  { id: "marco-serra", name: "Marco Serra", skills: ["fiscalita", "credito", "famiglia"], availability: "2 slot liberi" },
  { id: "giulia-riva", name: "Giulia Riva", skills: ["budget", "benessere", "assicurazioni"], availability: "5 slot liberi" },
  { id: "andrea-conti", name: "Andrea Conti", skills: ["investimenti", "credito", "previdenza"], availability: "1 slot libero" },
];

const topics: Topic[] = [
  {
    id: "budget",
    title: "Ambito personale",
    description: "Gestione del denaro, liquidita, investimenti e decisioni quotidiane.",
    icon: "banknote",
    color: "#1cafb9",
    badge: "base",
    themes: [
      { id: "budget-mensile", title: "Budgeting personale", description: "Entrate, uscite e budget mensile." },
      { id: "fondo-emergenza", title: "Fondo di emergenza", description: "Riserva immediata e strategia di accumulo." },
      { id: "abitudini", title: "Liquidita", description: "Conto corrente, riserva, obiettivi e strumenti a basso rischio." },
      { id: "mutuo", title: "Mutui & Banche", description: "Mutui, prestiti, TAN, TAEG e rischi del debito." },
      { id: "etf", title: "PAC in ETF", description: "Avviare un piano di accumulo in autonomia." },
      { id: "rischio", title: "Investimenti", description: "Basi, rischio, strumenti e profilo personale." },
    ],
  },
  {
    id: "risparmio",
    title: "Liquidita",
    description: "Fondo emergenza, conto corrente e gestione della liquidita ferma.",
    icon: "sparkles",
    color: "#f0ad2e",
    badge: "popolare",
    themes: [
      { id: "fondo-emergenza", title: "Fondo emergenza", description: "Quanto serve e dove tenerlo." },
      { id: "abitudini", title: "Abitudini di risparmio", description: "Automazioni e routine leggere." },
    ],
  },
  {
    id: "investimenti",
    title: "Investimenti",
    description: "Rischio, orizzonte temporale e strumenti spiegati senza fumo.",
    icon: "chart",
    color: "#6477d5",
    badge: "consigliato",
    themes: [
      { id: "rischio", title: "Rischio", description: "Capire volatilita, rendimento e tempo." },
      { id: "etf", title: "ETF e fondi", description: "Come leggere prodotti e costi." },
    ],
  },
  {
    id: "previdenza",
    title: "TFR & Previdenza",
    description: "TFR, previdenza complementare e scelte di medio-lungo periodo.",
    icon: "briefcase",
    color: "#37b679",
    badge: "popolare",
    themes: [
      { id: "tfr", title: "TFR & Previdenza", description: "TFR e previdenza complementare: come orientarsi." },
    ],
  },
  {
    id: "fiscalita",
    title: "Ambito lavorativo",
    description: "Fiscalita, stipendio, bonus, legge di bilancio e genitorialita.",
    icon: "file",
    color: "#ff8a63",
    badge: "base",
    themes: [
      { id: "dichiarazione", title: "Bonus e detrazioni", description: "Agevolazioni fiscali e bonus famiglia." },
      { id: "benefit", title: "Legge di Bilancio", description: "Novita su stipendi, IRPEF, detrazioni e genitorialita." },
      { id: "genitori", title: "Genitorialita", description: "Congedi, maternita, paternita e reddito ridotto." },
    ],
  },
  {
    id: "credito",
    title: "Mutui, prestiti e credito",
    description: "Tassi, sostenibilita della rata e decisioni informate sul debito.",
    icon: "home",
    color: "#d85f8c",
    badge: "consigliato",
    themes: [
      { id: "mutuo", title: "Mutuo casa", description: "Variabile, fisso, surroga e costi." },
      { id: "credito-consumo", title: "Credito al consumo", description: "Valutare prestiti e finanziamenti." },
    ],
  },
  {
    id: "assicurazioni",
    title: "Assicurazioni",
    description: "Proteggere reddito, famiglia e patrimonio con coperture sensate.",
    icon: "shield",
    color: "#2aa6a1",
    badge: "base",
    themes: [
      { id: "protezione", title: "Protezione personale", description: "Priorita e rischi principali." },
      { id: "polizze", title: "Polizze", description: "Leggere garanzie, esclusioni e costi." },
    ],
  },
  {
    id: "famiglia",
    title: "Ambito familiare",
    description: "Coppia, figli, successioni, diritti economici e pianificazione familiare.",
    icon: "users",
    color: "#8a6bd8",
    badge: "popolare",
    themes: [
      { id: "genitori", title: "Genitori", description: "Spese, scuola e futuro dei figli." },
      { id: "coppia", title: "Coppia e denaro", description: "Regole, conti e conversazioni." },
      { id: "famiglia-diritti", title: "Famiglia e diritti", description: "Convivenza, matrimonio, successioni ed eredita." },
    ],
  },
  {
    id: "acquisti",
    title: "Casa, auto e grandi acquisti",
    description: "Preparare decisioni importanti con numeri, priorita e anticipo.",
    icon: "car",
    color: "#f3a63b",
    badge: "base",
    themes: [
      { id: "casa", title: "Acquisto casa", description: "Budget totale e costi accessori." },
      { id: "auto", title: "Auto", description: "Acquisto, leasing e costo reale." },
    ],
  },
  {
    id: "benessere",
    title: "Iniziative speciali",
    description: "Welfare, figli dei dipendenti e iniziative educative fuori catalogo standard.",
    icon: "heart",
    color: "#ef6f9b",
    badge: "consigliato",
    themes: [
      { id: "welfare", title: "Educazione finanziaria figli", description: "Merenda, video-corso e incontro dal vivo." },
    ],
  },
];

const initialExpertProfiles: ExpertProfile[] = experts.map((expert, index) => {
  const [firstName, ...lastNameParts] = expert.name.split(" ");
  const topicIds = expert.skills;
  const themeIds = topics
    .filter((topic) => topicIds.includes(topic.id))
    .flatMap((topic) => topic.themes.map((theme) => theme.id));
  return {
    id: expert.id,
    firstName,
    lastName: lastNameParts.join(" "),
    email: `rinaldi.rilio+${index + 3}@gmail.com`,
    photo: "",
    bio: "Profilo esperto FunniFin associato ai workshop del catalogo.",
    topicIds,
    themeIds,
    availability: expert.availability,
  };
});

const workshops: Workshop[] = [
  {
    id: "ws-budget-step",
    topicId: "budget",
    themeId: "budget-mensile",
    title: "Budgeting personale step by step",
    short: "Monitorare entrate e uscite, riconoscere spese ricorrenti e costruire un budget mensile personalizzato.",
    long: "Imparare a monitorare entrate e uscite; identificare spese ricorrenti e superflue; costruire un budget mensile personalizzato e usare strumenti digitali per la gestione quotidiana.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "base",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Budgeting personale",
    experts: ["Elena Costa", "Marco Serra"],
    state: "attivo",
  },
  {
    id: "ws-fondo-emergenza",
    topicId: "risparmio",
    themeId: "fondo-emergenza",
    title: "Come creare un fondo di emergenza",
    short: "Calcolare la riserva necessaria, accumularla gradualmente e scegliere dove conservarla.",
    long: "Comprendere l'importanza del fondo di emergenza; calcolare l'importo necessario in base alla propria situazione e stabilire una strategia per accumularlo gradualmente.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "base",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Fondo emergenza",
    experts: ["Elena Costa"],
    state: "attivo",
  },
  {
    id: "ws-liquidita-conto",
    topicId: "risparmio",
    themeId: "abitudini",
    title: "La gestione della liquidità sul conto corrente",
    short: "Capire quanta liquidita tenere ferma e come organizzare conti, riserva, progetti e spese fisse.",
    long: "Capire perche e rischioso lasciare troppa liquidita ferma; valutare equilibrio tra riserva, risparmio e investimento; ottimizzare conti correnti e strumenti a basso rischio.",
    durationOptions: ["1h"],
    formatOptions: ["live", "webinar"],
    level: "base",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Liquidita",
    experts: ["Elena Costa", "Marco Serra"],
    state: "attivo",
  },
  {
    id: "ws-mutui-prestiti",
    topicId: "credito",
    themeId: "mutuo",
    title: "Mutui e prestiti: come fare scelte intelligenti senza cadere in trappola",
    short: "Tassi, durata, costi e rischi per arrivare preparati davanti a banche e finanziarie.",
    long: "Confrontare costi tra affitto e acquisto; capire mutui, TAN, TAEG, durata, rata e costi nascosti; riconoscere condizioni critiche ed evitare sovraindebitamento.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "intermedio",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Mutui e prestiti",
    experts: ["Marco Serra"],
    state: "attivo",
  },
  {
    id: "ws-prestiti-quinto",
    topicId: "credito",
    themeId: "credito-consumo",
    title: "Prestiti e cessione del quinto: come evitare errori e debiti cattivi",
    short: "TAN, TAEG, durata, rata e condizioni critiche per riconoscere costi nascosti e rischi di sovraindebitamento.",
    long: "Differenze tra prestiti personali, credito al consumo e cessione del quinto; valutare il costo reale di un finanziamento, riconoscere condizioni critiche e capire quando la cessione del quinto e una soluzione o un rischio.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "intermedio",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Prestiti e cessione quinto",
    experts: ["Marco Serra"],
    state: "attivo",
  },
  {
    id: "ws-pac-etf",
    topicId: "investimenti",
    themeId: "etf",
    title: "Come avviare un PAC in ETF in autonomia",
    short: "Guida pratica per costruire una strategia di investimento e avviarla con strumenti concreti.",
    long: "Guida pratica passo dopo passo per costruire una strategia di investimento e avviarla in autonomia, con strumenti concreti applicabili fin da subito.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "intermedio",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - PAC ETF",
    experts: ["Giulia Riva"],
    state: "attivo",
  },
  {
    id: "ws-abc-investimenti",
    topicId: "investimenti",
    themeId: "rischio",
    title: "ABC degli investimenti: le basi da conoscere prima di iniziare",
    short: "Rendimento, rischio, tempo, costi, correlazione e profilo personale di rischio.",
    long: "Comprendere i fattori che guidano gli investimenti; conoscere le principali tipologie di strumenti finanziari; acquisire un metodo per investire in modo consapevole.",
    durationOptions: ["1h"],
    formatOptions: ["live", "webinar"],
    level: "base",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - ABC investimenti",
    experts: ["Giulia Riva"],
    state: "attivo",
  },
  {
    id: "ws-investimenti-complessi",
    topicId: "investimenti",
    themeId: "rischio",
    title: "Investimenti: gli strumenti complessi",
    short: "Fondi comuni, ETF, gestione attiva e passiva, benchmark, indici e strumenti come futures, opzioni e CFD.",
    long: "Approfondire fondi comuni ed ETF, gestione attiva e passiva, benchmark di riferimento, indici di mercato e costi; comprendere il funzionamento di strumenti complessi come futures, opzioni e CFD.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "avanzato",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Strumenti complessi",
    experts: ["Giulia Riva"],
    state: "attivo",
  },
  {
    id: "ws-tfr-previdenza",
    topicId: "previdenza",
    themeId: "tfr",
    title: "TFR e previdenza complementare: come orientarsi",
    short: "Cos'e il TFR, come viene gestito e come scegliere un fondo pensione in modo consapevole.",
    long: "Comprendere cos'e il TFR; conoscere le differenze tra previdenza pubblica e complementare; valutare quando aderire a un fondo pensione e come scegliere.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "base",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - TFR Previdenza",
    experts: ["Laura Bianchi", "Marco Serra"],
    state: "attivo",
  },
  {
    id: "ws-bonus-detrazioni",
    topicId: "fiscalita",
    themeId: "dichiarazione",
    title: "Bonus, detrazioni e agevolazioni fiscali: conoscerli per usarli bene",
    short: "Bonus famiglia, AUU, nido, nuovi nati, detrazioni e regole per non perdere rimborsi.",
    long: "Capire come funzionano i bonus per famiglie; sapere chi ha diritto, quanto spetta e come fare domanda; orientarsi sulle detrazioni piu rilevanti.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "base",
    target: "genitori",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Bonus detrazioni",
    experts: ["Laura Bianchi"],
    state: "attivo",
  },
  {
    id: "ws-legge-bilancio",
    topicId: "fiscalita",
    themeId: "benefit",
    title: "La legge di bilancio: cosa cambia per stipendi e genitorialità",
    short: "Novita fiscali, impatto su stipendi, IRPEF, detrazioni e agevolazioni legate alla genitorialita.",
    long: "Comprendere le principali novita fiscali introdotte dalla legge di bilancio e valutarne l'impatto su stipendi, IRPEF, detrazioni, bonus e agevolazioni.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "intermedio",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Legge bilancio",
    experts: ["Laura Bianchi"],
    state: "attivo",
  },
  {
    id: "ws-genitorialita",
    topicId: "famiglia",
    themeId: "genitori",
    title: "Gestire le finanze in caso di congedi, maternità e paternità",
    short: "Diritti economici, impatto delle assenze e pianificazione durante periodi di reddito ridotto.",
    long: "Conoscere diritti economici legati a maternita, paternita e congedi parentali; pianificare spese e risparmi durante periodi di reddito ridotto.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "base",
    target: "genitori",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Genitorialita",
    experts: ["Elena Costa"],
    state: "attivo",
  },
  {
    id: "ws-futuri-genitori",
    topicId: "famiglia",
    themeId: "genitori",
    title: "Futuri genitori: pianificare economicamente l’arrivo di un figlio",
    short: "Spese dei primi anni, bonus disponibili e piano di risparmio per il futuro del figlio.",
    long: "Prevedere le spese legate alla nascita e ai primi anni di vita; conoscere bonus e agevolazioni disponibili per i genitori; impostare un piano di risparmio per il futuro del figlio.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "base",
    target: "genitori",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Futuri genitori",
    experts: ["Elena Costa", "Laura Bianchi"],
    state: "attivo",
  },
  {
    id: "ws-finanze-coppia",
    topicId: "famiglia",
    themeId: "coppia",
    title: "Finanze nella coppia: come gestire il patrimonio senza intoppi",
    short: "Gestione separata, condivisa o mista delle finanze e prevenzione dei conflitti economici.",
    long: "Valutare diverse modalita di gestione delle finanze di coppia; prevenire conflitti e disallineamenti economici con esempi pratici di gestione delle spese familiari.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "base",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Finanze nella coppia",
    experts: ["Marco Serra", "Elena Costa"],
    state: "attivo",
  },
  {
    id: "ws-amore-soldi",
    topicId: "famiglia",
    themeId: "coppia",
    title: "Amore e soldi, convivenza, matrimonio e diritti economici",
    short: "Aspetti legali e patrimoniali delle relazioni, convivenza, matrimonio e successioni.",
    long: "Chiarire aspetti legali e patrimoniali delle relazioni; convivenza registrata, matrimonio, comunione o separazione dei beni, successioni con esempi concreti.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "intermedio",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Amore e soldi",
    experts: ["Marco Serra"],
    state: "attivo",
  },
  {
    id: "ws-successioni-eredita",
    topicId: "famiglia",
    themeId: "famiglia-diritti",
    title: "Successioni ed eredità in famiglia: strumenti e pianificazione",
    short: "Successione legale e testamentaria, donazioni, polizze vita e pianificazione in famiglie ricostituite.",
    long: "Capire come funziona la successione legale e testamentaria; valutare strumenti come testamento, donazione e polizze vita; prevenire conflitti e tutelare i propri cari.",
    durationOptions: ["1h"],
    formatOptions: ["webinar", "live"],
    level: "intermedio",
    target: "tutti",
    participants: "illimitati",
    price1h: 1000,
    price2h: 1000,
    packageAvailable: true,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Successioni eredita",
    experts: ["Laura Bianchi", "Marco Serra"],
    state: "attivo",
  },
  {
    id: "ws-merenda-finanziaria",
    topicId: "benessere",
    themeId: "welfare",
    title: "Educazione finanziaria per i figli dei dipendenti (6–11 anni)",
    short: "Iniziativa welfare per bambini e ragazzi: video-corso, appuntamento dal vivo e attestato.",
    long: "Educazione finanziaria per figli dei dipendenti 6-13 anni: 10 video brevi, appuntamento dal vivo di 2 ore in azienda, merenda e attestato di partecipazione.",
    durationOptions: ["2h"],
    formatOptions: ["live"],
    level: "base",
    target: "genitori",
    participants: "bambini 6-13",
    price1h: 2500,
    price2h: 2500,
    packageAvailable: false,
    customAvailable: true,
    customExtra: 500,
    masterSlide: "Catalogo master - Merenda finanziaria",
    experts: ["Elena Costa", "Laura Bianchi"],
    state: "attivo",
  },
];

const initialRules: PricingRule[] = [
  { id: "single", name: "Workshop singolo", min: 1, max: 1, discountPercent: 0 },
  { id: "duo", name: "2 workshop a catalogo", min: 2, max: 2, discountPercent: 0 },
  { id: "basic", name: "Bundle Basic", min: 3, max: 3, discountPercent: 20 },
  { id: "advanced", name: "Percorso personalizzato", min: 4, max: 5, discountPercent: 0, specialQuote: true },
  { id: "full", name: "Percorso su preventivo", min: 6, max: 99, discountPercent: 0, specialQuote: true },
];

const BASIC_BUNDLE_WORKSHOP_IDS = ["ws-budget-step", "ws-liquidita-conto", "ws-tfr-previdenza"];
const roleOptions: Role[] = ["Cliente", "FunniFin", "Esperto", "Brand"];
const roleIdentities: Record<Exclude<Role, "Cliente">, { name: string; email: string; role: string; note: string }> = {
  FunniFin: {
    name: "Team FunniFin",
    email: "rinaldi.rilio@gmail.com",
    role: "Operations",
    note: "Gestione richieste, calendario, esperti e avanzamento progetto.",
  },
  Esperto: {
    name: "Laura Bianchi",
    email: "rinaldi.rilio+3@gmail.com",
    role: "Esperto",
    note: "Candidature, disponibilita e deck assegnati.",
  },
  Brand: {
    name: "Brand Review",
    email: "rinaldi.rilio+4@gmail.com",
    role: "Brand",
    note: "Revisione materiali, versioni e approvazioni finali.",
  },
};
const canvaCatalogSource = {
  url: "https://canva.link/q4s0wnx4ot4jmrg",
  fileName: "Catalogo workshop.pdf",
  pages: 9,
  workshopCards: 17,
  singleWorkshopCards: 16,
  specialOffers: 3,
  label: "Catalogo visuale Canva",
};

const projectStatuses: ProjectStatus[] = [
  "draft_cliente",
  "richiesta_inviata",
  "in_verifica_funnifin",
  "date_approvate",
  "aperto_a_esperti",
  "esperto_assegnato",
  "materiali_cliente_in_attesa",
  "in_preparazione_esperto",
  "in_revisione_brand",
  "approvazione_finale",
  "evento_provvisorio",
  "confermato",
];

const statusLabel: Record<ProjectStatus, string> = {
  draft_cliente: "Richiesta in bozza",
  richiesta_inviata: "Richiesta inviata",
  in_verifica_funnifin: "In verifica FunniFin",
  date_approvate: "Date approvate",
  aperto_a_esperti: "Aperto a esperti",
  esperto_assegnato: "Esperto assegnato",
  materiali_cliente_in_attesa: "Materiali cliente in attesa",
  in_preparazione_esperto: "In preparazione esperto",
  in_revisione_brand: "In revisione brand",
  approvazione_finale: "Approvazione finale",
  evento_provvisorio: "Evento provvisorio",
  confermato: "Confermato",
};

const statusDescription: Record<ProjectStatus, string> = {
  draft_cliente: "Il cliente sta componendo workshop, dati e date: non e ancora entrata nella coda FunniFin.",
  richiesta_inviata: "Il cliente ha inviato la richiesta e FunniFin deve verificare workshop, prezzo e fattibilita.",
  in_verifica_funnifin: "FunniFin sta controllando coerenza del percorso, disponibilita e preventivo.",
  date_approvate: "Le date proposte sono state validate e il progetto puo passare agli esperti.",
  aperto_a_esperti: "La richiesta e visibile agli esperti compatibili per candidatura o assegnazione.",
  esperto_assegnato: "Almeno un esperto e stato collegato al progetto.",
  materiali_cliente_in_attesa: "Mancano materiali cliente necessari per preparare o rifinire il workshop.",
  in_preparazione_esperto: "L'esperto sta preparando contenuti e materiali operativi.",
  in_revisione_brand: "Il team brand sta revisionando deck, tono e asset.",
  approvazione_finale: "Tutti i passaggi principali sono pronti per creare l'evento finale.",
  evento_provvisorio: "Evento Google Calendar creato come provvisorio, in attesa della conferma definitiva.",
  confermato: "Evento confermato, calendario e materiali collegati.",
};

function money(value: number) {
  return new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(value);
}

function requestToAdminProject(request: WorkshopRequestRecord): AdminProject {
  return {
    id: request.id,
    company: request.company,
    manager: request.manager,
    email: request.email,
    phone: request.phone,
    status: request.status,
    workshopIds: request.workshopIds,
    quoteTotal: request.quoteTotal,
    dateCount: request.dateCount,
    assignedExpert: request.assignedExpert || request.workshops.find((workshop) => workshop.expertName)?.expertName,
    source: "sheet",
    request,
  };
}

function buildLocalAdminProject(selections: Selection[], quoteTotal: number, status: ProjectStatus): AdminProject {
  return {
    id: "local-request",
    company: "Richiesta locale",
    manager: "Referente cliente",
    email: "rinaldi.rilio@gmail.com",
    phone: "",
    status,
    workshopIds: selections.map((selection) => selection.workshopId),
    quoteTotal,
    dateCount: selections.filter((selection) => selection.date).length,
    source: "local",
  };
}

function topicColorClass(topicId: string) {
  return `topic-color-${topicId}`;
}

function extractGoogleFileId(url = "") {
  return (
    url.match(/\/(?:presentation|file)\/d\/([^/?#]+)/)?.[1] ||
    url.match(/[?&]id=([^&#]+)/)?.[1] ||
    ""
  );
}

function getDeckOpenUrl(deck: BrandPresentation) {
  const id = deck.id || extractGoogleFileId(deck.url) || extractGoogleFileId(deck.previewUrl);
  const isNativeSlides = deck.mimeType === "application/vnd.google-apps.presentation";
  if (isNativeSlides && id) return `https://docs.google.com/presentation/d/${id}/edit`;
  if (deck.url) return deck.url;
  if (id) return `https://drive.google.com/file/d/${id}/view`;
  return deck.previewUrl || "";
}

function getDeckPreviewUrl(deck: BrandPresentation) {
  const id = deck.id || extractGoogleFileId(deck.previewUrl) || extractGoogleFileId(deck.url);
  const isNativeSlides = deck.mimeType === "application/vnd.google-apps.presentation";
  if (!isNativeSlides && deck.previewUrl?.includes("drive.google.com/file")) return deck.previewUrl;
  if (isNativeSlides && id) return `https://docs.google.com/presentation/d/${id}/preview`;
  if (id) return `https://drive.google.com/file/d/${id}/preview`;
  return deck.previewUrl || "";
}

function App() {
  const [role, setRole] = useState<Role>("Cliente");
  const [roleMenuOpen, setRoleMenuOpen] = useState(false);
  const [activeTopics, setActiveTopics] = useState<string[]>(["budget", "benessere"]);
  const [activeThemes, setActiveThemes] = useState<string[]>(["budget-mensile", "fondo-emergenza", "abitudini", "mutuo", "etf", "rischio", "welfare"]);
  const [brandFilter, setBrandFilter] = useState("Revisioni");
  const [projectStatus, setProjectStatus] = useState<ProjectStatus>("draft_cliente");
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [customModalWorkshop, setCustomModalWorkshop] = useState<Workshop | null>(null);
  const [customRequestWorkshop, setCustomRequestWorkshop] = useState<Workshop | null>(null);
  const [dateModalSelection, setDateModalSelection] = useState<Selection | null>(null);
  const [rules, setRules] = useState(initialRules);
  const [clientAssetFolder, setClientAssetFolder] = useState<AssetDraftFolder | null>(null);
  const [clientUploadedAssets, setClientUploadedAssets] = useState<UploadedAsset[]>([]);
  const [currentRequest, setCurrentRequest] = useState<WorkshopRequestRecord | null>(null);
  const [requestRefreshToken, setRequestRefreshToken] = useState(0);
  const [selections, setSelections] = useState<Selection[]>([]);

  useEffect(() => {
    if (window.location.hash === "#esperto-candidature") {
      setRole("Esperto");
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const selectedWorkshops = selections
    .map((selection) => ({ selection, workshop: workshops.find((workshop) => workshop.id === selection.workshopId)! }))
    .filter(({ workshop }) => Boolean(workshop));

  const quote = useMemo(() => {
    const gross = selectedWorkshops.reduce((total, { selection, workshop }) => {
      return total + (selection.duration === "2h" ? workshop.price2h : workshop.price1h);
    }, 0);
    const customTotal = selectedWorkshops.reduce((total, { selection, workshop }) => {
      return total + (selection.custom ? workshop.customExtra : 0);
    }, 0);
    const baseRule = rules.find((item) => selections.length >= item.min && selections.length <= item.max) ?? rules[0];
    const selectedIds = selectedWorkshops.map(({ workshop }) => workshop.id).sort();
    const isBasicBundle =
      selectedIds.length === BASIC_BUNDLE_WORKSHOP_IDS.length &&
      BASIC_BUNDLE_WORKSHOP_IDS.every((id, index) => selectedIds[index] === id);
    const allPackageable = selectedWorkshops.every(({ workshop }) => workshop.packageAvailable);
    const trioCustomRule: PricingRule = { id: "custom-trio", name: "Percorso personalizzato", min: 3, max: 3, discountPercent: 10, specialQuote: true };
    const rule = selections.length === 3 && allPackageable && !isBasicBundle ? trioCustomRule : baseRule;
    const catalogTargetPrice = isBasicBundle ? 2400 : selections.length === 3 && allPackageable ? 2700 : null;
    const quantityDiscount = catalogTargetPrice ? Math.max(0, gross - catalogTargetPrice) : Math.round((gross * rule.discountPercent) / 100);
    const promoDiscount = selectedWorkshops.reduce((total, { selection, workshop }) => {
      const base = selection.duration === "2h" ? workshop.price2h : workshop.price1h;
      return total + (selection.promo ? Math.round(base * 0.05) : 0);
    }, 0);
    return {
      gross,
      customTotal,
      rule,
      catalogTargetPrice,
      isBasicBundle,
      quantityDiscount,
      promoDiscount,
      total: gross - quantityDiscount - promoDiscount + customTotal,
      saved: quantityDiscount + promoDiscount,
    };
  }, [rules, selectedWorkshops, selections.length]);

  const notify = (title: string, body: string) => {
    const id = Date.now() + Math.round(Math.random() * 1000);
    setToasts((current) => [...current.slice(-3), { id, title, body }]);
  };

  useEffect(() => {
    if (toasts.length === 0) return;
    const timeout = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 4200);
    return () => window.clearTimeout(timeout);
  }, [toasts]);

  const setStatusWithFeedback = (status: ProjectStatus, title: string, body: string) => {
    setProjectStatus(status);
    notify(title, body);
  };

  const toggleWorkshop = (workshopId: string) => {
    const workshop = workshops.find((item) => item.id === workshopId)!;
    const alreadySelected = selections.some((selection) => selection.workshopId === workshopId);
    setSelections((current) => {
      if (current.some((selection) => selection.workshopId === workshopId)) {
        return current.filter((selection) => selection.workshopId !== workshopId);
      }
      return [
        ...current,
        {
          workshopId,
          duration: workshop.durationOptions[0],
          format: workshop.formatOptions[0],
          custom: false,
          promo: false,
          date: "",
          time: "10:00",
          dateConfirmed: false,
          status: "selezionato",
        },
      ];
    });
    notify(
      alreadySelected ? "Workshop rimosso" : "Workshop aggiunto",
      alreadySelected
        ? `${workshop.title} non e piu nel preventivo.`
        : `${workshop.title} e stato aggiunto. Ora scegli date e formato.`,
    );
  };
  const addWorkshops = (workshopIds: string[]) => {
    const uniqueIds = Array.from(new Set(workshopIds));
    setSelections((current) => {
      const selectedIds = new Set(current.map((selection) => selection.workshopId));
      const additions = uniqueIds
        .filter((id) => !selectedIds.has(id))
        .map((id) => {
          const workshop = workshops.find((item) => item.id === id);
          if (!workshop) return null;
          return {
            workshopId: id,
            duration: workshop.durationOptions[0],
            format: workshop.formatOptions[0],
            custom: false,
            promo: false,
            date: "",
            time: "10:00",
            dateConfirmed: false,
            status: "selezionato",
          } satisfies Selection;
        })
        .filter(Boolean) as Selection[];
      return [...current, ...additions];
    });
  };

  const updateSelection = (workshopId: string, patch: Partial<Selection>) => {
    setSelections((current) =>
      current.map((selection) => (selection.workshopId === workshopId ? { ...selection, ...patch } : selection)),
    );
    const workshop = workshops.find((item) => item.id === workshopId);
    if (patch.date || patch.time || patch.format || patch.duration || patch.promo !== undefined) {
      notify("Configurazione aggiornata", "Preventivo e prossima azione sono stati aggiornati.");
    }
  };

  const coveredTopics = new Set(selectedWorkshops.map(({ workshop }) => workshop.topicId)).size;
  const coveredThemes = new Set(selectedWorkshops.map(({ workshop }) => workshop.themeId)).size;
  const totalHours = selectedWorkshops.reduce((total, { selection }) => total + (selection.duration === "2h" ? 2 : 1), 0);
  const topbarContext = (() => {
    if (role === "Cliente") {
      return currentRequest ? `Cliente - ${currentRequest.company} / richiesta inviata` : "Cliente · nuovo percorso";
    }
    if (role === "FunniFin") {
      return currentRequest ? `FunniFin - ${currentRequest.company} / ${currentRequest.workshops.length} workshop` : "FunniFin · coda richieste";
    }
    if (role === "Esperto") return "Esperto · candidature e incarichi";
    return "Brand · revisioni materiali";
  })();

  return (
    <div className={`app-shell role-${role.toLowerCase()}`}>
      {toasts.length > 0 && (
        <FeedbackToastStack
          toasts={toasts}
          onClose={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
        />
      )}
      {customModalWorkshop && <CustomModal workshop={customModalWorkshop} onClose={() => setCustomModalWorkshop(null)} />}
      {customRequestWorkshop && (
        <CustomRequestModal
          workshop={customRequestWorkshop}
          initialNote={selections.find((selection) => selection.workshopId === customRequestWorkshop.id)?.customNote ?? ""}
          onClose={() => setCustomRequestWorkshop(null)}
          onSave={(note) => {
            updateSelection(customRequestWorkshop.id, { custom: true, customNote: note });
            setCustomRequestWorkshop(null);
            notify("Su misura attivato", `Note salvate per ${customRequestWorkshop.title}.`);
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
            notify("Date scelte", "La proposta e stata salvata nel progetto. FunniFin verifichera la disponibilita prima della conferma.");
          }}
        />
      )}
      <header className="topbar">
        <div className="brand-mark">
          <img className="logo-bubble" src="/Logo.png" alt="FunniFin" />
          <div>
            <div className="brand-title-row">
              <strong>FunniFin Workshop Planner</strong>
              <span className="role-title-badge">{role}</span>
            </div>
            <div className="brand-subline">
              <span>{topbarContext}</span>
              <span className="request-status-chip" title={statusDescription[projectStatus]}>
                <strong>{statusLabel[projectStatus]}</strong>
                <button
                  type="button"
                  className="status-info-button"
                  aria-label={`Dettagli stato: ${statusDescription[projectStatus]}`}
                  title={statusDescription[projectStatus]}
                  onClick={() => notify(statusLabel[projectStatus], statusDescription[projectStatus])}
                >
                  <InfoIcon size={14} />
                </button>
              </span>
            </div>
          </div>
        </div>
        <div className="topbar-controls">
          <div className="role-menu">
            <button
              className="role-menu-trigger"
              type="button"
              aria-label="Cambia ruolo"
              aria-expanded={roleMenuOpen}
              onClick={() => setRoleMenuOpen((open) => !open)}
            >
              <span>{role}</span>
              <Menu size={18} />
            </button>
            {roleMenuOpen && (
              <div className="role-switch" aria-label="Seleziona ruolo">
                {roleOptions.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className={role === item ? "active" : ""}
                    onClick={() => {
                      setRole(item);
                      setRoleMenuOpen(false);
                      if (item === "Brand") setBrandFilter("Revisioni");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    {item}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </header>

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
            clientAssetFolder={clientAssetFolder}
            clientUploadedAssets={clientUploadedAssets}
            currentRequest={currentRequest}
            requestRefreshToken={requestRefreshToken}
          />
        )}
        {role === "Esperto" && (
          <ExpertView
            selections={selections}
            updateSelection={updateSelection}
            setProjectStatus={setStatusWithFeedback}
            notify={notify}
            project={{
              ...(currentRequest ? requestToAdminProject(currentRequest) : buildLocalAdminProject(selections, quote.total, projectStatus)),
              status: projectStatus,
              quoteTotal: quote.total,
              workshopIds: selections.map((selection) => selection.workshopId),
            }}
          />
        )}
        {role === "Brand" && <BrandView brandFilter={brandFilter} setBrandFilter={setBrandFilter} setProjectStatus={setStatusWithFeedback} notify={notify} />}
      </main>
    </div>
  );
}

function ClientView({
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
  onRequestCreated,
}: {
  activeTopics: string[];
  activeThemes: string[];
  selections: Selection[];
  quote: ReturnType<typeof useQuotePlaceholder>;
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
  const [submittedEmail, setSubmittedEmail] = useState("");
  const [emailDeliveryMode, setEmailDeliveryMode] = useState<"sent" | "demo" | "opaque">("sent");
  const [flyToBar, setFlyToBar] = useState<{ id: number; title: string; x: number; y: number } | null>(null);
  const [showTopicBadges, setShowTopicBadges] = useState(true);
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
  const selectedWorkshopRows = selections
    .map((selection) => ({ selection, workshop: workshops.find((item) => item.id === selection.workshopId)! }))
    .filter(({ workshop }) => Boolean(workshop));
  const allCatalogActive = activeTopics.length === topics.length && activeThemes.length === allThemes.length;
  const recommendedWorkshops = workshops
    .map((workshop) => {
      const themeMatch = activeThemes.includes(workshop.themeId);
      const topicMatch = activeTopics.includes(workshop.topicId);
      const score = (themeMatch ? 4 : 0) + (topicMatch ? 2 : 0) + (workshop.packageAvailable ? 1 : 0);
      return { workshop, score };
    })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || b.workshop.price1h - a.workshop.price1h)
    .slice(0, 3)
    .map(({ workshop }) => workshop);
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
        price: (selection.duration === "2h" ? workshop.price2h : workshop.price1h) + (selection.custom ? workshop.customExtra : 0),
        custom: selection.custom,
        customNote: selection.customNote,
        status: selection.status,
        approval: selection.dateConfirmed ? "pending" : undefined,
      }));
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
      onRequestCreated(request);
      const result = await sendWorkshopRequestEmail({
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
        }).catch((emailError) => {
          const message = emailError instanceof Error ? emailError.message : "Email non inviata";
          notify("Richiesta salvata, email da verificare", `${request.id}: ${message}`);
          return { sent: false, opaque: false };
        });
      setProjectStatus(
        "richiesta_inviata",
        result.opaque ? "Richiesta presa in carico" : "Richiesta salvata e inviata",
        result.sent && !result.opaque
          ? `Richiesta ${request.id} salvata su registro reale. Recap email inviato al cliente e a FunniFin.`
          : result.opaque
            ? `Richiesta ${request.id} salvata sul registro reale. FunniFin la trova in coda e puo verificare il recap.`
          : `Richiesta ${request.id} salvata su registro reale. Configura l'email per invio automatico.`,
      );
      setSubmittedEmail(contact.email.trim());
      setEmailDeliveryMode(result.sent ? (result.opaque ? "opaque" : "sent") : "demo");
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
      />

      <div className="client-commerce">
        <div className="client-shop">
      <Stepper
        steps={clientSteps}
        activeStep={clientStep}
        onStep={(step) => {
          setClientStep(step);
          if (step === "Personalizza") {
            notify("Personalizzazione su misura", "Qui decidi se aggiungere il lavoro di co-design FunniFin con i nostri esperti.");
            return;
          }
          const target = document.querySelector(`#step-${step.toLowerCase()}`);
          if (target) target.scrollIntoView({ behavior: "smooth" });
          notify("Step selezionato", `${step}: vai alla sezione operativa.`);
        }}
      />

      {clientStep === "Interessi" && (
        <WizardPane>
          <div id="step-interessi" />
          <Panel
            title="Scegli interessi e temi"
            icon={<BookOpen size={20} />}
            actions={
              <ToolIconButton onClick={() => refreshClientSection("Interessi e temi")} label="Ricarica interessi e temi">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          >
            <div className="catalog-display-toolbar">
              <span>{topics.length} interessi · {allThemes.length} temi · {workshops.length} workshop</span>
              <button className={showTopicBadges ? "active" : ""} onClick={() => setShowTopicBadges(!showTopicBadges)}>
                {showTopicBadges ? "Badge visibili" : "Badge nascosti"}
              </button>
            </div>
            <div className="topic-grid">
              <button className="topic-card all-topics-card topic-color-all" onClick={selectAllTopics}>
                <span className="topic-icon"><BookOpen size={22} /></span>
                {showTopicBadges && <span className="topic-badge">vedi tutti</span>}
                <strong>Tutto il catalogo</strong>
                <small>Mostra tutti gli interessi, i temi e i workshop disponibili.</small>
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
                    {showTopicBadges && topicItem.badge !== "base" && <span className="topic-badge">{topicItem.badge}</span>}
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
        </WizardPane>
      )}

      {clientStep === "Consigliati" && (
        <WizardPane>
          <div id="step-consigliati" />
          <Panel
            title="Workshop consigliati"
            icon={<Sparkles size={20} />}
            actions={
              <ToolIconButton onClick={() => refreshClientSection("Workshop consigliati")} label="Ricarica workshop consigliati">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          >
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
                <em>{selectedRecommendationCount}/{recommendedWorkshops.length} gia nel percorso</em>
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
        </WizardPane>
      )}

      {clientStep === "Workshop" && (
        <WizardPane>
          <div id="step-workshop" />
          <Panel
            title="Scegli workshop"
            icon={<Presentation size={20} />}
            actions={
              <ToolIconButton onClick={() => refreshClientSection("Catalogo workshop")} label="Ricarica catalogo workshop">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          >
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
        </WizardPane>
      )}

      {clientStep === "Personalizza" && (
        <WizardPane>
          <Panel
            title="Personalizzazione su misura"
            icon={<Sparkles size={20} />}
            actions={
              <ToolIconButton onClick={() => refreshClientSection("Personalizzazione")} label="Ricarica personalizzazione">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          >
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
        </WizardPane>
      )}

      {clientStep === "Date" && (
        <WizardPane>
          <div id="date-materiali" />
          <div id="step-date" />
          <Panel
            title="Proponi date"
            icon={<CalendarCheck size={20} />}
            actions={
              <ToolIconButton onClick={() => refreshClientSection("Date")} label="Ricarica date">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          >
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
                return (
                  <div className={`date-action-card ${selection.dateConfirmed ? "done" : ""}`} key={selection.workshopId}>
                    <span className="date-status">{selection.dateConfirmed ? <Check size={16} /> : <Clock3 size={16} />}</span>
                    <div>
                      <strong>{workshop.title}</strong>
                      <span>
                        {selection.dateConfirmed
                          ? `${selection.date} · ${selection.time} · ${selection.duration}`
                          : "Date non ancora scelte"}
                      </span>
                    </div>
                    <div className="date-row-actions">
                      <AppButton variant={selection.dateConfirmed ? "outline" : "secondary"} onClick={() => openDateModal(selection)}>
                        <CalendarCheck size={17} /> {selection.dateConfirmed ? "Modifica" : "Scegli"}
                      </AppButton>
                      <RemoveWorkshopButton onClick={() => removeWorkshop(workshop.id)} label={workshop.title} />
                    </div>
                  </div>
                );
                })}
              </div>
            )}
          </Panel>
        </WizardPane>
      )}

      {clientStep === "Materiali" && (
        <WizardPane>
          <Panel
            title="Logo e note cliente"
            icon={<UploadCloud size={20} />}
            actions={
              <ToolIconButton onClick={() => refreshClientSection("Materiali cliente")} label="Ricarica materiali cliente">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          >
          <div className="upload-box">
            <UploadCloud size={32} />
            <strong>Logo, brand guideline e note platea</strong>
            <span>
              Crea una cartella Drive draft chiamata <strong>{assetClientName} data</strong> per logo, linee guida e note.
            </span>
            <label className="secondary-btn asset-upload-trigger">
              <input
                type="file"
                multiple
                onChange={(event) => {
                  void handleAssetFiles(event.target.files);
                  event.target.value = "";
                }}
              />
              {uploadingAssets ? "Caricamento..." : "Carica materiali"}
            </label>
            {assetFolder && (
              <a className="asset-folder-link" href={assetFolder.url} target="_blank" rel="noreferrer">
                Apri cartella Drive: {assetFolder.name}
              </a>
            )}
            {uploadedAssets.length > 0 && (
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
        </WizardPane>
      )}

      {clientStep === "Invio" && (
        <WizardPane>
          <Panel
            title="Invio richiesta"
            icon={<FileCheck2 size={20} />}
            actions={
              <ToolIconButton onClick={() => refreshClientSection("Invio richiesta")} label="Ricarica riepilogo invio">
                <RefreshCw size={18} />
              </ToolIconButton>
            }
          >
            <ReadinessPanel rows={selectedWorkshopRows} missingDateRows={missingDateRows} />
            {requestFinalized ? (
              <div className="request-success-card">
                <span className="success-check">
                  <Check size={38} />
                </span>
                <div>
                  <strong>Richiesta inviata</strong>
                  <p>
                    {emailDeliveryMode === "demo"
                      ? "Richiesta salvata in demo. Configura Apps Script per inviare davvero l'email."
                      : emailDeliveryMode === "opaque"
                        ? "Richiesta presa in carico. FunniFin la trova nella coda e ti ricontattera con il recap."
                        : "Email inviata al cliente e a FunniFin."}
                  </p>
                </div>
                <div className="submitted-email-box">
                  <span>Inviata a</span>
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
                    <label>
                      Nome
                      <input value={contact.firstName} onChange={(event) => setContact({ ...contact, firstName: event.target.value })} autoComplete="given-name" />
                    </label>
                    <label>
                      Cognome
                      <input value={contact.lastName} onChange={(event) => setContact({ ...contact, lastName: event.target.value })} autoComplete="family-name" />
                    </label>
                    <label>
                      Email aziendale
                      <input type="email" value={contact.email} onChange={(event) => setContact({ ...contact, email: event.target.value })} autoComplete="email" />
                    </label>
                    <label>
                      Azienda
                      <input value={contact.company} onChange={(event) => setContact({ ...contact, company: event.target.value })} autoComplete="organization" />
                    </label>
                    <label>
                      Telefono
                      <input value={contact.phone} onChange={(event) => setContact({ ...contact, phone: event.target.value })} autoComplete="tel" />
                    </label>
                  </div>
                </div>
                <div className="approval-card">
                  <div>
                    <strong>Preventivo pronto per FunniFin</strong>
                    <span>Riceverai un recap via email; FunniFin verifichera date, esperti e fattibilita operativa.</span>
                  </div>
                  <button
                    className="primary-btn"
                    onClick={submitRequest}
                    disabled={sendingRequest}
                  >
                    <Send size={18} /> {sendingRequest ? "Invio..." : "Invia richiesta"}
                  </button>
                </div>
              </>
            )}
          </Panel>
        </WizardPane>
      )}
        </div>
        <EcommerceCart
          rows={selectedWorkshopRows}
          quote={quote}
          onRemove={removeWorkshop}
          onSubmit={submitRequest}
        />
      </div>
      <BottomActionBar
        className="client-bottom-bar"
        context={`Cliente · ${clientStep}`}
        detail={`${selectedWorkshopRows.length} workshop`}
        priceBefore={quote.saved > 0 ? money(quote.gross) : undefined}
        priceAfter={money(quote.total)}
        discountLabel={quote.saved > 0 ? `Sconto ${money(quote.saved)}` : undefined}
        caveat={
          selectedWorkshopRows.length > 0 && selectedWorkshopRows.length < 3
            ? `Aggiungi ${3 - selectedWorkshopRows.length} workshop\nper sconto del 20%`
            : undefined
        }
        primaryLabel={clientMainAction.label}
        primaryDisabled={clientMainAction.disabled}
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

function AdminView({
  projectStatus,
  quote,
  rules,
  selections,
  setRules,
  setProjectStatus,
  updateSelection,
  notify,
  clientAssetFolder,
  clientUploadedAssets,
  currentRequest,
  requestRefreshToken,
}: {
  projectStatus: ProjectStatus;
  quote: ReturnType<typeof useQuotePlaceholder>;
  rules: PricingRule[];
  selections: Selection[];
  setRules: (rules: PricingRule[]) => void;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  notify: (title: string, body: string) => void;
  clientAssetFolder: AssetDraftFolder | null;
  clientUploadedAssets: UploadedAsset[];
  currentRequest: WorkshopRequestRecord | null;
  requestRefreshToken: number;
}) {
  const [adminTab, setAdminTab] = useState("Operativo");
  const [catalogView, setCatalogView] = useState<"sheet" | "drive">("sheet");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminQueueFilter, setAdminQueueFilter] = useState<"tutti" | "da-fare" | "esperti" | "brand">("tutti");
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
  const [googleHealth, setGoogleHealth] = useState<GoogleHealth | null>(null);
  const [googleHealthError, setGoogleHealthError] = useState("");
  const [googleHealthLoading, setGoogleHealthLoading] = useState(false);
  const [adminActionModal, setAdminActionModal] = useState<AdminActionModalState | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<Record<string, CalendarEventRecord>>({});
  const [driveFolderPreview, setDriveFolderPreview] = useState<DriveFolderResponse | null>(null);
  const [driveFolderStatus, setDriveFolderStatus] = useState<{ loading: boolean; error: string }>({ loading: false, error: "" });
  const [catalogEdits, setCatalogEdits] = useState<Record<string, { title: string; description: string; badge: string; active: boolean }>>(() =>
    Object.fromEntries(topics.map((topic) => [topic.id, { title: topic.title, description: topic.description, badge: topic.badge, active: true }])),
  );
  const [dateApprovals, setDateApprovals] = useState<Record<string, DateApproval>>({});
  const [workshopExperts, setWorkshopExperts] = useState<Record<string, string>>({});
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
        const message = error instanceof Error ? error.message : "Lettura richieste non riuscita";
        const fallbackProjects = currentRequest ? [requestToAdminProject(currentRequest)] : [buildLocalAdminProject(selections, quote.total, projectStatus)];
        setAdminProjects(fallbackProjects);
        setSelectedProjectId((current) => (fallbackProjects.some((project) => project.id === current) ? current : fallbackProjects[0].id));
        setRequestSyncState({ loading: false, error: message, source: currentRequest ? "sheet" : "local" });
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
        setDriveFolderStatus({ loading: false, error: error instanceof Error ? error.message : "Lettura Drive non riuscita." });
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
        setAdminProjects((current) => current.map((project) => (project.id === projectId ? requestToAdminProject(request) : project)));
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
        price: existing?.price ?? (row.duration === "2h" ? row.workshop.price2h : row.workshop.price1h),
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
      return total + (record.duration === "2h" ? workshop.price2h : workshop.price1h);
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
  const confirmRequestEdit = async (records: RequestWorkshopRecord[], notification: NotificationChoice) => {
    const patch = buildEditedRequestPatch(records);
    const adminPatch: Partial<AdminProject> = {
      workshopIds: patch.workshopIds ?? [],
      dateCount: patch.dateCount ?? 0,
      quoteTotal: patch.quoteTotal ?? 0,
      request: selectedProject.request ? { ...selectedProject.request, ...patch } : selectedProject.request,
    };
    updateAdminProject(selectedProject.id, adminPatch, "request_admin_edited", "FunniFin ha modificato workshop, date o preventivo della richiesta.");
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
        patch,
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
          status: statusLabel[activeAdminStatus],
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
      notify("Richiesta modificata", `Modifica salvata e email inviata a ${notification.recipients.join(", ")}.`);
    } else {
      notify("Richiesta modificata", "Modifica salvata senza inviare email.");
    }
    setAdminActionModal(null);
  };
  const runProjectStatus = (status: ProjectStatus, title: string, body: string) => {
    updateAdminProject(selectedProject.id, { status });
    if (selectedProject.source === "local") setProjectStatus(status, title, body);
    else notify(title, `${selectedProject.company}: ${body}`);
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
        actionUrl: phase === "candidacies_open" ? `${window.location.origin}${window.location.pathname}#esperto-candidature` : undefined,
        actionLabel: phase === "candidacies_open" ? "Mi candido" : undefined,
      });
      notify(
        result.sent ? "Email inviata" : "Email pronta in demo",
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
      const eventRecord = await createWorkshopCalendarEvent({
        projectId: selectedProject.id,
        company: selectedProject.company,
        manager: selectedProject.manager,
        managerEmail: selectedProject.email,
        managerPhone: selectedProject.phone,
        quoteTotal: activeAdminQuote,
        eventMode,
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
        `Evento ${eventRecord.id} creato con Meet e materiali collegati.`,
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
  const filteredAdminProjects = adminProjects.filter((project) => {
    const text = `${project.company} ${project.manager} ${project.email}`.toLowerCase();
    const matchesSearch = adminSearch.trim() === "" || text.includes(adminSearch.trim().toLowerCase());
    const matchesFilter =
      adminQueueFilter === "tutti" ||
      (adminQueueFilter === "da-fare" && ["richiesta_inviata", "in_verifica_funnifin", "date_approvate"].includes(project.status)) ||
      (adminQueueFilter === "esperti" && !project.assignedExpert) ||
      (adminQueueFilter === "brand" && ["in_revisione_brand", "approvazione_finale"].includes(project.status));
    return matchesSearch && matchesFilter;
  });
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
    },
    {
      id: "Catalogo",
      title: "Catalogo vendibile",
      meta: `${catalogWorkshopsForAdmin.length} workshop`,
      body: "Ambiti, categorie e tag da Sheet; presentazioni operative da Drive.",
    },
    {
      id: "Prezzi",
      title: "Regole prezzo",
      meta: `${rules.length} regole`,
      body: "Bundle, sconti quantita, promo e preventivo dinamico.",
    },
    {
      id: "Esperti",
      title: "Pool esperti",
      meta: `${expertDirectory.length} profili`,
      body: "Competenze, disponibilita e assegnazioni ai workshop.",
    },
    {
      id: "Google",
      title: "Google backend",
      meta: googleHealth ? `${googleHealth.spreadsheet.requests} richieste` : "health",
      body: "Sheets, Calendar, Drive, Mail quota e settings operative.",
    },
  ];
  const adminMainAction = (() => {
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
          action: () => refreshGoogleHealth(),
        };
      }
      return {
        label: "Aggiorna vista esperti",
        disabled: false,
        action: () => {
          setExpertsSyncedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
          setAdminQueueFilter("esperti");
          notify("Vista esperti aggiornata", `${expertDirectory.length} profili riletti dalla rubrica interna. La coda mostra i progetti senza esperto.`);
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
        const message = error instanceof Error ? error.message : "Lettura richieste non riuscita";
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
  const refreshGoogleHealth = (options?: { silent?: boolean }) => {
    setGoogleHealthLoading(true);
    setGoogleHealthError("");
    void Promise.all([getGoogleHealth(), listWorkspaceSettings().catch(() => workspaceSettings)])
      .then(([health, settings]) => {
        setGoogleHealth(health);
        setWorkspaceSettings(settings);
        setGoogleHealthLoading(false);
        if (!options?.silent) {
          notify("Google Health aggiornata", health ? `${health.spreadsheet.requests} richieste, ${health.spreadsheet.events} eventi, quota mail ${health.mail.remainingDailyQuota}.` : "Endpoint Google non configurato.");
        }
      })
      .catch((error) => {
        setGoogleHealth(null);
        setGoogleHealthLoading(false);
        setGoogleHealthError(error instanceof Error ? error.message : "Health Google non disponibile.");
      });
  };
  useEffect(() => {
    if (adminTab !== "Google" || googleHealth || googleHealthLoading) return;
    refreshGoogleHealth({ silent: true });
  }, [adminTab]);
  useEffect(() => {
    if (adminTab !== "Catalogo" || catalogView !== "sheet" || googleHealth || googleHealthLoading) return;
    refreshGoogleHealth({ silent: true });
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
  const automaticPricingRules = rules.filter((rule) => !rule.specialQuote);
  const quoteOnlyRules = rules.filter((rule) => rule.specialQuote);
  const maxAutomaticDiscount = automaticPricingRules.reduce((max, rule) => Math.max(max, rule.discountPercent), 0);
  const currentRule = quote.rule;
  const currentRuleRange = `${currentRule.min}-${currentRule.max === 99 ? "6+" : currentRule.max}`;
  const currentRuleMode = currentRule.specialQuote ? "su preventivo" : `${currentRule.discountPercent}% sconto`;
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
        <div className="admin-workbench-v2">
          <aside className="admin-project-queue" aria-label="Coda progetti cliente">
            <div className="queue-control-panel">
              <div className="queue-head">
                <div>
                  <strong>Coda progetti</strong>
                  <span>
                    {requestSyncState.loading && "Lettura registro..."}
                    {!requestSyncState.loading && requestSyncState.source === "sheet" && `${filteredAdminProjects.length} richieste reali`}
                    {!requestSyncState.loading && requestSyncState.source === "local" && "Vista locale temporanea"}
                  </span>
                </div>
                <ToolIconButton active={requestSyncState.source === "sheet"} onClick={refreshRequestQueue} label="Aggiorna registro richieste">
                  <RefreshCw size={20} />
                </ToolIconButton>
                {adminSearch && (
                  <ToolIconButton active onClick={() => setAdminSearch("")} label="Reset ricerca progetti">
                    <X size={20} />
                  </ToolIconButton>
                )}
              </div>
              {requestSyncState.error && (
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
                  {[
                    ["tutti", "Tutti"],
                    ["da-fare", "Da fare"],
                    ["esperti", "Esperti"],
                    ["brand", "Brand"],
                  ].map(([id, label]) => (
                    <button key={id} className={adminQueueFilter === id ? "active" : ""} onClick={() => setAdminQueueFilter(id as typeof adminQueueFilter)}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="project-choice-list" aria-label="Progetti in coda">
              {filteredAdminProjects.map((project) => {
                const activeStatus = project.source === "local" ? projectStatus : project.status;
                const selected = selectedProject.id === project.id;
                return (
                  <button key={project.id} className={selected ? "active" : ""} onClick={() => selectProject(project)}>
                    <span className="queue-status-dot" />
                    <div>
                      <strong>{project.company}</strong>
                      <em>{project.manager} · {project.workshopIds.length} workshop</em>
                    </div>
                    <small>{statusLabel[activeStatus]}</small>
                    <b>{money(project.source === "local" ? quote.total : project.quoteTotal)}</b>
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
                    <strong>
                      {adminWorkspacePanel === "calendar" && "Date proposte"}
                      {adminWorkspacePanel === "experts" && "Esperti compatibili"}
                      {adminWorkspacePanel === "folder" && "Cartella progetto"}
                      {adminWorkspacePanel === "confirm" && "Conferma evento"}
                      {adminWorkspacePanel === "workshops" && "Workshop del progetto"}
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
                    <ToolIconButton onClick={refreshAdminWorkspacePanel} label="Ricarica dati sezione">
                      <RefreshCw size={18} />
                    </ToolIconButton>
                    {adminWorkspacePanel === "workshops" && (
                      <ActionIconButton onClick={() => setAdminActionModal({ type: "edit_request" })} label="Modifica richiesta cliente">
                        <Settings2 size={18} />
                      </ActionIconButton>
                    )}
                  </div>
                </div>
                {adminWorkspacePanel === "workshops" && (
                  <div className="admin-workshop-flow-panel">
                    <div className="admin-request-summary">
                      <Info label="Cliente" value={selectedProject.company} />
                      <Info label="Referente" value={selectedProject.manager} />
                      <Info label="Preventivo" value={`${money(activeAdminQuote)} + IVA`} />
                    </div>
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
                    {currentProjectSelections.map((row) => (
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
                    <Info label="Evento" value={currentProjectEvent ? currentProjectEvent.id : "da creare"} />
                    {currentProjectEvent && (
                      <div className="inline-status-card">
                        <Check size={18} />
                        <div className="inline-status-copy">
                          <span>
                            Evento {currentProjectEvent.source === "google-calendar" ? "Google Calendar" : "demo"} creato alle {currentProjectEvent.createdAt}: {currentProjectEvent.workshops} workshop collegati
                            {currentProjectEvent.fallback ? " · creato senza Meet automatico: controlla Advanced Calendar API" : ""}
                          </span>
                          <span className="event-link-row">
                            <EventLink href={currentProjectEvent.meetLink} label="Apri Meet" />
                            {currentProjectEvent.htmlLink && <EventLink href={currentProjectEvent.htmlLink} label="Apri Calendar" />}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>

            </div>
          </section>
        </div>
      )}

      {adminTab === "Catalogo" && (
        <Panel
          title="Catalogo"
          icon={<Settings2 size={20} />}
          actions={
            <>
              <ToolIconButton onClick={refreshCatalogSection} label="Ricarica catalogo">
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
                  <AppButton
                    variant="secondary"
                    onClick={refreshCatalogSection}
                  >
                    <RefreshCw size={17} /> Ricarica Sheet
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
                    <AppButton variant="secondary" onClick={() => refreshGoogleHealth()}>
                      <RefreshCw size={17} /> Verifica Sheet
                    </AppButton>
                  </div>
                </div>
                {sheetPreviewUrl ? (
                  <iframe title="Preview Google Sheet catalogo FunniFin" src={sheetPreviewUrl} loading="lazy" />
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
                <AppButton variant="secondary" onClick={syncDriveSlidesFromRoot}>
                  <RefreshCw size={17} /> Sincronizza root
                </AppButton>
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
                          <RefreshCw size={17} /> Verifica
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
            <ToolIconButton onClick={refreshGoogleHealth} label="Ricarica stato Google">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          <div className="pricing-console">
            <div className="pricing-hero-card">
              <div>
                <span className="eyebrow">Workspace Google</span>
                <strong>{googleHealthLoading ? "Controllo..." : googleHealth ? "Connesso" : googleHealthError ? "Errore verifica" : "Verifica non eseguita"}</strong>
                <em>{googleHealth?.checkedAt ?? googleHealthError ?? "Sheets, Calendar, Drive e MailApp"}</em>
              </div>
              <div className="pricing-hero-metrics" aria-label="Stato backend Google">
                <Info label="Richieste" value={String(googleHealth?.spreadsheet.requests ?? adminProjects.length)} />
                <Info label="Eventi log" value={String(googleHealth?.spreadsheet.events ?? 0)} />
                <Info label="Interessi" value={String(googleHealth?.spreadsheet.catalogTopics ?? Object.keys(catalogEdits).length)} />
                <Info label="Workshop" value={String(googleHealth?.spreadsheet.catalogWorkshops ?? workshops.length)} />
                <Info label="Prezzi" value={String(googleHealth?.spreadsheet.pricingRules ?? rules.length)} />
                <Info label="Esperti" value={String(googleHealth?.spreadsheet.experts ?? expertDirectory.length)} />
                <Info label="Mail quota" value={String(googleHealth?.mail.remainingDailyQuota ?? "-")} />
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
                        return (
                          <article className="admin-setting-card" key={setting.key}>
                            <div className="pricing-rule-head">
                              <div>
                                <span className="pricing-rule-kicker">{definition.group}</span>
                                <strong>{setting.label || definition.label}</strong>
                                <em>{definition.helper}</em>
                              </div>
                              {!definition.readOnly && (
                                <ActionIconButton
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
                                  label={`Salva ${setting.label || definition.label}`}
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
                                  setWorkspaceSettings((current) => {
                                    const exists = current.some((item) => item.key === next.key);
                                    return exists ? current.map((item) => (item.key === next.key ? next : item)) : [...current, next];
                                  });
                                }}
                              />
                            </label>
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
          onConfirmDate={(workshopId, decision, notification) => {
            void confirmDateDecision(workshopId, decision, notification);
            setAdminActionModal(null);
          }}
          onConfirmExpert={(workshopId, expertName, mode, notification) => {
            void confirmExpertAssignment(workshopId, expertName, mode, notification);
            setAdminActionModal(null);
          }}
          onInviteExperts={(notification) => {
            void inviteExpertsToCandidacy(notification);
            setAdminActionModal(null);
          }}
          onConfirmBrandHandoff={(notification) => {
            void sendBrandHandoff(notification);
            setAdminActionModal(null);
          }}
          onConfirmEvent={createCalendarEvent}
          onSaveRequestEdit={(records, notification) => {
            void confirmRequestEdit(records, notification);
          }}
          onSaveRule={(ruleId, patch) => {
            const nextRules = rules.map((rule) => (rule.id === ruleId ? { ...rule, ...patch } : rule));
            const nextRule = nextRules.find((rule) => rule.id === ruleId);
            setRules(nextRules);
            setPricingSavedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
            if (nextRule) {
              void updatePricingRule(nextRule)
                .then((savedRule) => {
                  setRules(nextRules.map((rule) => (rule.id === savedRule.id ? { ...rule, ...savedRule } : rule)));
                  notify("Prezzi salvati su Google", "Nome, range, sconto e logica preventivo sono ora usati dal preventivo dinamico.");
                })
                .catch((error) => {
                  notify("Prezzi salvati solo in locale", error instanceof Error ? error.message : "Redeploy Apps Script necessario per salvare su Google Sheets.");
                });
            }
            setAdminActionModal(null);
          }}
        />
      )}
      <BottomActionBar
        context={
          adminTab === "Catalogo"
            ? `Catalogo · ${catalogView === "drive" ? "Slide Drive" : "Sheet"}`
            : adminTab === "Google"
              ? "Google backend"
            : `${adminTab}${adminTab === "Operativo" ? ` · ${adminFlowSteps[activeAdminFlowIndex]?.title}` : ""}`
        }
        detail={
          adminTab === "Catalogo" && catalogView === "drive"
            ? `${driveLinkedCount}/${workshops.length} slide collegate`
            : adminTab === "Google"
              ? `Workspace Google · ${googleHealthLoading ? "controllo in corso" : googleHealth ? "connesso" : googleHealthError ? "errore verifica" : "pronto da verificare"}`
            : `${selectedProject.company} · ${statusLabel[activeAdminStatus]}`
        }
        primaryLabel={adminMainAction.label}
        primaryDisabled={adminMainAction.disabled}
        onPrimary={adminMainAction.action}
        backLabel={adminTab === "Operativo" && activeAdminFlowIndex > 0 ? "Indietro" : undefined}
        onBack={adminTab === "Operativo" && activeAdminFlowIndex > 0 ? () => goAdminFlow(-1) : undefined}
      />
    </section>
  );
}

function ExpertView({
  selections,
  updateSelection,
  setProjectStatus,
  notify,
  project,
}: {
  selections: Selection[];
  updateSelection: (id: string, patch: Partial<Selection>) => void;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  notify: (title: string, body: string) => void;
  project: AdminProject;
}) {
  const expertSteps = ["Opportunita", "Assegnati", "Upload deck", "Storico"];
  const expertName = "Laura Bianchi";
  const [syncedProject, setSyncedProject] = useState<AdminProject>(project);
  const [expertSyncState, setExpertSyncState] = useState<{ loading: boolean; error: string }>({ loading: false, error: "" });
  const [expertStep, setExpertStep] = useState(expertSteps[0]);
  const [candidateModalRow, setCandidateModalRow] = useState<{ selection: Selection; workshop: Workshop } | null>(null);
  const [candidateSending, setCandidateSending] = useState(false);
  const [availabilityUpdatedAt, setAvailabilityUpdatedAt] = useState("");
  const [expertDeckFolder, setExpertDeckFolder] = useState<AssetDraftFolder | null>(null);
  const [expertDeckFile, setExpertDeckFile] = useState<UploadedAsset | null>(null);
  const [expertDeckUploading, setExpertDeckUploading] = useState(false);
  const [expertDeckError, setExpertDeckError] = useState("");
  const [expertDrivePickerOpen, setExpertDrivePickerOpen] = useState(false);
  const [expertDriveItems, setExpertDriveItems] = useState<DriveFolderItem[]>([]);
  const [expertDriveLoading, setExpertDriveLoading] = useState(false);
  const activeExpertProject = syncedProject.source === "sheet" ? syncedProject : project;
  const expertRows = activeExpertProject.request
    ? activeExpertProject.request.workshops
        .map((record) => {
          const workshop = workshops.find((item) => item.id === record.workshopId);
          if (!workshop) return null;
          return {
            selection: {
              workshopId: record.workshopId,
              duration: record.duration,
              format: record.format,
              date: record.date,
              time: record.time || "10:00",
              custom: record.custom,
              customNote: record.customNote || "",
              promo: false,
              status: record.status,
              dateConfirmed: record.approval === "approved",
            } satisfies Selection,
            workshop,
          };
        })
        .filter(Boolean) as Array<{ selection: Selection; workshop: Workshop }>
    : selections
        .map((selection) => ({ selection, workshop: workshops.find((item) => item.id === selection.workshopId)! }))
        .filter(({ workshop }) => Boolean(workshop));
  const assignedRow = expertRows.find(({ selection }) => selection.status === "esperto_assegnato") ?? expertRows[0];
  const candidateCount = expertRows.filter(({ selection }) => selection.status === "candidatura_ricevuta").length;
  const loadExpertOpportunities = async (showFeedback = false) => {
    setExpertSyncState({ loading: true, error: "" });
    try {
      const requests = await listWorkshopRequests();
      const openRequests = requests.filter((request) =>
        ["aperto_a_esperti", "date_approvate", "esperto_assegnato", "in_preparazione_esperto"].includes(request.status),
      );
      const request = openRequests[0] ?? requests[0];
      if (!request) {
        setExpertSyncState({ loading: false, error: "Nessuna richiesta reale trovata nel registro." });
        if (showFeedback) notify("Nessuna opportunita reale", "Il registro non contiene richieste aperte agli esperti.");
        return;
      }
      setSyncedProject(requestToAdminProject(request));
      setExpertSyncState({ loading: false, error: "" });
      if (showFeedback) notify("Opportunita aggiornate", `${request.company}: ${request.workshops.length} workshop letti dal registro.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Lettura opportunita non riuscita.";
      setExpertSyncState({ loading: false, error: message });
      if (showFeedback) notify("Opportunita non aggiornate", message);
    }
  };
  useEffect(() => {
    void loadExpertOpportunities(false);
  }, []);
  const expertMainAction = (() => {
    if (expertStep === "Opportunita") return { label: "Aggiorna disponibilita", disabled: false, action: () => {
      setAvailabilityUpdatedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      void loadExpertOpportunities(true);
    } };
    if (expertStep === "Assegnati") return { label: "Vai all'upload", disabled: !assignedRow, action: () => setExpertStep("Upload deck") };
    if (expertStep === "Upload deck") return { label: "Invia a brand", disabled: !assignedRow || !expertDeckFile, action: () => { void sendDeckToBrand(); } };
    return { label: "Vedi opportunita", disabled: false, action: () => setExpertStep("Opportunita") };
  })();
  const handleExpertDeckUpload = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file || !assignedRow) return;
    setExpertDeckUploading(true);
    setExpertDeckError("");
    try {
      const folder = expertDeckFolder ?? (await createAssetDraftFolder(`deck ${assignedRow.workshop.title}`));
      setExpertDeckFolder(folder);
      const uploaded = await uploadAssetFiles(folder.id, [file]);
      const uploadedFile = uploaded[0] ?? { id: `local_${Date.now()}`, name: file.name, url: folder.url };
      setExpertDeckFile(uploadedFile);
      notify("Deck caricato", `${uploadedFile.name} salvato nella cartella Drive.`);
    } catch (error) {
      setExpertDeckError(error instanceof Error ? error.message : "Upload deck non riuscito.");
    } finally {
      setExpertDeckUploading(false);
    }
  };
  const sendDeckToBrand = async () => {
    if (!assignedRow || !expertDeckFile) return;
    try {
      if (activeExpertProject.source === "sheet" && activeExpertProject.request) {
        const nextWorkshops = activeExpertProject.request.workshops.map((record) =>
          record.workshopId === assignedRow.workshop.id
            ? { ...record, status: "in_revisione_brand", expertName: record.expertName || expertName }
            : record,
        );
        const request = await updateWorkshopRequest(
          activeExpertProject.id,
          {
            status: "in_revisione_brand",
            workshops: nextWorkshops,
            materials: {
              ...(activeExpertProject.request.materials ?? {}),
              folderId: expertDeckFolder?.id ?? activeExpertProject.request.materials?.folderId,
              folderName: expertDeckFolder?.name ?? expertDeckFile.name,
              folderUrl: expertDeckFile.url || expertDeckFolder?.url || activeExpertProject.request.materials?.folderUrl,
              fileCount: Math.max(activeExpertProject.request.materials?.fileCount ?? 0, 1),
            },
          },
          {
            type: "expert_deck_sent_to_brand",
            note: `${expertName} ha inviato ${expertDeckFile.name} alla revisione brand.`,
            payload: { workshopId: assignedRow.workshop.id, file: expertDeckFile, folder: expertDeckFolder },
          },
        );
        setSyncedProject(requestToAdminProject(request));
      } else {
        updateSelection(assignedRow.workshop.id, { status: "in_revisione_brand" });
      }
      setProjectStatus("in_revisione_brand", "Deck inviato al brand", `${expertDeckFile.name} passa alla revisione qualita.`);
      notify("Deck inviato al brand", `${expertDeckFile.name} salvato sul registro del progetto.`);
    } catch (error) {
      notify("Invio a brand non salvato", error instanceof Error ? error.message : "Aggiornamento registro non riuscito.");
    }
  };
  const loadExpertDriveItems = async (openPicker: boolean) => {
    if (openPicker) setExpertDrivePickerOpen(true);
    setExpertDriveLoading(true);
    setExpertDeckError("");
    try {
      const preview = await getDriveFolderPreview();
      const items = [...(preview?.files ?? []), ...(preview?.folders ?? [])].filter((item) =>
        item.type === "presentation" || item.type === "file",
      );
      setExpertDriveItems(items);
      if (!preview) {
        setExpertDeckError("Configura Apps Script e una cartella Drive per selezionare file esistenti.");
      } else if (!items.length) {
        setExpertDeckError("Nessuna presentazione o file selezionabile nella cartella Drive configurata.");
      }
    } catch (error) {
      setExpertDeckError(error instanceof Error ? error.message : "Selezione Drive non disponibile.");
    } finally {
      setExpertDriveLoading(false);
    }
  };
  const openExpertDrivePicker = async () => {
    await loadExpertDriveItems(true);
  };
  const selectExpertDriveItem = (item: DriveFolderItem) => {
    setExpertDeckFile({
      id: item.id,
      name: item.name,
      size: 0,
      mimeType: item.mimeType || (item.type === "presentation" ? "Google Slides" : "File Drive"),
      url: item.url,
    });
    setExpertDrivePickerOpen(false);
    notify("Presentazione selezionata", `${item.name} selezionata da Drive.`);
  };
  const refreshExpertSection = (section: string) => {
    if (section === "Opportunita") {
      setAvailabilityUpdatedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
      void loadExpertOpportunities(true);
      return;
    }
    if (section === "Upload deck") {
      void loadExpertDriveItems(false);
      notify("File Drive aggiornati", "Presentazioni e file selezionabili rilette dalla cartella Drive configurata.");
      return;
    }
    notify("Sezione aggiornata", `${section}: dati esperto riletti nella vista corrente.`);
  };
  const confirmExpertCandidacy = async () => {
    if (!candidateModalRow || candidateSending) return;
    const { selection, workshop } = candidateModalRow;
    setCandidateSending(true);
    try {
      let updatedProject = activeExpertProject;
      if (activeExpertProject.source === "sheet" && activeExpertProject.request) {
        const nextWorkshops = activeExpertProject.request.workshops.map((record) =>
          record.workshopId === workshop.id
            ? { ...record, status: "candidatura_ricevuta", expertName, approval: record.approval ?? "approved" }
            : record,
        );
        const request = await updateWorkshopRequest(
          activeExpertProject.id,
          {
            status: "aperto_a_esperti",
            workshops: nextWorkshops,
            assignedExpert: activeExpertProject.assignedExpert,
          },
          {
            type: "expert_candidate_received",
            note: `${expertName} si e candidata per ${workshop.title}.`,
            payload: { workshopId: workshop.id, expertName },
          },
        );
        updatedProject = requestToAdminProject(request);
        setSyncedProject(updatedProject);
      }
      const result = await sendWorkflowNotification({
        phase: "expert_candidate_received",
        project: {
          id: updatedProject.id,
          company: updatedProject.company,
          manager: updatedProject.manager,
          email: updatedProject.email,
          phone: updatedProject.phone,
          status: updatedProject.status,
          quoteTotal: updatedProject.quoteTotal,
        },
        workshops: [
          {
            title: workshop.title,
            date: selection.date,
            time: selection.time,
            duration: selection.duration,
            format: selection.format,
          },
        ],
        recipients: ["funnifin"],
        note: `Nuova candidatura esperto per ${workshop.title}. Notifica inviata solo a FunniFin.`,
      });
      if (activeExpertProject.source === "local") updateSelection(workshop.id, { status: "candidatura_ricevuta" });
      setProjectStatus("aperto_a_esperti", "Candidatura inviata", "FunniFin ha ricevuto la candidatura interna e puo assegnarti il workshop.");
      notify(
        result.sent ? "Candidatura inviata a FunniFin" : "Candidatura salvata in demo",
        result.sent
          ? "Notifica interna inviata solo al team FunniFin."
          : "Configura Apps Script per inviare davvero la mail interna a FunniFin.",
      );
      setCandidateModalRow(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invio candidatura non riuscito.";
      notify("Candidatura non inviata", message);
    } finally {
      setCandidateSending(false);
    }
  };

  return (
    <section className="view-stack expert-console">
      {candidateModalRow && (
        <ExpertCandidateModal
          row={candidateModalRow}
          company={project.company}
          sending={candidateSending}
          onClose={() => {
            if (!candidateSending) setCandidateModalRow(null);
          }}
          onConfirm={confirmExpertCandidacy}
        />
      )}
      <RoleHero
        eyebrow="Area esperto"
        title="Gestisci candidature, incarichi e deck."
        subtitle={`${activeExpertProject.company} · ${expertRows.length} opportunita aperte · ${candidateCount} candidature inviate`}
        actions={
          <>
          <ToolIconButton onClick={() => setExpertStep("Opportunita")} label="Vedi opportunita">
            <Megaphone size={22} />
          </ToolIconButton>
          <ToolIconButton onClick={() => setExpertStep("Upload deck")} label="Carica deck">
            <UploadCloud size={22} />
          </ToolIconButton>
          <ToolIconButton
            onClick={() => {
              setAvailabilityUpdatedAt(new Date().toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" }));
              setExpertStep("Opportunita");
              void loadExpertOpportunities(true);
            }}
            label="Aggiorna disponibilita"
          >
            <CalendarCheck size={22} />
          </ToolIconButton>
          </>
        }
      />
      <OperatorIdentityCard identity={roleIdentities.Esperto} />
      {availabilityUpdatedAt && (
        <div className="inline-status-card">
          <Check size={18} />
          <span>Disponibilita aggiornata alle {availabilityUpdatedAt}. Le opportunita sono filtrate sui tuoi slot liberi.</span>
        </div>
      )}
      {expertSyncState.error && (
        <div className="inline-status-card warning">
          <AlertCircle size={18} />
          <span>{expertSyncState.error}</span>
        </div>
      )}

      <OperationalStrip
        label="Riepilogo operativo esperto"
        items={[
          { id: "opportunities", label: "Workshop disponibili", value: expertRows.length, icon: <Megaphone size={22} />, active: expertStep === "Opportunita", onClick: () => setExpertStep("Opportunita") },
          { id: "assigned", label: "Assegnati", value: assignedRow ? 1 : 0, icon: <CalendarCheck size={22} />, active: expertStep === "Assegnati", onClick: () => setExpertStep("Assegnati") },
          { id: "deck", label: "Deck da caricare", value: 1, icon: <Presentation size={22} />, active: expertStep === "Upload deck", onClick: () => setExpertStep("Upload deck") },
        ]}
      />

      <Stepper steps={expertSteps} activeStep={expertStep} onStep={setExpertStep} />

      {expertStep === "Opportunita" && (
        <Panel
          title="Opportunita disponibili"
          icon={<Megaphone size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshExpertSection("Opportunita")} label="Ricarica opportunita">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          {expertSyncState.loading && <span className="empty-selection">Lettura opportunita dal registro...</span>}
          <div className="expert-opportunity-grid">
            {expertRows.map(({ selection, workshop }) => {
              const alreadyCandidate = selection.status === "candidatura_ricevuta";
              const unavailable = selection.status === "non_disponibile";
              return (
                <div className={`opportunity-card ${alreadyCandidate ? "candidate-sent" : ""} ${unavailable ? "unavailable" : ""}`} key={selection.workshopId}>
                  <div className="opportunity-head">
                    <span className="topic-badge">
                      {alreadyCandidate && "candidatura inviata"}
                      {unavailable && "non disponibile"}
                      {!alreadyCandidate && !unavailable && workshop.level}
                    </span>
                    <strong>{workshop.title}</strong>
                  </div>
                  <div className="opportunity-meta">
                    <Info label="Cliente" value={activeExpertProject.company} />
                    <Info label="Target" value={workshop.target} />
                    <Info label="Formato" value={`${selection.duration} · ${selection.format}`} />
                    <Info label="Data proposta" value={`${selection.date || "da proporre"} ${selection.time}`} />
                  </div>
                  <p className="email-entry-hint">Accesso da mail FunniFin: clicca “Mi candido” per inviare la candidatura al team.</p>
                  <div className="button-row">
                    <AppButton
                      variant={alreadyCandidate ? "outline" : "secondary"}
                      disabled={alreadyCandidate || unavailable}
                      onClick={() => {
                        if (alreadyCandidate || unavailable) return;
                        setCandidateModalRow({ selection, workshop });
                      }}
                    >
                      {alreadyCandidate ? "Candidatura inviata" : "Mi candido"}
                    </AppButton>
                    <AppButton
                      variant="ghost"
                      disabled={alreadyCandidate || unavailable}
                      onClick={() => {
                        if (alreadyCandidate || unavailable) return;
                        updateSelection(workshop.id, { status: "non_disponibile" });
                        notify("Non disponibile", `${workshop.title} segnato come non disponibile per la tua agenda.`);
                      }}
                    >
                      {unavailable ? "Segnato non disponibile" : "Non disponibile"}
                    </AppButton>
                  </div>
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {expertStep === "Assegnati" && (
        <Panel
          title="Workshop assegnati"
          icon={<CalendarCheck size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshExpertSection("Assegnati")} label="Ricarica workshop assegnati">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          <div className="expert-opportunity-grid">
            {(assignedRow ? [assignedRow] : []).map(({ selection, workshop }) => (
              <div className="opportunity-card selected" key={workshop.id}>
                <div className="opportunity-head">
                  <span className="topic-badge">assegnato</span>
                  <strong>{workshop.title}</strong>
                </div>
                <div className="opportunity-meta">
                  <Info label="Cliente" value={project.company} />
                  <Info label="Quando" value={`${selection.date || "data da confermare"} ${selection.time}`} />
                  <Info label="Formato" value={`${selection.duration} · ${selection.format}`} />
                  <Info label="Materiali" value="Logo e note disponibili" />
                </div>
                <AppButton variant="secondary" onClick={() => setExpertStep("Upload deck")}>
                  Vai all'upload
                </AppButton>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {expertStep === "Upload deck" && (
        <Panel
          title="Upload presentazione"
          icon={<UploadCloud size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshExpertSection("Upload deck")} label="Ricarica file Drive">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          <div className="expert-upload-panel">
            <div className="expert-upload-copy">
              <span className="topic-badge">deck</span>
              <h3>{assignedRow?.workshop.title ?? "Nessun workshop assegnato"}</h3>
              <p>Carica la presentazione pronta o scegli un file gia presente in Drive. Dopo l'invio passa al brand.</p>
            </div>
            <div className={`expert-upload-dropzone ${expertDeckFile ? "has-file" : ""}`}>
              {expertDeckFile ? <FileCheck2 size={28} /> : <UploadCloud size={28} />}
              <strong>{expertDeckFile ? expertDeckFile.name : "Nessuna presentazione selezionata"}</strong>
              <span>{expertDeckFile ? expertDeckFile.mimeType || "File selezionato" : "Google Slides, PPTX o PDF"}</span>
              {expertDeckError && <em>{expertDeckError}</em>}
              <div className="expert-upload-actions">
                <label className="app-btn app-btn-secondary asset-upload-trigger">
                  {expertDeckUploading ? "Carico..." : "Carica file"}
                  <input
                    className="asset-file-input"
                    type="file"
                    accept=".ppt,.pptx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.presentationml.presentation"
                    disabled={expertDeckUploading}
                    onChange={(event) => handleExpertDeckUpload(event.target.files)}
                  />
                </label>
                <AppButton variant="ghost" onClick={openExpertDrivePicker}>
                  <ExternalLink size={18} /> Seleziona da Drive
                </AppButton>
              </div>
              {expertDrivePickerOpen && (
                <div className="drive-picker-panel">
                  <div>
                    <strong>Seleziona da Drive</strong>
                    <button type="button" onClick={() => setExpertDrivePickerOpen(false)} aria-label="Chiudi selezione Drive">
                      <X size={16} />
                    </button>
                  </div>
                  {expertDriveLoading && <span>Carico file Drive...</span>}
                  {!expertDriveLoading && expertDriveItems.length === 0 && <span>Nessun file selezionabile.</span>}
                  {!expertDriveLoading && expertDriveItems.map((item) => (
                    <button key={item.id} type="button" onClick={() => selectExpertDriveItem(item)}>
                      <Presentation size={16} />
                      <span>{item.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <AppButton
              variant="primary"
              disabled={!assignedRow || !expertDeckFile}
              onClick={() => {
                void sendDeckToBrand();
              }}
            >
              <UploadCloud size={18} /> Invia a revisione brand
            </AppButton>
          </div>
        </Panel>
      )}

      {expertStep === "Storico" && (
        <Panel
          title="Storico workshop"
          icon={<Presentation size={20} />}
          actions={
            <ToolIconButton onClick={() => refreshExpertSection("Storico")} label="Ricarica storico">
              <RefreshCw size={18} />
            </ToolIconButton>
          }
        >
          <div className="expert-history-list">
            <div className="info">
              <span>Storico reale</span>
              <strong>Nessun workshop completato registrato per questo esperto.</strong>
            </div>
          </div>
        </Panel>
      )}
      <BottomActionBar
        context={`Esperto · ${expertStep}`}
        detail={`${expertRows.length} opportunita · ${candidateCount} candidature inviate`}
        primaryLabel={expertMainAction.label}
        primaryDisabled={expertMainAction.disabled}
        onPrimary={expertMainAction.action}
      />
    </section>
  );
}

function BrandView({
  brandFilter,
  setBrandFilter,
  setProjectStatus,
  notify,
}: {
  brandFilter: string;
  setBrandFilter: (filter: string) => void;
  setProjectStatus: (status: ProjectStatus, title: string, body: string) => void;
  notify: (title: string, body: string) => void;
}) {
  const [brandDecks, setBrandDecks] = useState<BrandPresentation[]>([]);
  const [brandProjects, setBrandProjects] = useState<AdminProject[]>([]);
  const [selectedBrandProjectId, setSelectedBrandProjectId] = useState("");
  const [brandProjectLoading, setBrandProjectLoading] = useState(false);
  const [brandProjectError, setBrandProjectError] = useState("");
  const [selectedBrandDeckId, setSelectedBrandDeckId] = useState("");
  const [brandVersion, setBrandVersion] = useState(2);
  const [brandDriveLoading, setBrandDriveLoading] = useState(false);
  const [brandDriveError, setBrandDriveError] = useState("");
  const [brandDriveFolder, setBrandDriveFolder] = useState<{ name: string; url: string } | null>(null);
  const [reviewNote, setReviewNote] = useState("Uniformare chip topic, inserire logo nella cover, verificare disclaimer finale.");
  const [reviewChecklist, setReviewChecklist] = useState({
    clientLogo: false,
    contents: false,
    qrCode: false,
  });
  const brandItems = {
    Revisioni: brandDecks.filter((deck) => deck.status === "in_review"),
    "Da correggere": brandDecks.filter((deck) => deck.status === "changes_requested"),
    Approvate: brandDecks.filter((deck) => deck.status === "approved"),
    Storico: brandDecks.filter((deck) => deck.status === "archived"),
  };
  const selectedBrandDeck = brandDecks.find((deck) => deck.id === selectedBrandDeckId) ?? brandItems[brandFilter as keyof typeof brandItems][0];
  const selectedBrandProject = brandProjects.find((project) => project.id === selectedBrandProjectId) ?? brandProjects[0];
  const selectedDeckStatus = selectedBrandDeck?.status ?? "in_review";
  const selectedDeckPreviewUrl = selectedBrandDeck ? getDeckPreviewUrl(selectedBrandDeck) : "";
  const selectedDeckOpenUrl = selectedBrandDeck ? getDeckOpenUrl(selectedBrandDeck) : "";
  const selectedDeckStatusLabel: Record<BrandDeckStatus, string> = {
    in_review: "in revisione",
    changes_requested: "modifiche richieste",
    approved: "approvata",
    archived: "archiviata",
  };
  const updateDeckStatus = (status: BrandDeckStatus) => {
    if (!selectedBrandDeck) return;
    setBrandDecks((current) => current.map((deck) => (deck.id === selectedBrandDeck.id ? { ...deck, status } : deck)));
  };
  const refreshBrandProjects = (showFeedback = true) => {
    setBrandProjectLoading(true);
    setBrandProjectError("");
    listWorkshopRequests()
      .then((requests) => {
        const projects = requests
          .filter((request) => ["in_revisione_brand", "approvazione_finale", "confermato", "evento_provvisorio"].includes(request.status))
          .map(requestToAdminProject);
        setBrandProjects(projects);
        setSelectedBrandProjectId((current) => (projects.some((project) => project.id === current) ? current : projects[0]?.id ?? ""));
        if (!projects.length) setBrandProjectError("Nessun progetto reale in revisione brand nel registro.");
        if (showFeedback) notify(projects.length ? "Coda brand aggiornata" : "Nessun progetto brand", projects.length ? `${projects.length} progetti letti dal registro.` : "Il registro non contiene progetti in revisione brand.");
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : "Lettura progetti brand non riuscita.";
        setBrandProjectError(message);
        if (showFeedback) notify("Coda brand non aggiornata", message);
      })
      .finally(() => setBrandProjectLoading(false));
  };
  const persistBrandProjectStatus = async (status: ProjectStatus, eventType: string, note: string, deckStatus?: BrandDeckStatus) => {
    if (!selectedBrandProject) {
      notify("Nessun progetto selezionato", "Seleziona un progetto reale dalla coda brand.");
      return;
    }
    try {
      const request = await updateWorkshopRequest(
        selectedBrandProject.id,
        {
          status,
          materials: {
            ...(selectedBrandProject.request?.materials ?? {}),
            folderUrl: selectedBrandDeck ? getDeckOpenUrl(selectedBrandDeck) : selectedBrandProject.request?.materials?.folderUrl,
            folderName: selectedBrandDeck?.title ?? selectedBrandProject.request?.materials?.folderName,
          },
        },
        {
          type: eventType,
          note,
          payload: {
            deckId: selectedBrandDeck?.id,
            deckTitle: selectedBrandDeck?.title,
            deckStatus,
            reviewNote,
            checklist: reviewChecklist,
          },
        },
      );
      const project = requestToAdminProject(request);
      setBrandProjects((current) => current.map((item) => (item.id === project.id ? project : item)));
      setSelectedBrandProjectId(project.id);
      setProjectStatus(status, eventType === "brand_approved" ? "Brand approvato" : "Modifiche richieste", note);
      notify(eventType === "brand_approved" ? "Brand approvato" : "Modifiche richieste", `${project.company}: stato salvato sul registro.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Aggiornamento brand non salvato.";
      notify("Registro brand non aggiornato", message);
    }
  };
  const refreshBrandDrive = (showFeedback = true) => {
    setBrandDriveLoading(true);
    getBrandPresentations()
      .then((result) => {
        if (!result) {
          setBrandDriveError("Endpoint Apps Script non configurato.");
          return;
        }
        if (!Array.isArray(result.presentations)) {
          setBrandDriveError("Action brandPresentations non disponibile nel deploy Apps Script corrente.");
          return;
        }
        setBrandDriveFolder(result.folder ? { name: result.folder.name, url: result.folder.url } : null);
        if (!result.presentations.length) {
          setBrandDecks([]);
          setSelectedBrandDeckId("");
          setBrandDriveError("Nessuna presentazione trovata nella cartella configurata.");
          return;
        }
        setBrandDecks(result.presentations.map((deck) => ({ ...deck, source: "google-drive" })));
        setSelectedBrandDeckId(result.presentations[0].id);
        setBrandDriveError("");
        if (showFeedback) notify("Presentazioni aggiornate", `${result.presentations.length} deck riletti dalla cartella Drive.`);
      })
      .catch((error) => {
        setBrandDriveError(error instanceof Error ? error.message : "Sincronizzazione Drive non riuscita.");
      })
      .finally(() => {
        setBrandDriveLoading(false);
      });
  };

  useEffect(() => {
    refreshBrandDrive(false);
    refreshBrandProjects(false);
    return () => {
    };
  }, []);

  useEffect(() => {
    const currentQueue = brandItems[brandFilter as keyof typeof brandItems];
    if (currentQueue.some((deck) => deck.id === selectedBrandDeckId)) return;
    const firstDeck = currentQueue[0];
    setSelectedBrandDeckId(firstDeck?.id ?? "");
  }, [brandFilter, brandDecks]);
  const approveSelectedDeck = () => {
    if (!selectedBrandDeck && !selectedBrandProject) return;
    if (selectedBrandDeck) {
      const deckId = selectedBrandDeck.id;
      updateDeckStatus("approved");
      setSelectedBrandDeckId(deckId);
    }
    setBrandFilter("Approvate");
    void persistBrandProjectStatus("approvazione_finale", "brand_approved", "La versione brand-approved passa all'approvazione finale FunniFin/cliente.", "approved");
  };
  const requestDeckChanges = () => {
    if (!selectedBrandDeck && !selectedBrandProject) return;
    if (selectedBrandDeck) {
      const deckId = selectedBrandDeck.id;
      updateDeckStatus("changes_requested");
      setSelectedBrandDeckId(deckId);
    }
    setBrandFilter("Da correggere");
    void persistBrandProjectStatus("in_revisione_brand", "brand_changes_requested", "L'esperto vede le note e deve caricare una nuova versione.", "changes_requested");
  };
  const uploadDeckVersion = () => {
    if (!selectedBrandDeck) return;
    const deckId = selectedBrandDeck.id;
    setBrandDecks((current) =>
      current.map((deck) =>
        deck.id === selectedBrandDeck.id ? { ...deck, version: deck.version + 1, status: "in_review" as BrandDeckStatus } : deck,
      ),
    );
    setBrandVersion((version) => version + 1);
    setSelectedBrandDeckId(deckId);
    setBrandFilter("Revisioni");
    notify("Nuova versione caricata", `${selectedBrandDeck.title} aggiornato e rimesso in coda revisioni.`);
  };
  const brandMainAction = (() => {
    if (!selectedBrandDeck && !selectedBrandProject) return { label: "Nessun deck selezionato", disabled: true, action: () => {} };
    if (brandFilter === "Approvate") return { label: "Carica nuova versione", disabled: false, action: uploadDeckVersion };
    if (brandFilter === "Da correggere") return { label: "Carica nuova versione", disabled: false, action: uploadDeckVersion };
    if (brandFilter === "Storico") return { label: "Riapri revisione", disabled: false, action: uploadDeckVersion };
    return { label: "Approva brand", disabled: false, action: approveSelectedDeck };
  })();
  const queueIcons: Record<string, React.ReactNode> = {
    Revisioni: <Palette size={18} />,
    "Da correggere": <AlertCircle size={18} />,
    Approvate: <BadgeCheck size={18} />,
    Storico: <Presentation size={18} />,
  };

  return (
    <section className="view-stack">
      <RoleHero
        eyebrow="Area brand"
        title="Revisiona deck, note e versioni prima della conferma finale."
        subtitle={`${brandProjects.length} progetti reali · ${brandDecks.length} deck in Drive · ${brandItems.Revisioni.length} in revisione`}
        actions={
          brandDriveFolder?.url ? (
            <ToolIconButton onClick={() => window.open(brandDriveFolder.url, "_blank", "noopener,noreferrer")} label="Apri cartella Drive">
              <ExternalLink size={22} />
            </ToolIconButton>
          ) : undefined
        }
      />
      <OperatorIdentityCard identity={roleIdentities.Brand} />
      <Panel
        title="Progetti in revisione"
        icon={<BadgeCheck size={20} />}
        actions={
          <ToolIconButton onClick={() => refreshBrandProjects(true)} label="Ricarica progetti brand">
            <RefreshCw size={18} />
          </ToolIconButton>
        }
      >
        <div className="drive-sync-strip">
          <span>
            {brandProjectLoading && "Leggo progetti dal registro..."}
            {!brandProjectLoading && !brandProjectError && "Progetti reali letti da Google Sheet"}
            {!brandProjectLoading && brandProjectError}
          </span>
          <strong>{brandProjects.length} progetti</strong>
        </div>
        <div className="review-list">
          {brandProjects.map((project) => (
            <button
              key={project.id}
              className={`review-list-item ${selectedBrandProject?.id === project.id ? "active" : ""}`}
              onClick={() => setSelectedBrandProjectId(project.id)}
            >
              <BadgeCheck size={16} />
              <span>{project.company} · {statusLabel[project.status] ?? project.status}</span>
            </button>
          ))}
          {brandProjects.length === 0 && <span className="empty-selection">Nessun progetto in revisione brand.</span>}
        </div>
      </Panel>
      <Panel
        title="Revisione materiali brand"
        icon={<Palette size={20} />}
        actions={
          <ToolIconButton onClick={() => refreshBrandDrive(true)} label="Ricarica presentazioni Drive">
            <RefreshCw size={18} />
          </ToolIconButton>
        }
      >
        <div className="drive-sync-strip">
          <span>
            {brandDriveLoading && "Sincronizzo presentazioni Drive..."}
            {!brandDriveLoading && !brandDriveError && `Presentazioni reali da ${brandDriveFolder?.name || "Google Drive"}`}
            {!brandDriveLoading && brandDriveError}
          </span>
          <strong>{brandDecks.length} deck</strong>
        </div>
        <div className="brand-workbench">
          <div className="brand-queue-card">
            <span>Coda materiali</span>
            {Object.entries(brandItems).map(([label, items]) => (
              <button
                key={label}
                className={brandFilter === label ? "active" : ""}
                onClick={() => setBrandFilter(label)}
              >
                {queueIcons[label]}
                <span>{label}</span>
                <strong>{items.length}</strong>
              </button>
            ))}
          </div>
          <div className="brand-review-area">
            <div className="review-list">
              {brandItems[brandFilter as keyof typeof brandItems].map((item) => (
                <button key={item.id} className={`review-list-item ${selectedBrandDeck?.id === item.id ? "active" : ""}`} onClick={() => setSelectedBrandDeckId(item.id)}>
                  <Presentation size={16} />
                  <span>{item.title}_v{String(item.version).padStart(2, "0")}</span>
                </button>
              ))}
              {brandItems[brandFilter as keyof typeof brandItems].length === 0 && (
                <span className="empty-selection">Nessun deck in questa coda.</span>
              )}
            </div>
            {!selectedBrandDeck ? (
              <div className="brand-empty-state">
                <Presentation size={42} />
                <strong>Nessuna presentazione da revisionare</strong>
                <span>Quando arriva un deck nella cartella Drive del progetto, lo trovi qui con anteprima, note e stato di revisione.</span>
                {brandDriveFolder?.url && (
                  <AppButton variant="secondary" onClick={() => window.open(brandDriveFolder.url, "_blank", "noopener,noreferrer")}>
                    <ExternalLink size={17} /> Apri Drive
                  </AppButton>
                )}
              </div>
            ) : (
              <div className="brand-review">
                <div className="deck-preview">
                  {selectedDeckPreviewUrl ? (
                    <iframe title={`Anteprima ${selectedBrandDeck.title}`} src={selectedDeckPreviewUrl} loading="lazy" allowFullScreen />
                  ) : (
                    <div className="deck-preview-empty">
                      <Presentation size={42} />
                      <strong>{selectedBrandDeck.title}</strong>
                      <span>Anteprima non disponibile: apri il file in Slides/Drive.</span>
                    </div>
                  )}
                  <div className="deck-preview-meta">
                    <span className={`review-status-badge ${selectedDeckStatus}`}>{selectedDeckStatusLabel[selectedDeckStatus]}</span>
                    <strong>{selectedBrandDeck.title}</strong>
                    <span>{selectedBrandDeck.client} · versione v{String(selectedBrandDeck.version).padStart(2, "0")}</span>
                    <AppButton
                      variant="outline"
                      disabled={!selectedDeckOpenUrl}
                      onClick={() => {
                        if (!selectedDeckOpenUrl) {
                          notify("Link non disponibile", "Il file non espone un URL Drive/Slides apribile.");
                          return;
                        }
                        window.open(selectedDeckOpenUrl, "_blank", "noopener,noreferrer");
                      }}
                    >
                      <Presentation size={18} /> Apri in Slides
                    </AppButton>
                  </div>
                </div>
                <div className="review-fields">
                  <div className="brand-review-info">
                    <Info label="Progetto" value={selectedBrandProject?.company ?? "Nessun progetto collegato"} />
                    <Info label="Cliente" value={selectedBrandDeck.client} />
                    <Info label="Workshop" value={selectedBrandDeck.workshop} />
                    <Info label="Esperto" value={selectedBrandDeck.expert} />
                    <Info label="Origine" value={selectedBrandDeck.source === "google-drive" ? selectedBrandDeck.folderName || "Google Drive" : "Demo"} />
                    <Info label="Aggiornata" value={selectedBrandDeck.updatedAt || "Non disponibile"} />
                  </div>
                  <div className="brand-checklist">
                    {[
                      ["clientLogo", "Logo cliente:"],
                      ["contents", "Contenuti;"],
                      ["qrCode", "Qrcode aggiornato:"],
                    ].map(([id, label]) => (
                      <label className="check-row" key={id}>
                        <input
                          type="checkbox"
                          checked={reviewChecklist[id as keyof typeof reviewChecklist]}
                          onChange={(event) => setReviewChecklist({ ...reviewChecklist, [id]: event.target.checked })}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                  <label>
                    Note revisione
                    <textarea value={reviewNote} onChange={(event) => setReviewNote(event.target.value)} />
                  </label>
                  <div className="button-row compact-actions">
                    <ActionIconButton variant="success" onClick={approveSelectedDeck} label="Approva brand">
                      <Check size={18} />
                    </ActionIconButton>
                    <ActionIconButton onClick={requestDeckChanges} label="Richiedi modifiche">
                      <AlertCircle size={18} />
                    </ActionIconButton>
                    <ActionIconButton onClick={uploadDeckVersion} label="Carica nuova versione">
                      <UploadCloud size={18} />
                    </ActionIconButton>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </Panel>
      <BottomActionBar
        context={`Brand · ${brandFilter}`}
        detail={selectedBrandDeck ? `${selectedBrandDeck.title} · ${selectedDeckStatusLabel[selectedDeckStatus]}` : "Nessun deck reale trovato in Drive"}
        primaryLabel={brandMainAction.label}
        primaryDisabled={brandMainAction.disabled}
        onPrimary={brandMainAction.action}
        secondaryLabel={brandFilter === "Revisioni" && selectedBrandDeck ? "Richiedi modifiche" : undefined}
        onSecondary={brandFilter === "Revisioni" ? requestDeckChanges : undefined}
      />
    </section>
  );
}

function WorkshopCard({
  workshop,
  selection,
  onToggle,
  onChange,
  onCustomRequest,
  onCustomInfo,
}: {
  workshop: Workshop;
  selection?: Selection;
  onToggle: (event: React.MouseEvent<HTMLButtonElement>) => void;
  onChange: (patch: Partial<Selection>) => void;
  onCustomRequest: () => void;
  onCustomInfo: () => void;
}) {
  const selectedPrice = selection?.duration === "2h" ? workshop.price2h : workshop.price1h;
  const topic = topics.find((item) => item.id === workshop.topicId);
  const theme = topic?.themes.find((item) => item.id === workshop.themeId);
  return (
    <article className={`workshop-card ${selection ? "selected" : ""}`}>
      <div className="workshop-card-top">
        <span>{topic?.title} · {theme?.title}</span>
      </div>
      <div className="workshop-head">
        <div>
          <strong>{workshop.title}</strong>
        </div>
      </div>
      <p>{workshop.short}</p>
      <div className="meta-grid">
        <span>
          <Clock3 size={15} /> {workshop.durationOptions.join(" / ")}
        </span>
        <span>
          <Video size={15} /> {workshop.formatOptions.join(" / ")} · {workshop.level.toUpperCase()}
        </span>
        <span>
          <UsersRound size={15} /> {workshop.participants}
        </span>
      </div>
      {selection && (
        <div className="config-row">
          <select value={selection.duration} onChange={(event) => onChange({ duration: event.target.value as Duration })}>
            {workshop.durationOptions.map((duration) => (
              <option key={duration}>{duration}</option>
            ))}
          </select>
          <select value={selection.format} onChange={(event) => onChange({ format: event.target.value as Format })}>
            {workshop.formatOptions.map((format) => (
              <option key={format}>{format}</option>
            ))}
          </select>
          {workshop.customAvailable && (
            <div className={`custom-preview-toggle ${selection.custom ? "active" : ""}`}>
              <button
                type="button"
                className="custom-check-button"
                onClick={() => {
                  if (selection.custom) onChange({ custom: false, customNote: "" });
                  else onCustomRequest();
                }}
                aria-pressed={selection.custom}
              >
                <span>{selection.custom ? <Check size={16} /> : <Plus size={16} />}</span>
                <strong>Rendi su misura</strong>
                <em>+{money(workshop.customExtra)}</em>
              </button>
              <p>Adattiamo esempi, tono e casi pratici al pubblico aziendale.</p>
              {selection.customNote && <small>{selection.customNote}</small>}
              <button type="button" className="icon-help" onClick={onCustomInfo} aria-label="Spiega su misura">
                <InfoIcon size={16} />
              </button>
            </div>
          )}
        </div>
      )}
      <div className="card-footer">
        <strong>{money(selectedPrice || workshop.price1h)}</strong>
        <AppButton variant={selection ? "dangerIcon" : "secondary"} onClick={onToggle} aria-label={selection ? `Rimuovi ${workshop.title}` : `Aggiungi ${workshop.title} al percorso`}>
          {selection ? <Trash2 size={18} /> : "Aggiungi al percorso"}
        </AppButton>
      </div>
    </article>
  );
}

function QuoteStrip({
  selections,
  quote,
  coveredTopics,
  coveredThemes,
  totalHours,
  onCta,
}: {
  selections: Selection[];
  quote: ReturnType<typeof useQuotePlaceholder>;
  coveredTopics: number;
  coveredThemes: number;
  totalHours: number;
  onCta?: () => void;
}) {
  return (
    <section className="quote-strip">
      <div>
        <span>Workshop</span>
        <strong>{selections.length}</strong>
      </div>
      <div>
        <span>Topic</span>
        <strong>{coveredTopics}</strong>
      </div>
      <div>
        <span>Temi</span>
        <strong>{coveredThemes}</strong>
      </div>
      <div>
        <span>Durata</span>
        <strong>{totalHours}h</strong>
      </div>
      <div className="quote-strip-total">
        <span>{quote.rule.name}</span>
        <strong>{money(quote.total)}</strong>
      </div>
      <AppButton variant="secondary" onClick={onCta} aria-label="Vai all'invio richiesta">
        <Send size={17} /> Invia
      </AppButton>
    </section>
  );
}

function ExpertCandidateModal({
  row,
  company,
  sending,
  onClose,
  onConfirm,
}: {
  row: { selection: Selection; workshop: Workshop };
  company: string;
  sending: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { selection, workshop } = row;
  const price = selection.duration === "2h" ? workshop.price2h : workshop.price1h;
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="expert-candidate-title">
      <section className="custom-modal expert-candidate-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">Candidatura esperto</span>
            <h2 id="expert-candidate-title">Confermi la candidatura?</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi" disabled={sending}>
            <X size={18} />
          </button>
        </header>
        <div className="modal-body">
          <div className="candidate-confirm-card">
            <span className="workshop-badge">{workshop.level}</span>
            <strong>{workshop.title}</strong>
            <p>{workshop.short}</p>
            <div className="opportunity-meta">
              <Info label="Cliente" value={company} />
              <Info label="Formato" value={`${selection.duration} · ${selection.format}`} />
              <Info label="Data proposta" value={`${selection.date || "da proporre"} ${selection.time}`} />
              <Info label="Valore" value={money(price)} />
            </div>
          </div>
          <div className="modal-points">
            <span>
              <Check size={16} />
              La candidatura viene registrata sulla coda FunniFin.
            </span>
            <span>
              <Send size={16} />
              Parte una mail interna solo a FunniFin.
            </span>
            <span>
              <AlertCircle size={16} />
              Questa schermata e la conferma dopo il click “Mi candido” ricevuto via mail.
            </span>
          </div>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose} disabled={sending}>
            Annulla
          </AppButton>
          <AppButton variant="secondary" onClick={onConfirm} disabled={sending}>
            <Send size={17} /> {sending ? "Invio..." : "Conferma candidatura"}
          </AppButton>
        </footer>
      </section>
    </div>
  );
}

function RemoveWorkshopButton({ onClick, label, compact }: { onClick: () => void; label: string; compact?: boolean }) {
  return (
    <AppButton variant="dangerIcon" className={compact ? "compact" : ""} onClick={onClick} aria-label={`Rimuovi ${label}`} title={`Rimuovi ${label}`}>
      <Trash2 size={compact ? 16 : 18} />
    </AppButton>
  );
}

function EmptyWorkflowState({
  title,
  body,
  cta,
  onClick,
}: {
  title: string;
  body: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="empty-state workflow-empty">
      <strong>{title}</strong>
      <span>{body}</span>
      <AppButton variant="secondary" onClick={onClick}>
        {cta}
      </AppButton>
    </div>
  );
}

function ReadinessPanel({
  rows,
  missingDateRows,
}: {
  rows: Array<{ selection: Selection; workshop: Workshop }>;
  missingDateRows: Array<{ selection: Selection; workshop: Workshop }>;
}) {
  const checks = [
    { label: "Percorso configurato", done: rows.length > 0, detail: rows.length ? `${rows.length} workshop` : "Aggiungi almeno un workshop" },
    { label: "Date proposte", done: rows.length > 0 && missingDateRows.length === 0, detail: missingDateRows.length ? `${missingDateRows.length} mancanti` : "Tutte compilate" },
    { label: "Preventivo", done: rows.length > 0, detail: rows.length ? "Totale calcolato" : "Non disponibile" },
  ];

  return (
    <section className="readiness-panel" aria-label="Checklist invio richiesta">
      {checks.map((check) => (
        <div className={check.done ? "done" : ""} key={check.label}>
          {check.done ? <Check size={18} /> : <Clock3 size={18} />}
          <span>
            <strong>{check.label}</strong>
            <em>{check.detail}</em>
          </span>
        </div>
      ))}
    </section>
  );
}

function SelectedInterestSummary({
  topics,
  activeThemeIds,
  onRemoveTopic,
  onRemoveTheme,
  context = "default",
}: {
  topics: Topic[];
  activeThemeIds: string[];
  onRemoveTopic: (topicId: string) => void;
  onRemoveTheme: (themeId: string) => void;
  context?: "default" | "filters";
}) {
  const title = context === "filters" ? "Interessi scelti" : "Percorso scelto";

  if (topics.length === 0) {
    return <p className="empty-selection">Seleziona uno o piu interessi per filtrare temi e workshop.</p>;
  }

  return (
    <section className={`selected-interests ${context === "filters" ? "in-filter-panel" : ""}`} aria-label={title}>
      <div className="selected-interests-head">
        <strong>{title}</strong>
        <span>{topics.length} interessi · {activeThemeIds.length} temi</span>
      </div>
      {topics.map((topic) => (
        <article key={topic.id} className={`selected-interest-card ${topicColorClass(topic.id)}`}>
          <div className="selected-interest-title">
            <span className="topic-badge">{topic.badge}</span>
            <strong>{topic.title}</strong>
            <button onClick={() => onRemoveTopic(topic.id)} aria-label={`Rimuovi ${topic.title}`}>
              <X size={16} />
            </button>
          </div>
          <div className="selected-interest-themes">
            {topic.themes.filter((theme) => activeThemeIds.includes(theme.id)).map((theme) => (
              <span key={theme.id}>
                {theme.title}
                <button onClick={() => onRemoveTheme(theme.id)} aria-label={`Rimuovi ${theme.title}`}>
                  <X size={13} />
                </button>
              </span>
            ))}
            {topic.themes.every((theme) => !activeThemeIds.includes(theme.id)) && <em>Nessun tema attivo</em>}
          </div>
        </article>
      ))}
    </section>
  );
}

function EcommerceCart({
  rows,
  quote,
  onRemove,
  onSubmit,
}: {
  rows: Array<{ selection: Selection; workshop: Workshop }>;
  quote: ReturnType<typeof useQuotePlaceholder>;
  onRemove: (workshopId: string) => void;
  onSubmit: () => void;
}) {
  const cartRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const updateCartHeight = () => {
      const node = cartRef.current;
      if (!node) return;
      const top = Math.max(8, Math.round(node.getBoundingClientRect().top));
      node.style.setProperty("--cart-visible-top", `${top}px`);
    };
    updateCartHeight();
    window.addEventListener("resize", updateCartHeight);
    window.addEventListener("scroll", updateCartHeight, { passive: true });
    return () => {
      window.removeEventListener("resize", updateCartHeight);
      window.removeEventListener("scroll", updateCartHeight);
    };
  }, [rows.length]);

  return (
    <aside ref={cartRef} className="ecommerce-cart" aria-label="Carrello workshop">
      <button className="cart-head" type="button">
        <div>
          <span>Carrello</span>
          <strong>{rows.length} workshop</strong>
        </div>
        <div className="cart-head-total">
          <strong>{money(quote.total)}</strong>
        </div>
      </button>

      <>
        <div className="cart-lines">
            {rows.length === 0 && <p>Seleziona un workshop dal catalogo.</p>}
            {rows.map(({ selection, workshop }) => {
              const base = selection.duration === "2h" ? workshop.price2h : workshop.price1h;
              return (
                <div className="cart-line" key={workshop.id}>
                  <div>
                    <strong>{workshop.title}</strong>
                    <span>
                      {selection.duration} · {selection.format}
                      {selection.custom ? ` · su misura +${money(workshop.customExtra)}` : ""}
                      {selection.promo ? " · promo data" : ""}
                    </span>
                  </div>
                  <div className="cart-line-price">
                    <strong>{money(base + (selection.custom ? workshop.customExtra : 0))}</strong>
                    <RemoveWorkshopButton onClick={() => onRemove(workshop.id)} label={workshop.title} compact />
                  </div>
                </div>
              );
            })}
        </div>

        <div className="cart-totals">
            <Line label="Subtotale workshop" value={money(quote.gross)} />
            {quote.quantityDiscount > 0 && <Line label={quote.rule.name} value={`-${money(quote.quantityDiscount)}`} good />}
            {quote.promoDiscount > 0 && <Line label="Date promo" value={`-${money(quote.promoDiscount)}`} good />}
            {quote.customTotal > 0 && <Line label="Su misura" value={`+${money(quote.customTotal)}`} />}
            <div className="total-line">
              <span>Totale</span>
              <strong>{money(quote.total)}</strong>
            </div>
            {quote.saved > 0 && <div className="saving">Risparmio: {money(quote.saved)}</div>}
        </div>
      </>

      <div className="cart-submit-row">
        <AppButton variant="secondary" onClick={onSubmit} disabled={rows.length === 0}>
          <Send size={17} /> Invia
        </AppButton>
      </div>
    </aside>
  );
}

function Stepper({ steps, activeStep, onStep }: { steps: string[]; activeStep: string; onStep: (step: string) => void }) {
  return (
    <div className="stepper">
      {steps.map((step, index) => (
        <button key={step} className={step === activeStep ? "active" : index < steps.indexOf(activeStep) ? "done" : ""} onClick={() => onStep(step)}>
          {index + 1}. {step}
        </button>
      ))}
    </div>
  );
}

function OperationalStrip({
  label,
  items,
}: {
  label: string;
  items: Array<{ id: string; label: string; value: number | string; icon: React.ReactNode; active?: boolean; onClick: () => void }>;
}) {
  return (
    <div className="operational-strip" aria-label={label}>
      {items.map((item) => (
        <button key={item.id} className={item.active ? "active" : ""} onClick={item.onClick}>
          {item.icon}
          <span>{item.label}</span>
          <strong>{item.value}</strong>
        </button>
      ))}
    </div>
  );
}

function ExpertProfileModal({
  expert,
  catalogThemeRows,
  onClose,
  onDelete,
  onChange,
  onSave,
}: {
  expert: ExpertProfile;
  catalogThemeRows: Array<Theme & { topicId: string; topicTitle: string }>;
  onClose: () => void;
  onDelete: () => void;
  onChange: (patch: Partial<ExpertProfile>) => void;
  onSave: () => void;
}) {
  const fullName = `${expert.firstName} ${expert.lastName}`.trim();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="expert-profile-title">
      <section className="custom-modal expert-profile-modal">
        <header className="modal-header expert-profile-header">
          <div className="expert-modal-title">
            <div className="expert-avatar large">{expert.photo ? <img src={expert.photo} alt="" /> : `${expert.firstName[0] ?? ""}${expert.lastName[0] ?? ""}`}</div>
            <div>
              <span className="topic-badge">Pool esperti</span>
              <h2 id="expert-profile-title">Modifica profilo</h2>
              <em>{fullName || "Nuovo esperto"} · {expert.email}</em>
            </div>
          </div>
          <div className="row-actions compact-actions">
            <ActionIconButton variant="danger" onClick={onDelete} label="Elimina esperto">
              <Trash2 size={17} />
            </ActionIconButton>
            <button className="modal-close" onClick={onClose} aria-label="Chiudi">
              x
            </button>
          </div>
        </header>
        <div className="modal-body">
          <div className="modal-stack">
            <div className="contact-grid">
              <label>
                Nome
                <input value={expert.firstName} onChange={(event) => onChange({ firstName: event.target.value })} />
              </label>
              <label>
                Cognome
                <input value={expert.lastName} onChange={(event) => onChange({ lastName: event.target.value })} />
              </label>
              <label>
                Email utenza
                <input value={expert.email} onChange={(event) => onChange({ email: event.target.value })} />
              </label>
              <label>
                Foto URL
                <input value={expert.photo} onChange={(event) => onChange({ photo: event.target.value })} />
              </label>
              <label>
                Disponibilita
                <input value={expert.availability} onChange={(event) => onChange({ availability: event.target.value })} />
              </label>
            </div>
            <label className="full-field">
              Breve descrizione
              <textarea value={expert.bio} onChange={(event) => onChange({ bio: event.target.value })} />
            </label>
            <div className="expert-association-block">
              <strong>Interessi associati</strong>
              <div className="catalog-theme-chips">
                {topics.map((topic) => {
                  const active = expert.topicIds.includes(topic.id);
                  return (
                    <button
                      key={topic.id}
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() => {
                        const topicThemeIds = topic.themes.map((theme) => theme.id);
                        onChange({
                          topicIds: active ? expert.topicIds.filter((id) => id !== topic.id) : [...expert.topicIds, topic.id],
                          themeIds: active
                            ? expert.themeIds.filter((id) => !topicThemeIds.includes(id))
                            : [...new Set([...expert.themeIds, ...topicThemeIds])],
                        });
                      }}
                    >
                      {topic.title}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="expert-association-block">
              <strong>Temi associati</strong>
              <div className="catalog-theme-chips">
                {catalogThemeRows.map((theme) => {
                  const active = expert.themeIds.includes(theme.id);
                  return (
                    <button
                      key={`${theme.topicId}-${theme.id}`}
                      type="button"
                      className={active ? "active" : ""}
                      onClick={() =>
                        onChange({
                          themeIds: active ? expert.themeIds.filter((id) => id !== theme.id) : [...expert.themeIds, theme.id],
                        })
                      }
                    >
                      {theme.title}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose}>
            Annulla
          </AppButton>
          <AppButton variant="primary" onClick={onSave}>
            Salva profilo
          </AppButton>
        </footer>
      </section>
    </div>
  );
}

function AdminActionModal({
  modal,
  rows,
  project,
  recipientEmails,
  eventPrechecks,
  eventRecord,
  canConfirmEvent,
  rules,
  expertCount,
  onClose,
  onConfirmDate,
  onConfirmExpert,
  onInviteExperts,
  onConfirmBrandHandoff,
  onConfirmEvent,
  onSaveRequestEdit,
  onSaveRule,
}: {
  modal: AdminActionModalState;
  rows: AdminProjectWorkshopRow[];
  project: AdminProject;
  recipientEmails: Partial<Record<WorkflowNotificationRecipientRole, string>>;
  eventPrechecks: Array<{ label: string; done: boolean }>;
  eventRecord?: CalendarEventRecord;
  canConfirmEvent: boolean;
  rules: PricingRule[];
  expertCount: number;
  onClose: () => void;
  onConfirmDate: (workshopId: string, decision: DateDecision, notification: NotificationChoice) => void;
  onConfirmExpert: (workshopId: string, expertName: string, mode: "assign" | "reassign", notification: NotificationChoice) => void;
  onInviteExperts: (notification: NotificationChoice) => void;
  onConfirmBrandHandoff: (notification: NotificationChoice) => void;
  onConfirmEvent: (notification: NotificationChoice) => void;
  onSaveRequestEdit: (records: RequestWorkshopRecord[], notification: NotificationChoice) => void;
  onSaveRule: (ruleId: string, patch: Partial<PricingRule>) => void;
}) {
  const rule = modal.type === "price" ? rules.find((item) => item.id === modal.ruleId) ?? rules[0] : rules[0];
  const [draftRule, setDraftRule] = useState({
    name: rule?.name ?? "",
    min: rule?.min ?? 1,
    max: rule?.max ?? 1,
    discountPercent: rule?.discountPercent ?? 0,
    specialQuote: Boolean(rule?.specialQuote),
  });
  const notificationContextKey = rows.map((row) => `${row.workshop.id}:${row.approval}`).join("|");
  const [notification, setNotification] = useState<NotificationChoice>(() => getDefaultNotificationChoice(modal, rows));
  const [selectedExpertWorkshopId, setSelectedExpertWorkshopId] = useState(
    modal.type === "expert" ? modal.workshopId ?? rows[0]?.workshop.id ?? "" : "",
  );
  const [requestDraft, setRequestDraft] = useState<Record<string, RequestWorkshopRecord>>(() => {
    if (modal.type !== "edit_request") return {};
    return Object.fromEntries(
      rows.map((row) => [
        row.workshop.id,
        {
          workshopId: row.workshop.id,
          title: row.workshop.title,
          duration: row.duration,
          format: row.format,
          date: row.date,
          time: row.time,
          price: row.duration === "2h" ? row.workshop.price2h : row.workshop.price1h,
          custom: false,
          status: "selezionato",
          approval: row.approval,
          expertName: row.assignedExpert,
        } satisfies RequestWorkshopRecord,
      ]),
    );
  });

  useEffect(() => {
    setDraftRule({
      name: rule?.name ?? "",
      min: rule?.min ?? 1,
      max: rule?.max ?? 1,
      discountPercent: rule?.discountPercent ?? 0,
      specialQuote: Boolean(rule?.specialQuote),
    });
  }, [rule?.id, rule?.name, rule?.min, rule?.max, rule?.discountPercent, rule?.specialQuote]);
  useEffect(() => {
    setNotification(getDefaultNotificationChoice(modal, rows));
  }, [modal, notificationContextKey]);
  useEffect(() => {
    if (modal.type === "expert") setSelectedExpertWorkshopId(modal.workshopId ?? rows[0]?.workshop.id ?? "");
  }, [modal, notificationContextKey]);
  useEffect(() => {
    if (modal.type !== "edit_request") return;
    setRequestDraft(
      Object.fromEntries(
        rows.map((row) => [
          row.workshop.id,
          {
            workshopId: row.workshop.id,
            title: row.workshop.title,
            duration: row.duration,
            format: row.format,
            date: row.date,
            time: row.time,
            price: row.duration === "2h" ? row.workshop.price2h : row.workshop.price1h,
            custom: false,
            status: "selezionato",
            approval: row.approval,
            expertName: row.assignedExpert,
          } satisfies RequestWorkshopRecord,
        ]),
      ),
    );
  }, [modal, notificationContextKey]);

  const row =
    modal.type === "date"
      ? rows.find((item) => item.workshop.id === modal.workshopId)
      : modal.type === "expert"
        ? rows.find((item) => item.workshop.id === selectedExpertWorkshopId)
        : undefined;
  const editedRecords = Object.values(requestDraft);
  const editedQuoteTotal = editedRecords.reduce((total, record) => {
    const workshop = workshops.find((item) => item.id === record.workshopId);
    if (!workshop) return total;
    return total + (record.duration === "2h" ? workshop.price2h : workshop.price1h);
  }, 0);
  const toggleDraftWorkshop = (workshop: Workshop) => {
    setRequestDraft((current) => {
      if (current[workshop.id]) {
        const next = { ...current };
        delete next[workshop.id];
        return next;
      }
      return {
        ...current,
        [workshop.id]: {
          workshopId: workshop.id,
          title: workshop.title,
          duration: workshop.durationOptions[0],
          format: workshop.formatOptions[0],
          date: "",
          time: "10:00",
          price: workshop.price1h,
          custom: false,
          status: "selezionato",
          approval: "pending",
        },
      };
    });
  };
  const updateDraftWorkshop = (workshopId: string, patch: Partial<RequestWorkshopRecord>) => {
    setRequestDraft((current) => ({
      ...current,
      [workshopId]: {
        ...current[workshopId],
        ...patch,
      },
    }));
  };
  const decisionCopy: Record<DateDecision, { title: string; action: string; body: string }> = {
    approved: {
      title: "Approva data",
      action: "Approva data",
      body: "La data passera come validata da FunniFin e il progetto potra avanzare quando tutte le date sono approvate.",
    },
    change_requested: {
      title: "Chiedi modifica data",
      action: "Chiedi modifica",
      body: "Il cliente dovra proporre una nuova opzione per questo workshop.",
    },
    rejected: {
      title: "Rifiuta data",
      action: "Rifiuta data",
      body: "La proposta viene marcata come rifiutata e resta da sostituire prima di aprire le candidature.",
    },
  };
  const title =
    modal.type === "edit_request"
      ? "Modifica richiesta cliente"
      : modal.type === "date"
      ? decisionCopy[modal.decision].title
      : modal.type === "expert"
        ? modal.mode === "reassign"
          ? "Riapri assegnazione esperto"
          : "Assegna esperto"
        : modal.type === "open_candidacies"
          ? "Invita esperti"
        : modal.type === "brand_handoff"
          ? "Manda a brand"
        : modal.type === "price"
          ? "Modifica regola prezzo"
          : "Conferma evento";
  const showNotification = modal.type === "edit_request" || modal.type === "date" || modal.type === "expert" || modal.type === "open_candidacies" || modal.type === "brand_handoff" || modal.type === "confirm_event";
  const showImpact = showNotification || modal.type === "price";
  const normalizedDiscount = Math.min(100, Math.max(0, Number(draftRule.discountPercent) || 0));
  const normalizedMin = Math.max(1, Number(draftRule.min) || 1);
  const normalizedMax = Math.max(normalizedMin, Number(draftRule.max) || normalizedMin);
  const pricePreviewCount = normalizedMax >= 99 ? Math.max(normalizedMin, 6) : normalizedMax;
  const pricePreviewGross = pricePreviewCount * 1000;
  const pricePreviewTotal = Math.round(pricePreviewGross * (1 - normalizedDiscount / 100));
  const selectedRecipients = notification.recipients.map((role) => `${recipientLabels[role]} · ${role === "client" ? project.email : recipientEmails[role] || SECRET_SETTINGS.google.email.testRecipients[role]}`);
  const emailImpact = notification.send && selectedRecipients.length > 0
    ? `Email: parte alla conferma verso ${selectedRecipients.join(" / ")}.`
    : "Email: non parte nessuna email alla conferma.";
  const workflowImpact = (() => {
    if (modal.type === "edit_request") {
      return [
        `Richiesta: salva ${editedRecords.length} workshop e aggiorna il preventivo a ${money(editedQuoteTotal)} + IVA.`,
        emailImpact,
        "Calendario: non crea eventi e non approva date; corregge solo la configurazione della richiesta.",
        "Audit: la modifica viene registrata nel record richiesta reale.",
      ];
    }
    if (modal.type === "date") {
      const completesAllDates =
        modal.decision === "approved" &&
        rows.length > 0 &&
        rows.every((item) => (item.workshop.id === modal.workshopId ? "approved" : item.approval) === "approved");
      return [
        `Stato: ${modal.decision === "approved" ? (completesAllDates ? "tutte le date risultano approvate" : "approva solo questa data") : modal.decision === "change_requested" ? "richiede una nuova proposta data" : "marca la proposta come rifiutata"}.`,
        emailImpact,
        "Calendario: non crea ancora eventi; la creazione avviene nello step Conferma.",
        "Catalogo/Drive: non cambia catalogo ne slide, usa solo il workshop gia selezionato.",
      ];
    }
    if (modal.type === "expert") {
      return [
        `Stato: ${modal.mode === "reassign" ? "toglie l'esperto e riapre la candidatura" : `assegna ${modal.expertName || "l'esperto selezionato"} al workshop scelto`}.`,
        emailImpact,
        "Calendario: non crea eventi e non invita l'esperto a calendario in questa fase.",
        "Catalogo/Drive: mantiene nomi workshop e slide operative gia collegate al catalogo.",
      ];
    }
    if (modal.type === "open_candidacies") {
      return [
        "Stato: apre il progetto agli esperti compatibili.",
        emailImpact,
        "Email esperto: contiene riepilogo workshop e CTA 'Mi candido' che porta alla vista Esperto.",
        "Dopo il click: l'esperto conferma la candidatura e parte notifica interna solo a FunniFin.",
      ];
    }
    if (modal.type === "brand_handoff") {
      return [
        "Stato: porta il progetto in revisione brand.",
        emailImpact,
        "Calendario: non crea eventi; la revisione brand precede la conferma finale.",
        "Catalogo/Drive: usa le slide operative collegate e passa i deck al flusso brand.",
      ];
    }
    if (modal.type === "confirm_event") {
      return [
        `Stato: crea un evento ${notification.eventMode === "tentative" ? "provvisorio" : "definitivo"} e aggiorna il progetto.`,
        emailImpact,
        `Calendario: crea evento Google Calendar ${notification.eventMode === "tentative" ? "provvisorio" : "confermato"} con Meet e workshop collegati.`,
        "Catalogo/Drive: collega materiali e presentazioni operative gia mappate, senza rinominare il catalogo.",
      ];
    }
    if (modal.type === "price") {
      return [
        `Prezzi: salva "${draftRule.name || rule.name}" per ${normalizedMin}-${normalizedMax >= 99 ? "6+" : normalizedMax} workshop.`,
        draftRule.specialQuote ? "Preventivo: il cliente vede percorso su preventivo, senza prezzo automatico finale." : `Preventivo: esempio ${pricePreviewCount} workshop passa da ${money(pricePreviewGross)} a ${money(pricePreviewTotal)}.`,
        "Email: non invia comunicazioni.",
        "Catalogo: non modifica workshop o slide, cambia solo la regola commerciale applicata.",
      ];
    }
    return [];
  })();

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="admin-action-title">
      <section className="custom-modal admin-action-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">FunniFin</span>
            <h2 id="admin-action-title">{title}</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body">
          {modal.type === "edit_request" && (
            <div className="modal-stack">
              <p>
                Correggi la richiesta cliente da FunniFin: puoi aggiungere o togliere workshop, modificare formato, durata, date e totale prima di procedere.
              </p>
              <div className="request-edit-summary">
                <Info label="Cliente" value={project.company} />
                <Info label="Workshop" value={`${editedRecords.length} selezionati`} />
                <Info label="Preventivo aggiornato" value={`${money(editedQuoteTotal)} + IVA`} />
              </div>
              <div className="request-edit-list" aria-label="Modifica workshop richiesta">
                {workshops.map((workshop) => {
                  const draft = requestDraft[workshop.id];
                  const selected = Boolean(draft);
                  return (
                    <article className={selected ? "selected" : ""} key={workshop.id}>
                      <button type="button" className="request-edit-toggle" onClick={() => toggleDraftWorkshop(workshop)}>
                        {selected ? <Check size={17} /> : <Plus size={17} />}
                      </button>
                      <div className="request-edit-main">
                        <strong>{workshop.title}</strong>
                        <span>{workshop.durationOptions.join(" / ")} · {workshop.formatOptions.join(" / ")} / {workshop.level.toUpperCase()}</span>
                      </div>
                      {selected && (
                        <div className="request-edit-controls">
                          <label>
                            Durata
                            <select value={draft.duration} onChange={(event) => updateDraftWorkshop(workshop.id, { duration: event.target.value as Duration })}>
                              {workshop.durationOptions.map((duration) => (
                                <option key={duration} value={duration}>{duration}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Formato
                            <select value={draft.format} onChange={(event) => updateDraftWorkshop(workshop.id, { format: event.target.value as Format })}>
                              {workshop.formatOptions.map((format) => (
                                <option key={format} value={format}>{format}</option>
                              ))}
                            </select>
                          </label>
                          <label>
                            Data
                            <input value={draft.date} type="date" onChange={(event) => updateDraftWorkshop(workshop.id, { date: event.target.value, approval: "pending" })} />
                          </label>
                          <label>
                            Ora
                            <input value={draft.time} type="time" onChange={(event) => updateDraftWorkshop(workshop.id, { time: event.target.value })} />
                          </label>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
              {editedRecords.length === 0 && <p className="modal-warning">Lascia almeno un workshop nella richiesta.</p>}
            </div>
          )}
          {modal.type === "date" && row && (
            <div className="modal-stack">
              <p>{decisionCopy[modal.decision].body}</p>
              <div className="modal-points single">
                <Info label="Workshop" value={row.workshop.title} />
                <Info label="Data proposta" value={`${row.date} · ${row.time} · ${row.duration} · ${row.format}`} />
                <Info label="Stato attuale" value={row.approval === "pending" ? "da verificare" : row.approval} />
              </div>
            </div>
          )}
          {modal.type === "expert" && (
            <div className="modal-stack">
              <p>
                {modal.mode === "reassign"
                  ? "Il workshop torna in candidatura e l'esperto assegnato viene rimosso."
                  : "Scegli il workshop da assegnare a questo esperto e conferma l'assegnazione operativa."}
              </p>
              {modal.mode === "assign" && (
                <div className="modal-workshop-picker" aria-label="Scegli workshop da assegnare">
                  {rows.map((item) => (
                    <button
                      key={item.workshop.id}
                      type="button"
                      className={selectedExpertWorkshopId === item.workshop.id ? "active" : ""}
                      onClick={() => setSelectedExpertWorkshopId(item.workshop.id)}
                    >
                      <span>{item.assignedExpert ? `assegnato a ${item.assignedExpert}` : "da assegnare"}</span>
                      <strong>{item.workshop.title}</strong>
                      <em>{item.duration} · {item.format} / {item.workshop.level.toUpperCase()}</em>
                    </button>
                  ))}
                </div>
              )}
              {row ? (
                <div className="modal-points single">
                  <Info label="Workshop" value={row.workshop.title} />
                  <Info label="Esperto" value={modal.expertName || row.assignedExpert || "Da assegnare"} />
                  <Info label="Cliente" value={project.company} />
                </div>
              ) : (
                <p className="modal-warning">Nessun workshop disponibile per questo progetto.</p>
              )}
            </div>
          )}
          {modal.type === "open_candidacies" && (
            <div className="modal-stack">
              <p>Invia agli esperti compatibili una mail di candidatura con accesso diretto alla vista Esperto.</p>
              <div className="modal-points single">
                <Info label="Esperti invitati" value={`${expertCount} profili compatibili/test`} />
                <Info label="CTA email" value="Mi candido" />
                <Info label="Link" value="Apre il planner in ruolo Esperto sulla lista opportunita" />
              </div>
              <div className="candidate-confirm-card">
                <span className="workshop-badge">Email esperto</span>
                <strong>Nuove opportunita FunniFin per {project.company}</strong>
                <p>
                  La mail mostra i workshop disponibili, date proposte e bottone “Mi candido”. Il click porta l’esperto nella vista Esperto dove conferma la candidatura.
                </p>
              </div>
            </div>
          )}
          {modal.type === "confirm_event" && (
            <div className="modal-stack">
              <p>
                Conferma finale: crea il record evento, collega Meet e materiali e porta il progetto in stato confermato.
              </p>
              <div className="precheck-list">
                {eventPrechecks.map((item) => (
                  <span key={item.label} className={item.done ? "done" : "missing"}>
                    {item.done ? <Check size={16} /> : <AlertCircle size={16} />}
                    {item.label}
                  </span>
                ))}
              </div>
              <div className="modal-points single">
                <Info label="Cliente" value={project.company} />
                <Info label="Workshop" value={`${rows.length} collegati`} />
                <Info label="Evento" value={eventRecord ? eventRecord.id : "da creare"} />
                {eventRecord && <Info label="Meet" value={<EventLink href={eventRecord.meetLink} label="Apri Meet" />} />}
                {eventRecord?.htmlLink && <Info label="Calendar" value={<EventLink href={eventRecord.htmlLink} label="Apri Calendar" />} />}
              </div>
              {!canConfirmEvent && <p className="modal-warning">Completa i passaggi mancanti prima di creare l'evento.</p>}
            </div>
          )}
          {modal.type === "brand_handoff" && (
            <div className="modal-stack">
              <p>Passa i materiali al team brand/design e avvisa chi deve revisionare.</p>
              <div className="modal-points single">
                <Info label="Cliente" value={project.company} />
                <Info label="Workshop" value={`${rows.length} deck collegati`} />
                <Info label="Stato successivo" value="In revisione brand" />
              </div>
            </div>
          )}
          {modal.type === "price" && rule && (
            <div className="modal-stack">
              <p>Configura una regola commerciale reale: nome, quantita coperta, sconto e comportamento del preventivo cliente.</p>
              <div className="pricing-editor-grid">
                <label>
                  Nome regola
                  <input value={draftRule.name} onChange={(event) => setDraftRule((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label>
                  Min workshop
                  <input
                    type="number"
                    min="1"
                    value={draftRule.min}
                    onChange={(event) => setDraftRule((current) => ({ ...current, min: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Max workshop
                  <input
                    type="number"
                    min="1"
                    value={draftRule.max}
                    onChange={(event) => setDraftRule((current) => ({ ...current, max: Number(event.target.value) }))}
                  />
                </label>
                <label>
                  Sconto %
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={draftRule.discountPercent}
                    onChange={(event) => setDraftRule((current) => ({ ...current, discountPercent: Number(event.target.value) }))}
                  />
                </label>
                <label className="toggle-line pricing-toggle">
                  <input
                    type="checkbox"
                    checked={draftRule.specialQuote}
                    onChange={(event) => setDraftRule((current) => ({ ...current, specialQuote: event.target.checked }))}
                  />
                  <span>Mostra come percorso su preventivo</span>
                </label>
              </div>
              <div className="price-preview-card">
                <div>
                  <span>Preview cliente</span>
                  <strong>{draftRule.specialQuote ? "Su preventivo" : money(pricePreviewTotal)}</strong>
                </div>
                <div>
                  <span>Scenario</span>
                  <strong>{pricePreviewCount} workshop · listino {money(pricePreviewGross)}</strong>
                </div>
                <div>
                  <span>Sconto applicato</span>
                  <strong>{normalizedDiscount}% · {draftRule.specialQuote ? "prezzo nascosto" : `risparmio ${money(pricePreviewGross - pricePreviewTotal)}`}</strong>
                </div>
              </div>
            </div>
          )}
          {showImpact && (
            <div className="workflow-impact-panel" aria-label="Cosa succede alla conferma">
              <div>
                <strong>Prima di confermare</strong>
                <span>Effetti reali su email, calendario, catalogo e stato progetto.</span>
              </div>
              <ul>
                {workflowImpact.map((item) => (
                  <li key={item}>
                    <Check size={15} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {showNotification && (
            <NotificationController
              choice={notification}
              modalType={modal.type}
              onChange={setNotification}
            />
          )}
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose}>
            Annulla
          </AppButton>
          {modal.type === "edit_request" && (
            <AppButton
              variant="primary"
              disabled={editedRecords.length === 0}
              onClick={() => onSaveRequestEdit(editedRecords, notification)}
            >
              Salva modifica
            </AppButton>
          )}
          {modal.type === "date" && (
            <AppButton variant="primary" onClick={() => onConfirmDate(modal.workshopId, modal.decision, notification)}>
              {decisionCopy[modal.decision].action}
            </AppButton>
          )}
          {modal.type === "expert" && (
            <AppButton
              variant="primary"
              disabled={!selectedExpertWorkshopId}
              onClick={() => onConfirmExpert(selectedExpertWorkshopId, modal.expertName, modal.mode, notification)}
            >
              {modal.mode === "reassign" ? "Riapri candidatura" : "Assegna esperto"}
            </AppButton>
          )}
          {modal.type === "open_candidacies" && (
            <AppButton variant="primary" onClick={() => onInviteExperts(notification)}>
              Invia invito esperti
            </AppButton>
          )}
          {modal.type === "brand_handoff" && (
            <AppButton variant="primary" onClick={() => onConfirmBrandHandoff(notification)}>
              Manda a brand
            </AppButton>
          )}
          {modal.type === "confirm_event" && (
            <AppButton variant="primary" onClick={eventRecord ? onClose : () => onConfirmEvent(notification)} disabled={!eventRecord && !canConfirmEvent}>
              {eventRecord ? "Chiudi riepilogo" : notification.eventMode === "tentative" ? "Crea provvisorio" : "Crea definitivo"}
            </AppButton>
          )}
          {modal.type === "price" && rule && (
            <AppButton
              variant="primary"
              onClick={() =>
                onSaveRule(rule.id, {
                  name: draftRule.name.trim() || rule.name,
                  min: normalizedMin,
                  max: normalizedMax,
                  discountPercent: normalizedDiscount,
                  specialQuote: draftRule.specialQuote,
                })
              }
            >
              Salva regola
            </AppButton>
          )}
        </footer>
      </section>
    </div>
  );
}

const recipientLabels: Record<WorkflowNotificationRecipientRole, string> = {
  client: "Cliente",
  funnifin: "FunniFin",
  expert: "Esperto",
  brand: "Brand",
};

function getDefaultNotificationChoice(modal: AdminActionModalState, rows: AdminProjectWorkshopRow[] = []): NotificationChoice {
  if (modal.type === "edit_request") {
    return {
      send: false,
      recipients: ["client", "funnifin"],
      note: "FunniFin ha aggiornato workshop e preventivo della richiesta.",
    };
  }
  if (modal.type === "date") {
    const completesAllDates =
      modal.decision === "approved" &&
      rows.length > 0 &&
      rows.every((row) => (row.workshop.id === modal.workshopId ? "approved" : row.approval) === "approved");
    return {
      send: completesAllDates,
      recipients: completesAllDates ? ["client", "funnifin"] : ["funnifin"],
      note: completesAllDates
        ? "Tutte le date sono state approvate da FunniFin."
        : modal.decision === "change_requested"
          ? "Richiesta modifica interna: il cliente non viene avvisato automaticamente."
          : "Approvazione interna: il cliente verra avvisato quando tutte le date saranno approvate.",
    };
  }
  if (modal.type === "expert") {
    return {
      send: false,
      recipients: ["funnifin"],
      note: modal.mode === "reassign" ? "Il workshop torna in assegnazione." : "Assegnazione registrata internamente nel progetto.",
    };
  }
  if (modal.type === "open_candidacies") {
    return {
      send: true,
      recipients: ["expert"],
      note: "Nuove opportunita aperte: clicca su Mi candido per confermare disponibilita e interesse.",
    };
  }
  if (modal.type === "brand_handoff") {
    return {
      send: true,
      recipients: ["brand", "funnifin"],
      note: "Materiali pronti per revisione brand.",
    };
  }
  if (modal.type === "confirm_event") {
    return {
      send: true,
      recipients: ["funnifin"],
      note: "Evento creato a calendario con materiali collegati.",
      eventMode: "tentative",
    };
  }
  return { send: false, recipients: [], note: "" };
}

function NotificationController({
  choice,
  modalType,
  onChange,
}: {
  choice: NotificationChoice;
  modalType: AdminActionModalState["type"];
  onChange: (choice: NotificationChoice) => void;
}) {
  const toggleRecipient = (role: WorkflowNotificationRecipientRole) => {
    onChange({
      ...choice,
      recipients: choice.recipients.includes(role) ? choice.recipients.filter((item) => item !== role) : [...choice.recipients, role],
    });
  };

  return (
    <div className="notification-controller">
      <div className="notification-controller-head">
        <label className="toggle-line">
          <input type="checkbox" checked={choice.send} onChange={(event) => onChange({ ...choice, send: event.target.checked })} />
          <span>Invia email di aggiornamento</span>
        </label>
        {modalType === "confirm_event" && (
          <div className="event-mode-switch" aria-label="Tipo evento calendario">
            {[
              ["tentative", "Provvisorio"],
              ["confirmed", "Definitivo"],
            ].map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                className={choice.eventMode === mode ? "active" : ""}
                onClick={() => onChange({ ...choice, eventMode: mode as "tentative" | "confirmed" })}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="recipient-grid" aria-disabled={!choice.send}>
        {(Object.keys(recipientLabels) as WorkflowNotificationRecipientRole[]).map((role) => (
          <button
            key={role}
            type="button"
            className={choice.recipients.includes(role) ? "active" : ""}
            disabled={!choice.send}
            onClick={() => toggleRecipient(role)}
          >
            {choice.recipients.includes(role) ? <Check size={15} /> : <Plus size={15} />}
            {recipientLabels[role]}
          </button>
        ))}
      </div>
      <label className="notification-note">
        Nota email
        <textarea value={choice.note} disabled={!choice.send} onChange={(event) => onChange({ ...choice, note: event.target.value })} rows={2} />
      </label>
    </div>
  );
}

function AppButton({
  variant = "primary",
  children,
  className = "",
  ...props
}: {
  variant?: ButtonVariant;
  children: React.ReactNode;
  className?: string;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className={`app-btn app-btn-${variant} ${className}`} {...props}>
      {children}
    </button>
  );
}

function BottomActionBar({
  className,
  context,
  detail,
  priceBefore,
  priceAfter,
  discountLabel,
  caveat,
  primaryLabel,
  primaryDisabled,
  onPrimary,
  backLabel,
  onBack,
  secondaryLabel,
  onSecondary,
}: {
  className?: string;
  context: string;
  detail: string;
  priceBefore?: string;
  priceAfter?: string;
  discountLabel?: string;
  caveat?: string;
  primaryLabel: string;
  primaryDisabled?: boolean;
  onPrimary: () => void;
  backLabel?: string;
  onBack?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}) {
  return (
    <aside className={`bottom-action-bar ${className ?? ""}`} aria-label="Azione principale">
      <div className="bottom-action-copy">
        <div>
          <span>{context}</span>
          <strong>{detail}</strong>
        </div>
        {priceAfter && (
          <div className="bottom-price-stack">
            {priceBefore && <del>{priceBefore}</del>}
            <strong>{priceAfter}</strong>
            {discountLabel && <small>{discountLabel}</small>}
          </div>
        )}
        {caveat && <em>{caveat}</em>}
      </div>
      <div className="bottom-action-buttons">
        {backLabel && onBack && (
          <AppButton variant="ghost" className="bottom-back-btn" onClick={onBack} aria-label={backLabel} title={backLabel}>
            <ChevronLeft size={22} />
          </AppButton>
        )}
        {secondaryLabel && onSecondary && (
          <AppButton variant="ghost" onClick={onSecondary}>
            {secondaryLabel}
          </AppButton>
        )}
        <AppButton variant="primary" onClick={onPrimary} disabled={primaryDisabled}>
          {primaryLabel}
        </AppButton>
      </div>
    </aside>
  );
}

function AdminFlowStepper({
  steps,
  activeStep,
  completed,
  onStep,
}: {
  steps: ReadonlyArray<{ id: AdminWorkspacePanel; title: string; body: string }>;
  activeStep: AdminWorkspacePanel;
  completed: Record<AdminWorkspacePanel, boolean>;
  onStep: (step: AdminWorkspacePanel) => void;
}) {
  return (
    <nav className="admin-flow-stepper" aria-label="Flusso operativo FunniFin">
      {steps.map((step, index) => (
        <button key={step.id} className={`${activeStep === step.id ? "active" : ""} ${completed[step.id] ? "done" : ""}`} onClick={() => onStep(step.id)}>
          <span>{completed[step.id] ? <Check size={16} /> : index + 1}</span>
          <strong>{step.title}</strong>
          <em>{step.body}</em>
        </button>
      ))}
    </nav>
  );
}

function AdminSectionNav({
  sections,
  activeSection,
  onSection,
}: {
  sections: Array<{ id: string; title: string; meta: string; body: string }>;
  activeSection: string;
  onSection: (section: string) => void;
}) {
  return (
    <nav className="admin-section-nav" aria-label="Navigazione FunniFin">
      {sections.map((section) => (
        <button key={section.id} className={activeSection === section.id ? "active" : ""} onClick={() => onSection(section.id)}>
          <span>{section.meta}</span>
          <strong>{section.title}</strong>
          <em>{section.body}</em>
        </button>
      ))}
    </nav>
  );
}

function RoleHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow: string;
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}) {
  return (
    <section className="role-hero">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {actions && <div className="role-actions">{actions}</div>}
    </section>
  );
}

function OperatorIdentityCard({
  identity,
}: {
  identity: { name: string; email: string; role: string; note: string };
}) {
  const initials = identity.name
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  return (
    <section className="operator-identity-card" aria-label={`Utente ${identity.role}`}>
      <div className="operator-avatar">{initials}</div>
      <div className="operator-main">
        <span>{identity.role}</span>
        <strong>{identity.name}</strong>
        <em>{identity.email}</em>
      </div>
      <p>{identity.note}</p>
    </section>
  );
}

function ToolIconButton({
  active,
  onClick,
  label,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button className={`tool-icon-btn ${active ? "active" : ""}`} onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function ActionIconButton({
  variant = "neutral",
  onClick,
  label,
  children,
}: {
  variant?: "neutral" | "success" | "danger";
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button className={`action-icon-btn ${variant}`} onClick={onClick} aria-label={label} title={label}>
      {children}
    </button>
  );
}

function WizardPane({ children }: { children: React.ReactNode }) {
  return (
    <div className="wizard-pane">
      {children}
    </div>
  );
}

function Panel({ title, icon, actions, children }: { title: string; icon: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panel-title">
        <div className="panel-title-main">
          {icon}
          <h2>{title}</h2>
        </div>
        {actions && <div className="panel-title-actions">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  const caveatValue = typeof value === "string" && /da assegnare|da scegliere/i.test(value);
  return (
    <div className="info">
      <span>{label}</span>
      <strong className={caveatValue ? "caveat-value" : ""}>{value}</strong>
    </div>
  );
}

function EventLink({ href, label }: { href: string; label: string }) {
  return (
    <a className="event-link" href={href} target="_blank" rel="noreferrer" title={href}>
      <ExternalLink size={14} />
      <span>{label}</span>
    </a>
  );
}

function Line({ label, value, good }: { label: string; value: string; good?: boolean }) {
  return (
    <div className="line">
      <span>{label}</span>
      <strong className={good ? "good" : ""}>{value}</strong>
    </div>
  );
}

function FeedbackToastStack({ toasts, onClose }: { toasts: Toast[]; onClose: (id: number) => void }) {
  const visibleToasts = toasts.slice(-2);
  const hiddenCount = Math.max(0, toasts.length - visibleToasts.length);
  return (
    <div className="feedback-toast-stack" aria-live="polite">
      {hiddenCount > 0 && (
        <div className="feedback-toast-overflow" aria-label={`${hiddenCount} notifiche precedenti`}>
          <span>...</span>
          <strong>+{hiddenCount}</strong>
        </div>
      )}
      {visibleToasts.map((toast) => (
        <FeedbackToast key={toast.id} toast={toast} onClose={() => onClose(toast.id)} />
      ))}
    </div>
  );
}

function FeedbackToast({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <aside className="feedback-toast">
      <div>
        <strong>{toast.title}</strong>
        <button onClick={onClose} aria-label="Chiudi notifica">
          x
        </button>
      </div>
      <span>{toast.body}</span>
    </aside>
  );
}

function CustomModal({ workshop, onClose }: { workshop: Workshop; onClose: () => void }) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="custom-title">
      <section className="custom-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">Su misura +{money(workshop.customExtra)}</span>
            <h2 id="custom-title">Cosa significa rendere questo workshop su misura</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body">
          <p>
            Non e una semplice modifica alle slide. Ci sediamo con il cliente, raccogliamo obiettivi, platea, vincoli e linguaggio aziendale, poi coinvolgiamo i nostri migliori esperti per confezionare un'iniziativa davvero adatta al contesto.
          </p>
          <div className="modal-points">
            <Info label="Workshop" value={workshop.title} />
            <Info label="Sessione di co-design" value="Allineamento con HR/manager e obiettivi formativi" />
            <Info label="Esperti FunniFin" value="Scelta esempi, casi pratici e focus piu rilevanti" />
            <Info label="Output" value="Scaletta, deck adattato, note per speaker e proposta finale" />
          </div>
        </div>
        <footer className="modal-footer">
          <AppButton variant="primary" className="full" onClick={onClose}>
            Ok, ho capito
          </AppButton>
        </footer>
      </section>
    </div>
  );
}

function CustomRequestModal({
  workshop,
  initialNote,
  onClose,
  onSave,
}: {
  workshop: Workshop;
  initialNote: string;
  onClose: () => void;
  onSave: (note: string) => void;
}) {
  const [note, setNote] = useState(initialNote);

  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="custom-request-title">
      <section className="custom-modal custom-request-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">Su misura +{money(workshop.customExtra)}</span>
            <h2 id="custom-request-title">Note per adattare il workshop</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body">
          <div className="custom-note-context">
            <strong>{workshop.title}</strong>
            <span>Scrivi cosa va adattato: platea, esempi, tono, casi aziendali, obiettivi HR o vincoli da rispettare.</span>
          </div>
          <label>
            Note su misura
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Es. pubblico junior, esempi su benefit aziendali, tono molto pratico, focus su famiglie..."
              autoFocus
            />
          </label>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onClose}>
            Annulla
          </AppButton>
          <AppButton variant="primary" onClick={() => onSave(note.trim())}>
            Salva note
          </AppButton>
        </footer>
      </section>
    </div>
  );
}

function CatalogEditModal({
  topic,
  draft,
  onChange,
  onReset,
  onSave,
  onClose,
}: {
  topic: Topic;
  draft: { title: string; description: string; badge: string; active: boolean };
  onChange: (patch: Partial<{ title: string; description: string; badge: string; active: boolean }>) => void;
  onReset: () => void;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="catalog-edit-title">
      <section className="custom-modal catalog-edit-modal">
        <header className="modal-header">
          <div>
            <span className="topic-badge">Catalogo</span>
            <h2 id="catalog-edit-title">Modifica ambito</h2>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Chiudi">
            x
          </button>
        </header>
        <div className="modal-body catalog-modal-body">
          <div className="catalog-modal-summary">
            <span className={`color-dot ${topicColorClass(topic.id)}`} />
            <strong>{draft.title}</strong>
            <em>{draft.badge} · {topic.themes.length} temi · {workshops.filter((workshop) => workshop.topicId === topic.id).length} workshop</em>
          </div>
          <label>
            Titolo catalogo
            <input value={draft.title} onChange={(event) => onChange({ title: event.target.value })} />
          </label>
          <label>
            Descrizione
            <textarea value={draft.description} onChange={(event) => onChange({ description: event.target.value })} />
          </label>
          <label>
            Badge commerciale
            <select value={draft.badge} onChange={(event) => onChange({ badge: event.target.value })}>
              <option value="base">base</option>
              <option value="popolare">popolare</option>
              <option value="consigliato">consigliato</option>
              <option value="speciale">speciale</option>
            </select>
          </label>
          <label className="check-row">
            <input type="checkbox" checked={draft.active} onChange={(event) => onChange({ active: event.target.checked })} />
            Visibile nel catalogo cliente
          </label>
        </div>
        <footer className="modal-footer">
          <AppButton variant="ghost" onClick={onReset}>
            Ripristina
          </AppButton>
          <AppButton variant="primary" onClick={onSave}>
            Salva modifiche
          </AppButton>
        </footer>
      </section>
    </div>
  );
}

function DatePickerModal({
  selection,
  selections,
  workshop,
  onClose,
  onConfirm,
}: {
  selection: Selection;
  selections: Selection[];
  workshop: Workshop;
  onClose: () => void;
  onConfirm: (date: string, time: string) => void;
}) {
  const [mode, setMode] = useState<"now" | "plan">("plan");
  const [day, setDay] = useState(selection.date || "2026-06-12");
  const [time, setTime] = useState(selection.time || "18:00");
  const [availability, setAvailability] = useState<{ source: string; slots: Array<{ time: string; status: "available" | "busy" | "promo" }> }>({
    source: "mock",
    slots: [],
  });
  const [loadingSlots, setLoadingSlots] = useState(false);
  const days = Array.from({ length: 30 }, (_, index) => index + 1);
  const todayDate = "2026-06-12";
  const dayNumber = Number(day.split("-")[2] || "12");
  const formattedDay = `2026-06-${String(dayNumber).padStart(2, "0")}`;
  const scheduledSelections = selections
    .filter((item) => item.dateConfirmed && item.date && item.time)
    .map((item) => ({ ...item, workshop: workshops.find((workshopItem) => workshopItem.id === item.workshopId) }))
    .filter((item) => item.workshop);
  const scheduledDays = new Set(scheduledSelections.map((item) => Number(item.date.split("-")[2])));
  const scheduledTimesForDay = new Set(scheduledSelections.filter((item) => item.date === formattedDay).map((item) => item.time));
  const currentAlreadyScheduled = Boolean(selection.dateConfirmed && selection.date && selection.time);

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    getWorkshopAvailability({ date: formattedDay, duration: selection.duration, format: selection.format, expertIds: workshop.experts })
      .then((result) => {
        if (!cancelled) setAvailability(result);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [formattedDay, selection.duration, selection.format, workshop.experts]);

  useEffect(() => {
    if (mode !== "now" || formattedDay !== todayDate || loadingSlots) return;
    const immediateSlot = availability.slots.find((slot) => slot.status !== "busy");
    if (immediateSlot && immediateSlot.time !== time) setTime(immediateSlot.time);
  }, [availability.slots, formattedDay, loadingSlots, mode, time]);

  const chooseNow = () => {
    setMode("now");
    setDay(todayDate);
    const immediateSlot = availability.slots.find((slot) => slot.status !== "busy");
    if (immediateSlot) setTime(immediateSlot.time);
  };

  return (
    <div className="modal-backdrop calendar-backdrop" role="dialog" aria-modal="true" aria-labelledby="date-title">
      <section className="calendar-modal">
        <header className="modal-header calendar-header">
          <div>
            <span className="calendar-kicker">Scegli data e orario</span>
            <h2 id="date-title">{workshop.title}</h2>
            <p>Proponi una data. FunniFin verifichera la disponibilita prima della conferma.</p>
          </div>
          <button className="modal-close calendar-close" onClick={onClose} aria-label="Chiudi calendario">
            x
          </button>
        </header>

        <div className="modal-body calendar-body">
          <div className="calendar-mode">
            <button className={mode === "now" ? "active" : ""} onClick={chooseNow}>Adesso</button>
            <button className={mode === "plan" ? "active" : ""} onClick={() => setMode("plan")}>Pianifica</button>
          </div>
          {mode === "now" && (
            <div className="now-banner">
              <Clock3 size={18} />
              <span>Adesso seleziona oggi e propone il primo orario libero.</span>
            </div>
          )}

          <div className="calendar-layout">
            <div className="month-card">
              <div className="month-head">
                <button aria-label="Mese precedente">‹</button>
                <strong>Giugno 2026</strong>
                <button aria-label="Mese successivo">›</button>
              </div>
              <div className="weekday-row">
                {["LU", "MA", "ME", "GI", "VE", "SA", "DO"].map((weekday) => <span key={weekday}>{weekday}</span>)}
              </div>
              <div className="day-grid">
                {days.map((item) => (
                  <button
                    key={item}
                    className={`${item === dayNumber ? "active" : ""} ${scheduledDays.has(item) ? "has-selection" : ""}`}
                    onClick={() => setDay(`2026-06-${String(item).padStart(2, "0")}`)}
                  >
                    {item}
                  </button>
                ))}
              </div>
            </div>

            <div className="slot-panel">
              <div className="slot-title">
                <Clock3 size={18} /> Inizio
                <span>{availability.source === "google-freebusy" ? "Disponibilita aggiornata" : "Disponibilita demo"}</span>
              </div>
              <div className="slot-grid">
                {loadingSlots && <span className="slot-loading">Carico disponibilita...</span>}
                {!loadingSlots && availability.slots.map((slot) => (
                  <button
                    key={slot.time}
                    disabled={slot.status === "busy"}
                    className={`${slot.time === time ? "active" : ""} ${slot.status} ${scheduledTimesForDay.has(slot.time) ? "already-picked" : ""}`}
                    onClick={() => setTime(slot.time)}
                  >
                    {slot.time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="already-selected-dates">
            <div>
              <strong>Date gia scelte</strong>
              <span>{scheduledSelections.length ? `${scheduledSelections.length} proposte nel percorso` : "Nessuna proposta ancora salvata"}</span>
            </div>
            {scheduledSelections.length > 0 && (
              <div className="already-selected-list">
                {scheduledSelections.map((item) => (
                  <button
                    key={item.workshopId}
                    className={item.workshopId === selection.workshopId ? "active" : ""}
                    onClick={() => {
                      setDay(item.date);
                      setTime(item.time);
                    }}
                  >
                    <Check size={16} />
                    <span>
                      <strong>{item.workshop?.title}</strong>
                      <em>{item.date} · {item.time} · {item.duration}</em>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <footer className="modal-footer calendar-footer">
          <div className="calendar-selection">
            {currentAlreadyScheduled ? <Check size={20} /> : <Clock3 size={20} />}
            <div>
              <strong>{currentAlreadyScheduled ? "Proposta salvata, puoi modificarla" : new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "short" }).format(new Date(`${formattedDay}T12:00:00`))}</strong>
              <span>{time} → {String(Number(time.slice(0, 2)) + (selection.duration === "2h" ? 2 : 1)).padStart(2, "0")}:00</span>
            </div>
            <em>{selection.duration}</em>
          </div>
          <button className="primary-btn" onClick={() => onConfirm(formattedDay, time)}>
            Conferma proposta
          </button>
        </footer>
      </section>
    </div>
  );
}

function iconFor(name: string) {
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

function useQuotePlaceholder() {
  return {
    gross: 0,
    customTotal: 0,
    rule: initialRules[0],
    catalogTargetPrice: null as number | null,
    isBasicBundle: false,
    quantityDiscount: 0,
    promoDiscount: 0,
    total: 0,
    saved: 0,
  };
}

export default App;
