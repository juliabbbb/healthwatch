import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import {
  Download,
  Menu,
  Minus,
  Moon,
  Plus,
  Search,
  Settings,
  Share2,
  Sun,
  X,
  Map as MapIcon,
  Waves,
  GitCompare,
  BookOpen,
} from "lucide-react";
import { SettingsModal } from "@/components/hw/SettingsModal";
import { useTheme } from "@/hooks/use-theme";
import { REGIONS } from "@/lib/healthwatch/data";
import { cn } from "@/lib/utils";

export interface TopToolbarProps {
  onPick: (code: string) => void;
  onZoom?: (dir: 1 | -1) => void;
  /** Extra icon affordances (e.g. the notification bell) shown first in the actions cluster. */
  trailing?: React.ReactNode;
}

export function TopToolbar({ onPick, onZoom, trailing }: TopToolbarProps) {
  const [q, setQ] = useState("");
  const [focused, setFocused] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [theme, toggleTheme] = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

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

  const handleShare = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      void navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <>
      {/* ===================== DESKTOP TOP TOOLBAR (>= md) ===================== */}
      <div className="pointer-events-auto hidden md:flex items-start gap-2">
        {/* Search input with autocomplete */}
        <div className="relative">
          <div className="glass-panel flex items-center gap-2 rounded-xl px-3.5 py-2.5">
            <Search className="size-4 text-muted-foreground" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => window.setTimeout(() => setFocused(false), 180)}
              placeholder="Search region or PSGC code"
              aria-label="Search regions"
              className="w-48 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
            />
            {q && (
              <button
                onClick={() => setQ("")}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="size-3.5" />
              </button>
            )}
          </div>
          {focused && matches.length > 0 && (
            <ul className="glass-panel absolute right-0 z-50 mt-1 w-64 overflow-hidden rounded-xl py-1 shadow-xl">
              {matches.map((r) => (
                <li key={r.code}>
                  <button
                    onMouseDown={() => {
                      onPick(r.code);
                      setQ("");
                    }}
                    className="flex w-full items-center justify-between px-3 py-2 text-left text-xs hover:bg-secondary/80 transition-colors"
                  >
                    <span className="font-medium">{r.name}</span>
                    <span className="label-caps text-[10px] text-primary">{r.short}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Primary Desktop Nav Links */}
        <nav className="glass-panel flex items-center gap-1 rounded-xl p-1">
          <NavLink to="/">Map</NavLink>
          <NavLink to="/seasonality">Seasonality</NavLink>
          <NavLink to="/compare">Compare</NavLink>
          <NavLink to="/methodology">Methodology</NavLink>
        </nav>

        {/* Action icons */}
        <div className="glass-panel flex items-center gap-0.5 rounded-xl p-1">
          {trailing}
          <IconButton
            label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            onClick={toggleTheme}
          >
            {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
          </IconButton>
          <IconButton label="Settings" onClick={() => setSettingsOpen(true)}>
            <Settings className="size-4" />
          </IconButton>
          <IconButton
            label={copied ? "Link copied!" : "Share view"}
            onClick={handleShare}
            className={copied ? "text-primary" : ""}
          >
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

      {/* ===================== MOBILE TOP TOOLBAR (< md) ===================== */}
      <div className="pointer-events-auto flex md:hidden items-center gap-1.5">
        {/* Search trigger button */}
        <button
          onClick={() => setMobileSearchOpen(true)}
          aria-label="Open search"
          className="glass-panel rounded-xl p-2.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95"
        >
          <Search className="size-4" />
        </button>

        {/* Trailing item (Notification bell) */}
        <div className="glass-panel rounded-xl p-0.5">{trailing}</div>

        {/* Hamburger Menu Toggle */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          aria-label="Open mobile navigation menu"
          aria-expanded={mobileMenuOpen}
          className="glass-panel flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium text-foreground transition-colors hover:bg-secondary active:scale-95"
        >
          <Menu className="size-4" />
          <span className="hidden xs:inline font-semibold">Menu</span>
        </button>
      </div>

      {/* ===================== MOBILE SEARCH OVERLAY MODAL ===================== */}
      {mounted && mobileSearchOpen &&
        createPortal(
          <div
            style={{ zIndex: 9960 }}
            className="fixed inset-0 flex flex-col bg-background/98 backdrop-blur-md p-4 animate-in fade-in-0 duration-200"
          >
            <div className="flex items-center gap-2">
              <div className="glass-panel flex flex-1 items-center gap-2.5 rounded-xl px-3.5 py-2.5 border border-border/80">
                <Search className="size-4 text-muted-foreground shrink-0" />
                <input
                  autoFocus
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search Philippine region or code..."
                  className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
                {q && (
                  <button
                    onClick={() => setQ("")}
                    className="rounded-full p-1 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
              <button
                onClick={() => setMobileSearchOpen(false)}
                className="rounded-xl bg-secondary px-3 py-2 text-xs font-semibold text-foreground transition-colors"
              >
                Cancel
              </button>
            </div>

            {/* Search match list */}
            <div className="mt-3 flex-1 overflow-y-auto hw-scroll">
              {q.trim() && matches.length === 0 && (
                <p className="py-8 text-center text-xs text-muted-foreground">
                  No regions found matching "{q}".
                </p>
              )}
              {matches.length > 0 && (
                <ul className="glass-panel divide-y divide-border/60 overflow-hidden rounded-xl">
                  {matches.map((r) => (
                    <li key={r.code}>
                      <button
                        onClick={() => {
                          onPick(r.code);
                          setQ("");
                          setMobileSearchOpen(false);
                        }}
                        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-secondary/70 transition-colors"
                      >
                        <div>
                          <p className="text-sm font-medium text-foreground">{r.name}</p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {r.classification} · {r.density.toLocaleString()} persons/km²
                          </p>
                        </div>
                        <span className="label-caps text-primary font-bold">{r.short}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {!q.trim() && (
                <div className="mt-2 p-2">
                  <p className="label-caps mb-2 text-[10px]">Popular Regions</p>
                  <div className="flex flex-wrap gap-1.5">
                    {REGIONS.slice(0, 6).map((r) => (
                      <button
                        key={r.code}
                        onClick={() => {
                          onPick(r.code);
                          setMobileSearchOpen(false);
                        }}
                        className="rounded-lg border border-border/80 bg-secondary/40 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-secondary transition-colors"
                      >
                        {r.short} ({r.name})
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )
      }

      {/* ===================== MOBILE HAMBURGER MENU MODAL (VERTICALLY CENTERED & TOP OF CARDS) ===================== */}
      {mounted && mobileMenuOpen &&
        createPortal(
          <div
            style={{ zIndex: 9950 }}
            className="fixed inset-0 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-xs animate-in fade-in-0 duration-200"
          >
            {/* Click-away backdrop */}
            <div
              onClick={() => setMobileMenuOpen(false)}
              className="absolute inset-0"
              aria-hidden="true"
            />
            <div
              style={{ zIndex: 9951 }}
              className="relative flex max-h-[85vh] w-full max-w-sm flex-col rounded-2xl border border-border/80 bg-card/98 backdrop-blur-2xl p-4 sm:p-5 shadow-2xl animate-in zoom-in-95 duration-200 overflow-y-auto hw-scroll"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border/70 pb-3">
                <div>
                  <h2 className="text-base font-bold text-foreground">HEALTHWATCH</h2>
                  <p className="text-[10px] text-muted-foreground font-medium">Outbreak Decision Support</p>
                </div>
                <button
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label="Close navigation menu"
                >
                  <X className="size-5" />
                </button>
              </div>

              {/* Nav Links */}
              <div className="py-3 space-y-1">
                <p className="label-caps mb-1.5 text-[10px]">Views &amp; Tools</p>
                <MobileNavLink
                  to="/"
                  icon={MapIcon}
                  label="Outbreak Hotspot Map"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <MobileNavLink
                  to="/seasonality"
                  icon={Waves}
                  label="Seasonality &amp; Cycles"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <MobileNavLink
                  to="/compare"
                  icon={GitCompare}
                  label="Regional Compare"
                  onClick={() => setMobileMenuOpen(false)}
                />
                <MobileNavLink
                  to="/methodology"
                  icon={BookOpen}
                  label="Data Sources &amp; Methodology"
                  onClick={() => setMobileMenuOpen(false)}
                />
              </div>

              {/* Quick Actions / Preferences */}
              <div className="border-t border-border/70 py-3">
                <p className="label-caps mb-2 text-[10px]">Preferences &amp; Actions</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={toggleTheme}
                    className="flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/40 p-2.5 text-left text-xs font-medium text-foreground hover:bg-secondary transition-colors active:scale-98"
                  >
                    {theme === "dark" ? <Sun className="size-4 text-primary" /> : <Moon className="size-4 text-primary" />}
                    <span>{theme === "dark" ? "Light Mode" : "Dark Mode"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      setSettingsOpen(true);
                    }}
                    className="flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/40 p-2.5 text-left text-xs font-medium text-foreground hover:bg-secondary transition-colors active:scale-98"
                  >
                    <Settings className="size-4 text-primary" />
                    <span>Settings</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/40 p-2.5 text-left text-xs font-medium text-foreground hover:bg-secondary transition-colors active:scale-98"
                  >
                    <Share2 className="size-4 text-primary" />
                    <span>{copied ? "Link Copied!" : "Share Link"}</span>
                  </button>
                  <button
                    onClick={() => {
                      setMobileMenuOpen(false);
                      window.print();
                    }}
                    className="flex items-center gap-2 rounded-xl border border-border/80 bg-secondary/40 p-2.5 text-left text-xs font-medium text-foreground hover:bg-secondary transition-colors active:scale-98"
                  >
                    <Download className="size-4 text-primary" />
                    <span>Export View</span>
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      }

      <SettingsModal open={settingsOpen} onOpenChange={setSettingsOpen} />
    </>
  );
}

function NavLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      activeOptions={{ exact: to === "/" }}
      className="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
      activeProps={{ className: "bg-secondary text-foreground font-semibold" }}
    >
      {children}
    </Link>
  );
}

function MobileNavLink({
  to,
  icon: Icon,
  label,
  onClick,
}: {
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      activeOptions={{ exact: to === "/" }}
      className="flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
      activeProps={{ className: "bg-primary/15 text-primary font-bold" }}
    >
      <Icon className="size-4 shrink-0" />
      <span>{label}</span>
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
        "rounded-lg p-2 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground active:scale-95",
        className,
      )}
    >
      {children}
    </button>
  );
}
