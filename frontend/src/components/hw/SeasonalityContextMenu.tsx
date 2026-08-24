import { useEffect, useRef } from "react";
import { Waves } from "lucide-react";

/**
 * Custom right-click menu for the Seasonality page. Rendered at cursor
 * coordinates; replaces the browser's native menu (the host elements call
 * preventDefault in their onContextMenu handlers). Dismisses on outside
 * pointer-down, Escape, scroll or resize.
 */

export interface ContextMenuAnchor {
  x: number;
  y: number;
  /** Which dashboard section was right-clicked (drives the offered actions). */
  section: string;
}

export interface ContextMenuAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string | undefined;
  run: () => void;
}

const MENU_WIDTH = 224;
const ITEM_HEIGHT = 34;

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

  const estimatedHeight = actions.length * ITEM_HEIGHT + 16;
  const left = Math.min(anchor.x, window.innerWidth - MENU_WIDTH - 8);
  const top = Math.min(anchor.y, window.innerHeight - estimatedHeight - 8);

  return (
    <div
      ref={ref}
      role="menu"
      aria-label="Chart actions"
      className="glass-panel fixed z-[600] w-56 overflow-hidden rounded-xl py-1 shadow-lg"
      style={{ left, top }}
    >
      <p className="label-caps px-3 pt-1.5 pb-1 text-[9px] text-muted-foreground">
        {anchor.section}
      </p>
      {actions.map((action) => (
        <button
          key={action.id}
          role="menuitem"
          onClick={() => {
            onClose();
            action.run();
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-secondary"
        >
          <action.icon className="size-3.5 text-primary" />
          <span className="flex-1">
            {action.label}
            {action.hint && (
              <span className="block text-[10px] text-muted-foreground">{action.hint}</span>
            )}
          </span>
        </button>
      ))}
      <p className="flex items-center gap-1.5 border-t border-border px-3 py-1.5 text-[10px] text-muted-foreground">
        <Waves className="size-3" />
        Numbers come from the HEALTHWATCH pipeline
      </p>
    </div>
  );
}
