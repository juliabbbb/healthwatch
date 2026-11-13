import { heatReferenceForRegion } from "@/lib/healthwatch/data";

export function HeatReferencePanel({ regionCode }: { regionCode?: string }) {
  const rows = heatReferenceForRegion(regionCode);
  const years = [...new Set(rows.map((row) => row.year))].sort((a, b) => a - b);
  const count = (year: number, field: "events" | "cases" | "deaths") =>
    rows.filter((row) => row.year === year).reduce((total, row) => total + Number(row[field]), 0).toLocaleString();
  return <section className="rounded-lg border border-border/70 bg-secondary/20 p-3" aria-label="Original annual heat records">
    <h3 className="text-sm font-semibold">Heat-related records · annual source</h3>
    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">The supplied DOH report lists annual events. Monthly counts, forecasts and risk tiers are unavailable.</p>
    {years.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm">
      <caption className="sr-only">Annual heat-related totals listed in the original report</caption>
      <thead><tr className="border-b border-border"><th scope="col" className="py-2 pr-2">Year</th><th scope="col" className="p-2 text-right">Events</th><th scope="col" className="p-2 text-right">Cases listed</th><th scope="col" className="py-2 pl-2 text-right">Deaths listed</th></tr></thead>
      <tbody>{years.map((year) => <tr key={year} className="border-b border-border/50"><th scope="row" className="py-2 pr-2 font-mono font-normal">{year}</th><td className="p-2 text-right font-mono">{count(year, "events")}</td><td className="p-2 text-right font-mono">{count(year, "cases")}</td><td className="py-2 pl-2 text-right font-mono">{count(year, "deaths")}</td></tr>)}</tbody>
    </table></div> : <p className="mt-2 text-sm text-muted-foreground">No annual events are listed for this region in the supplied report.</p>}
    <p className="mt-2 text-xs leading-relaxed text-muted-foreground">Source: DOH Heat-Related Events Report, Table 1, pages 2–3. These are the listed event totals; missing years or regions do not mean zero cases.</p>
  </section>;
}
