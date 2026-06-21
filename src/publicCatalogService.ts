import { allowLocalFallbacks } from "./authTransport";
import { initialRules } from "./data/pricing";
import { topics as fallbackTopics, workshops as fallbackWorkshops } from "./data/catalog";
import { SECRET_SETTINGS } from "./secretSettings";
import type { Duration, Format, PricingRule, Topic, Workshop } from "./types/domain";
import type { CatalogTopicConfig, CatalogWorkshopConfig, PricingRuleConfig } from "./googleAdminService";

type PublicCatalogResponse = {
  ok?: boolean;
  error?: string;
  source?: string;
  topics?: CatalogTopicConfig[];
  workshops?: CatalogWorkshopConfig[];
  rules?: PricingRuleConfig[];
  updatedAt?: string;
};

export type PublicCatalog = {
  topics: Topic[];
  workshops: Workshop[];
  rules: PricingRule[];
  source: "google-sheet" | "local-fallback";
  updatedAt?: string;
};

function getScriptUrl() {
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];
}

function asDurationOptions(values: string[]): Duration[] {
  return values.filter((value): value is Duration => value === "1h" || value === "2h");
}

function asFormatOptions(values: string[]): Format[] {
  return values.filter((value): value is Format => value === "live" || value === "webinar" || value === "ibrido");
}

function enrichTopic(config: CatalogTopicConfig): Topic {
  const fallback = fallbackTopics.find((topic) => topic.id === config.id);
  return {
    id: config.id,
    title: config.title || fallback?.title || config.id,
    description: config.description || fallback?.description || "",
    icon: fallback?.icon || "sparkles",
    color: fallback?.color || "#1cafb9",
    badge: config.badge || fallback?.badge || "base",
    themes: fallback?.themes || [],
  };
}

function toWorkshop(config: CatalogWorkshopConfig): Workshop {
  const fallback = fallbackWorkshops.find((workshop) => workshop.id === config.id);
  return {
    id: config.id,
    topicId: config.topicId || fallback?.topicId || "",
    themeId: config.themeId || fallback?.themeId || "",
    title: config.title || fallback?.title || config.id,
    short: config.short || fallback?.short || "",
    long: config.long || fallback?.long || config.short || "",
    durationOptions: asDurationOptions(config.durationOptions).length ? asDurationOptions(config.durationOptions) : fallback?.durationOptions || ["1h"],
    formatOptions: asFormatOptions(config.formatOptions).length ? asFormatOptions(config.formatOptions) : fallback?.formatOptions || ["webinar"],
    level: config.level === "intermedio" || config.level === "avanzato" ? config.level : "base",
    target: config.target || fallback?.target || "tutti",
    participants: config.participants || fallback?.participants || "illimitati",
    price1h: Number(config.price1h || fallback?.price1h || 0),
    price2h: Number(config.price2h || fallback?.price2h || config.price1h || 0),
    packageAvailable: config.packageAvailable !== false,
    customAvailable: config.customAvailable !== false,
    customExtra: Number(config.customExtra || fallback?.customExtra || 0),
    masterSlide: config.masterSlide || fallback?.masterSlide || "",
    experts: config.experts?.length ? config.experts : fallback?.experts || [],
    state: config.state === "nascosto" || config.state === "da aggiornare" ? config.state : "attivo",
  };
}

function toRule(config: PricingRuleConfig): PricingRule {
  return {
    id: config.id,
    name: config.name,
    min: Number(config.min || 1),
    max: Number(config.max || 1),
    discountPercent: Number(config.discountPercent || 0),
    specialQuote: Boolean(config.specialQuote),
  };
}

function localFallback(): PublicCatalog {
  return {
    topics: fallbackTopics,
    workshops: fallbackWorkshops,
    rules: initialRules,
    source: "local-fallback",
  };
}

export async function getPublicCatalog(): Promise<PublicCatalog> {
  const scriptUrl = getScriptUrl();
  if (!scriptUrl) {
    if (allowLocalFallbacks()) return localFallback();
    throw new Error("VITE_APPS_SCRIPT_DEPLOYMENT_URL non configurato");
  }

  const url = new URL(scriptUrl);
  url.searchParams.set("action", "publicCatalog");

  try {
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error("Catalogo pubblico non disponibile");
    const result = (await response.json().catch(() => null)) as PublicCatalogResponse | null;
    if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
    if (result.ok === false) throw new Error(result.error || "Catalogo pubblico non disponibile");
    return {
      topics: (result.topics ?? []).filter((topic) => topic.active !== false).map(enrichTopic),
      workshops: (result.workshops ?? []).filter((workshop) => workshop.active !== false && workshop.state !== "nascosto").map(toWorkshop),
      rules: (result.rules ?? []).map(toRule),
      source: "google-sheet",
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    if (allowLocalFallbacks()) return localFallback();
    throw error instanceof Error ? error : new Error("Catalogo pubblico non disponibile");
  }
}
