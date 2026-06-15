import { statusDescription, statusLabel } from "../data/workflow";
import type { ProjectStatus } from "../types/domain";

export function getStatusLabel(status: ProjectStatus) {
  return statusLabel[status];
}

export function getStatusDescription(status: ProjectStatus) {
  return statusDescription[status];
}
