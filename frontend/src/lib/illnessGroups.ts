import { ILLNESS_BY_ID } from "@/lib/healthwatch/data";

/**
 * Route classification for an illness, or null when it is standalone (Dengue).
 *
 * All four food-and-waterborne diseases are reported as a single group: any of
 * them can be acquired from food or from water depending on the source of the
 * outbreak, so no single route is attributed to a disease.
 */
export function groupForIllness(illnessId: string): string | null {
  return ILLNESS_BY_ID[illnessId]?.group === "Food and Waterborne Diseases"
    ? "Foodborne & Waterborne"
    : null;
}

/** Display name for an illness id, resolving through ILLNESS_BY_ID. */
export function illnessDisplayName(illnessId: string): string {
  return ILLNESS_BY_ID[illnessId]?.name ?? illnessId;
}
