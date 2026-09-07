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
import { RiskBadge } from "./RiskBadge";
import { ForecastCard } from "./ForecastCard";

export interface MobileBottomSheetProps {
  regionCode: string | null;
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
  const [lastRegionCode, setLastRegionCode] = useState<string | null>(regionCode);

  const touchStartY = useRef<number | null>(null);
  const touchCurrentY = useRef<number | null>(null);

  // Maintain active region code during exit animation
  useEffect(() => {
    if (regionCode) {
      setLastRegionCode(regionCode);
      setIsExpanded(false);
    }
  }, [regionCode]);

  const activeCode = regionCode || lastRegionCode;
  const isVisible = Boolean(regionCode);

  // If no region has ever been selected, render nothing
  if (!activeCode) return null;

  const a = assessRegion(activeCode, illness, monthIndex, mode);
  const unit = METRIC_META[mode].unit;

  // Touch gesture handlers for dragging card/sheet
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
      // Dragged upwards -> expand to full sheet
      if (deltaY < -30) {
        setIsExpanded(true);
      }
      // Dragged downwards
      else if (deltaY > 30) {
        if (isExpanded) {
          // If expanded, collapse back to floating summary card
          setIsExpanded(false);
        } else if (onClose) {
          // If already collapsed, dismiss region entirely
          onClose();
        }
      }
    }
    touchStartY.current = null;
    touchCurrentY.current = null;
  };

  return (
    <>
      {/* 1. Backdrop Overlay (Appears only when Expanded state is active) */}
      <div
        onClick={() => setIsExpanded(false)}
        className={cn(
          "fixed inset-0 z-[590] bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden",
          isVisible && isExpanded ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none",
        )}
        aria-hidden="true"
      />

      {/* 2. State-driven Sheet / Floating Card Container */}
      <div
        className={cn(
          "fixed z-[600] flex flex-col md:hidden transition-all duration-300 ease-in-out",
          // Mutually Exclusive Geometry:
          // Expanded -> Snaps to fill ~85vh vertically, 0 side/bottom margins
          // Collapsed -> Compact floating card with side & bottom margins over the map
          isExpanded
            ? "inset-x-0 bottom-0 h-[85vh] px-0 pb-0"
            : "inset-x-3 bottom-3 h-auto max-w-lg mx-auto",
          // Entry/Exit Motion: Smooth slide up/down + opacity fade
          isVisible
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-[120%] opacity-0 pointer-events-none",
        )}
      >
        {/* Main Card Surface */}
        <div
          className={cn(
            "flex flex-col w-full h-full border border-border/80 bg-card/98 backdrop-blur-2xl shadow-2xl overflow-hidden transition-all duration-300",
            isExpanded ? "rounded-t-3xl border-b-0" : "rounded-2xl",
          )}
        >
          {/* Header & Touch Drag Handle */}
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={() => setIsExpanded(!isExpanded)}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse region details" : "Expand region details sheet"}
            className="group cursor-pointer select-none border-b border-border/40 px-3.5 pt-2.5 pb-3 active:bg-secondary/40 transition-colors shrink-0"
          >
            {/* Pill Drag Handle Affordance */}
            <div className="mx-auto mb-2.5 h-1.5 w-12 rounded-full bg-muted-foreground/40 transition-all duration-200 group-hover:bg-primary/60 group-hover:w-14" />

            {/* Single-Row Summary Bar */}
            <div className="flex items-center justify-between gap-2.5 min-w-0">
              {/* Left: Region Badge & Name */}
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <span className="rounded-md bg-primary/15 px-1.5 py-0.5 font-mono text-[10px] font-bold text-primary shrink-0">
                  {a.region.short}
                </span>
                <span className="truncate text-xs font-bold text-foreground leading-tight">
                  {a.region.name}
                </span>
              </div>

              {/* Right: Key Metric + Risk Badge + Action Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
                <div className="text-right leading-none">
                  <span className="font-mono text-xs font-bold tabular-nums text-foreground">
                    {formatMetric(a.value, mode)}
                  </span>
                  <span className="hidden xs:inline-block ml-0.5 text-[9px] text-muted-foreground">
                    {unit}
                  </span>
                </div>

                <RiskBadge risk={a.risk} />

                {/* Chevron expand/collapse toggle button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsExpanded((prev) => !prev);
                  }}
                  aria-label={isExpanded ? "Collapse region details" : "Expand region details"}
                  className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors active:scale-95"
                >
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronUp className="size-4" />
                  )}
                </button>

                {/* Dismiss Close (X) button */}
                {onClose && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    aria-label="Dismiss region details card"
                    className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors active:scale-95"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Expanded Scrollable Deep-Dive Content */}
          {isExpanded && (
            <div className="flex-1 overflow-y-auto hw-scroll overscroll-contain">
              <ForecastCard
                regionCode={activeCode}
                illness={illness}
                monthIndex={monthIndex}
                mode={mode}
                {...(onModeChange ? { onModeChange } : {})}
                {...(onLayerChange ? { onLayerChange } : {})}
                layer={layer}
                variant="sheet"
                showHeader={false}
                className="rounded-none border-none shadow-none bg-transparent"
              />
            </div>
          )}
        </div>
      </div>
    </>
  );
}

