import * as React from "react";

const STORAGE_KEY = "healthwatch:ai-analysis-enabled";
/** Same-tab counterpart of the `storage` event (which only fires cross-tab). */
const CHANGE_EVENT = "healthwatch:ai-analysis-changed";

/**
 * AI analysis is ON unless the user has explicitly turned it off. The key is
 * absent on a first visit, so an absent value means "no stored preference" and
 * resolves to true; only a literal "false" opts out. The narratives these
 * surfaces render come from the pre-generated corpus served by the API, so
 * being on costs no provider key, no quota and no per-request latency.
 */
function readStored(): boolean {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === null) return true;
    return stored !== "false";
  } catch {
    return true;
  }
}

/**
 * Persisted preference for the AI-assisted analysis surfaces, defaulting to
 * enabled. All hook instances stay in sync without a reload: writers dispatch
 * CHANGE_EVENT for this tab, and the browser's `storage` event covers other
 * tabs. Initialized lazily from storage so the first paint already agrees with
 * the stored value and a default-on user never sees a static-copy flash before
 * the corpus narrative swaps in.
 */
export function useAiAnalysisSetting(): [boolean, (value: boolean) => void] {
  const [enabled, setEnabled] = React.useState(readStored);

  React.useEffect(() => {
    const sync = () => setEnabled(readStored());
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
