import { useState } from "react";
import { ChevronDown, ChevronUp, Siren, TrendingUp, TriangleAlert } from "lucide-react";
import type { AlertItem } from "@/lib/healthwatch/alerts";
import { cn } from "@/lib/utils";

/**
 * Bantay-style stacked alert list. Entries are derived client-side from the
 * classification/forecast data already loaded (see lib/healthwatch/alerts.ts);
 * clicking one focuses the region on the map.
 * Fully responsive width and alignment across all screen sizes.
 */
export function AlertsPanel({
  alerts,
  onFocusRegion,
  className,
}: {
  alerts: AlertItem[];
  onFocusRegion: (code: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(true);
  const highCount = alerts.filter((a) => a.kind === "high-now").length;

  return (
    <div
      className={cn(
        "glass-panel pointer-events-auto w-full rounded-xl shadow-xl overflow-hidden",
        className,
      )}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-label={open ? "Collapse alerts panel" : "Expand alerts panel"}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-secondary/30"
      >
        <TriangleAlert
          className="size-4 shrink-0"
          style={{ color: highCount > 0 ? "var(--risk-high)" : "var(--muted-foreground)" }}
        />
        <span className="label-caps flex-1 text-xs font-bold text-foreground">Active alerts</span>
        {alerts.length > 0 && (
          <span
            className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold tabular-nums"
            style={{
              color: highCount > 0 ? "var(--risk-high)" : "var(--risk-moderate)",
              backgroundColor: `color-mix(in oklab, ${highCount > 0 ? "var(--risk-high)" : "var(--risk-moderate)"}, transparent 86%)`,
            }}
          >
            {alerts.length}
          </span>
        )}
        {open ? (
          <ChevronUp className="size-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="size-4 text-muted-foreground" />
        )}
      </button>

      {open && (
        <>
          <ul className="hw-scroll max-h-[36vh] sm:max-h-72 divide-y divide-border/60 overflow-y-auto border-t border-border/70">
            {alerts.length === 0 && (
              <li className="px-4 py-6 text-center text-xs text-muted-foreground">
                No active alerts — every region is within its seasonal range.
              </li>
            )}
            {alerts.map((a) => (
              <li key={a.id}>
                <button
                  onClick={() => onFocusRegion(a.regionCode)}
                  className="flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/70 active:bg-secondary"
                >
                  <span
                    className="mt-0.5 shrink-0 rounded-md p-1.5"
                    style={{
                      color:
                        a.kind === "high-now" ? "var(--risk-high)" : "var(--risk-moderate)",
                      backgroundColor: `color-mix(in oklab, ${
                        a.kind === "high-now" ? "var(--risk-high)" : "var(--risk-moderate)"
                      }, transparent 86%)`,
                    }}
                    aria-hidden="true"
                  >
                    {a.kind === "high-now" ? (
                      <Siren className="size-3.5" />
                    ) : (
                      <TrendingUp className="size-3.5" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {a.title}
                    </span>
                    <span className="mt-0.5 block text-[11px] leading-snug text-muted-foreground line-clamp-2">
                      {a.detail}
                    </span>
                  </span>
                  <span className="shrink-0 pt-0.5 font-mono text-[10px] font-medium tabular-nums text-muted-foreground">
                    {a.week}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {alerts.length > 0 && (
            <div className="border-t border-border/70 px-4 py-2 bg-secondary/15">
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Derived from current classification and the 12-week forecast horizon. Click an alert
                to locate the region on the map.
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
