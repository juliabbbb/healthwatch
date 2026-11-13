import { availabilityForRegion, indexForYearMonth, monthMeta, seriesFor } from "@/lib/healthwatch/data";

export function AvailabilityNotice({ regionCode, disease, monthIndex, onSelectMonth }: { regionCode: string; disease: string; monthIndex: number; onSelectMonth?: ((index: number) => void) | undefined }) {
  if (disease === "all") return null;
  const facts = availabilityForRegion(regionCode, disease);
  const series = seriesFor(regionCode, disease);
  const selected = series[monthIndex];
  const selectedAvailable = selected && selected.raw >= 0 && Number.isFinite(selected.cases);
  const history = series.filter((point) => !point.forecast && point.raw >= 0 && Number.isFinite(point.cases));
  const last = facts?.last_observed ?? history.at(-1)?.date;
  let title = "Selected month unavailable";
  let reason = `No reported value or forecast for ${monthMeta(monthIndex).label}.`;
  if (facts?.reason_code === "unresolved_measure") { title = "Source clarification required"; reason = facts.message ?? "Case totals cannot be interpreted from the supplied schema."; }
  else if (facts?.reason_code === "request_failed") { title = "Data request failed"; reason = facts.message ?? "Retry loading the dashboard."; }
  else if (facts && !facts.forecast_available) { title = facts.history_available ? "History available; forecast unavailable" : "Data unavailable"; reason = facts.message ?? "No eligible forecast in this snapshot."; }
  else if (selectedAvailable) return null;
  const lastIndex = last ? indexForYearMonth(Number(last.slice(0, 4)), Number(last.slice(5, 7))) : -1;
  return <section className="mx-5 mt-3 rounded-lg border border-border/70 bg-secondary/30 px-4 py-3" aria-label="Data availability">
    <p className="text-sm font-medium">{title}</p>
    <p className="mt-1 text-xs leading-relaxed text-muted-foreground" role="status">{reason}</p>
    {last && <p className="mt-1 text-xs text-muted-foreground">Last reported month: {last.slice(0, 7)}.{facts ? ` Observed months: ${facts.observed_months}.` : ""}</p>}
    {(facts?.zero_rule_months ?? 0) > 0 && <p className="mt-1 text-xs text-muted-foreground">Includes {facts?.zero_rule_months} internal zero-report months under the user-relayed DOH rule. Wider coverage remains unresolved.</p>}
    {onSelectMonth && lastIndex >= 0 && !selectedAvailable && <button type="button" onClick={() => onSelectMonth(lastIndex)} className="mt-2 rounded border border-border px-3 py-1.5 text-xs font-medium hover:bg-secondary focus-visible:outline-2 focus-visible:outline-ring">View latest reported month</button>}
  </section>;
}
