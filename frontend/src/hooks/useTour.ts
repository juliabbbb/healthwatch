/**
 * useTour.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Hook that manages the state for Explain Mode and the Guided Tour.
 */

import { useCallback, useState } from "react";

const TOUR_COMPLETED_KEY = "healthwatch:tutorial_completed";

export function useExplainMode() {
  const [explainActive, setExplainActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [isTour, setIsTour] = useState(false);

  // Check if tour was already completed
  const [isCompleted, setIsCompleted] = useState(() => {
    try {
      return localStorage.getItem(TOUR_COMPLETED_KEY) === "true";
    } catch {
      return false;
    }
  });

  const startTour = useCallback(() => {
    setExplainActive(true);
    setIsTour(true);
    setStepIndex(0);
  }, []);

  const toggleExplain = useCallback(() => {
    setExplainActive((v) => !v);
    setIsTour(false); // Default to inspector mode when toggling manually
  }, []);
  
  const exitExplain = useCallback(() => {
    setExplainActive(false);
    setIsTour(false);
    setStepIndex(0);
  }, []);

  const nextStep = useCallback((totalSteps: number) => {
    setStepIndex((prev) => {
      const next = prev + 1;
      if (next >= totalSteps) {
        localStorage.setItem(TOUR_COMPLETED_KEY, "true");
        setIsCompleted(true);
        exitExplain();
        return 0;
      }
      return next;
    });
  }, [exitExplain]);

  const prevStep = useCallback(() => {
    setStepIndex((prev) => Math.max(0, prev - 1));
  }, []);

  return { 
    explainActive, 
    toggleExplain, 
    exitExplain,
    isTour,
    stepIndex,
    startTour,
    nextStep,
    prevStep,
    isCompleted
  };
}
