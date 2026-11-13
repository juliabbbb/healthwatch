/** Serialize unavailable numbers as empty cells, preserving valid zero and quoting text. */
export function encodeCsv(header: string[], rows: (string | number | boolean | null)[][]): string {
  const escape = (value: string | number | boolean | null): string => {
    const text = value == null || (typeof value === "number" && !Number.isFinite(value)) ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  if (rows.some((row) => row.length !== header.length)) throw new Error("CSV column count mismatch");
  return "\ufeff" + [header, ...rows].map((row) => row.map(escape).join(",")).join("\n");
}
