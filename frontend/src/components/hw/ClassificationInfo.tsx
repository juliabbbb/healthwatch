import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { METRIC_META, RISK_META, type MetricMode, type Thresholds } from "@/lib/healthwatch/data";

/**
 * Explains how the Low / Moderate / High hotspot tiers are derived for the
 * currently active metric mode.
 */
export function ClassificationInfo({
  mode,
  thresholds,
  label = "How is risk computed?",
}: {
  mode: MetricMode;
  thresholds?: Thresholds | undefined;
  label?: string | undefined;
}) {
  const meta = METRIC_META[mode];
  const fmt = (v: number) =>
    mode === "raw"
      ? Math.round(v).toLocaleString()
      : v.toLocaleString(undefined, { maximumFractionDigits: 1 });

  return (
    <Dialog>
      <DialogTrigger className="inline-flex items-center gap-1.5 rounded-md border border-border px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground">
        <Info className="size-3.5" /> {label}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-lg">Hotspot classification</DialogTitle>
          <DialogDescription>
            Active metric: <span className="text-foreground">{meta.label}</span> ({meta.unit})
          </DialogDescription>
        </DialogHeader>

        <ol className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="text-foreground">1. Pool the national distribution.</span> Every
            historical month (2022–2026) from all 18 regions is collected for the selected illness
            and converted into the active metric, so regions are ranked against the whole country,
            not against themselves.
          </li>
          <li>
            <span className="text-foreground">2. Restrict to the same calendar month.</span> Only
            months from prior years that fall on the same calendar month (e.g. every August) are
            kept, so a wet-season forecast is judged against wet-season norms.
          </li>
          <li>
            <span className="text-foreground">3. Take percentiles.</span> The 50th and 75th
            percentiles of that pooled window become the tier cut-offs.
          </li>
          <li>
            <span className="text-foreground">4. Classify the forecast value.</span> Below P50 is
            Low, P50–P75 is Moderate, above P75 is High. The percentile rank shown on each region is
            its position inside the same pooled distribution.
          </li>
        </ol>

        <div className="mt-1 space-y-1.5 rounded-lg border border-border bg-card/60 p-3 text-xs">
          {(["low", "moderate", "high"] as const).map((r) => (
            <div key={r} className="flex items-center justify-between gap-3">
              <span className="inline-flex items-center gap-2">
                <span
                  className="size-2 rounded-full"
                  style={{ backgroundColor: RISK_META[r].color }}
                />
                <span className="capitalize">{r}</span>
              </span>
              <span className="tabular-nums text-muted-foreground">
                {thresholds
                  ? r === "low"
                    ? `< ${fmt(thresholds.p50)} ${meta.unit}`
                    : r === "moderate"
                      ? `${fmt(thresholds.p50)} – ${fmt(thresholds.p75)} ${meta.unit}`
                      : `> ${fmt(thresholds.p75)} ${meta.unit}`
                  : r === "low"
                    ? "< 50th percentile"
                    : r === "moderate"
                      ? "50th – 75th percentile"
                      : "> 75th percentile"}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11px] leading-relaxed text-muted-foreground">
          Switching between raw cases and per 100,000 re-pools the distribution: raw mode lets
          large-population regions dominate the upper percentiles, while per-capita mode surfaces
          intense transmission in smaller regions.
        </p>
      </DialogContent>
    </Dialog>
  );
}
