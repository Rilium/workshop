import { LIVE_FORMAT_EXTRA } from "../data/pricing";
import type { AdminProject, ProjectStatus, Selection, Workshop } from "../types/domain";
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
    email: "rinaldi.rilio@gmail.com",
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

export function getWorkshopSelectionPrice(workshop: Workshop, selection: Pick<Selection, "duration" | "format" | "custom">) {
  const base = selection.duration === "2h" ? workshop.price2h : workshop.price1h;
  const liveExtra = selection.format === "live" ? LIVE_FORMAT_EXTRA : 0;
  const customExtra = selection.custom ? workshop.customExtra : 0;
  return {
    base,
    liveExtra,
    customExtra,
    total: base + liveExtra + customExtra,
  };
}
