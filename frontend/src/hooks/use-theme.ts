import * as React from "react";

const THEME_KEY = "healthwatch:theme";

export type Theme = "light" | "dark";

function readStored(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

/** The `.dark` class drives every CSS token; components stay theme-agnostic. */
function apply(theme: Theme): void {
  document.documentElement.classList.toggle("dark", theme === "dark");
}

/**
 * Light/dark switch persisted in localStorage. Initialized to "light" so SSR
 * and hydration agree; the real stored value is applied in an effect (an
 * inline boot script in __root already set the class pre-paint to avoid a
 * flash). Cross-tab changes flow through the `storage` event.
 */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = React.useState<Theme>("light");

  React.useEffect(() => {
    const stored = readStored();
    apply(stored);
    setTheme(stored);
    const sync = () => {
      const next = readStored();
      apply(next);
      setTheme(next);
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const toggle = React.useCallback(() => {
    // documentElement holds the applied truth, so rapid clicks stay correct.
    const next: Theme = document.documentElement.classList.contains("dark")
      ? "light"
      : "dark";
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage unavailable: theme still switches for this session only.
    }
    apply(next);
    setTheme(next);
  }, []);

  return [theme, toggle];
}
