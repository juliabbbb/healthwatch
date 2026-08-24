import * as React from "react";

const STORAGE_KEY = "healthwatch:ai-analysis-enabled";
/** Same-tab counterpart of the `storage` event (which only fires cross-tab). */
const CHANGE_EVENT = "healthwatch:ai-analysis-changed";

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "true";
  } catch {
    return false;
  }
}

/**
 * Opt-in flag for the AI-assisted analysis features. Defaults to false and is
 * persisted in localStorage. All hook instances stay in sync without a
 * reload: writers dispatch CHANGE_EVENT for this tab, and the browser's
 * `storage` event covers other tabs. Initialized to false on first render so
 * SSR and hydration agree.
 */
export function useAiAnalysisSetting(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setEnabled(readStored());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CHANGE_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CHANGE_EVENT, sync);
    };
  }, []);

  const set = React.useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, value ? "true" : "false");
    } catch {
      // Storage unavailable (e.g. private mode): keep in-memory value only.
    }
    window.dispatchEvent(new Event(CHANGE_EVENT));
    setEnabled(value);
  }, []);

  return [enabled, set];
}

