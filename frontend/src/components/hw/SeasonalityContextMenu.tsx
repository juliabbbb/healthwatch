import { useEffect, useRef } from "react";
import { Sparkles, Waves } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ContextMenuAnchor {
  x: number;
  y: number;
  /** Which dashboard section or chart component was clicked */
  section: string;
  title?: string | undefined;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string | undefined;
  variant?: "primary" | "default" | "muted";
  run: () => void;
}

const MENU_WIDTH = 240;

export function SeasonalityContextMenu({
  anchor,
  actions,
  onClose,
}: {
  anchor: ContextMenuAnchor | null;
  actions: ContextMenuAction[];
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!anchor) return;
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const close = () => onClose();
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;
  const estimatedHeight = actions.length * 40 + 75;
  const left = isMobile
    ? Math.max(12, (window.innerWidth - MENU_WIDTH) / 2)
    : Math.max(12, Math.min(anchor.x, window.innerWidth - MENU_WIDTH - 16));
  const top = isMobile
    ? Math.max(16, Math.min(anchor.y, window.innerHeight - estimatedHeight - 16))
    : Math.max(12, Math.min(anchor.y, window.innerHeight - estimatedHeight - 16));

  return (
    <>
      {/* Mobile backdrop for seamless dismiss */}
      {isMobile && (
        <div
          className="fixed inset-0 z-[599] bg-black/40 backdrop-blur-xs transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      <div
        ref={ref}
        role="menu"
        aria-label="Chart actions"
        className={cn(
          "glass-panel fixed z-[600] w-60 overflow-hidden rounded-xl py-1.5 shadow-2xl border border-border/90",
          "animate-in fade-in zoom-in-95 duration-150",
        )}
        style={{ left, top }}
      >
        <div className="flex items-center justify-between border-b border-border/60 px-3 py-1.5 mb-1 bg-secondary/30">
          <p className="label-caps text-[10px] font-semibold text-foreground truncate">
            {anchor.title ?? anchor.section}
          </p>
          <span className="text-[9px] text-muted-foreground uppercase">Options</span>
        </div>

        <div className="space-y-0.5 px-1">
          {actions.map((action) => {
            const isAiAction = action.id.includes("ai") || action.id.includes("explain");
            return (
              <button
                key={action.id}
                role="menuitem"
                onClick={() => {
                  onClose();
                  action.run();
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors cursor-pointer touch-manipulation",
                  isAiAction
                    ? "bg-primary/10 text-primary font-medium hover:bg-primary/20"
                    : "text-foreground hover:bg-secondary hover:text-foreground",
                )}
              >
                <action.icon
                  className={cn(
                    "size-3.5 shrink-0",
                    isAiAction ? "text-primary" : "text-muted-foreground",
                  )}
                />
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{action.label}</span>
                  {action.hint && (
                    <span className="block text-[10px] text-muted-foreground truncate leading-tight">
                      {action.hint}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-1 flex items-center gap-1.5 border-t border-border/60 px-3 pt-1.5 pb-0.5 text-[9px] text-muted-foreground">
          <Waves className="size-3 text-primary shrink-0" />
          <span className="truncate">HEALTHWATCH pipeline deterministic metrics</span>
        </div>
      </div>
    </>
  );
}
