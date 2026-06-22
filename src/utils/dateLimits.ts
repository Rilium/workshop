export function formatDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function calendarDateLimits(now = new Date()) {
  return {
    min: formatDateKey(now),
    max: `${now.getFullYear()}-12-31`,
  };
}

export function isCalendarDateAllowed(value: string, now = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const limits = calendarDateLimits(now);
  return value >= limits.min && value <= limits.max;
}

export function calendarDateLimitMessage(now = new Date()) {
  const limits = calendarDateLimits(now);
  return `Seleziona una data tra ${limits.min} e ${limits.max}. Non sono ammessi eventi nel passato o nell'anno successivo.`;
}
