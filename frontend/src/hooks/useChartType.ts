import { useState } from "react";

export type ChartType = "line" | "bar";

export function useChartType(defaultType: ChartType = "line") {
  const [chartType, setChartType] = useState<ChartType>(defaultType);
  return { chartType, setChartType };
}
