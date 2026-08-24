import { RISK_META, type RiskLevel } from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

export function RiskBadge({
  risk,
  className,
  size = "sm",
}: {
  risk: RiskLevel;
  className?: string;
  size?: "sm" | "md";
}) {
  const meta = RISK_META[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium uppercase tracking-wider",
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        className,
      )}
      style={{
        color: "oklch(0.99 0.003 95)",
        backgroundColor: meta.solidColor,
      }}
    >
      <span className="size-1.5 rounded-full bg-white/80" />
      {meta.label} risk
    </span>
  );
}

export function RiskDot({ risk }: { risk: RiskLevel }) {
  return (
    <span
      className="inline-block size-2 rounded-full"
      style={{ backgroundColor: RISK_META[risk].color }}
    />
  );
}

export function SeasonTag({ season }: { season: "wet" | "dry" }) {
  const color = season === "wet" ? "var(--wet)" : "var(--dry)";
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] uppercase tracking-wider"
      style={{ color, backgroundColor: `color-mix(in oklab, ${color}, transparent 88%)` }}
    >
      {season} season
    </span>
  );
}
