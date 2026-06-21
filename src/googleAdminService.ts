import { SECRET_SETTINGS } from "./secretSettings";
import { appendSessionParams, withSessionPayload } from "./authTransport";

export type CatalogTopicConfig = {
  id: string;
  title: string;
  description: string;
  badge: string;
  active: boolean;
  updatedAt?: string;
};

export type PricingRuleConfig = {
  id: string;
  name: string;
  min: number;
  max: number;
  discountPercent: number;
  specialQuote?: boolean;
  updatedAt?: string;
};

export type CatalogWorkshopConfig = {
  id: string;
  topicId: string;
  themeId: string;
  title: string;
  short: string;
  long: string;
  durationOptions: string[];
  formatOptions: string[];
  level: string;
  target: string;
  participants: string;
  price1h: number;
  price2h: number;
  packageAvailable: boolean;
  customAvailable: boolean;
  customExtra: number;
  masterSlide: string;
  experts: string[];
  state: string;
  active?: boolean;
  updatedAt?: string;
};

export type ExpertProfileConfig = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  photo: string;
  bio: string;
  topicIds: string[];
  themeIds: string[];
  availability: string;
  active?: boolean;
  updatedAt?: string;
};

export type WorkspaceSetting = {
  key: string;
  value: string;
  group: string;
  label: string;
  updatedAt?: string;
};

export type GoogleHealth = {
  source: "google-workspace";
  spreadsheet: {
    id: string;
    url: string;
    requests: number;
    events: number;
    clientUsers: number;
    authUsers: number;
    accessRequests: number;
    catalogTopics: number;
    catalogWorkshops: number;
    pricingRules: number;
    notifications?: number;
    experts: number;
    settings: number;
  };
  calendar: {
    configured: boolean;
    id: string;
    name: string;
  };
  drive: {
    configured: boolean;
    rootFolderId: string;
    slidesRootFolderId: string;
  };
  mail: {
    remainingDailyQuota: number;
  };
  checkedAt: string;
  cached?: boolean;
};

function getScriptUrl() {
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];
}

function friendlyGoogleError(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/failed to fetch/i.test(message) || /networkerror/i.test(message)) return fallback;
  return message;
}

async function getAppsScript<T>(action: string, params?: Record<string, string>): Promise<T | null> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  const url = new URL(scriptUrl);
  url.searchParams.set("action", action);
  appendSessionParams(url);
  Object.entries(params ?? {}).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Lettura ${action} non riuscita`);
    const result = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
    if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
    if (result.ok === false) throw new Error(result.error || `Lettura ${action} non riuscita`);
    return result;
  } catch (error) {
    throw new Error(friendlyGoogleError(error, `Connessione Google non disponibile per ${action}.`));
  }
}

async function postAppsScript<T>(action: string, payload: unknown): Promise<T> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");

  try {
    const response = await fetch(scriptUrl, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        action,
        payload: payload && typeof payload === "object" && !Array.isArray(payload)
          ? withSessionPayload(payload as Record<string, unknown>)
          : payload,
      }),
    });
    if (!response.ok) throw new Error(`Salvataggio ${action} non riuscito`);
    const result = (await response.json().catch(() => null)) as (T & { ok?: boolean; error?: string }) | null;
    if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
    if (result.ok === false) throw new Error(result.error || `Salvataggio ${action} non riuscito`);
    return result;
  } catch (error) {
    throw new Error(friendlyGoogleError(error, `Connessione Google non disponibile per ${action}.`));
  }
}

export async function listCatalogConfig(): Promise<CatalogTopicConfig[]> {
  const result = await getAppsScript<{ topics?: CatalogTopicConfig[] }>("listCatalogConfig");
  return result?.topics ?? [];
}

export async function updateCatalogTopic(topic: CatalogTopicConfig): Promise<CatalogTopicConfig> {
  const result = await postAppsScript<{ topic: CatalogTopicConfig }>("updateCatalogTopic", topic);
  return result.topic;
}

export async function listCatalogWorkshops(): Promise<CatalogWorkshopConfig[]> {
  const result = await getAppsScript<{ workshops?: CatalogWorkshopConfig[] }>("listCatalogWorkshops");
  return result?.workshops ?? [];
}

export async function updateCatalogWorkshop(workshop: CatalogWorkshopConfig): Promise<CatalogWorkshopConfig> {
  const result = await postAppsScript<{ workshop: CatalogWorkshopConfig }>("updateCatalogWorkshop", workshop);
  return result.workshop;
}

export async function listPricingRules(): Promise<PricingRuleConfig[]> {
  const result = await getAppsScript<{ rules?: PricingRuleConfig[] }>("listPricingRules");
  return result?.rules ?? [];
}

export async function updatePricingRule(rule: PricingRuleConfig): Promise<PricingRuleConfig> {
  const result = await postAppsScript<{ rule: PricingRuleConfig }>("updatePricingRule", rule);
  return result.rule;
}

export async function listExperts(): Promise<ExpertProfileConfig[]> {
  const result = await getAppsScript<{ experts?: ExpertProfileConfig[] }>("listExperts");
  return result?.experts ?? [];
}

export async function updateExpert(expert: ExpertProfileConfig): Promise<ExpertProfileConfig> {
  const result = await postAppsScript<{ expert: ExpertProfileConfig }>("updateExpert", expert);
  return result.expert;
}

export async function deleteExpert(expertId: string): Promise<{ deleted: boolean; expertId: string }> {
  return postAppsScript("deleteExpert", { expertId });
}

export async function listWorkspaceSettings(): Promise<WorkspaceSetting[]> {
  const result = await getAppsScript<{ settings?: WorkspaceSetting[] }>("listWorkspaceSettings");
  return result?.settings ?? [];
}

export async function updateWorkspaceSetting(setting: WorkspaceSetting): Promise<WorkspaceSetting> {
  const result = await postAppsScript<{ setting: WorkspaceSetting }>("updateWorkspaceSetting", setting);
  return result.setting;
}

export async function getGoogleHealth(options?: { refresh?: boolean }): Promise<GoogleHealth | null> {
  return getAppsScript<GoogleHealth>("googleHealth", options?.refresh ? { refresh: "1" } : undefined);
}

export async function seedAdminConfig(payload: {
  catalogTopics?: CatalogTopicConfig[];
  catalogWorkshops?: CatalogWorkshopConfig[];
  pricingRules?: PricingRuleConfig[];
  experts?: ExpertProfileConfig[];
  settings?: WorkspaceSetting[];
}) {
  return postAppsScript("seedAdminConfig", payload);
}
