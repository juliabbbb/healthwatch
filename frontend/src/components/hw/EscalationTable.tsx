import { useEffect, useState } from "react";
import { ArrowUpRight, TrendingUp } from "lucide-react";
import { loadEscalation, type EscalationItem } from "@/lib/healthwatch/data";
import { RISK_META, type RiskLevel } from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

const TIER_LEVEL: Record<string, RiskLevel> = {
  Low: "low",
  Moderate: "moderate",
  High: "high",
};

/**
 * Risk-tier escalation ranking, straight from GET /escalation.
 *
 * This is a different question from the per-region comparison above: that one
 * ranks regions by how big they are right now, this one ranks them by how fast
 * they are about to get worse, which is the order a surveillance team should
 * staff in. `tier_climbs` counts upward tier transitions across the 12-month
 * horizon; `first_high_month` is when the region is first predicted to cross
 * its own P75.
 *
 * A series the pipeline declined to forecast (stale reporting, too little
 * history) is absent from this ranking entirely -- it has no tier path to climb.
 */
export function EscalationTable({ disease }: { disease: string }) {
  const [items, setItems] = useState<EscalationItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setItems(null);
    void loadEscalation(disease).then((res) => {
      if (!cancelled) setItems(res);
    });
    return () => {
      cancelled = true;
    };
  }, [disease]);

  // "All Illnesses" has no escalation ranking of its own: tier_climbs is
  // computed per disease from that disease's own thresholds, and the five case
  // scales are not additive.
  if (disease === "all") {
    return (
      <section className="glass-panel rounded-xl p-4 sm:p-5">
        <SectionHeader
          title="Risk-tier escalation ranking"
          sub="Ranked by upward risk-tier transitions across the 12-month forecast horizon"
        />
        <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
          Escalation is tiered per disease against that disease's own thresholds, so there is no
          single ranking for All Illnesses. Select a specific illness above to see its escalation
          priority order.
        </p>
      </section>
    );
  }

  const climbing = (items ?? []).filter((i) => i.tier_climbs > 0);

  return (
    <section className="glass-panel rounded-xl p-4 sm:p-5" data-explain="escalation-table">
      <SectionHeader
        title="Risk-tier escalation ranking"
        sub={`${disease} · steepest risers first · ${climbing.length} of ${items?.length ?? 0} regions climb a tier in the next 12 months`}
      />

      {items === null ? (
        <p className="mt-3 text-xs text-muted-foreground">Loading escalation ranking…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          No escalation ranking available for this illness.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-lg border border-border/70">
          <table className="w-full min-w-[560px] text-left text-xs border-collapse">
            <thead className="label-caps">
              <tr className="border-b border-border/70 bg-secondary/35 text-[10px] uppercase font-semibold tracking-wider text-muted-foreground">
                <th className="px-3 py-2.5 border-r border-border/40">#</th>
                <th className="px-3 py-2.5 border-r border-border/40">Region</th>
                <th className="px-3 py-2.5 text-right border-r border-border/40">Tier climbs</th>
                <th className="px-3 py-2.5 text-right border-r border-border/40">Net change</th>
                <th className="px-3 py-2.5 text-right border-r border-border/40">High months</th>
                <th className="px-3 py-2.5 text-right border-r border-border/40">First High</th>
                <th className="px-3 py-2.5 text-right">Ends at</th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr
                  key={it.region_code}
                  className={cn(
                    "border-b border-border/30 transition-colors odd:bg-card/40 even:bg-secondary/15 hover:bg-secondary/30",
                    it.tier_climbs === 0 && "text-muted-foreground",
                  )}
                >
                  <td className="px-3 py-2 font-mono tabular-nums border-r border-border/30">
                    {it.rank}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground border-r border-border/30">
                    {it.region}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums border-r border-border/30">
                    {it.tier_climbs > 0 ? (
                      <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                        <TrendingUp className="size-3 text-risk-high" aria-hidden="true" />
                        {it.tier_climbs}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </td>
                  <td
                    className={cn(
                      "px-3 py-2 text-right font-mono tabular-nums border-r border-border/30",
                      it.net_climb > 0
                        ? "text-risk-high"
                        : it.net_climb < 0
                          ? "text-muted-foreground"
                          : "",
                    )}
                  >
                    {it.net_climb > 0 ? "+" : ""}
                    {it.net_climb}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums border-r border-border/30">
                    {it.n_high_months}
                  </td>
                  <td className="px-3 py-2 text-right font-mono tabular-nums border-r border-border/30">
                    {it.first_high_month ?? "—"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className="inline-flex items-center gap-1.5"
                      style={{ color: RISK_META[TIER_LEVEL[it.final_tier] ?? "low"].color }}
                    >
                      <ArrowUpRight className="size-3" aria-hidden="true" />
                      {it.final_tier}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
        A tier climb is a move up one or more risk tiers, counted month by month across the forecast
        horizon. Regions whose reporting stopped, or with too little history to model, are not
        forecast and therefore do not appear here.
      </p>
    </section>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div>
      <p className="label-caps text-[11px] font-semibold tracking-wider text-foreground">{title}</p>
      <p className="text-[11px] text-muted-foreground">{sub}</p>
    </div>
  );
}
