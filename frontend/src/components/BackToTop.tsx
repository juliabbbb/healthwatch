import { useEffect, useState } from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A fixed "Back to top" button that fades in after the user scrolls down 300 px
 * and smoothly scrolls the window back to the top on click.
 */
export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 300);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const scrollToTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="Back to top"
      className={cn(
        "fixed bottom-6 right-6 z-50 flex items-center gap-1.5 rounded-full border border-primary/40 bg-card/80 px-3.5 py-2 text-xs font-semibold text-primary shadow-lg backdrop-blur-sm transition-all duration-300 hover:bg-primary/15 hover:border-primary/70 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary cursor-pointer touch-manipulation",
        visible ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-3 pointer-events-none",
      )}
    >
      <ArrowUp className="size-3.5" aria-hidden="true" />
      <span>Top</span>
    </button>
  );
}
