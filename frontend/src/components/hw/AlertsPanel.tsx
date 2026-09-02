import { useState } from "react";
import { ChevronDown, ChevronUp, Siren, TrendingUp, TriangleAlert } from "lucide-react";
import type { AlertItem } from "@/lib/healthwatch/alerts";

/**
 * Bantay-style stacked alert list. Entries are derived client-side from the
 * classification/forecast data already loaded (see lib/healthwatch/alerts.ts);
 * clicking one focuses the region on the map.
 */
export function AlertsPanel({
  alerts,
  onFocusRegion,
}: {
  alerts: AlertItem[];
  onFocusRegion: (code: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const severeCount = alerts.filter((a) => a.kind !== "crossing").length;
  const severe = severeCount > 0;

  return (
    <div className="glass-panel pointer-events-auto w-[21.5rem] max-w-[calc(100vw-2rem)] rounded-xl">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Collapse alerts panel" : "Expand alerts panel"}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <TriangleAlert
          className="size-4 shrink-0"
          style={{ color: severe ? "var(--risk-high)" : "var(--muted-foreground)" }}
        />
        <span className="label-caps flex-1">Active alerts</span>
        {alerts.length > 0 && (
          <span
            className="rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums"
            style={{
              color: severe ? "var(--risk-high)" : "var(--risk-moderate)",
              backgroundColor: `color-mix(in oklab, ${severe ? "var(--risk-high)" : "var(--risk-moderate)"}, transparent 86%)`,
            }}
          >
            {alerts.length}
          </span>
        )}
        {open ? (
          <ChevronUp className="size-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-3.5 text-muted-foreground" />
        )}
      </button>

      {open && (
        <>
          <ul className="hw-scroll max-h-[34vh] divide-y divide-border overflow-y-auto border-t border-border">
            {alerts.length === 0 && (
              <li className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                No active alerts — every region is within its seasonal range.
              </li>
            )}
            {alerts.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => onFocusRegion(a.regionCode)}
                  className="flex w-full items-start gap-2.5 px-3 py-2 text-left transition-colors hover:bg-secondary/60"
                >
                  <span
                    className="mt-0.5 shrink-0 rounded-md p-1"
                    style={{
                      color:
                        a.kind === "outbreak" ? "var(--risk-moderate)" : "var(--risk-high)",
                      backgroundColor: `color-mix(in oklab, ${
                        a.kind === "outbreak" ? "var(--risk-moderate)" : "var(--risk-high)"
                      }, transparent 86%)`,
                    }}
                    aria-hidden="true"
                  >
                    {a.kind === "outbreak" ? (
                      <TriangleAlert className="size-3.5" />
                    ) : a.kind === "high-now" ? (
                      <Siren className="size-3.5" />
                    ) : (
                      <TrendingUp className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={
                        a.kind === "outbreak"
                          ? "block text-xs font-semibold text-foreground"
                          : "block truncate text-xs font-medium"
                      }
                    >
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                      {a.detail}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                    {a.week}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {alerts.length > 0 && (
            <p className="border-t border-border px-3 py-1.5 text-[9px] leading-relaxed text-muted-foreground">
              Weekly risk alerts come from the current classification; seasonal outbreak alerts come
              from Rule A/B on the active season window. Click an alert to locate the region on the
              map.
            </p>
          )}
        </>
      )}
    </div>
  );
}
