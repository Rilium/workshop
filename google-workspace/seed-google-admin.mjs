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
const localTestSettingsPath = "config/local-test-settings.json";
const localTestSettings = fs.existsSync(localTestSettingsPath)
  ? JSON.parse(fs.readFileSync(localTestSettingsPath, "utf8"))
  : { mail: { recipients: {} }, authUsers: {} };
const mailRecipients = localTestSettings.mail?.recipients || {};

const catalogSource = fs.readFileSync("src/data/catalog.ts", "utf8");
const pricingSource = fs.readFileSync("src/data/pricing.ts", "utf8");
const topicsLiteral = catalogSource.match(/export const topics: Topic\[\] = (\[[\s\S]*?\n\]);/)?.[1];
const rulesLiteral = pricingSource.match(/export const initialRules: PricingRule\[\] = (\[[\s\S]*?\n\]);/)?.[1];
const expertsLiteral = catalogSource.match(/export const experts = (\[[\s\S]*?\n\]);/)?.[1];
const workshopsLiteral = catalogSource.match(/export const workshops: Workshop\[\] = (\[[\s\S]*?\n\]);/)?.[1];
if (!topicsLiteral || !rulesLiteral || !expertsLiteral || !workshopsLiteral) {
  throw new Error("Cannot parse seed data from src/data");
}

const topics = Function(`return ${topicsLiteral};`)();
const pricingRules = Function(`return ${rulesLiteral};`)();
const experts = Function(`return ${expertsLiteral};`)();
const workshops = Function(`return ${workshopsLiteral};`)();

function buildExpertProfiles() {
  return experts.map((expert, index) => {
    const [firstName, ...lastNameParts] = expert.name.split(" ");
    const topicIds = expert.skills;
    const themeIds = topics
      .filter((topic) => topicIds.includes(topic.id))
      .flatMap((topic) => topic.themes.map((theme) => theme.id));
    return {
      id: expert.id,
      firstName,
      lastName: lastNameParts.join(" "),
      email: env[`EXPERT_${index + 1}_EMAIL`] || mailRecipients.expert || "",
      photo: "",
      bio: "Profilo esperto FunniFin associato ai workshop del catalogo.",
      topicIds,
      themeIds,
      availability: expert.availability,
      active: true,
    };
  });
}

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
  { key: "mail.provider", value: "Google MailApp", group: "mail", label: "Provider invii" },
  { key: "mail.fromName", value: "FunniFin Workshop Planner", group: "mail", label: "Nome mittente" },
  { key: "mail.internalRecipient", value: env.INTERNAL_RECIPIENT || env.VITE_INTERNAL_RECIPIENT || localTestSettings.mail?.internalRecipient || "", group: "mail", label: "Inbox interna" },
  { key: "mail.funnifin", value: env.FUNNIFIN_RECIPIENT || env.VITE_FUNNIFIN_RECIPIENT || mailRecipients.funnifin || "", group: "mail", label: "Email FunniFin" },
  { key: "mail.expert", value: env.EXPERT_RECIPIENT || env.VITE_EXPERT_RECIPIENT || mailRecipients.expert || "", group: "mail", label: "Email Esperti" },
  { key: "mail.brand", value: env.BRAND_RECIPIENT || env.VITE_BRAND_RECIPIENT || mailRecipients.brand || "", group: "mail", label: "Email Brand" },
  { key: "funnifin.name", value: "Team FunniFin", group: "identity", label: "Nome FunniFin" },
  { key: "funnifin.email", value: env.FUNNIFIN_EMAIL || env.VITE_FUNNIFIN_RECIPIENT || mailRecipients.funnifin || "", group: "identity", label: "Email FunniFin" },
  { key: "brand.name", value: "Brand Review", group: "identity", label: "Nome Brand" },
  { key: "brand.email", value: env.BRAND_EMAIL || env.VITE_BRAND_RECIPIENT || mailRecipients.brand || "", group: "identity", label: "Email Brand" },
  { key: "calendar.id", value: env.VITE_FUNNIFIN_CALENDAR_ID || "", group: "google", label: "Calendar ID" },
  { key: "calendar.name", value: env.VITE_FUNNIFIN_CALENDAR_NAME || "", group: "google", label: "Calendar name" },
  { key: "drive.rootFolderId", value: env.VITE_DRIVE_ROOT_FOLDER_ID || "", group: "google", label: "Drive root materiali" },
  { key: "drive.slidesRootFolderId", value: env.VITE_SLIDES_TEMPLATE_FOLDER_ID || "", group: "google", label: "Drive root Slides" },
];

const seed = await post("seedAdminConfig", {
  setupSecret,
  catalogTopics: topics.map((topic) => ({
    id: topic.id,
    title: topic.title,
    description: topic.description,
    badge: topic.badge,
    active: true,
  })),
  catalogWorkshops: workshops.map((workshop) => ({
    ...workshop,
    active: workshop.state !== "nascosto",
  })),
  pricingRules,
  experts: buildExpertProfiles(),
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
