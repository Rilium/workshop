import fs from "node:fs";

const envPath = ".env.local";
if (!fs.existsSync(envPath)) {
  throw new Error("Missing .env.local");
}

const env = Object.fromEntries(
  fs
    .readFileSync(envPath, "utf8")
    .split(/\n/)
    .filter(Boolean)
    .filter((line) => !line.trim().startsWith("#"))
    .map((line) => {
      const index = line.indexOf("=");
      return [line.slice(0, index), line.slice(index + 1)];
    }),
);

const scriptUrl = env.VITE_APPS_SCRIPT_DEPLOYMENT_URL;
if (!scriptUrl) throw new Error("Missing VITE_APPS_SCRIPT_DEPLOYMENT_URL");
const setupSecret = env.ADMIN_SETUP_SECRET || env.VITE_ADMIN_SETUP_SECRET || "";
if (!setupSecret) throw new Error("Missing ADMIN_SETUP_SECRET or VITE_ADMIN_SETUP_SECRET");
const catalogImport = JSON.parse(fs.readFileSync("src/data/clientCatalogImport.json", "utf8"));
const workshopBasePrice = 1000;
const inPersonExtra = 500;
const customExtra = 500;
const recordingOptOutDiscount = 100;
const bundlePrices = { 3: 2500, 6: 4500, 10: 6900 };
const outcomeSizes = { sensibilizzazione: 3, avanzata: 6, completa: 10 };
const pricingRules = [
  { id: "a-la-carte", name: "Workshop à-la-carte", min: 1, max: 99, discountPercent: 0 },
];

function durationOptions(label) {
  const normalized = String(label || "").replace(",", ".").replace(/\s+/g, "");
  if (normalized === "2") return ["1h", "2h"];
  if (normalized.includes("1.30") && normalized.includes("2")) return ["1h", "1.5h", "2h"];
  if (normalized.includes("1.30") || normalized.includes("1.5")) return ["1h", "1.5h"];
  return normalized.includes("2") ? ["1h", "2h"] : ["1h"];
}

const topics = catalogImport.topics.map((topic) => ({
  id: topic.id,
  title: topic.title,
  description: topic.description || `Workshop dedicati al topic ${topic.title}.`,
  badge: !topic.badge || topic.badge === "cliente-2026" ? "base" : topic.badge,
  active: topic.active !== false,
}));

const workshops = catalogImport.workshops.map((workshop) => ({
  id: workshop.id,
  topicId: workshop.topicIds[0] || "",
  topicIds: workshop.topicIds,
  themeId: workshop.topicIds[0] || "",
  title: workshop.title,
  short: workshop.description,
  long: workshop.description,
  durationOptions: durationOptions(workshop.durationLabel),
  formatOptions: ["webinar", "live"],
  level: "base",
  target: "tutti",
  participants: "da definire",
  price1h: workshopBasePrice,
  price2h: workshopBasePrice,
  packageAvailable: true,
  customAvailable: workshop.customAvailable,
  customExtra,
  masterSlide: "",
  experts: String(workshop.suggestedExperts || "")
    .split("/")
    .map((expert) => expert.trim())
    .filter(Boolean),
  state: workshop.productionStatus === "draft" ? "da aggiornare" : "attivo",
  durationLabel: workshop.durationLabel,
  adminNotes: workshop.adminNotes,
  productionStatus: workshop.productionStatus,
  active: true,
}));

async function get(action) {
  const url = new URL(scriptUrl);
  url.searchParams.set("action", action);
  const response = await fetch(url);
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(`${action} failed: ${result.error || response.status}`);
  }
  return result;
}

async function post(action, payload) {
  const response = await fetch(scriptUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, payload }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok || result.ok === false) {
    throw new Error(`${action} failed: ${result.error || response.status}`);
  }
  return result;
}

const service = await get("service");
const requiredActions = [
  "listCatalogConfig",
  "listCatalogWorkshops",
  "listPricingRules",
  "listExperts",
  "listWorkspaceSettings",
  "googleHealth",
  "listAdminConfig",
  "updateCatalogTopic",
  "updateCatalogWorkshop",
  "updatePricingRule",
  "updateExpert",
  "updateWorkspaceSetting",
  "seedAdminConfig",
];
const missingActions = requiredActions.filter((action) => !service.actions?.includes(action));
if (missingActions.length > 0) {
  throw new Error(`Apps Script deployment is missing actions: ${missingActions.join(", ")}`);
}

const settings = [
  { key: "catalog.bundlesJson", value: JSON.stringify(catalogImport.bundles), group: "catalog", label: "Pacchetti catalogo" },
  { key: "pricing.workshopBasePrice", value: String(workshopBasePrice), group: "pricing", label: "Prezzo workshop singolo" },
  { key: "pricing.inPersonExtra", value: String(inPersonExtra), group: "pricing", label: "Maggiorazione in presenza" },
  { key: "pricing.customExtra", value: String(customExtra), group: "pricing", label: "Maggiorazione personalizzazione" },
  { key: "pricing.recordingOptOutDiscount", value: String(recordingOptOutDiscount), group: "pricing", label: "Sconto senza registrazione" },
  { key: "pricing.recordingDefault", value: "true", group: "pricing", label: "Registrazione inclusa di default" },
  { key: "pricing.bundlePricesJson", value: JSON.stringify(bundlePrices), group: "pricing", label: "Prezzi pacchetti 3/6/10" },
  { key: "survey.outcomeSizesJson", value: JSON.stringify(outcomeSizes), group: "survey", label: "Dimensione percorsi survey" },
];

const seed = await post("seedAdminConfig", {
  setupSecret,
  replaceCatalog: true,
  replacePricingRules: true,
  catalogTopics: topics,
  catalogWorkshops: workshops,
  pricingRules,
  settings,
});
const health = seed.health || (await get("googleHealth"));
console.log(
  JSON.stringify(
    {
      seeded: seed.seeded,
      health: {
        requests: health.spreadsheet?.requests,
        events: health.spreadsheet?.events,
        catalogTopics: health.spreadsheet?.catalogTopics,
        catalogWorkshops: health.spreadsheet?.catalogWorkshops,
        pricingRules: health.spreadsheet?.pricingRules,
        experts: health.spreadsheet?.experts,
        settings: health.spreadsheet?.settings,
        mailQuota: health.mail?.remainingDailyQuota,
      },
    },
    null,
    2,
  ),
);
