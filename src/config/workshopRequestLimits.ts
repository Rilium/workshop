export const WORKSHOP_REQUEST_WARNING_THRESHOLD = 12;
export const WORKSHOP_REQUEST_MAX = 25;

export function isLargeWorkshopRequest(count: number) {
  return count > WORKSHOP_REQUEST_WARNING_THRESHOLD;
}
