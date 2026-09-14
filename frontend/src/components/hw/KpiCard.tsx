import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface KpiCardProps {
  label: string;
  value: string;
  sub?: string | undefined;
  icon: ReactNode;
  /** CSS token color used for the icon chip (e.g. "var(--chart-1)"). */
  accent?: string;
  className?: string;
}

/** Small glanceable KPI card. Value is mono for tabular alignment. */
export function KpiCard({
  label,
  value,
  sub,
  icon,
  accent = "var(--chart-1)",
  className,
}: KpiCardProps) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-start justify-between gap-2 rounded-xl border border-border/70 bg-card/60 p-3",
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="label-caps text-[9px] leading-tight text-muted-foreground">{label}</p>
        <p
          className="mt-1 truncate font-mono text-lg font-bold leading-none tracking-tight tabular-nums text-foreground"
          title={value}
        >
          {value}
        </p>
        {sub && (
          <p className="mt-0.5 truncate text-[10px] leading-snug text-muted-foreground" title={sub}>
            {sub}
          </p>
        )}
      </div>
      <span
        className="ml-auto mt-0.5 shrink-0 self-start rounded-lg p-1.5"
        style={{
          backgroundColor: `color-mix(in oklab, ${accent} 18%, transparent)`,
          color: accent,
        }}
        aria-hidden="true"
      >
        {icon}
      </span>
    </div>
  );
}