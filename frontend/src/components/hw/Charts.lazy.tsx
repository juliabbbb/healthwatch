import { lazy } from "react";

// Chart components are the only consumers of recharts. Keeping this module as
// the single lazy entry point defers the recharts bundle out of both the
// server static-import graph (SSR cold start) and the client entry chunk, so
// the landing/region pages never pay for recharts unless the Seasonality
// charts are actually rendered.
export const ForecastChart = lazy(() =>
  import("./Charts").then((m) => ({ default: m.ForecastChart })),
);
export const DecompositionChart = lazy(() =>
  import("./Charts").then((m) => ({ default: m.DecompositionChart })),
);
export const AcfChart = lazy(() => import("./Charts").then((m) => ({ default: m.AcfChart })));
