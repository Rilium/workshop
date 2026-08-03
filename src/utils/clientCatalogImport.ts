import { clientCatalogImport } from "../data/clientCatalog";
import { DEFAULT_WORKSHOP_PRICE, defaultCommercialConfig } from "../data/pricing";
import type { CatalogTopicConfig, CatalogWorkshopConfig, WorkspaceSetting } from "../googleAdminService";
import type { CatalogBundle } from "../types/domain";

function normalizeTitle(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function publicBadge(value?: string) {
  return !value || value === "cliente-2026" ? "base" : value;
}

export function catalogDurationOptions(label: string): Array<"1h" | "1.5h" | "2h"> {
  const normalized = label.replace(",", ".").replace(/\s+/g, "");
  if (normalized === "2") return ["2h"];
  if (normalized.includes("1.30") && normalized.includes("2")) return ["1.5h", "2h"];
  if (normalized.includes("1.30") || normalized.includes("1.5")) return ["1h", "1.5h"];
  return normalized.includes("2") ? ["1h", "2h"] : ["1h"];
}

export function buildClientCatalogSeed(existingTopics: CatalogTopicConfig[], existingWorkshops: CatalogWorkshopConfig[]) {
  const topicByTitle = new Map(existingTopics.map((topic) => [normalizeTitle(topic.title), topic]));
  const resolvedTopicIds = new Map<string, string>();
  const catalogTopics: CatalogTopicConfig[] = clientCatalogImport.topics.map((source) => {
    const existing = topicByTitle.get(normalizeTitle(source.title));
    const id = existing?.id || source.id;
    resolvedTopicIds.set(source.id, id);
    return {
      id,
      title: source.title,
      description: source.description || existing?.description || `Workshop dedicati all’ambito ${source.title}.`,
      badge: publicBadge(existing?.badge || source.badge),
      active: true,
    };
  });

  const workshopByTitle = new Map(existingWorkshops.map((workshop) => [normalizeTitle(workshop.title), workshop]));
  const resolvedWorkshopIds = new Map<string, string>();
  const catalogWorkshops: CatalogWorkshopConfig[] = clientCatalogImport.workshops.map((source) => {
    const existing = workshopByTitle.get(normalizeTitle(source.title));
    const id = existing?.id || source.id;
    resolvedWorkshopIds.set(source.id, id);
    const topicIds = source.topicIds.map((topicId) => resolvedTopicIds.get(topicId) || topicId);
    return {
      id,
      topicId: topicIds[0] || existing?.topicId || "",
      topicIds,
      themeId: existing?.themeId || topicIds[0] || "",
      title: source.title,
      short: source.description,
      long: source.description,
      durationOptions: catalogDurationOptions(source.durationLabel),
      formatOptions: ["webinar", "live"],
      level: existing?.level || "base",
      target: existing?.target || "tutti",
      participants: existing?.participants || "da definire",
      price1h: existing?.price1h || DEFAULT_WORKSHOP_PRICE,
      price2h: existing?.price2h || existing?.price1h || DEFAULT_WORKSHOP_PRICE,
      packageAvailable: existing?.packageAvailable !== false,
      customAvailable: source.customAvailable,
      customExtra: existing?.customExtra || 0,
      masterSlide: existing?.masterSlide || "",
      experts: existing?.experts || [],
      state: source.productionStatus === "draft" ? "da aggiornare" : "attivo",
      active: true,
      durationLabel: source.durationLabel,
      adminNotes: source.adminNotes,
      productionStatus: source.productionStatus,
    };
  });

  const bundles: CatalogBundle[] = clientCatalogImport.bundles.map((bundle) => ({
    id: bundle.id,
    title: bundle.title,
    size: bundle.size,
    workshopIds: bundle.workshopIds.map((workshopId) => resolvedWorkshopIds.get(workshopId) || workshopId),
    active: bundle.active,
    topicIds: bundle.topicIds,
    description: bundle.description,
  }));
  const settings: WorkspaceSetting[] = [
    {
      key: "catalog.bundlesJson",
      value: JSON.stringify(bundles),
      group: "catalog",
      label: "Bundle catalogo",
    },
    {
      key: "pricing.workshopBasePrice",
      value: String(defaultCommercialConfig.workshopBasePrice),
      group: "pricing",
      label: "Prezzo workshop singolo",
    },
    {
      key: "pricing.inPersonExtra",
      value: String(defaultCommercialConfig.inPersonExtra),
      group: "pricing",
      label: "Maggiorazione in presenza",
    },
    {
      key: "pricing.customExtra",
      value: String(defaultCommercialConfig.customExtra),
      group: "pricing",
      label: "Maggiorazione personalizzazione",
    },
    {
      key: "pricing.recordingOptOutDiscount",
      value: String(defaultCommercialConfig.recordingOptOutDiscount),
      group: "pricing",
      label: "Sconto senza registrazione",
    },
    {
      key: "pricing.recordingDefault",
      value: String(defaultCommercialConfig.recordingDefault),
      group: "pricing",
      label: "Registrazione inclusa di default",
    },
    {
      key: "pricing.bundlePricesJson",
      value: JSON.stringify(defaultCommercialConfig.bundlePrices),
      group: "pricing",
      label: "Prezzi pacchetti 3/6/10",
    },
    {
      key: "survey.outcomeSizesJson",
      value: JSON.stringify(defaultCommercialConfig.outcomeSizes),
      group: "survey",
      label: "Dimensione percorsi survey",
    },
  ];

  return { catalogTopics, catalogWorkshops, bundles, settings };
}
