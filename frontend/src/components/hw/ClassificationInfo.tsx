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
 * Explains how the Low / Moderate / High tiers are derived for the active metric
 * mode. Tiers are always the per-region hotspot yardstick: each region's month is
 * cut against that region's own P50/P75 for the same calendar month, which is
 * the classification the pipeline computes and validates.
 *
 * `pooledFallback` is true only when a per-region percentile row was missing and
 * the pooled national distribution had to stand in for it. That never happens
 * for a single illness; the All Illnesses aggregate always takes that path and
 * discloses it in the region card instead.
 */
export function ClassificationInfo({
  mode,
  thresholds,
  pooledFallback = false,
  label = "How is risk computed?",
}: {
  mode: MetricMode;
  thresholds?: Thresholds | undefined;
  pooledFallback?: boolean | undefined;
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
          <DialogTitle className="text-lg">Risk classification</DialogTitle>
          <DialogDescription>
            Active metric: <span className="text-foreground">{meta.label}</span> ({meta.unit})
          </DialogDescription>
        </DialogHeader>

        {pooledFallback && (
          <p className="rounded-md border border-border bg-secondary/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
            <span className="text-foreground">No percentile for this region and month.</span> The
            tier cut-offs below are not in the loaded data for this region, so the national
            distribution is used instead. The tiers shown are therefore not this region's own
            seasonal percentiles.
          </p>
        )}

        <ol className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
          <li>
            <span className="text-foreground">1. Use the region's own history.</span> Every reported
            month for <span className="text-foreground">this region only</span> (2019–2026) is
            collected for the selected illness, so a region is never judged against another region.
          </li>
          <li>
            <span className="text-foreground">2. Restrict to the same calendar month.</span> Only
            that region's prior years falling on the same calendar month (e.g. every August) are
            kept, so a wet-season forecast is judged against wet-season norms.
          </li>
          <li>
            <span className="text-foreground">3. Take percentiles.</span> The 50th and 75th
            percentiles of that region's own monthly history become the tier cut-offs. These are the
            same percentiles the pipeline writes to{" "}
            <span className="font-mono">risk_thresholds</span> and uses to tier the forecast.
            {mode === "percapita" ? (
              <>
                {" "}
                They are divided by the region's population to match the per-100k unit being
                displayed, so both sides of the comparison are in the same unit.
              </>
            ) : null}
          </li>
          <li>
            <span className="text-foreground">4. Classify the value.</span> Below P50 is Low,
            P50–P75 is Moderate, above P75 is High.
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
          Because the cut-offs are this region's own percentiles, a tier means{" "}
          <span className="text-foreground">above or below that region's own seasonal norm</span> —
          not high relative to the rest of the country. Switching between raw cases and per 100,000
          re-expresses both sides in the same unit: raw mode lets large-population regions dominate
          the absolute counts, while per-capita mode surfaces intense transmission in smaller
          regions. The tier a region receives is unchanged by that switch.
        </p>
      </DialogContent>
    </Dialog>
  );
}
