import { useEffect, useId, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useBodyScrollLock } from "@/hooks/useBodyScrollLock";
import type { TourStep } from "@/lib/explainRegistry";

interface TourOverlayProps {
  active: boolean;
  index: number;
  step: TourStep | undefined;
  total: number;
  steps: readonly TourStep[];
  onNext: () => void;
  onBack: () => void;
  onExit: () => void;
  onOmit: (ids: string[]) => void;
}

interface Rectangle { left: number; top: number; width: number; height: number }
interface Layout {
  viewport: { width: number; height: number };
  spotlight: Rectangle | null;
  card: CSSProperties;
}

/** Find the visible desktop or mobile version without inspecting pointer locations. */
function visibleTarget(step: TourStep): HTMLElement | null {
  if (!step.target) return null;
  for (const element of document.querySelectorAll<HTMLElement>(step.target)) {
    const bounds = element.getBoundingClientRect();
    const style = getComputedStyle(element);
    if (bounds.width <= 0 || bounds.height <= 0 || style.visibility === "hidden" || style.opacity === "0") continue;
    if (element.closest('[aria-hidden="true"]')) continue;
    if (step.id === "map" && !element.querySelector(".leaflet-container")) continue;
    return element;
  }
  return null;
}

export function TourOverlay({ active, index, step, total, steps, onNext, onBack, onExit, onOmit }: TourOverlayProps) {
  const [mounted, setMounted] = useState(false);
  const [ready, setReady] = useState(false);
  const [layout, setLayout] = useState<Layout | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const maskId = `tour-mask-${useId().replace(/:/g, "")}`;
  const titleId = `${maskId}-title`;
  const textId = `${maskId}-text`;
  useBodyScrollLock(active);
  useEffect(() => setMounted(true), []);

  // Determine the available steps before numbering them. The conditional region
  // panel is prepared by the route only when that step is reached.
  useEffect(() => {
    if (!active) { setReady(false); setLayout(null); return; }
    setReady(false);
    const started = performance.now();
    let timer = 0;
    const prepare = () => {
      const missing = steps.filter((candidate) => candidate.target && candidate.id !== "region" && !visibleTarget(candidate));
      if (missing.length && performance.now() - started < 1500) {
        timer = window.setTimeout(prepare, 100);
        return;
      }
      if (missing.length) onOmit(missing.map((candidate) => candidate.id));
      setReady(true);
    };
    prepare();
    return () => window.clearTimeout(timer);
  }, [active, steps, onOmit]);

  // Focus stays in the modal, while the rest of the page remains inert even
  // through the transparent spotlight. Restore the visible replay control on exit.
  useEffect(() => {
    if (!active || !mounted || !portalRef.current) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const siblings = Array.from(document.body.children)
      .filter((node): node is HTMLElement => node instanceof HTMLElement && node !== portalRef.current);
    const oldInert = siblings.map((node) => node.inert);
    siblings.forEach((node) => { node.inert = true; });
    dialogRef.current?.focus({ preventScroll: true });
    return () => {
      siblings.forEach((node, position) => { node.inert = oldInert[position] ?? false; });
      window.requestAnimationFrame(() => {
        const replay = Array.from(document.querySelectorAll<HTMLElement>('#hw-tour-btn, [data-tour="replay-tour"]'))
          .find((node) => node.getBoundingClientRect().width > 0);
        (replay ?? (previousFocus?.isConnected ? previousFocus : null))?.focus({ preventScroll: true });
      });
    };
  }, [active, mounted]);

  useEffect(() => {
    if (!active || !mounted || !step) return;
    setLayout(null);
    dialogRef.current?.focus({ preventScroll: true });
    const started = performance.now();
    let timer = 0;
    let frame = 0;
    let observed: HTMLElement | null = null;
    let disposed = false;
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(() => schedule());
    const measure = () => {
      if (disposed) return;
      window.clearTimeout(timer);
      const width = window.innerWidth;
      const height = window.innerHeight;
      const mobile = width < 768;
      const cardWidth = Math.min(360, width - 24);
      const cardHeight = Math.min(dialogRef.current?.offsetHeight ?? 260, height - 24);
      const target = ready && step.target ? visibleTarget(step) : null;
      if (ready && step.target && !target) {
        if (performance.now() - started < 1500) timer = window.setTimeout(measure, 100);
        else onOmit([step.id]);
      }
      let spotlight: Rectangle | null = null;
      let top = (height - cardHeight) / 2;
      let left = (width - cardWidth) / 2;
      if (target) {
        if (observed !== target) {
          target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "auto" });
          if (observed) observer?.unobserve(observed);
          observer?.observe(target);
          observed = target;
        }
        const bounds = target.getBoundingClientRect();
        const targetLeft = Math.max(4, Math.min(width - 4, bounds.left - 6));
        const targetTop = Math.max(4, Math.min(height - 4, bounds.top - 6));
        const targetRight = Math.min(width - 4, bounds.right + 6);
        const targetBottom = Math.min(mobile ? height - cardHeight - 28 : height - 4, bounds.bottom + 6);
        if (targetRight > targetLeft && targetBottom > targetTop) {
          spotlight = { left: targetLeft, top: targetTop, width: targetRight - targetLeft, height: targetBottom - targetTop };
        }
        const candidates = {
          right: { left: bounds.right + 16, top: bounds.top },
          left: { left: bounds.left - cardWidth - 16, top: bounds.top },
          top: { left: bounds.left, top: bounds.top - cardHeight - 16 },
          bottom: { left: bounds.left, top: bounds.bottom + 16 },
        };
        const placements = [step.placement ?? "bottom", "right", "left", "top", "bottom"] as const;
        const fitting = placements.map((placement) => candidates[placement])
          .find((position) => position.left >= 12 && position.top >= 12 && position.left + cardWidth <= width - 12 && position.top + cardHeight <= height - 12);
        if (fitting) { top = fitting.top; left = fitting.left; }
      }
      const card: CSSProperties = mobile
        ? { left: 12, right: 12, bottom: "max(12px, env(safe-area-inset-bottom))", maxHeight: "calc(100dvh - 24px)" }
        : { left: Math.max(12, Math.min(left, width - cardWidth - 12)), top: Math.max(12, Math.min(top, height - cardHeight - 12)), width: cardWidth, maxHeight: "calc(100dvh - 24px)" };
      setLayout({ viewport: { width, height }, spotlight, card });
    };
    const schedule = () => { if (disposed) return; window.cancelAnimationFrame(frame); frame = window.requestAnimationFrame(measure); };
    if (dialogRef.current) observer?.observe(dialogRef.current);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.addEventListener("transitionend", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    measure();
    return () => {
      disposed = true;
      window.clearTimeout(timer);
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.removeEventListener("transitionend", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
    };
  }, [active, mounted, ready, step, onOmit]);

  const positioned = Boolean(layout);
  useEffect(() => {
    if (active && mounted && positioned) dialogRef.current?.focus({ preventScroll: true });
  }, [active, mounted, positioned, step?.id]);

  useEffect(() => {
    if (!active || !mounted) return;
    const onKey = (event: KeyboardEvent) => {
      if (["Escape", "ArrowRight", "ArrowLeft", "Enter", "Tab"].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
      }
      if (event.key === "Escape") onExit();
      else if (ready && (event.key === "ArrowRight" || event.key === "Enter")) onNext();
      else if (ready && event.key === "ArrowLeft") onBack();
      else if (event.key === "Tab") {
        const buttons = Array.from(dialogRef.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? []);
        const current = buttons.findIndex((button) => button === document.activeElement);
        const following = event.shiftKey ? (current <= 0 ? buttons.length - 1 : current - 1) : (current + 1) % buttons.length;
        buttons[following]?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [active, mounted, ready, onNext, onBack, onExit]);

  if (!mounted || !active || !step) return null;
  const spotlight = layout?.spotlight;
  return createPortal(
    <div ref={portalRef} className="fixed inset-0 z-[10000] isolate pointer-events-auto" data-tour-overlay="true">
      <svg className="absolute inset-0 size-full" aria-hidden="true">
        <defs>
          <mask id={maskId} maskUnits="userSpaceOnUse" x="0" y="0" width="100%" height="100%">
            <rect width="100%" height="100%" fill="white" />
            {spotlight && <rect x={spotlight.left} y={spotlight.top} width={spotlight.width} height={spotlight.height} rx="10" fill="black" />}
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="black" fillOpacity="0.65" mask={`url(#${maskId})`} />
        {spotlight && <rect x={spotlight.left} y={spotlight.top} width={spotlight.width} height={spotlight.height} rx="10" fill="none" stroke="var(--primary)" strokeWidth="2" />}
      </svg>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={textId}
        aria-live="polite"
        tabIndex={-1}
        style={{ ...(layout?.card ?? { left: 12, right: 12, bottom: 12 }), visibility: layout ? "visible" : "hidden" }}
        className="fixed z-10 flex flex-col gap-4 overflow-y-auto rounded-2xl border border-border bg-card p-5 text-foreground shadow-2xl outline-none motion-safe:animate-in motion-safe:fade-in motion-safe:duration-150"
      >
        <div className="flex min-w-0 items-start justify-between gap-3">
          <h2 id={titleId} className="min-w-0 break-words text-lg font-semibold">{step.title}</h2>
          <button type="button" onClick={onExit} aria-label="Close guided tour" className="shrink-0 rounded-lg p-2 text-muted-foreground hover:bg-secondary focus-visible:ring-2 focus-visible:ring-primary">
            <X className="size-4" />
          </button>
        </div>
        <p id={textId} className="text-sm leading-relaxed">{step.text}</p>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">{ready ? `${index + 1} of ${total}` : "Preparing tour…"}</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={onBack} disabled={!ready || index === 0} className="min-h-10 rounded-lg border border-border px-3 py-2 text-sm font-medium disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary">Back</button>
            <button type="button" onClick={onNext} disabled={!ready} className="min-h-10 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40 focus-visible:ring-2 focus-visible:ring-primary">{index === total - 1 ? "Done" : "Next"}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
