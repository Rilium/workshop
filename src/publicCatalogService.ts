import { allowLocalFallbacks } from "./authTransport";
import { defaultCommercialConfig, initialRules } from "./data/pricing";
import {
  clientCatalogImport,
  fallbackCatalogBundles,
  fallbackCatalogTopics as fallbackTopics,
  fallbackCatalogWorkshops as fallbackWorkshops,
} from "./data/clientCatalog";
import { SECRET_SETTINGS } from "./secretSettings";
import { fetchAppsScript } from "./appsScriptTransport";
import type { CatalogBundle, CommercialConfig, Duration, Format, PricingRule, Topic, Workshop } from "./types/domain";
import type { CatalogTopicConfig, CatalogWorkshopConfig, PricingRuleConfig } from "./googleAdminService";
import { buildClientCatalogSeed, catalogDurationOptions } from "./utils/clientCatalogImport";

type PublicCatalogResponse = {
  ok?: boolean;
  error?: string;
  source?: string;
  topics?: CatalogTopicConfig[];
  workshops?: CatalogWorkshopConfig[];
  rules?: PricingRuleConfig[];
  bundles?: CatalogBundle[];
  commercialConfig?: Partial<CommercialConfig>;
  updatedAt?: string;
};

export type PublicCatalog = {
  topics: Topic[];
  workshops: Workshop[];
  rules: PricingRule[];
  bundles: CatalogBundle[];
  commercialConfig: CommercialConfig;
  source: "google-sheet" | "local-fallback";
  updatedAt?: string;
};

function getScriptUrl() {
  return (import.meta as unknown as { env: Record<string, string | undefined> }).env[
    SECRET_SETTINGS.google.env.appScriptDeploymentUrl
  ];
}

function asDurationOptions(values: string[]): Duration[] {
  return values.filter((value): value is Duration => value === "1h" || value === "1.5h" || value === "2h");
}

function asFormatOptions(values: string[]): Format[] {
  return values.filter((value): value is Format => value === "live" || value === "webinar" || value === "ibrido");
}

function normalizedCatalogTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveBundleWorkshopIds(bundles: CatalogBundle[], workshops: Workshop[]) {
  const workshopById = new Map(workshops.map((workshop) => [workshop.id, workshop]));
  const workshopByTitle = new Map(workshops.map((workshop) => [normalizedCatalogTitle(workshop.title), workshop]));
  const importedWorkshopById = new Map(clientCatalogImport.workshops.map((workshop) => [workshop.id, workshop]));
  return bundles.map((bundle) => ({
    ...bundle,
    workshopIds: bundle.workshopIds
      .map((workshopId) => {
        if (workshopById.has(workshopId)) return workshopId;
        const importedTitle = importedWorkshopById.get(workshopId)?.title;
        return importedTitle ? workshopByTitle.get(normalizedCatalogTitle(importedTitle))?.id : undefined;
      })
      .filter((workshopId): workshopId is string => Boolean(workshopId)),
  }));
}

function enrichTopic(config: CatalogTopicConfig): Topic {
  const fallback = fallbackTopics.find((topic) => topic.id === config.id);
  const badge = config.badge === "cliente-2026" ? "base" : config.badge;
  return {
    id: config.id,
    title: config.title || fallback?.title || config.id,
    description: config.description || fallback?.description || "",
    icon: fallback?.icon || "sparkles",
    color: fallback?.color || "#1cafb9",
    badge: badge || fallback?.badge || "base",
    themes: fallback?.themes || [],
  };
}

function toWorkshop(config: CatalogWorkshopConfig): Workshop {
  const fallback = fallbackWorkshops.find((workshop) => workshop.id === config.id);
  const imported = clientCatalogImport.workshops.find((workshop) => workshop.id === config.id || workshop.title === config.title);
  return {
    id: config.id,
    topicId: config.topicId || fallback?.topicId || "",
    topicIds: config.topicIds?.length ? config.topicIds : fallback?.topicIds || [config.topicId || fallback?.topicId || ""].filter(Boolean),
    themeId: config.themeId || fallback?.themeId || "",
    title: config.title || fallback?.title || config.id,
    short: config.short || fallback?.short || "",
    long: config.long || fallback?.long || config.short || "",
    durationOptions: imported
      ? catalogDurationOptions(imported.durationLabel)
      : asDurationOptions(config.durationOptions).length
        ? asDurationOptions(config.durationOptions)
        : fallback?.durationOptions || ["1h"],
    formatOptions: asFormatOptions(config.formatOptions).length ? asFormatOptions(config.formatOptions) : fallback?.formatOptions || ["webinar"],
    level: config.level === "intermedio" || config.level === "avanzato" ? config.level : "base",
    target: config.target || fallback?.target || "tutti",
    participants: config.participants || fallback?.participants || "illimitati",
    price1h: Number(config.price1h || fallback?.price1h || 0),
    price2h: Number(config.price2h || fallback?.price2h || config.price1h || 0),
    packageAvailable: config.packageAvailable !== false,
    customAvailable: imported ? imported.customAvailable : config.customAvailable !== false,
    customExtra: Number(config.customExtra || fallback?.customExtra || 0),
    masterSlide: config.masterSlide || fallback?.masterSlide || "",
    experts: config.experts?.length ? config.experts : fallback?.experts || [],
    state: config.state === "nascosto" || config.state === "da aggiornare" ? config.state : "attivo",
    durationLabel: imported?.durationLabel || config.durationLabel || fallback?.durationLabel,
    adminNotes: config.adminNotes || fallback?.adminNotes,
    productionStatus: config.productionStatus === "draft" ? "draft" : "published",
  };
}

function toOfficialWorkshop(config: CatalogWorkshopConfig): Workshop {
  const durations = asDurationOptions(config.durationOptions ?? []);
  const formats = asFormatOptions(config.formatOptions ?? []);
  const price1h = Number(config.price1h);
  const price2h = Number(config.price2h);
  if (!config.id || !config.title || !config.topicId || durations.length === 0 || formats.length === 0) {
    throw new Error(`Workshop ufficiale incompleto: ${config.id || "ID mancante"}`);
  }
  if (!Number.isFinite(price1h) || !Number.isFinite(price2h) || price1h < 0 || price2h < 0) {
    throw new Error(`Prezzo ufficiale non valido per ${config.id}`);
  }
  return {
    id: config.id,
    topicId: config.topicId,
    topicIds: config.topicIds?.length ? config.topicIds : [config.topicId],
    themeId: config.themeId || "",
    title: config.title,
    short: config.short || "",
    long: config.long || config.short || "",
    durationOptions: durations,
    formatOptions: formats,
    level: config.level === "intermedio" || config.level === "avanzato" ? config.level : "base",
    target: config.target || "tutti",
    participants: config.participants || "illimitati",
    price1h,
    price2h,
    packageAvailable: config.packageAvailable !== false,
    customAvailable: config.customAvailable !== false,
    customExtra: Number.isFinite(Number(config.customExtra)) ? Number(config.customExtra) : 0,
    masterSlide: config.masterSlide || "",
    experts: Array.isArray(config.experts) ? config.experts : [],
    state: config.state === "nascosto" || config.state === "da aggiornare" ? config.state : "attivo",
    durationLabel: config.durationLabel,
    adminNotes: config.adminNotes,
    productionStatus: config.productionStatus === "draft" ? "draft" : "published",
  };
}

function officialCommercialConfig(value: Partial<CommercialConfig> | undefined): CommercialConfig {
  if (!value || !value.bundlePrices || !value.outcomeSizes) {
    throw new Error("Configurazione commerciale ufficiale incompleta");
  }
  const numericValues = [
    value.workshopBasePrice,
    value.inPersonExtra,
    value.customExtra,
    value.recordingOptOutDiscount,
    value.bundlePrices[3],
    value.bundlePrices[6],
    value.bundlePrices[10],
  ];
  if (numericValues.some((item) => !Number.isFinite(Number(item)))) {
    throw new Error("Configurazione prezzi ufficiale non valida");
  }
  return {
    workshopBasePrice: Number(value.workshopBasePrice),
    inPersonExtra: Number(value.inPersonExtra),
    customExtra: Number(value.customExtra),
    recordingOptOutDiscount: Number(value.recordingOptOutDiscount),
    recordingDefault: value.recordingDefault !== false,
    bundlePrices: {
      3: Number(value.bundlePrices[3]),
      6: Number(value.bundlePrices[6]),
      10: Number(value.bundlePrices[10]),
    },
    outcomeSizes: value.outcomeSizes,
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
  const seed = buildClientCatalogSeed(
    fallbackTopics.map((topic) => ({
      id: topic.id,
      title: topic.title,
      description: topic.description,
      badge: topic.badge,
      active: true,
    })),
    fallbackWorkshops,
  );
  return {
    topics: seed.catalogTopics.map(enrichTopic),
    workshops: seed.catalogWorkshops.map(toWorkshop),
    rules: initialRules,
    bundles: resolveBundleWorkshopIds(seed.bundles, seed.catalogWorkshops.map(toWorkshop)),
    commercialConfig: defaultCommercialConfig,
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
    const response = await fetchAppsScript(url.toString());
    if (!response.ok) throw new Error("Catalogo pubblico non disponibile");
    const result = (await response.json().catch(() => null)) as PublicCatalogResponse | null;
    if (!result) throw new Error("Apps Script ha risposto con un formato non valido");
    if (result.ok === false) throw new Error(result.error || "Catalogo pubblico non disponibile");
    if (!Array.isArray(result.topics) || !Array.isArray(result.workshops) || !Array.isArray(result.rules) || !Array.isArray(result.bundles)) {
      throw new Error("Catalogo ufficiale incompleto");
    }
    const workshops = result.workshops.filter((workshop) => workshop.active !== false && workshop.state !== "nascosto").map(toOfficialWorkshop);
    if (result.topics.length === 0 || workshops.length === 0) throw new Error("Catalogo ufficiale vuoto");
    return {
      topics: result.topics.filter((topic) => topic.active !== false).map(enrichTopic),
      workshops,
      rules: result.rules.map(toRule),
      bundles: resolveBundleWorkshopIds(
        result.bundles.filter((bundle) => bundle.active !== false),
        workshops,
      ),
      commercialConfig: officialCommercialConfig(result.commercialConfig),
      source: "google-sheet",
      updatedAt: result.updatedAt,
    };
  } catch (error) {
    if (allowLocalFallbacks()) return localFallback();
    throw error instanceof Error ? error : new Error("Catalogo pubblico non disponibile");
  }
}
