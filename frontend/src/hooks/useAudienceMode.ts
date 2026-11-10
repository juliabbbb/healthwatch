import { useEffect, useState, useSyncExternalStore } from "react";

export type AudienceMode = "clinical" | "public";

const STORAGE_KEY = "healthwatch:audience_mode";
const DEFAULT_MODE: AudienceMode = "clinical";

const listeners = new Set<() => void>();

function getSnapshot(): AudienceMode {
  if (typeof window === "undefined") return DEFAULT_MODE;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "public" || saved === "clinical") return saved;
  } catch {
    // ignore localStorage errors
  }
  return DEFAULT_MODE;
}

function subscribe(callback: () => void) {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function setAudienceMode(mode: AudienceMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // ignore
  }
  listeners.forEach((listener) => listener());
}

/**
 * Global hook for switching between:
 * - "clinical": Healthcare Worker Mode (detailed epidemiological surveillance, hospital admission splits, error metrics, triage protocols)
 * - "public": General Public Mode (plain-language risk level, household prevention guides, symptom warning signs)
 */
export function useAudienceMode(): {
  mode: AudienceMode;
  setMode: (mode: AudienceMode) => void;
  toggleMode: () => void;
  isClinical: boolean;
  isPublic: boolean;
} {
  const mode = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_MODE);

  const toggleMode = () => {
    setAudienceMode(mode === "clinical" ? "public" : "clinical");
  };

  return {
    mode,
    setMode: setAudienceMode,
    toggleMode,
    isClinical: mode === "clinical",
    isPublic: mode === "public",
  };
}

