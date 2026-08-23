import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Bell } from "lucide-react";
import type { AlertItem } from "@/lib/healthwatch/alerts";

/**
 * Forecast notification bell: badge shows active alert count; entries
 * deep-link to the region's own detail route (the HEALTHWATCH equivalent of
 * the reference design's "click an alert → land on region detail" pattern).
 */
export function NotificationBell({ items }: { items: AlertItem[] }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications, ${items.length} active`}
        aria-expanded={open}
        title="Forecast alerts"
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      >
        <Bell className="size-4" />
        {items.length > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-0.5 font-mono text-[9px] font-semibold leading-none"
            style={{ backgroundColor: "var(--risk-high)", color: "oklch(0.98 0.005 248)" }}
          >
            {items.length > 9 ? "9+" : items.length}
          </span>
        )}
      </button>

      {open && (
        <>
          {/* click-away catcher */}
          <button
            aria-hidden="true"
            tabIndex={-1}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-10 cursor-default"
          />
          <div className="glass-panel absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl">
            <p className="label-caps border-b border-border px-3 py-2">Forecast alerts</p>
            <ul className="hw-scroll max-h-80 divide-y divide-border overflow-y-auto">
              {items.length === 0 && (
                <li className="px-3 py-4 text-center text-[11px] text-muted-foreground">
                  No forecast alerts — all monitored regions stable.
                </li>
              )}
              {items.map((a) => (
                <li key={a.id}>
                  <Link
                    to="/region/$code"
                    params={{ code: a.regionCode }}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-2.5 px-3 py-2.5 transition-colors hover:bg-secondary/60"
                  >
                    <span
                      className="mt-1 size-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor:
                          a.kind === "high-now" ? "var(--risk-high)" : "var(--risk-moderate)",
                      }}
                      aria-hidden="true"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium leading-snug">{a.title}</span>
                      <span className="mt-0.5 block text-[10px] leading-snug text-muted-foreground">
                        {a.detail}
                      </span>
                    </span>
                    <span className="shrink-0 pt-0.5 font-mono text-[10px] tabular-nums text-muted-foreground">
                      {a.week}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
