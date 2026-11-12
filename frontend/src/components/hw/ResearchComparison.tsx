import { useEffect, useState } from "react";

interface Comparison {
  run_id: string;
  fold: string;
  provisional: boolean;
  metrics: { model: string; MAE: number; RMSE: number; MASE: number | null; n: number }[];
}

export function ResearchComparison({ disease, region, regionCode }: { disease: string; region: string; regionCode?: string }) {
  const [fold, setFold] = useState("TEST2025");
  const [result, setResult] = useState<Comparison | null>(null);
  const [message, setMessage] = useState("Loading research comparison…");
  useEffect(() => {
    const controller = new AbortController();
    setResult(null);
    setMessage("Loading research comparison…");
    const canonical = disease === "Influenza-like Illness" ? "ILI" : disease === "Acute Viral Hepatitis" ? "Hep A" : disease;
    const params = new URLSearchParams({ disease: canonical, region, fold });
    if (regionCode) params.set("region_code", regionCode);
    const base = import.meta.env["VITE_API_URL"] ?? "http://localhost:8000";
    fetch(`${base}/research/comparison?${params}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("Research results unavailable for this source, region, or fold.");
        return response.json() as Promise<Comparison>;
      })
      .then(setResult)
      .catch((error: unknown) => {
        if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : "Research results unavailable.");
      });
    return () => controller.abort();
  }, [disease, region, regionCode, fold]);
  return <section className="border-b border-border/70 px-5 py-3">
    <h3 className="text-sm font-medium">Four-model research comparison</h3>
    <label className="text-xs text-muted-foreground">Evaluation period <select className="ml-2 rounded border border-border bg-background p-1" value={fold} onChange={(event) => setFold(event.target.value)}>
      <option value="CV2022">Cross-validation 2022</option><option value="CV2023">Cross-validation 2023</option><option value="CV2024">Cross-validation 2024</option><option value="TEST2025">Retrospective 2025</option>
    </select></label>
    {result ? <><p className="my-2 text-xs text-muted-foreground">Fixed-origin point forecasts. Operational model unchanged.{result.provisional ? " Provisional source interpretation." : ""}</p>
      <div className="overflow-x-auto"><table className="w-full text-left text-xs"><caption className="sr-only">Matched model forecast errors</caption><thead><tr><th>Model</th><th>MAE</th><th>RMSE</th><th>MASE</th><th>Months</th></tr></thead><tbody>{result.metrics.map((row) => <tr key={row.model}><th className="py-1 font-normal">{row.model}</th><td>{row.MAE.toFixed(2)}</td><td>{row.RMSE.toFixed(2)}</td><td>{row.MASE?.toFixed(3) ?? "Unavailable"}</td><td>{row.n}</td></tr>)}</tbody></table></div>
      <p className="mt-2 break-all text-xs text-muted-foreground">Research run: {result.run_id}. Forecast-error ranking does not establish alert recall or deployment readiness.</p></> : <p className="mt-2 text-xs text-muted-foreground" role="status">{message}</p>}
  </section>;
}
