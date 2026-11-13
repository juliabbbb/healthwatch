const definitions: [RegExp, string][] = [
  [/risk distribution/i, "This counts how many regions fall into each risk tier for the displayed illness and month. It describes regions, not the number of people infected."],
  [/risk|P50|P75|percentile/i, "Monthly risk compares a disease's value with that region's historical values for the same calendar month: Low below P50, Moderate from P50 through P75, and High above P75. Unavailable means there is not enough information. A cross-region percentile is a separate burden comparison, not outbreak probability."],
  [/dominant illness/i, "This identifies the illness contributing the most to the displayed comparison. It does not mean every reported case belongs to that illness."],
  [/per capita|per 100|100k/i, "This scales counts to 100,000 residents so regions with different population sizes can be compared. It is not a percentage or an individual person's risk."],
  [/interval|uncertainty|confidence|\bCI\b/i, "The lower and upper bounds describe the model's uncertainty around a forecast. The configured 80% interval has not been empirically calibrated here and is not an outbreak probability."],
  [/SARIMAX|forecast|predicted/i, "Forecasts are model estimates for the displayed future dates, not reported cases. HealthWatch uses SARIMAX for operational forecasts; unavailable dates are not filled with invented estimates."],
  [/reported|observed/i, "These values come from available source reports. Missing reports are different from zero, and national totals do not prove complete surveillance coverage."],
  [/season|wet|dry/i, "The calendar convention groups June–November as wet and December–May as dry. Seasonal patterns describe historical timing and do not prove weather caused the reported illnesses."],
  [/MASE|MAPE|RMSE|\bMAE\b|performance/i, "These summarize differences between predictions and observed values. MAE and RMSE use count units, MAPE uses percentages and excludes observed zeros, and MASE compares error with a seasonal baseline. Lower error is generally better; these are not outbreak probabilities."],
  [/outbreak|rule A|rule B/i, "These are rule-derived seasonal reference signals, not official outbreak declarations. The retrospective benchmark concerns January–March and July–September 2025; it must not be read as a future alert."],
  [/provisional/i, "This source has unresolved interpretation or confirmation limits. Its displayed counts and eligible forecasts should be read with the accompanying source caveats."],
];

export function explainSelectedText(text: string): string | null {
  return definitions.find(([pattern]) => pattern.test(text))?.[1] ?? null;
}

// Semantic headings work on every page; explicit markers cover clickable titles.
export const headingTargets = 'h1, h2, h3, h4, h5, h6, [data-explain-title], p.label-caps, span.label-caps';
// Exact chart titles take priority over broad terminology rules.
const chartTitleExplanations: Record<string, string> = {
  "yearly rhythm": "This bar chart shows how average reported illness levels vary across the calendar year for the selected region and illness. The horizontal axis runs from January to December; each bar averages that calendar month's historical values in the chart's reporting window, using the selected count or per-100,000 unit. Taller bars identify months that were typically busier. Colours distinguish wet months (June–November) from dry months (December–May). The Year avg line is the mean of the twelve monthly bars; P50 and P75 are pooled burden references, not this region's monthly risk cutoffs. This is a historical monthly profile, not a prediction of next year's cases.",
  "12-month cycle indicators": "This section checks whether reported illness levels tend to repeat over time. It compares the observed series with earlier values at different lags: lag 1 means one earlier observation and lag 12 means twelve earlier observations, corresponding to one year when monthly reports are complete. The horizontal axis shows lags from 1 to 24; the vertical axis shows autocorrelation, a similarity score rather than a case count. A positive bar at lag 12 means relatively high or low values tend to align with those a year earlier; a value near zero shows little such relationship, while a negative value indicates opposite deviations from the average. Missing months and long-term trends can affect this interpretation. A lag-12 peak can suggest annual recurrence, but does not confirm an outbreak cycle or reliable forecasts.",
  "autocorrelation function (acf)": "ACF measures how similar a series is to a shifted version of itself. Each bar compares observed case levels with earlier observations at the lag shown on the horizontal axis; the vertical axis is a correlation score, not cases. Positive values indicate that above-average or below-average levels tend to occur together at that separation; negative values indicate opposite deviations, and values near zero indicate little linear association. The marked lag 12 highlights a possible annual pattern when monthly observations are complete. Trends and missing reports can affect the result, so a prominent bar alone does not prove seasonality, causation or forecast accuracy.",
};

const titleDefinitions: [RegExp, string][] = [
  [/highest illness risk/i, "For All Illnesses, this summarizes the highest available individual illness risk in each region. It is not a risk tier calculated from summed case counts."],
  [/national.*aggregate|national snapshot/i, "This summarizes available regional reports or forecasts for the displayed month. National totals are sums of available regions and do not establish complete reporting. All Illnesses includes only the declared eligible contributors."],
  [/trend/i, "This describes the longer-term direction of the series. In the decomposition charts, the trend uses a 12-month centred moving average to smooth short-term variation."],
  [/noise|residual/i, "This is the irregular remainder after the trend and seasonal components are removed. It captures unexplained variation, not a confirmed cause of illness."],
  [/autocorrelation|\bACF\b|cycle/i, "This compares the series with its earlier values at different monthly lags. Similarity at lag 12 can indicate an annual pattern; it does not establish causation."],
  [/research|four.model|benchmark reference|comparative|comparison/i, "This section compares the displayed regions or research results using the stated dates and units. Research model scores are historical evaluations and are separate from operational forecasts."],
  [/validation|accuracy|classification/i, "This evaluates predictions or rule-derived alerts against historical reference values. The 2025 evaluation is retrospective and does not establish future accuracy or official outbreak status."],
  [/weather|PAGASA|humidity|temp|flood/i, "This presents weather observations or PAGASA advisory context. Weather guidance does not change HealthWatch's operational forecasts, risk tiers or outbreak flags."],
  [/intervention|recommendation|guidance|response|4S|warning signs/i, "This section presents guidance associated with the displayed illness and assessment. It supports review and prevention, rather than diagnosing an individual or declaring an official outbreak."],
  [/source|preprocessing|coverage|missing|interpretation/i, "This explains how source reports are interpreted and where reporting limitations remain. Missing reports, reported zero and out-of-coverage dates have different meanings."],
  [/heat|annual/i, "Heat-related records are annual reference data. They are not monthly forecasts and should not be compared as if they covered the same monthly forecast window."],
  [/AI|explanation|evidence/i, "This section provides plain-language interpretation with the stated evidence limits. Prepared explanations are predefined; AI-assisted text uses the guarded analysis service when enabled."],
  [/export|report sections|dataset/i, "This controls which displayed information is downloaded. CSV contains tabular data for analysis; PDF contains a formatted report with the selected sections."],
  [/settings|preferences/i, "This groups display and analysis preferences. AI-assisted analysis is optional; prepared title explanations remain available when AI is off."],
  [/more details/i, "This expands supporting information for the surrounding card, including the displayed analysis, guidance or weather context."],
  [/period|date|month|horizon/i, "This identifies the time window used by the surrounding card. Reported dates describe available observations; forecast dates describe model estimates."],
  [/illness|pathology/i, "This identifies the disease or eligible disease grouping used by the surrounding information. Each disease is analysed independently and source caveats still apply."],
  [/region|metro/i, "This identifies the geographic area used by the surrounding data. Compare regions using the same dates and units, retaining any missing-data limitations."],
];

export function explainTitle(title: string): string {
  return chartTitleExplanations[title.trim().toLowerCase()]
    ?? titleDefinitions.find(([pattern]) => pattern.test(title))?.[1]
    ?? explainSelectedText(title)
    ?? `“${title.trim()}” names this section of the dashboard. The information grouped beneath it describes that topic for the displayed view; check the accompanying dates, units and source notes when interpreting it.`;
}

export const excludedSelectionTargets = 'button, a, input, textarea, select, label, nav, svg, canvas, [contenteditable], [role="slider"], [role="combobox"], [data-selection-popup], .recharts-wrapper, .leaflet-container';

export function selectedHeading(range: Range): HTMLElement | null {
  const element = (node: Node) => node instanceof Element ? node : node.parentElement;
  const start = element(range.startContainer);
  const end = element(range.endContainer);
  const heading = start?.closest<HTMLElement>(headingTargets);
  if (!heading || end?.closest(headingTargets) !== heading) return null;
  // Only explicitly marked heading text may override a clickable header's exclusion.
  if (heading.matches('[data-explain-title]')) return heading;
  return start?.closest(excludedSelectionTargets) ? null : heading;
}

export function selectionCard(range: Range): HTMLElement | null {
  const heading = selectedHeading(range);
  if (heading) return heading;
  const element = (node: Node) => node instanceof Element ? node : node.parentElement;
  const start = element(range.startContainer);
  const end = element(range.endContainer);
  const card = start?.closest<HTMLElement>('[data-text-card]');
  if (!card || end?.closest('[data-text-card]') !== card) return null;
  if (start?.closest(excludedSelectionTargets) || end?.closest(excludedSelectionTargets)) return null;
  if ([...card.querySelectorAll(excludedSelectionTargets)].some(node => range.intersectsNode(node))) return null;
  return card;
}
