import { statusDescription, statusLabel } from "../data/workflow";
import type { ProjectStatus } from "../types/domain";

export function getStatusLabel(status: ProjectStatus) {
  return statusLabel[status];
}

export function getStatusDescription(status: ProjectStatus) {
  return statusDescription[status];
}

export function getFriendlyErrorMessage(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  if (/failed to fetch/i.test(message)) return fallback;
  if (/networkerror/i.test(message)) return fallback;
  return message;
}
