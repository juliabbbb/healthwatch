import { useEffect, useState, type ReactNode } from "react";
import { Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  /** Optional right-aligned control (e.g. a chart-type toggle). */
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  /** Adds the expand-to-dialog icon. Default true. */
  expandable?: boolean;
  /** Render a differently-sized variant inside the expand dialog. */
  renderExpanded?: () => ReactNode;
  expandLabel?: string;
}

/**
 * Generic titled wrapper for charts, matching the glass-panel design system.
 * `expandable` opens the chart in a full-width Radix dialog; use
 * `renderExpanded` to render a larger variant when the default re-render
 * (fixed-height responsive charts) is not enough.
 */
export function ChartCard({
  title,
  subtitle,
  action,
  children,
  className,
  expandable = true,
  renderExpanded,
  expandLabel,
}: ChartCardProps) {
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!expanded) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setExpanded(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [expanded]);

  return (
    <>
      <section
        className={cn(
          "glass-panel rounded-2xl p-5 shadow-sm flex flex-col",
          className,
        )}
      >
        <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold tracking-tight text-foreground">{title}</h3>
            {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {action}
            {expandable && (
              <button
                type="button"
                onClick={() => setExpanded(true)}
                aria-label={expandLabel ?? `Expand ${title}`}
                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
              >
                <Maximize2 className="size-3.5" />
              </button>
            )}
          </div>
        </div>
        {children}
      </section>

      <Dialog open={expanded} onOpenChange={setExpanded}>
        <DialogContent
          overlayClassName="z-[600] bg-black/50 backdrop-blur-sm"
          className="z-[600] glass-panel max-w-5xl max-h-[92vh] overflow-y-auto rounded-2xl border-border/80 p-6 shadow-2xl"
        >
          <DialogHeader className="space-y-1 pr-8">
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              {title}
            </DialogTitle>
            {subtitle && (
              <DialogDescription className="text-xs text-muted-foreground">
                {subtitle}
              </DialogDescription>
            )}
          </DialogHeader>
          <div className="mt-4">
            {renderExpanded ? renderExpanded() : children}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}