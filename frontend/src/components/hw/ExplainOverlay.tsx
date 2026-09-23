/**
 * ExplainOverlay.tsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Click-to-explain inspector overlay.
 *
 * When `active` is true:
 *  - A semi-transparent overlay fills the screen with a crosshair cursor.
 *  - Hovering highlights the element under the cursor.
 *  - Clicking any element looks it up in EXPLAIN_REGISTRY (walking up the DOM
 *    until a match is found), then shows a floating card with the static explanation.
 *  - If AI-assisted analysis is enabled in Settings, an on-demand "Deep-dive with AI"
 *    button appears to fetch live context interpretation from Groq AI.
 *  - In-memory caching prevents duplicate network requests.
 *  - Clicking outside the card while it's open dismisses the card (but stays in mode).
 *  - Pressing Esc or clicking the active ? button exits explain mode.
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  X,
  HelpCircle,
  Info,
  Map as MapIcon,
  Search,
  Navigation,
  Sun,
  Settings,
  Share2,
  Mail,
  ZoomIn,
  BarChart2,
  AlertTriangle,
  TrendingUp,
  Clock,
  ArrowLeft,
  Layers,
  Filter,
  MapPin,
  Activity,
  Calendar,
  CloudRain,
  SlidersHorizontal,
  LayoutGrid,
  Waves,
  Percent,
  RefreshCw,
  RotateCcw,
  Sparkles,
  FileDown,
  FileText,
  CalendarRange,
  ChevronDown,
  CheckCircle,
  BookOpen,
  Globe,
  Menu,
  LayoutDashboard,
  GitCompare,
  Table,
  Sliders,
  Loader2,
  Bot,
  type LucideIcon,
} from "lucide-react";
import { EXPLAIN_REGISTRY } from "@/lib/explainRegistry";
import { useAiAnalysisSetting } from "@/hooks/use-ai-analysis-setting";

const API_BASE = import.meta.env?.["VITE_API_URL"] ?? "http://localhost:8000";

/** Map icon name strings from the registry to actual Lucide components. */
const ICON_MAP: Record<string, LucideIcon> = {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  BookOpen,
  Calendar,
  CalendarRange,
  CheckCircle,
  ChevronDown,
  Clock,
  CloudRain,
  FileDown,
  FileText,
  Filter,
  GitCompare,
  Globe,
  HelpCircle,
  Info,
  LayoutDashboard,
  LayoutGrid,
  Layers,
  Mail,
  Map: MapIcon,
  MapPin,
  Menu,
  Navigation,
  Percent,
  RefreshCw,
  RotateCcw,
  Search,
  Settings,
  Share2,
  Sliders,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Table,
  TrendingUp,
  Waves,
  ZoomIn,
};

interface PopoverState {
  title: string;
  description: string;
  icon?: string;
  /** Viewport-relative anchor rect of the clicked element */
  anchorRect: DOMRect;
}

interface ExplainOverlayProps {
  active: boolean;
  onExit: () => void;
}

/** Client-side in-memory cache for Groq AI responses */
const aiCache = new Map<string, string>();

/** Walk up from `el` until we find a node matching one of the registry selectors. */
function findExplanation(
  el: Element,
): { title: string; description: string; icon?: string } | null {
  let node: Element | null = el;
  while (node && node !== document.body) {
    if (node.id === "hw-explain-overlay" || node.closest("#hw-explain-popover")) {
      return null;
    }
    for (const entry of EXPLAIN_REGISTRY) {
      try {
        if (node.matches(entry.selector) || node.closest(entry.selector)) {
          return { title: entry.title, description: entry.description, icon: entry.icon };
        }
      } catch {
        // ignore invalid selectors
      }
    }
    node = node.parentElement;
  }
  return null;
}

/** Compute best position for the popover card (avoid viewport edges). */
function computePopoverStyle(
  anchorRect: DOMRect,
  cardW = 340,
  cardH = 200,
): React.CSSProperties {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const margin = 12;

  let top: number;
  let left: number;

  left = anchorRect.left;
  if (left + cardW + margin > vw) left = vw - cardW - margin;
  if (left < margin) left = margin;

  if (anchorRect.bottom + cardH + margin <= vh) {
    top = anchorRect.bottom + margin;
  } else if (anchorRect.top - cardH - margin >= 0) {
    top = anchorRect.top - cardH - margin;
  } else {
    top = vh / 2 - cardH / 2;
  }

  return { position: "fixed", top, left, width: cardW, zIndex: 9999 };
}

export function ExplainOverlay({ active, onExit }: ExplainOverlayProps) {
  const [popover, setPopover] = useState<PopoverState | null>(null);
  const [hoverRect, setHoverRect] = useState<DOMRect | null>(null);
  const [aiEnabled] = useAiAnalysisSetting();
  const [aiState, setAiState] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [aiNarrative, setAiNarrative] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Reset states when mode or popover changes
  useEffect(() => {
    if (!active || !popover) {
      setAiState("idle");
      setAiNarrative(null);
      setAiError(null);
      if (!active) {
        setPopover(null);
        setHoverRect(null);
      }
    } else {
      // Check if cache already has an entry for this title
      const cached = aiCache.get(popover.title);
      if (cached) {
        setAiNarrative(cached);
        setAiState("success");
      } else {
        setAiState("idle");
        setAiNarrative(null);
        setAiError(null);
      }
    }
  }, [active, popover]);

  // Global Esc key handler
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (popover) {
          setPopover(null);
        } else {
          onExit();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, popover, onExit]);

  // Hover tracking
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    const els = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of els) {
      if (el.id === "hw-explain-overlay" || el.closest("#hw-explain-popover")) continue;
      setHoverRect(el.getBoundingClientRect());
      return;
    }
    setHoverRect(null);
  }, []);

  const handleMouseLeave = useCallback(() => setHoverRect(null), []);

  // Click handler
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();

    const els = document.elementsFromPoint(e.clientX, e.clientY);
    for (const el of els) {
      if (el.id === "hw-explain-overlay" || el.closest("#hw-explain-popover")) continue;

      const match = findExplanation(el);
      if (match) {
        setPopover({ ...match, anchorRect: el.getBoundingClientRect() });
      } else {
        setPopover({
          title: "UI Element",
          icon: "Info",
          description:
            "This element doesn't have a specific explanation yet. Try clicking a chart, card, button, or slider for detailed info.",
          anchorRect: el.getBoundingClientRect(),
        });
      }
      return;
    }
  }, []);

  // Fetch AI deep-dive explanation on explicit user request
  const handleFetchAi = useCallback(async () => {
    if (!popover) return;
    const cacheKey = popover.title;
    if (aiCache.has(cacheKey)) {
      setAiNarrative(aiCache.get(cacheKey)!);
      setAiState("success");
      return;
    }

    setAiState("loading");
    setAiError(null);
    try {
      const res = await fetch(`${API_BASE}/analysis/explain-element`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: popover.title,
          description: popover.description,
        }),
      });

      if (!res.ok) {
        let detail = "AI analysis unavailable: AI provider keys (GROQ_API_KEY / OPENAI_API_KEY) are not configured on the server.";
        try {
          const errData = (await res.json()) as { detail?: string };
          if (errData?.detail) detail = errData.detail;
        } catch {
          // ignore JSON parse error
        }
        setAiError(detail);
        setAiState("error");
        return;
      }
      const data = (await res.json()) as { narrative: string };
      aiCache.set(cacheKey, data.narrative);
      setAiNarrative(data.narrative);
      setAiState("success");
    } catch {
      setAiError("AI analysis unavailable: cannot reach backend server.");
      setAiState("error");
    }
  }, [popover]);

  if (!active || typeof document === "undefined") return null;

  const popoverStyle = popover ? computePopoverStyle(popover.anchorRect) : undefined;
  const PopoverIcon: LucideIcon =
    (popover?.icon ? ICON_MAP[popover.icon] : undefined) ?? Info;

  return createPortal(
    <>
      {/* Dim overlay */}
      <div
        id="hw-explain-overlay"
        ref={overlayRef}
        role="presentation"
        aria-label="Explain mode active — click any element to learn what it does"
        className="hw-explain-overlay"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
      >
        {/* Hover highlight box */}
        {hoverRect && (
          <div
            className="hw-explain-hover"
            style={{
              top: hoverRect.top,
              left: hoverRect.left,
              width: hoverRect.width,
              height: hoverRect.height,
            }}
          />
        )}

        {/* Top-center banner */}
        <div className="hw-explain-banner">
          <HelpCircle className="size-3.5 shrink-0" aria-hidden="true" />
          <span>Explain Mode — click anything to learn what it does</span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onExit();
            }}
            aria-label="Exit explain mode"
            className="hw-explain-banner-close"
          >
            <X className="size-3.5" />
          </button>
        </div>
      </div>

      {/* Explanation popover card */}
      {popover && popoverStyle && (
        <div id="hw-explain-popover" style={popoverStyle} className="hw-explain-popover">
          {/* Header */}
          <div className="hw-explain-popover-header">
            <PopoverIcon className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span className="hw-explain-popover-title">{popover.title}</span>
            <button
              onClick={() => setPopover(null)}
              aria-label="Close explanation"
              className="hw-explain-popover-close"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Body - Static Description */}
          <p className="hw-explain-popover-body">{popover.description}</p>

          {/* Optional On-Demand Groq AI Section */}
          {aiEnabled && (
            <div className="mt-3 pt-2.5 border-t border-border/60">
              {aiState === "idle" && (
                <button
                  type="button"
                  onClick={handleFetchAi}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:text-primary/80 transition-colors cursor-pointer"
                >
                  <Sparkles className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>Deep-dive with AI</span>
                </button>
              )}
              {aiState === "loading" && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
                  <Loader2 className="size-3.5 animate-spin text-primary shrink-0" aria-hidden="true" />
                  <span>Fetching AI analysis...</span>
                </div>
              )}
              {aiState === "success" && aiNarrative && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-2.5 text-xs text-foreground/90 space-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary uppercase tracking-wider">
                    <Bot className="size-3 shrink-0" aria-hidden="true" /> AI Live Interpretation
                  </div>
                  <p className="leading-relaxed text-[12px]">{aiNarrative}</p>
                </div>
              )}
              {aiState === "error" && (
                <p className="text-[11px] text-amber-500 leading-snug">
                  {aiError || "AI analysis unavailable right now."}
                </p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="hw-explain-popover-footer">
            <span>Click another element to inspect it</span>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onExit();
              }}
              className="hw-explain-exit-btn"
            >
              Exit (Esc)
            </button>
          </div>
        </div>
      )}
    </>,
    document.body,
  );
}
