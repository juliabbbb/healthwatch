/**
 * Formats a date string or Date object to "Mon YYYY" display format.
 * Input accepts: "YYYY-MM", "YYYY-MM-DD", or a Date object.
 * Example: "2026-09" → "Sep 2026"
 * Uses en-PH locale — HealthWatch is a Philippine public health system.
 */
export function formatMonthYear(input: string | Date): string {
  const date =
    typeof input === 'string'
      ? new Date(input.length === 7 ? `${input}-01` : input)
      : input;
  return date.toLocaleDateString('en-PH', { month: 'short', year: 'numeric' });
}
