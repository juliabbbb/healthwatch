import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { DataLayer } from "./MapCanvas";
import { cn } from "@/lib/utils";
import {
  METRIC_META,
  assessRegion,
  formatMetric,
  monthMeta,
  type MetricMode,
} from "@/lib/healthwatch/data";
import { RiskBadge, SeasonTag } from "./RiskBadge";
import { ForecastCard } from "./ForecastCard";

export interface MobileBottomSheetProps {
  regionCode: string;
  illness: string;
  monthIndex: number;
  mode?: MetricMode;
  onModeChange?: (m: MetricMode) => void;
  layer?: DataLayer;
  onLayerChange?: (l: DataLayer) => void;
  onClose?: () => void;
}

export function MobileBottomSheet({
  regionCode,
  illness,
  monthIndex,
  mode = "percapita",
  onModeChange,
  layer = "hotspot",
  onLayerChange,
  onClose,
}: MobileBottomSheetProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);

  // When a new region is selected, reset to peek state
  useEffect(() => {
    setIsExpanded(false);
  }, [regionCode]);

  const a = assessRegion(regionCode, illness, monthIndex, mode);
  const meta = monthMeta(monthIndex);
  const unit = METRIC_META[mode].unit;

  // Touch handlers for drag gesture
  const handleTouchStart = (e: React.TouchEvent) => {
    const first = e.touches[0];
    if (!first) return;
    touchStartY.current = first.clientY;
    touchCurrentY.current = first.clientY;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    const first = e.touches[0];
    if (!first) return;
    touchCurrentY.current = first.clientY;
  };

  const handleTouchEnd = () => {
    const startY = touchStartY.current;
    const endY = touchCurrentY.current;
    if (startY !== null && endY !== null) {
      const deltaY = endY - startY;
      // Dragged upwards -> expand
      if (deltaY < -35) {
        setIsExpanded(true);
      }
      // Dragged downwards -> collapse
      else if (deltaY > 35) {
        setIsExpanded(false);
      }
    }
    touchStartY.current = null;
    touchCurrentY.current = null;
  };

  return (
    <div
      className={cn(
        "pointer-events-auto fixed inset-x-0 bottom-0 z-[600] flex flex-col transition-all duration-300 ease-out md:hidden",
        isExpanded ? "h-[85vh]" : "h-auto",
      )}
    >
      {/* Backdrop overlay when expanded */}
      {isExpanded && (
        <div
          onClick={() => setIsExpanded(false)}
          className="fixed inset-0 z-[-1] bg-black/60 backdrop-blur-xs transition-opacity duration-300"
          aria-hidden="true"
        />
      )}

      {/* Main Drawer Container */}
      <div
        className={cn(
          "flex flex-col w-full h-full rounded-t-2xl border-t border-x border-border/80 bg-card/98 backdrop-blur-2xl shadow-2xl transition-all duration-300 overflow-hidden",
          !isExpanded && "pb-1 sm:pb-2",
        )}
      >
        {/* Drag Handle & Peek Bar */}
        <div
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onClick={() => setIsExpanded(!isExpanded)}
          role="button"
          tabIndex={0}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "Collapse region drawer" : "Expand region drawer"}
          className="cursor-pointer select-none border-b border-border/40 px-3 pt-1.5 pb-2 active:bg-secondary/30 transition-colors"
        >
          {/* Pull indicator */}
          <div className="mx-auto mb-1.5 h-1 w-10 rounded-full bg-muted-foreground/30 transition-colors hover:bg-muted-foreground/50" />

          {/* Compact Single-Row Peek Content */}
          <div className="flex items-center justify-between gap-2 min-w-0">
            {/* Left: Region short code & name */}
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary shrink-0">
                {a.region.short}
              </span>
              <span className="truncate text-xs font-semibold text-foreground leading-tight">
                {a.region.name}
              </span>
            </div>

            {/* Right: Key metric + Risk badge + Controls */}
            <div className="flex items-center gap-1.5 shrink-0">
              <div className="text-right leading-none">
                <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                  {formatMetric(a.value, mode)}
                </span>
                <span className="hidden xs:inline-block ml-0.5 text-[8px] text-muted-foreground">
                  {unit}
                </span>
              </div>

              <RiskBadge risk={a.risk} />

              {/* Peek mode: show ChevronUp to hint at expansion */}
              {!isExpanded && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(true);
                  }}
                  aria-label="Expand region details"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <ChevronUp className="size-4" />
                </button>
              )}

              {/* Expanded: ChevronDown collapses to peek (region stays selected).
                  Peek: X dismisses the region entirely. */}
              {isExpanded ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded(false);
                  }}
                  aria-label="Collapse region details to peek"
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                >
                  <ChevronDown className="size-4" />
                </button>
              ) : (
                onClose && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    aria-label="Dismiss region panel"
                    className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )
              )}
            </div>
          </div>
        </div>

        {/* Expanded Deep-Dive Content (Scrollable) */}
        {isExpanded && (
          <div className="flex-1 overflow-y-auto hw-scroll overscroll-contain">
            <ForecastCard
              regionCode={regionCode}
              illness={illness}
              monthIndex={monthIndex}
              mode={mode}
              {...(onModeChange ? { onModeChange } : {})}
              {...(onLayerChange ? { onLayerChange } : {})}
              layer={layer}
              variant="sheet"
              showHeader={false}
              className="rounded-none border-none shadow-none"
            />
          </div>
        )}
      </div>
    </div>
  );
}
