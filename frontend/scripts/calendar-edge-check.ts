/**
 * Calendar-edge regression checks for the frontend analysis functions.
 *
 * Run with the API up:   npx -y tsx scripts/calendar-edge-check.ts
 *
 * Reproduces the /seasonality crash class end-to-end: ISO week 53 in real
 * API data used to throw inside decompose() and would have produced NaN
 * seasonal/residual values.
 */
import {
  ILLNESSES,
  REGIONS,
  acf,
  decompose,
  getThresholds,
  loadHealthwatchData,
  pooledValues,
  seriesFor,
} from "../src/lib/healthwatch/data";

let failures = 0;
const fail = (msg: string) => {
  failures++;
  console.error("FAIL " + msg);
};

await loadHealthwatchData();

const illnessIds = ["all", ...ILLNESSES.map((i) => i.id)] as const;
const modes = ["raw", "percapita"] as const;
let decomposePoints = 0;

for (const region of REGIONS) {
  for (const illness of illnessIds) {
    const series = seriesFor(region.code, illness);
    if (!series.length) fail(`${region.short}/${illness}: empty series`);
    const badWeeks = series.filter((p) => p.week < 1 || p.week > 53);
    if (badWeeks.length) fail(`${region.short}/${illness}: ${badWeeks.length} weeks outside 1..53`);

    const decomp = decompose(region.code, illness);
    const histLen = series.filter((p) => !p.forecast).length;
    if (decomp.length !== histLen)
      fail(`${region.short}/${illness}: decompose ${decomp.length} != history ${histLen}`);
    for (const p of decomp) {
      if (![p.observed, p.trend, p.seasonal, p.residual].every(Number.isFinite))
        fail(`${region.short}/${illness} wk${p.index}: non-finite decomposition value`);
    }
    decomposePoints += decomp.length;

    const corr = acf(region.code, illness);
    if (corr.length !== 60 || !corr.every((c) => Number.isFinite(c.value) && Math.abs(c.value) <= 1))
      fail(`${region.short}/${illness}: bad ACF output`);
  }

  for (const illness of illnessIds) {
    for (const week of [undefined, 10, 34] as const) {
      for (const mode of modes) {
        const t = getThresholds(illness, week, mode);
        if (!(Number.isFinite(t.p50) && Number.isFinite(t.p75) && t.p50 <= t.p75))
          fail(`${region.short}/${illness}/wk${week}/${mode}: invalid thresholds ${JSON.stringify(t)}`);
        const pooled = pooledValues(illness, week, mode);
        if (!pooled.length) fail(`${region.short}/${illness}/wk${week}/${mode}: empty pool`);
      }
    }
  }
}

if (failures) {
  console.error(`\n${failures} failure(s).`);
  process.exit(1);
}
console.log(
  `PASS ${REGIONS.length} regions x ${illnessIds.length} illnesses: ` +
    `${decomposePoints.toLocaleString()} decomposition points finite, ` +
    `ACF + thresholds + pools valid across weeks/modes.`,
);
