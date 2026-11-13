import { useCallback, useMemo, useState } from "react";
import type { TourStep } from "@/lib/explainRegistry";

interface TourState {
  active: boolean;
  currentId: string | null;
  skipped: string[];
}

export function useTour(steps: readonly TourStep[]) {
  const [state, setState] = useState<TourState>({ active: false, currentId: null, skipped: [] });
  const available = useMemo(() => steps.filter((step) => !state.skipped.includes(step.id)), [steps, state.skipped]);
  const index = available.findIndex((step) => step.id === state.currentId);
  const start = useCallback(() => {
    setState({ active: steps.length > 0, currentId: steps[0]?.id ?? null, skipped: [] });
  }, [steps]);
  const exit = useCallback(() => setState((previous) => ({ ...previous, active: false })), []);
  const next = useCallback(() => setState((previous) => {
    if (!previous.active) return previous;
    const remaining = steps.filter((step) => !previous.skipped.includes(step.id));
    const position = remaining.findIndex((step) => step.id === previous.currentId);
    const following = remaining[position + 1];
    return following ? { ...previous, currentId: following.id } : { ...previous, active: false };
  }), [steps]);
  const back = useCallback(() => setState((previous) => {
    if (!previous.active) return previous;
    const remaining = steps.filter((step) => !previous.skipped.includes(step.id));
    const position = remaining.findIndex((step) => step.id === previous.currentId);
    return { ...previous, currentId: remaining[Math.max(0, position - 1)]?.id ?? previous.currentId };
  }), [steps]);
  const omit = useCallback((ids: string[]) => setState((previous) => {
    if (!previous.active || ids.every((id) => previous.skipped.includes(id))) return previous;
    const skipped = [...new Set([...previous.skipped, ...ids])];
    const remaining = steps.filter((step) => !skipped.includes(step.id));
    const currentPosition = steps.findIndex((step) => step.id === previous.currentId);
    const current = remaining.find((step) => step.id === previous.currentId)
      ?? remaining.find((step) => steps.indexOf(step) > currentPosition);
    return { active: Boolean(current), currentId: current?.id ?? null, skipped };
  }), [steps]);

  return { active: state.active, index, step: available[index], total: available.length, start, next, back, exit, omit };
}
