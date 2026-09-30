import { ILLNESS_BY_ID } from "@/lib/healthwatch/data";

export type IllnessPropagationGroup = "Waterborne" | "Foodborne";

const _TRANSMISSION_TO_GROUP: Record<string, IllnessPropagationGroup> = {
  "Water-Borne": "Waterborne",
  "Food-Borne": "Foodborne",
};

/** Presentation group for an illness, or null when it is standalone (Dengue). */
export function groupForIllness(illnessId: string): IllnessPropagationGroup | null {
  const transmission = ILLNESS_BY_ID[illnessId]?.transmission;
  return transmission ? (_TRANSMISSION_TO_GROUP[transmission] ?? null) : null;
}

/** Display name for an illness id, resolving through ILLNESS_BY_ID. */
export function illnessDisplayName(illnessId: string): string {
  return ILLNESS_BY_ID[illnessId]?.name ?? illnessId;
}