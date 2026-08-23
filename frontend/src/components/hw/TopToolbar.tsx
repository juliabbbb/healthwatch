import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Download, Minus, Plus, Search, Share2 } from "lucide-react";
import { REGIONS } from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

export function TopToolbar({
  onPick,
  onZoom,
}: {
  onPick: (code: string) => void;
  onZoom?: (dir: 1 | -1) => void;
}) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);

  const matches = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return [];
    return REGIONS.filter(
      (r) =>
        r.name.toLowerCase().includes(term) ||
        r.short.toLowerCase().includes(term) ||
        r.code.startsWith(term),
    ).slice(0, 6);
  }, [q]);

  return (
    <div className="pointer-events-auto flex items-start gap-2">
      <div className="relative">
        <div className="glass-panel flex items-center gap-2 rounded-xl px-3 py-2">
          <Search className="size-4 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => window.setTimeout(() => setFocused(false), 150)}
            placeholder="Search region or PSGC code"
            aria-label="Search regions"
            className="w-48 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
          />
        </div>
        {focused && matches.length > 0 && (
          <ul className="glass-panel absolute right-0 z-20 mt-1 w-64 overflow-hidden rounded-xl py-1">
            {matches.map((r) => (
              <li key={r.code}>
                <button
                  onMouseDown={() => {
                    onPick(r.code);
                    setQ("");
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-secondary"
                >
                  <span>{r.name}</span>
                  <span className="text-[10px] text-muted-foreground">{r.short}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <nav className="glass-panel flex items-center gap-1 rounded-xl p-1">
        <NavLink to="/">Map</NavLink>
        <NavLink to="/seasonality">Seasonality</NavLink>
        <NavLink to="/compare">Compare</NavLink>
        <NavLink to="/methodology">Methodology</NavLink>
      </nav>

      <div className="glass-panel flex items-center gap-0.5 rounded-xl p-1">
        <IconButton label="Share view" onClick={() => shareView()}>
          <Share2 className="size-4" />
        </IconButton>
        <IconButton label="Export snapshot" onClick={() => window.print()}>
          <Download className="size-4" />
        </IconButton>
        {onZoom && (
          <>
            <span className="mx-0.5 h-5 w-px bg-border" />
            <IconButton label="Zoom in" onClick={() => onZoom(1)}>
              <Plus className="size-4" />
            </IconButton>
            <IconButton label="Zoom out" onClick={() => onZoom(-1)}>
              <Minus className="size-4" />
            </IconButton>
          </>
        )}
      </div>
    </div>
  );
}

function shareView() {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    void navigator.clipboard.writeText(window.location.href);
  }
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "bg-secondary text-foreground" }}
    >
      {children}
    </Link>
  );
}

function IconButton({
  label,
  onClick,
  children,
  className,
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      title={label}
      aria-label={label}
      onClick={onClick}
      className={cn(
        "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        className,
      )}
    >
      {children}
    </button>
  );
}
