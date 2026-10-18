import { useState, useId, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface CollapsibleSectionProps {
  title: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  badge?: ReactNode;
  id?: string;
  className?: string;
}

export function CollapsibleSection({
  title,
  children,
  defaultOpen = false,
  badge,
  id: customId,
  className,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const autoId = useId();
  const baseId = customId || autoId.replace(/:/g, "");
  const triggerId = `collapsible-trigger-${baseId}`;
  const contentId = `collapsible-content-${baseId}`;

  return (
    <div
      className={cn(
        "rounded-xl border border-border/80 bg-card/40 backdrop-blur-xs transition-colors hover:border-border/90",
        className,
      )}
    >
      <button
        type="button"
        id={triggerId}
        aria-expanded={isOpen}
        aria-controls={contentId}
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left transition-colors rounded-xl hover:bg-secondary/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer touch-manipulation"
      >
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <span className="text-base sm:text-lg font-semibold tracking-tight text-foreground truncate">
            {title}
          </span>
          {badge && <span className="shrink-0">{badge}</span>}
        </div>
        <ChevronDown
          className={cn(
            "size-5 text-muted-foreground shrink-0 transition-transform duration-300 ease-in-out",
            isOpen && "rotate-180 text-foreground",
          )}
          aria-hidden="true"
        />
      </button>

      <div
        id={contentId}
        role="region"
        aria-labelledby={triggerId}
        aria-hidden={!isOpen}
        className={cn(
          "grid transition-[grid-template-rows] duration-300 ease-in-out",
          isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
        )}
      >
        <div className="overflow-hidden">
          <div className="px-5 pb-5 pt-2 border-t border-border/40 text-sm text-foreground/85">
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
