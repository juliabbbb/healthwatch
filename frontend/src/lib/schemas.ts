import { z } from "zod";

/**
 * Zod schemas for runtime API payloads only. Dashboard data (series,
 * metrics, outbreaks) is loaded once via /dashboard and kept in typed
 * synchronous caches in `lib/healthwatch/data.ts` — no schema needed there.
 * These schemas guard the smaller on-demand endpoints the UI calls directly.
 */

/** Single month's Prophet forecast row. */
export const ForecastPointSchema = z.object({
  disease: z.string().optional(),
  region: z.string().optional(),
  target_date: z.string(),
  yhat: z.number(),
  yhat_lower: z.number(),
  yhat_upper: z.number(),
  risk: z.enum(["Low", "Moderate", "High"]).optional(),
});
export type ForecastPoint = z.infer<typeof ForecastPointSchema>;

/** Validation metrics for a region, as returned by GET /metrics/{region}. */
export const ValidationMetricsSchema = z.object({
  region: z.string().optional(),
  disease: z.string().optional(),
  windows: z
    .array(
      z.object({
        window: z.string(),
        months: z.number(),
        MAE: z.number(),
        RMSE: z.number(),
        MAPE: z.number(),
        skill_vs_naive_pct: z.number().nullable(),
      }),
    )
    .optional(),
  primary_window: z.string().optional(),
  mae: z.number().optional(),
  rmse: z.number().optional(),
  mape: z.number().optional(),
  skill_vs_naive_pct: z.number().nullable().optional(),
  confidence: z
    .object({
      label: z.string(),
      tone: z.enum(["low", "moderate", "high"]),
      note: z.string(),
    })
    .optional(),
});
export type ValidationMetrics = z.infer<typeof ValidationMetricsSchema>;

/** Prospective outbreak-classification validation, GET /validation/outbreak. */
export const OutbreakValidationSchema = z.object({
  scope: z.string(),
  overall: z.object({
    tp: z.number(),
    fp: z.number(),
    fn: z.number(),
    tn: z.number(),
    precision: z.number(),
    recall: z.number(),
    f1: z.number(),
  }),
  by_season: z.record(z.string(), z.unknown()).optional(),
});
export type OutbreakValidation = z.infer<typeof OutbreakValidationSchema>;

/** Compact AI insight line, GET /ai-insight. */
export const AiInsightResponseSchema = z.object({
  region: z.string(),
  disease: z.string().optional(),
  narrative: z.string(),
  model: z.string().optional(),
});
export type AiInsightResponse = z.infer<typeof AiInsightResponseSchema>;