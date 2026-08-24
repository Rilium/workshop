import { BUNDLE_PRICES, defaultCommercialConfig } from "../data/pricing";
import type { AdminProject, CatalogBundle, CommercialConfig, Duration, ProjectStatus, Selection, Workshop } from "../types/domain";
import type { WorkshopRequestRecord } from "../requestService";

export function requestToAdminProject(request: WorkshopRequestRecord): AdminProject {
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

export function buildLocalAdminProject(selections: Selection[], quoteTotal: number, status: ProjectStatus): AdminProject {
  return {
    id: "local-request",
    company: "Richiesta locale",
    manager: "Referente cliente",
    email: "",
    phone: "",
    status,
    workshopIds: selections.map((selection) => selection.workshopId),
    quoteTotal,
    dateCount: selections.filter((selection) => selection.date).length,
    source: "local",
  };
}

export function topicColorClass(topicId: string) {
  return `topic-color-${topicId}`;
}

export function formatDuration(duration: Duration) {
  return duration === "1.5h" ? "1h 30 min" : duration;
}

export function getWorkshopSelectionPrice(
  workshop: Workshop,
  selection: Pick<Selection, "duration" | "format" | "custom" | "recordingIncluded">,
  commercialConfig: CommercialConfig = defaultCommercialConfig,
) {
  const base = commercialConfig.workshopBasePrice;
  const liveExtra = selection.format === "live" ? commercialConfig.inPersonExtra : 0;
  const customExtra = selection.custom ? commercialConfig.customExtra : 0;
  const recordingDiscount = selection.recordingIncluded === false ? commercialConfig.recordingOptOutDiscount : 0;
  return {
    base,
    liveExtra,
    customExtra,
    recordingDiscount,
    total: Math.max(0, base + liveExtra + customExtra - recordingDiscount),
  };
}

export function getBundlePrice(bundle: CatalogBundle, commercialConfig: CommercialConfig = defaultCommercialConfig) {
  return commercialConfig.bundlePrices[bundle.size] ?? BUNDLE_PRICES[bundle.size];
}
