import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { Bell, Siren, TrendingUp, X } from "lucide-react";
import type { AlertItem } from "@/lib/healthwatch/alerts";

const SEEN_KEY = "healthwatch:alerts-seen";

function readSeenCount(): number {
  try {
    const raw = window.localStorage.getItem(SEEN_KEY);
    const parsed = raw === null ? NaN : Number(raw);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

/**
 * Forecast notification bell.
 *
 * The panel is always rendered via createPortal to document.body so it is
 * completely outside the glass-panel stacking context that wraps the bell
 * button.  Without the portal, backdrop-filter on the parent creates a new
 * containing block that traps fixed-position children.
 *
 * Panel position is calculated from the trigger button's bounding rect so
 * it anchors correctly regardless of where the button sits on screen.
 */
export function NotificationBell({ items }: { items: AlertItem[] }) {
  const [open, setOpen] = useState(false);
  const [seenCount, setSeenCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // We need document to be available for the portal
  useEffect(() => {
    setMounted(true);
    setSeenCount(readSeenCount());
  }, []);

  const unseen = Math.max(0, items.length - seenCount);

  const handleToggle = () => {
    setOpen((prev) => {
      const next = !prev;
      if (next) {
        setSeenCount(items.length);
        try {
          window.localStorage.setItem(SEEN_KEY, String(items.length));
        } catch {
          // Storage unavailable
        }
      }
      return next;
    });
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleToggle}
        aria-label={`Notifications, ${items.length} active`}
        aria-expanded={open}
        title="Forecast alerts"
        className="relative rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
      >
        <Bell className="size-4" />
        {unseen > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 font-mono text-[9px] font-bold leading-none"
            style={{ backgroundColor: "var(--risk-high)", color: "oklch(0.98 0.005 248)" }}
          >
            {unseen > 9 ? "9+" : unseen}
          </span>
        )}
      </button>

      {/* Panel rendered via portal — completely outside any stacking context */}
      {mounted && open &&
        createPortal(
          <NotificationPortalPanel
            items={items}
            triggerRef={triggerRef}
            onClose={() => setOpen(false)}
          />,
          document.body,
        )
      }
    </>
  );
}

/**
 * The actual notification panel, always mounted at document.body via portal.
 * On mobile (<640px) it fills the width with side margins.
 * On desktop it is an anchored dropdown below the trigger button.
 */
function NotificationPortalPanel({
  items,
  triggerRef,
  onClose,
}: {
  items: AlertItem[];
  triggerRef: React.RefObject<HTMLButtonElement | null>;
  onClose: () => void;
}) {
  const [isMobile, setIsMobile] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 640 : false,
  );

  // Track mobile breakpoint
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);

  // Compute dropdown anchor for desktop
  const rect = triggerRef.current?.getBoundingClientRect();
  const desktopTop = rect ? rect.bottom + 8 : 80;
  const desktopRight = rect ? window.innerWidth - rect.right : 16;

  return (
    <>
      {/* Transparent click-away — rendered at body level, never traps anything */}
      <div
        style={{ position: "fixed", inset: 0, zIndex: 9990 }}
        onClick={onClose}
        aria-hidden="true"
      />

      {isMobile ? (
        /* ── Mobile: fixed, full-width with 12px side margins, below the top bar ── */
        <div
          style={{ position: "fixed", top: 64, left: 12, right: 12, zIndex: 9991 }}
          className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl animate-in fade-in-0 slide-in-from-top-2 duration-150"
        >
          <NotificationContent items={items} onClose={onClose} />
        </div>
      ) : (
        /* ── Desktop: absolute-like, anchored below the trigger button ── */
        <div
          style={{
            position: "fixed",
            top: desktopTop,
            right: desktopRight,
            width: 320,
            zIndex: 9991,
          }}
          className="overflow-hidden rounded-xl border border-border/80 bg-card shadow-2xl animate-in fade-in-0 zoom-in-95 duration-150"
        >
          <NotificationContent items={items} onClose={onClose} />
        </div>
      )}
    </>
  );
}

function NotificationContent({
  items,
  onClose,
}: {
  items: AlertItem[];
  onClose: () => void;
}) {
  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border/70 bg-card px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold text-foreground">Forecast Alerts</span>
          {items.length > 0 && (
            <span
              className="rounded-full px-2 py-0.5 font-mono text-[10px] font-bold"
              style={{
                color: "var(--risk-high)",
                backgroundColor: "color-mix(in oklab, var(--risk-high), transparent 86%)",
              }}
            >
              {items.length} active
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          aria-label="Close alerts panel"
          className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      {/* Alert list */}
      <ul className="hw-scroll max-h-[55vh] divide-y divide-border/60 overflow-y-auto">
        {items.length === 0 && (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            No forecast alerts — all monitored regions are currently stable.
          </li>
        )}
        {items.map((a) => (
          <li key={a.id}>
            <Link
              to="/region/$code"
              params={{ code: a.regionCode }}
              onClick={onClose}
              className="flex items-start gap-3 px-4 py-4 transition-colors hover:bg-secondary/60"
            >
              <span
                className="mt-0.5 shrink-0 rounded-md p-1.5"
                style={{
                  color: a.kind === "high-now" ? "var(--risk-high)" : "var(--risk-moderate)",
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

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold leading-snug text-foreground">
                    {a.title}
                  </span>
                  <span className="shrink-0 font-mono text-[11px] text-muted-foreground whitespace-nowrap">
                    {a.month}
                  </span>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  {a.detail}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
