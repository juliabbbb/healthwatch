import { useEffect, useState } from "react";
interface EventRow { year: number; events: number; cases: number; deaths: number }
export function HeatReferencePanel({ regionCode }: { regionCode: string }) {
  const [rows, setRows] = useState<EventRow[]>([]);
  const [state, setState] = useState("Loading annual reference data…");
  useEffect(() => {
    const controller = new AbortController(); setRows([]); setState("Loading annual reference data…");
    const base = import.meta.env["VITE_API_URL"] ?? "http://localhost:8000";
    fetch(`${base}/reference/heat-events?region_code=${encodeURIComponent(regionCode)}`, { signal: controller.signal })
      .then(async (response) => { if (!response.ok) throw new Error("Annual reference data could not be loaded."); return response.json() as Promise<{ items: EventRow[] }>; })
      .then((data) => {
        const yearly = new Map<number, EventRow>();
        for (const row of data.items) { const total = yearly.get(row.year) ?? { year: row.year, events: 0, cases: 0, deaths: 0 }; total.events += row.events; total.cases += row.cases; total.deaths += row.deaths; yearly.set(row.year, total); }
        setRows([...yearly.values()].sort((a, b) => a.year - b.year)); setState("No annual event rows are listed for this region. This does not establish zero cases.");
      }).catch(() => { if (!controller.signal.aborted) setState("Annual reference request failed. Reload to retry."); });
    return () => controller.abort();
  }, [regionCode]);
  return <section className="border-b border-border/70 px-5 py-3"><h3 className="text-sm font-medium">Heat-related annual reference</h3>
    {rows.length ? <div className="mt-2 overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Annual heat-related reported events for the selected region</caption><thead><tr><th>Year</th><th>Events</th><th>Cases</th><th>Deaths</th></tr></thead><tbody>{rows.map((row) => <tr key={row.year}><th className="py-1 font-normal">{row.year}{row.year === 2026 ? " (partial)" : ""}</th><td>{row.events}</td><td>{row.cases}</td><td>{row.deaths}</td></tr>)}</tbody></table></div> : <p className="mt-2 text-xs text-muted-foreground" role="status">{state}</p>}
    <p className="mt-2 text-xs text-muted-foreground">Annual aggregates only. Deaths are included in cases. No monthly values or forecasts are inferred.</p>
  </section>;
}
