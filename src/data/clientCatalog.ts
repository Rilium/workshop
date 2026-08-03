import source from "./clientCatalogImport.json";
import { DEFAULT_WORKSHOP_PRICE, defaultCommercialConfig } from "./pricing";
import type { CatalogBundle, Duration, Topic, Workshop } from "../types/domain";

export type ClientCatalogTopicImport = {
  id: string;
  title: string;
  description: string;
  badge: string;
  active: boolean;
};

export type ClientCatalogWorkshopImport = {
  id: string;
  topicIds: string[];
  title: string;
  description: string;
  customAvailable: boolean;
  durationLabel: string;
  productionStatus: "published" | "draft";
  adminNotes: string;
  suggestedExperts: string;
};

export const clientCatalogImport = source as {
  source: string;
  version: string;
  topics: ClientCatalogTopicImport[];
  workshops: ClientCatalogWorkshopImport[];
  bundles: Array<CatalogBundle & { memberTitles: string[] }>;
};

export const fallbackCatalogBundles: CatalogBundle[] = clientCatalogImport.bundles.map(
  ({ id, title, size, workshopIds, active, topicIds, description }) => ({
    id,
    title,
    size,
    workshopIds,
    active,
    topicIds,
    description,
  }),
);

const topicVisuals: Record<string, { icon: string; color: string }> = {
  retribuzione: { icon: "banknote", color: "#1cafb9" },
  assicurazione: { icon: "shield", color: "#2aa6a1" },
  risparmio: { icon: "sparkles", color: "#f0ad2e" },
  famiglia: { icon: "users", color: "#8a6bd8" },
  pensione: { icon: "briefcase", color: "#37b679" },
  investimenti: { icon: "chart", color: "#6477d5" },
  finanziamenti: { icon: "home", color: "#d85f8c" },
  fiscalita: { icon: "file", color: "#ff8a63" },
  eredita: { icon: "folder", color: "#7a75d1" },
  casa: { icon: "home", color: "#f3a63b" },
  extra: { icon: "heart", color: "#ef6f9b" },
};

function durationOptionsFromLabel(label: string): Duration[] {
  const normalized = label.replace(",", ".").replace(/\s+/g, "");
  if (normalized === "2") return ["2h"];
  if (normalized.includes("1.30") && normalized.includes("2")) return ["1.5h", "2h"];
  if (normalized.includes("1.30") || normalized.includes("1.5")) return ["1h", "1.5h"];
  return normalized.includes("2") ? ["1h", "2h"] : ["1h"];
}

export const fallbackCatalogTopics: Topic[] = clientCatalogImport.topics
  .filter((topic) => topic.active)
  .map((topic) => ({
    id: topic.id,
    title: topic.title,
    description: topic.description,
    icon: topicVisuals[topic.id]?.icon ?? "sparkles",
    color: topicVisuals[topic.id]?.color ?? "#1cafb9",
    badge: topic.badge === "cliente-2026" ? "base" : topic.badge,
    themes: [],
  }));

export const fallbackCatalogWorkshops: Workshop[] = clientCatalogImport.workshops
  .map((workshop) => ({
    id: workshop.id,
    topicId: workshop.topicIds[0] ?? "",
    topicIds: workshop.topicIds,
    themeId: workshop.topicIds[0] ?? "",
    title: workshop.title,
    short: workshop.description,
    long: workshop.description,
    durationOptions: durationOptionsFromLabel(workshop.durationLabel),
    formatOptions: ["webinar", "live"],
    level: "base",
    target: "tutti",
    participants: "da definire",
    price1h: DEFAULT_WORKSHOP_PRICE,
    price2h: DEFAULT_WORKSHOP_PRICE,
    packageAvailable: true,
    customAvailable: workshop.customAvailable,
    customExtra: defaultCommercialConfig.customExtra,
    masterSlide: "",
    experts: workshop.suggestedExperts
      .split("/")
      .map((expert) => expert.trim())
      .filter(Boolean),
    state: workshop.productionStatus === "draft" ? "da aggiornare" : "attivo",
    durationLabel: workshop.durationLabel,
    adminNotes: workshop.adminNotes,
    productionStatus: workshop.productionStatus,
  }));
