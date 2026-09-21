/**
 * useExplainMode.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Simple hook that manages the boolean on/off state for the Explain inspector.
 * The actual overlay rendering is handled by <ExplainOverlay />.
 */

import { useCallback, useState } from "react";

export function useExplainMode() {
  const [explainActive, setExplainActive] = useState(false);

  const toggleExplain = useCallback(() => setExplainActive((v) => !v), []);
  const exitExplain = useCallback(() => setExplainActive(false), []);

  return { explainActive, toggleExplain, exitExplain };
}
