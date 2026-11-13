/**
 * ExplainOverlay.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Guided Tour & Click-to-Explain Overlay with Spotlight Highlight and Tooltips.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import {
  X, HelpCircle, Info, Map as MapIcon, Search, Navigation, Sun,
  Activity, CloudRain, Users, ChevronRight,
  type LucideIcon, Globe, Clock, ArrowRight,
} from "lucide-react";
import { EXPLAIN_REGISTRY } from "@/lib/explainRegistry";
import { useExplainMode } from "@/hooks/useTour";

const ICON_MAP: Record<string, LucideIcon> = {
  Activity, HelpCircle, Info, Map: MapIcon, Search, Navigation, Sun,
  CloudRain, Users, ChevronRight, Globe, Clock, ArrowRight,
};

const TOUR_STEPS = [
  {
    target: "header, [data-explain='top-nav']",
    title: "Welcome to HealthWatch",
    description: "HealthWatch is an early-warning outbreak forecasting system for the Philippines. Use this header bar to toggle views (Map, Seasonality, Compare, Methodology) and switch light/dark themes.",
    icon: "Activity",
  },
  {
    target: "[data-explain='audience-mode']",
    title: "Healthcare Worker vs Citizen Perspective",
    description: "Toggle between Healthcare Worker Mode (detailed clinical demographics, admission projections, Prophet 95% confidence bands) and General Public Mode (simplified risk alerts and household 4S guides).",
    icon: "Users",
  },
  {
    target: "input[aria-label='Search regions'], .hw-search-input, [data-explain='region-search']",
    title: "Instant Region Search",
    description: "Search for any Philippine region or PSGC code (e.g. 'NCR', 'Davao', 'Region III') to quickly jump the map view directly to that area.",
    icon: "Search",
  },
  {
    target: "#hw-map-canvas, [data-explain='map-canvas']",
    title: "Interactive Outbreak Hotspot Map",
    description: "Color-coded choropleth displaying regional risk tiers (Low, Moderate, High) across all 18 Philippine regions. Click any region to open its 12-month forecast and historical trend.",
    icon: "Map",
  },
  {
    target: "#hw-timeline, [data-explain='timeline']",
    title: "Time-Series Playback & 12-Month Forecast",
    description: "Drag the scrubber or click Play to animate disease progression. Look ahead with our 12-month Prophet forecast baseline combined with PAGASA weather nowcasts.",
    icon: "Clock",
  },
  {
    target: "[data-explain='national-snapshot'], #hw-national-card, .hw-alerts-panel",
    title: "National Summary & Escalation Alerts",
    description: "Displays nationwide projected cases, risk distribution summary, and automated early-warning alerts for rapidly escalating outbreak hotspots.",
    icon: "Globe",
  },
];

interface PopoverState { title: string; description: string; icon?: string | undefined; anchorRect: DOMRect; }
interface ExplainOverlayProps { active: boolean; onExit: () => void; }
interface MatchedTarget { title: string; description: string; icon?: string | undefined; rect: DOMRect; }

function findMatchingTarget(el: Element): MatchedTarget | null {
  let node: Element | null = el;
  while (node && node !== document.body && node !== document.documentElement) {
    for (const entry of EXPLAIN_REGISTRY) {
      try {
        if (entry.selector === "main" && node.tagName.toLowerCase() !== "main") continue;
        if (node.matches(entry.selector)) {
          return { title: entry.title, description: entry.description, icon: entry.icon, rect: node.getBoundingClientRect() };
        }
      } catch {}
    }
    node = node.parentElement;
  }
  return null;
}

function computePopoverStyle(anchorRect: DOMRect, cardW = 360, cardH = 180): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 16;
  let top: number, left: number;
  
  left = anchorRect.left + anchorRect.width / 2 - cardW / 2;
  if (left + cardW + margin > vw) left = vw - cardW - margin;
  if (left < margin) left = margin;

  if (anchorRect.bottom + cardH + margin <= vh) {
    top = anchorRect.bottom + margin;
  } else if (anchorRect.top - cardH - margin >= 0) {
    top = anchorRect.top - cardH - margin;
  } else {
    top = vh / 2 - cardH / 2;
  }
  return { position: "fixed", top, left, width: cardW, zIndex: 10001 };
}
export function ExplainOverlay({ active, onExit }: ExplainOverlayProps) {
  const { isTour, stepIndex, nextStep, prevStep } = useExplainMode();
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [hoverTarget, setHoverTarget] = useState<MatchedTarget | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [tourTargetRect, setTourTargetRect] = useState<DOMRect | null>(null);

  const currentTourStep = isTour ? TOUR_STEPS[stepIndex] : null;

  useEffect(() => {
    if (!active || !isTour || !currentTourStep) {
      setTourTargetRect(null); return;
    }
    const updateRect = () => {
      const selectors = currentTourStep.target.split(",").map((s) => s.trim());
      let el: Element | null = null;
      for (const sel of selectors) { el = document.querySelector(sel); if (el) break; }
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        setTimeout(() => el && setTourTargetRect(el.getBoundingClientRect()), 350);
      } else { setTourTargetRect(null); }
    };
    updateRect();
    window.addEventListener("resize", updateRect);
    return () => window.removeEventListener("resize", updateRect);
  }, [active, isTour, stepIndex, currentTourStep]);

  useEffect(() => {
    if (!active) { setPopover(null); setHoverTarget(null); setHoverRect(null); }
  }, [active]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") { if (popover) setPopover(null); else onExit(); }
      else if (isTour) {
        if (e.key === "ArrowRight" || e.key === "ArrowDown" || e.key === "Enter") { e.preventDefault(); nextStep(TOUR_STEPS.length); }
        else if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); prevStep(); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, popover, isTour, nextStep, prevStep, onExit]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isTour) return;
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of els) {
      if (el.id === "hw-explain-overlay" || el.closest("#hw-explain-popover")) continue;
      const match = findMatchingTarget(el);
      if (match) { setHoverTarget(match); setHoverRect(match.rect); }
      else { setHoverTarget(null); setHoverRect(null); }
      return;
    }
    setHoverTarget(null); setHoverRect(null);
  }, [isTour]);

  const handleClick = useCallback((e: React.MouseEvent) => {
    if (isTour) return;
    e.stopPropagation(); e.preventDefault();
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of els) {
      if (el.id === "hw-explain-overlay" || el.closest("#hw-explain-popover")) continue;
      const match = findMatchingTarget(el);
      if (match) setPopover({ title: match.title, description: match.description, icon: match.icon, anchorRect: match.rect });
      else setPopover({ title: "UI Workspace", icon: "Info", description: "This area doesn't have a specific explanation yet.", anchorRect: el.getBoundingClientRect() });
      return;
    }
  }, [isTour]);


  if (!active || typeof document === "undefined") return null;
  const activeAnchorRect = isTour ? tourTargetRect : popover?.anchorRect;
  const popoverStyle = activeAnchorRect ? computePopoverStyle(activeAnchorRect) : undefined;
  const activeIconName = isTour ? currentTourStep?.icon : popover?.icon;
  const PopoverIcon: LucideIcon = (activeIconName ? ICON_MAP[activeIconName] : undefined) ?? Info;
  const activeTitle = isTour ? currentTourStep?.title : popover?.title;
  const activeDescription = isTour ? currentTourStep?.description : popover?.description;

  return createPortal(
    <>
      <div id="hw-explain-overlay" role="presentation" className="hw-explain-overlay" onMouseMove={handleMouseMove} onClick={handleClick}>
        {isTour && tourTargetRect && (
          <div className="absolute rounded-xl ring-4 ring-primary/60 shadow-[0_0_0_9999px_rgba(0,0,0,0.75)] transition-all duration-300 pointer-events-none" style={{ top: tourTargetRect.top - 8, left: tourTargetRect.left - 8, width: tourTargetRect.width + 16, height: tourTargetRect.height + 16, zIndex: 10000 }} />
        )}
      <div className="fixed bottom-4 left-4 z-[10000] rounded-full border border-primary/50 bg-card/80 backdrop-blur px-3 py-1.5 text-xs font-semibold text-primary shadow-lg flex items-center gap-1.5 animate-in slide-in-from-bottom-2">
        <HelpCircle className="size-3.5" />
        <span>Explain Mode Active</span>
      </div>

      </div>
      {(popover || (isTour && currentTourStep)) && popoverStyle && (
        <div id="hw-explain-popover" style={popoverStyle} className="rounded-2xl border border-border/80 bg-card p-5 shadow-2xl backdrop-blur-2xl z-[10001] animate-in fade-in-0 zoom-in-95 duration-200">
          <div className="flex items-start justify-between gap-3 mb-2.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary"><PopoverIcon className="size-4" /></div>
              <h3 className="text-sm font-bold text-foreground leading-snug">{activeTitle}</h3>
            </div>
            <button onClick={() => isTour ? onExit() : setPopover(null)} className="rounded-lg p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><X className="size-4" /></button>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed mb-4">{activeDescription}</p>
          {isTour ? (
            <div className="flex items-center justify-between pt-3 border-t border-border/80">
              <div className="flex items-center gap-2">
                <button type="button" onClick={prevStep} disabled={stepIndex === 0} className="rounded-lg bg-secondary px-3 py-1.5 text-xs font-semibold text-secondary-foreground hover:bg-secondary/80 disabled:opacity-40 cursor-pointer">Back</button>
                <span className="font-mono text-[11px] text-muted-foreground">{stepIndex + 1}/{TOUR_STEPS.length}</span>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={onExit} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer">Skip</button>
                <button type="button" onClick={() => nextStep(TOUR_STEPS.length)} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-1.5 text-xs font-bold text-primary-foreground shadow-md hover:opacity-90 active:scale-95 cursor-pointer">
                  <span>{stepIndex === TOUR_STEPS.length - 1 ? "Finish Tour" : "Next"}</span><ArrowRight className="size-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between pt-3 border-t border-border/80 text-xs">
              <span className="text-muted-foreground">Click another element to inspect</span>
              <button onClick={(e) => { e.stopPropagation(); onExit(); }} className="rounded-lg bg-secondary px-3 py-1 text-secondary-foreground hover:bg-foreground hover:text-background font-semibold">Exit (Esc)</button>
            </div>
          )}
        </div>
      )}
    </>,
    document.body
  );
}

