import * as React from "react";

const STORAGE_KEY = "healthwatch:ai-analysis-enabled";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Opt-in flag for the AI-assisted analysis panel. Defaults to false and is
 * persisted in localStorage; the `storage` listener keeps multiple tabs in
 * sync (same-tab updates flow through the returned setter). Initialized to
 * false on first render so SSR and hydration agree.
 */
export function useAiAnalysisSetting(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setEnabled(readStored());
    sync();
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const set = React.useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch {
      // Storage unavailable (e.g. private mode): keep in-memory value only.
    }
    setEnabled(value);
  }, []);

  return [enabled, set];
}
