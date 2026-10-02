import { Info } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  METRIC_META,
  RISK_META,
  TIER_BASIS_META,
  type MetricMode,
  type PooledFallbackReason,
  type Thresholds,
  type TierBasis,
} from "@/lib/healthwatch/data";

/**
 * Explains how the Low / Moderate / High tiers are derived for the active
 * metric mode AND the active tier basis. The two bases answer different
 * questions, so the steps differ; saying "pool the national distribution" while
 * the map is tiering each region against its own history would be a lie.
 *
 * `pooledFallback` is only ever true for the hotspot basis, because an
 * explicitly selected burden basis IS the pooled distribution rather than a
 * substitute for it.
 */
export function ClassificationInfo({
  mode,
  thresholds,
  basis = "hotspot",
  pooledFallback = false,
  pooledFallbackReason = null,
  label = "How is risk computed?",
}: {
  mode: MetricMode;
  thresholds?: Thresholds | undefined;
  basis?: TierBasis | undefined;
  pooledFallback?: boolean | undefined;
  pooledFallbackReason?: PooledFallbackReason | undefined;
  label?: string | undefined;
}) {
  const meta = METRIC_META[mode];
  const basisMeta = TIER_BASIS_META[basis];
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
            {" · "}
            Active basis: <span className="text-foreground">{basisMeta.label}</span>
          </DialogDescription>
        </DialogHeader>

        {pooledFallback ? (
          <>
            <p className="rounded-md border border-border bg-secondary/40 p-2.5 text-xs leading-relaxed text-muted-foreground">
              {pooledFallbackReason === "all_illnesses" ? (
                <>
                  <span className="text-foreground">
                    All Illnesses has no per-disease percentile.
                  </span>{" "}
                  A percentile cannot be taken of a sum of five unrelated case scales, so this
                  aggregate view is tiered against the pooled national distribution instead of
                  per-region history. Pick a single illness to use the hotspot basis.
                </>
              ) : (
                <>
                  <span className="text-foreground">No per-region percentile available.</span> The
                  hotspot basis needs a percentile row for this region and month, which is not in
                  the loaded data, so the pooled national distribution is used instead.
                </>
              )}
            </p>
            <PooledSteps />
          </>
        ) : basis === "hotspot" ? (
          <ol className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
            <li>
              <span className="text-foreground">1. Use the region's own history.</span> Every
              reported month for <span className="text-foreground">this region only</span> (2019–
              2026) is collected for the selected illness, so a region is never judged against
              another region.
            </li>
            <li>
              <span className="text-foreground">2. Restrict to the same calendar month.</span> Only
              that region's prior years falling on the same calendar month (e.g. every August) are
              kept, so a wet-season forecast is judged against wet-season norms.
            </li>
            <li>
              <span className="text-foreground">3. Take percentiles.</span> The 50th and 75th
              percentiles of that region's own monthly history become the tier cut-offs. These are
              the same percentiles the pipeline writes to{" "}
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
        ) : (
          <PooledSteps />
        )}

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
          intense transmission in smaller regions. Switching the basis re-cuts every tier — the same
          month can be High on one basis and Moderate on the other, because "high" means{" "}
          {basis === "hotspot"
            ? "above your own seasonal norm"
            : "high relative to the rest of the country"}
          .
        </p>
      </DialogContent>
    </Dialog>
  );
}

/** The four steps behind the pooled-national (burden) basis. */
function PooledSteps() {
  return (
    <ol className="space-y-2.5 text-xs leading-relaxed text-muted-foreground">
      <li>
        <span className="text-foreground">1. Pool the national distribution.</span> Every historical
        month (2019–2026) from all 18 regions is collected for the selected illness and converted
        into the active metric, so regions are ranked against the whole country, not against
        themselves.
      </li>
      <li>
        <span className="text-foreground">2. Restrict to the same calendar month.</span> Only months
        from prior years that fall on the same calendar month (e.g. every August) are kept, so a
        wet-season forecast is judged against wet-season norms.
      </li>
      <li>
        <span className="text-foreground">3. Take percentiles.</span> The 50th and 75th percentiles
        of that pooled window become the tier cut-offs.
      </li>
      <li>
        <span className="text-foreground">4. Classify the value.</span> Below P50 is Low, P50–P75 is
        Moderate, above P75 is High. The percentile rank shown on each region is its position inside
        the same pooled distribution.
      </li>
    </ol>
  );
}
