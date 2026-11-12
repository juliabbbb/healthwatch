import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { AvailabilityNotice } from "../src/components/hw/AvailabilityNotice";
import { HeatReferencePanel } from "../src/components/hw/HeatReferencePanel";
import { dataReady, indexForYearMonth, monthMeta, seriesFor, availabilityForRegion, formatMetric } from "../src/lib/healthwatch/data";
import "../src/styles.css";

function Panel({ disease, regionCode, width }: { disease: string; regionCode: string; width: number }) {
  const [index, setIndex] = useState(indexForYearMonth(2026, 9));
  const point = seriesFor(regionCode, disease)[index];
  const facts = availabilityForRegion(regionCode, disease);
  return <article className="glass-panel rounded-xl pb-4" style={{ width, maxWidth: "100%" }}><h2 className="px-5 pt-4 text-base font-medium">{disease} · {regionCode === "130000000" ? "NCR" : "Ilocos"}</h2>
    <p className="px-5 pt-2 text-xs text-muted-foreground">Selected month: {monthMeta(index).label}. {facts?.source_status}</p>
    <AvailabilityNotice disease={disease} regionCode={regionCode} monthIndex={index} onSelectMonth={setIndex} />
    {disease === "Heat-Related Illness" ? <HeatReferencePanel regionCode={regionCode} /> : <p className="px-5 pt-3 text-sm">Cases: {formatMetric(point?.cases ?? NaN, "raw")}</p>}
    {disease === "Influenza-like Illness" && <p className="px-5 pt-2 text-xs text-muted-foreground">Provisional header reversal and calendar; not source-confirmed.</p>}
  </article>;
}
async function main() {
  await dataReady;
  createRoot(document.getElementById("root")!).render(<main className="p-6"><h1 className="mb-3 text-xl font-medium">Actual local availability · desktop and narrow cards</h1><p className="mb-5 text-sm">Verified local API data. Date changes only after selecting the history button.</p><div className="flex flex-wrap items-start gap-5"><Panel disease="Cholera" regionCode="010000000" width={440} /><Panel disease="Acute Viral Hepatitis" regionCode="130000000" width={340} /><Panel disease="Heat-Related Illness" regionCode="130000000" width={340} /><Panel disease="Influenza-like Illness" regionCode="130000000" width={340} /></div></main>);
}
void main();
