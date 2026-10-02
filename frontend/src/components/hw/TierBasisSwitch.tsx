import { TIER_BASIS_META, type TierBasis } from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

export interface TierBasisSwitchProps {
  basis: TierBasis;
  onBasisChange: (b: TierBasis) => void;
  /** Drives the "All Illnesses has no per-disease percentile" caveat. */
  illness?: string;
}

/**
 * Desktop control for which yardstick the map's Low/Moderate/High fills are cut
 * against. Mobile renders the same pair of buttons inside the bottom sheet's
 * ForecastCard, so this one is hidden below `md`.
 *
 * The active basis also sets the map legend's caption, because "High" means two
 * different things on the two bases and a bare colour swatch cannot say which.
 */
export function TierBasisSwitch({ basis, onBasisChange, illness }: TierBasisSwitchProps) {
  const meta = TIER_BASIS_META[basis];
  const pooledAll = illness === "all" && basis === "hotspot";

  return (
    <div className="flex flex-col items-center gap-1">
      <div
        role="radiogroup"
        aria-label="Risk tier basis"
        className="relative inline-flex h-8 items-center rounded-full border border-border/80 bg-glass/90 p-0.5 shadow-md backdrop-blur-sm select-none"
      >
        <div
          className={cn(
            "absolute top-0.5 bottom-0.5 w-[calc(50%-3px)] rounded-full bg-primary shadow-xs transition-all duration-200 ease-out",
            basis === "hotspot" ? "left-0.5" : "left-[calc(50%+1.5px)]",
          )}
          aria-hidden="true"
        />
        {(["hotspot", "burden"] as TierBasis[]).map((b) => {
          const isActive = basis === b;
          return (
            <button
              key={b}
              type="button"
              role="radio"
              aria-checked={isActive}
              title={TIER_BASIS_META[b].label}
              onClick={() => onBasisChange(b)}
              className={cn(
                "relative z-10 flex-1 whitespace-nowrap px-3 text-center text-[11px] font-semibold transition-colors duration-200",
                isActive
                  ? "text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {TIER_BASIS_META[b].short}
            </button>
          );
        })}
      </div>
      <p className="label-caps text-[10px] text-muted-foreground drop-shadow-sm">
        {pooledAll ? "All Illnesses → pooled national tiers" : meta.short}
      </p>
    </div>
  );
}
