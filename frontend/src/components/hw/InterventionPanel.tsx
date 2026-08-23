import { ShieldAlert } from "lucide-react";
import { RiskBadge } from "@/components/hw/RiskBadge";
import {
  METRIC_META,
  formatMetric,
  recommendations,
  type RegionAssessment,
} from "@/lib/healthwatch/data";

/**
 * Intervention recommendations derived from the region's current hotspot tier,
 * dominant illness and forecast trajectory.
 */
export function InterventionPanel({
  assessment,
  limit,
  compact = false,
}: {
  assessment: RegionAssessment;
  limit?: number;
  compact?: boolean;
}) {
  const recs = recommendations(assessment);
  const list = limit ? recs.slice(0, limit) : recs;
  const meta = METRIC_META[assessment.mode];

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="label-caps inline-flex items-center gap-1.5">
          <ShieldAlert className="size-3.5" /> Recommended interventions
        </p>
        <RiskBadge risk={assessment.risk} />
      </div>
      <p className="mb-2 text-[11px] text-muted-foreground">
        Triggered by a {assessment.risk} classification at{" "}
        {formatMetric(assessment.value, assessment.mode)} {meta.unit} ({assessment.percentileRank}th
        national percentile).
      </p>
      <ul className={compact ? "space-y-1.5" : "space-y-3"}>
        {list.map((r) =>
          compact ? (
            <li key={r.title} className="text-xs">
              <span className="font-medium">{r.title}.</span>{" "}
              <span className="text-muted-foreground">{r.detail}</span>
            </li>
          ) : (
            <li key={r.title} className="rounded-lg border border-border bg-card/60 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium">{r.title}</p>
                <RiskBadge risk={r.urgency} />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{r.detail}</p>
            </li>
          ),
        )}
      </ul>
    </div>
  );
}
