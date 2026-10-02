/**
 * Formats a date string or Date object to "Mon YYYY" display format.
 * Input accepts: "YYYY-MM", "YYYY-MM-DD", or a Date object.
 * Example: "2026-09" → "Sep 2026"
 * Uses en-PH locale — HealthWatch is a Philippine public health system.
 * Non-date labels (e.g. season windows like "Jul–Sep 2025") are returned
 * unchanged instead of being mis-parsed into a bogus century.
 */
export function formatMonthYear(input: string | Date): string {
  if (typeof input === "string" && !/^\d{4}-\d{2}(-\d{2})?$/.test(input)) {
    return input;
  }
  const date =
    typeof input === "string" ? new Date(input.length === 7 ? `${input}-01` : input) : input;
  return date.toLocaleDateString("en-PH", { month: "short", year: "numeric" });
}
