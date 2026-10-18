import { useEffect } from "react";

/**
 * Locks document-level scrolling while `active` is true.
 *
 * Used by every non-Radix modal/overlay in the app (drawers, sheets, raw
 * `createPortal` dialogs, context menus). Radix Dialog/DropdownMenu already
 * gate scroll internally and must NOT be wired through this hook twice.
 *
 * - Applies `overflow: hidden` to <body> and pads the right edge by the
 *   scrollbar width so content does not shift when the scrollbar disappears.
 * - Restores the previous inline styles (and therefore the scroll position)
 *   on unlock/unmount.
 *
 * @param active — true while the overlay is mounted/open.
 */
export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      document.body.style.paddingRight = `${scrollbarWidth}px`;
    }

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [active]);
}