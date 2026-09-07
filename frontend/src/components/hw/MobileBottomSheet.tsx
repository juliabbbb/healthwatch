import { useEffect, useRef, useState } from "react";
import { ChevronDown, X } from "lucide-react";
import type { DataLayer } from "./MapCanvas";
import { cn } from "@/lib/utils";
import { METRIC_META, assessRegion, formatMetric, type MetricMode } from "@/lib/healthwatch/data";
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

  // Real-time gesture drag state
  const [dragOffsetY, setDragOffsetY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const dragStartPos = useRef<{ y: number; time: number } | null>(null);
  const currentDragPos = useRef<{ y: number; time: number } | null>(null);
  const isExpandedRef = useRef(isExpanded);
  isExpandedRef.current = isExpanded;

  // Maintain active region code during exit animation
  useEffect(() => {
    if (regionCode) {
      setLastRegionCode(regionCode);
      setIsExpanded(false);
      setDragOffsetY(0);
    }
  }, [regionCode]);

  const activeCode = regionCode || lastRegionCode;
  const isVisible = Boolean(regionCode);

  // If no region has ever been selected, render nothing
  if (!activeCode) return null;

  const a = assessRegion(activeCode, illness, monthIndex, mode);
  const unit = METRIC_META[mode].unit;

  // Touch & Pointer Gesture Handlers
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== undefined && e.button !== 0) return;

    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // Fallback if capture unavailable
    }

    const now = performance.now();
    dragStartPos.current = { y: e.clientY, time: now };
    currentDragPos.current = { y: e.clientY, time: now };
    setIsDragging(true);
    setDragOffsetY(0);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartPos.current) return;

    const now = performance.now();
    const currentY = e.clientY;
    currentDragPos.current = { y: currentY, time: now };

    const deltaY = currentY - dragStartPos.current.y;

    if (isExpandedRef.current) {
      // Expanded sheet dragging logic
      if (deltaY > 0) {
        // Dragging down towards collapse
        setDragOffsetY(deltaY);
      } else {
        // Dragging up past top limit (elastic rubber-band resistance)
        setDragOffsetY(deltaY * 0.2);
      }
    } else {
      // Collapsed floating card dragging logic
      setDragOffsetY(deltaY);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || !dragStartPos.current) return;

    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore
    }

    const startY = dragStartPos.current.y;
    const startTime = dragStartPos.current.time;
    const endY = currentDragPos.current?.y ?? e.clientY;
    const endTime = currentDragPos.current?.time ?? performance.now();

    const deltaY = endY - startY;
    const deltaTime = Math.max(1, endTime - startTime);
    const velocityY = deltaY / deltaTime; // px/ms

    setIsDragging(false);

    // Tap / Click threshold check (< 6px movement)
    if (Math.abs(deltaY) < 6) {
      setIsExpanded((prev) => !prev);
      setDragOffsetY(0);
      dragStartPos.current = null;
      currentDragPos.current = null;
      return;
    }

    if (isExpandedRef.current) {
      // In Expanded mode: drag down > 70px or fast swipe down -> Collapse
      if (deltaY > 70 || velocityY > 0.35) {
        setIsExpanded(false);
      }
    } else {
      // In Collapsed mode: drag up > 50px or fast swipe up -> Expand
      if (deltaY < -50 || velocityY < -0.35) {
        setIsExpanded(true);
      }
      // Drag down > 70px or fast swipe down -> Dismiss
      else if (deltaY > 70 || velocityY > 0.4) {
        if (onClose) {
          onClose();
        }
      }
    }

    setDragOffsetY(0);
    dragStartPos.current = null;
    currentDragPos.current = null;
  };

  const handlePointerCancel = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture was already released or unavailable
    }
    setIsDragging(false);
    setDragOffsetY(0);
    dragStartPos.current = null;
    currentDragPos.current = null;
  };

  // Dynamic backdrop opacity calculation during drag
  const calculatedOpacity = isExpanded
    ? Math.max(0, 1 - (isDragging && dragOffsetY > 0 ? dragOffsetY / 350 : 0))
    : Math.min(1, isDragging && dragOffsetY < 0 ? -dragOffsetY / 250 : 0);

  const showBackdrop = isVisible && (isExpanded || (isDragging && dragOffsetY < -30));

  return (
    <>
      {/* 1. Backdrop Overlay */}
      <div
        onClick={() => setIsExpanded(false)}
        style={{ opacity: showBackdrop ? calculatedOpacity : 0 }}
        className={cn(
          "fixed inset-0 z-[590] bg-black/60 backdrop-blur-xs transition-opacity duration-300 md:hidden",
          showBackdrop ? "pointer-events-auto" : "pointer-events-none",
        )}
        aria-hidden="true"
      />

      {/* 2. State-driven Sheet / Floating Card Container */}
      <div
        className={cn(
          "fixed z-[600] flex flex-col md:hidden",
          isExpanded
            ? "inset-x-0 bottom-0 h-[85vh] px-0 pb-0"
            : "inset-x-3 bottom-3 h-auto max-w-lg mx-auto",
          isVisible ? "pointer-events-auto" : "pointer-events-none",
        )}
        style={{
          transform: isVisible ? `translateY(${dragOffsetY}px)` : "translateY(120%)",
          opacity: isVisible ? 1 : 0,
          transition: isDragging
            ? "none"
            : "transform 320ms cubic-bezier(0.32, 0.72, 0, 1), height 320ms cubic-bezier(0.32, 0.72, 0, 1), opacity 250ms ease",
        }}
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
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerCancel}
            role="button"
            tabIndex={0}
            aria-expanded={isExpanded}
            aria-label={isExpanded ? "Collapse region details" : "Expand region details sheet"}
            className="group cursor-grab active:cursor-grabbing select-none touch-none border-b border-border/40 px-3.5 pt-2.5 pb-3 active:bg-secondary/40 transition-colors shrink-0"
          >
            {/* Pill Drag Handle Affordance */}
            <div
              className={cn(
                "mx-auto mb-2.5 h-1.5 rounded-full transition-all duration-200",
                isDragging
                  ? "bg-primary w-16 scale-y-110"
                  : "w-12 bg-muted-foreground/40 group-hover:bg-primary/60 group-hover:w-14",
              )}
            />

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

                {/* Chevron collapse button (Only rendered when expanded) */}
                {isExpanded && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsExpanded(false);
                    }}
                    aria-label="Collapse region details"
                    className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors active:scale-95"
                  >
                    <ChevronDown className="size-4" />
                  </button>
                )}

                {/* Dismiss Close (X) button */}
                {onClose && (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
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
