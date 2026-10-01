"""Canonical vocabulary for HealthWatch's two forward-looking outputs.

Single source of truth for the terms defined in PAPER.md section 1.6. Served
read-only at ``GET /vocabulary`` so the dashboard reads these definitions rather
than hardcoding its own wording. When this file changes, PAPER.md section 1.6
and the frontend labels must change with it, or the two drift apart.

HealthWatch produces two outputs at different grains. They are never mixed:

    hotspot   one region-month          Low / Moderate / High
    outbreak  one region-season-probe   flagged / not flagged

Hotspot answers "where and when is it high". Outbreak answers "should the
region brace for this season".
"""

GLOSSARY_VERSION = "1.0"

# The two outputs, keyed by id. `grain` is the unit of the output; `trigger` is
# the rule that raises it; `never` states the boundary the rest of the system is
# written to protect. Both rules are evaluated on the same forecast series, so
# the grains are what keep them from being conflated.
OUTPUTS = {
    "hotspot": {
        "label": "Hotspot classification",
        "objective": "O2a",
        "grain": "one region-month",
        "question": (
            "How high is this month, relative to normal for this region and "
            "calendar month?"
        ),
        "output": "Low / Moderate / High",
        "visual": "Colored cells, choropleth, heatmap",
        "trigger": (
            "Forecast vs the region's same-calendar-month P50 and P75"
        ),
        "never": (
            "A month-level label. It never carries an outbreak claim, and it "
            "is never attached to a season."
        ),
    },
    "outbreak": {
        "label": "Seasonal outbreak prediction",
        "objective": "O2b",
        "grain": "one region-season-probe (3 months)",
        "question": "Is this coming season's peak window abnormal?",
        "output": (
            "Outbreak risk: flagged or not flagged, with reason (Rule A or Rule B)"
        ),
        "visual": "One banner or bracket spanning the probe months",
        "trigger": (
            "Rule A (all three months of the probe window are High) or Rule B "
            "(probe mean exceeds the season-pooled historical P75)"
        ),
        "never": (
            "A season-level signal. It is never attached to a single month."
        ),
    },
}

# The four locked terms. These four sentences are the ones the paper, the API
# docs and the dashboard must all reproduce verbatim; nothing else may redefine
# them.
LOCKED_TERMS = [
    {
        "term": "Hotspot",
        "definition": "A region-month in the High tier.",
        "output": "hotspot",
    },
    {
        "term": "Outbreak",
        "definition": (
            "The season-level signal. It is never attached to a single month."
        ),
        "output": "outbreak",
    },
    {
        "term": "Prediction",
        "definition": "The system's whole forward-looking output.",
        "output": None,
    },
    {
        "term": "Forecast",
        "definition": "The case-count regression only.",
        "output": None,
    },
]

# The remaining PAPER.md section 1.6 terms. `definition` is the wording the paper
# mirrors. Ordering here is the paper's ordering.
TERMS = [
    {
        "term": "Benchmarking Module",
        "definition": (
            "A feature that lets users filter and compare Philippine regions "
            "side by side by predicted case volume, hotspot risk tier, and "
            "recommended interventions, with PDF report and CSV dataset exports."
        ),
        "output": None,
    },
    {
        "term": "Causal Variables",
        "definition": (
            "Variables that would establish a cause-and-effect driver of "
            "transmission, such as rainfall or temperature; none are treated as "
            "causal in HealthWatch, so the wet/dry seasonal indicator makes no "
            "causal claim."
        ),
        "output": None,
    },
    {
        "term": "Classification and Risk Tiers",
        "definition": (
            "The step that turns predicted case counts into low, moderate, or "
            "high risk: Low below the region's same-calendar-month P50, "
            "Moderate between that P50 and P75, and High above it. A region-month "
            "in the High tier is a hotspot."
        ),
        "output": "hotspot",
    },
    {
        "term": "Classification Metrics (Precision, Recall, F1-Score)",
        "definition": (
            "Precision is the share of flagged outbreaks or high-risk events "
            "that were real, recall is the share of real events that were "
            "flagged, and F1 is their harmonic balance; together they measure "
            "how well the system's labels agree with observed signals."
        ),
        "output": None,
    },
    {
        "term": "Dengue and Pilot Illness",
        "definition": (
            "Dengue is the study's pilot illness and the illness for which the "
            "full validation evidence is reported; a vector-borne disease that "
            "peaks during the rainy season."
        ),
        "output": None,
    },
    {
        "term": "Department of Health (DOH) and Philippine Integrated Disease "
        "Surveillance and Response (PIDSR)",
        "definition": (
            "The DOH is the national agency responsible for public health, and "
            "PIDSR is its surveillance system, the source of this study's data, "
            "subject to passive-surveillance limits such as underreporting and "
            "reporting delays."
        ),
        "output": None,
    },
    {
        "term": "Deterministic Seasonal Indicator (Wet/Dry Seasonal Regressor)",
        "definition": (
            "A fixed, non-causal calendar variable, equal to one inside the wet "
            "season (June to November) and zero otherwise (December to May), "
            "that encodes the dry-wet climate calendar in the model."
        ),
        "output": None,
    },
    {
        "term": "Epidemic Threshold",
        "definition": (
            "The fixed, official case-count cutoff used to declare an outbreak, "
            "as in the 2026 Bohol declaration of three consecutive weeks above "
            "threshold. HealthWatch instead uses region-specific percentile "
            "thresholds and Rule A."
        ),
        "output": None,
    },
    {
        "term": "Epidemiologically Plausible",
        "definition": (
            "The property of predicted case counts staying within realistic, "
            "physically reasonable bounds, kept inline by the non-negativity "
            "constraint."
        ),
        "output": None,
    },
    {
        "term": "Error Metrics (MAE, RMSE, MAPE)",
        "definition": (
            "Measures of prediction accuracy: MAE is the average absolute "
            "deviation, RMSE penalizes larger errors more heavily, and MAPE "
            "expresses error as a percentage of observed counts, excluding "
            "zero-case months to avoid division by zero."
        ),
        "output": None,
    },
    {
        "term": "Prediction (Forecasting) and Regression",
        "definition": (
            "Predicting a continuous, non-negative expected case count per "
            "region-month. This numeric step is the forecast, and statisticians "
            "call the task a regression; prediction is the wider term covering "
            "every forward-looking output, including the hotspot tiers and the "
            "season-level outbreak signal."
        ),
        "output": None,
    },
    {
        "term": "Freedom of Information (FOI) Request",
        "definition": (
            "The approved mechanism through which the study obtained DOH "
            "regional case and fatality data."
        ),
        "output": None,
    },
    {
        "term": "Generative-AI Explanation Feature",
        "definition": (
            "The opt-in feature that translates already-computed predictions, "
            "classifications, outbreak signals, and seasonal patterns into plain "
            "English for non-expert stakeholders; it uses only pipeline figures "
            "and never generates predictions itself."
        ),
        "output": None,
    },
    {
        "term": "HealthWatch",
        "definition": (
            "The regional time-series analysis system developed in this study, "
            "pairing time-series analysis, hotspot classification, a grounded "
            "generative-AI explanation feature, a dashboard, and a benchmarking "
            "module."
        ),
        "output": None,
    },
    {
        "term": "Local Government Unit (LGU)",
        "definition": (
            "The local-level stakeholders intended to use the system's hotspot "
            "classifications for monitoring and response."
        ),
        "output": None,
    },
    {
        "term": "National Aggregate",
        "definition": (
            "The derived national series equal to the sum of the 18 regional "
            "series, giving the 19 series HealthWatch models independently per "
            "disease."
        ),
        "output": None,
    },
    {
        "term": "Non-Negativity Constraint",
        "definition": (
            "The rule preventing predicted counts from dropping below zero, "
            "keeping case volumes epidemiologically plausible; it floors point "
            "predictions and their lower bounds above zero, and probes and "
            "validation folds at zero."
        ),
        "output": None,
    },
    {
        "term": "Outbreak Prediction and Outbreak Rules (Rule A and Rule B)",
        "definition": (
            "The binary season-level signal derived from classification. Rule A "
            "flags a probe whose three months are all in the High tier; Rule B "
            "flags a probe whose mean exceeds that season's own historical P75."
        ),
        "output": "outbreak",
    },
    {
        "term": "Percentile Thresholds (P50 and P75)",
        "definition": (
            "The statistical cutoffs a predicted month is compared against. "
            "Hotspot tiers use thresholds computed per region and calendar "
            "month, over the history the model was fit on. Rule B instead uses a "
            "single P75 per region and season, pooled across the months of that "
            "season. The two are different quantities and are not "
            "interchangeable."
        ),
        "output": None,
    },
    {
        "term": "Per-Capita Reporting",
        "definition": (
            "Expressing case counts relative to population for context only; "
            "population metadata are used solely for this, not in the "
            "prediction or classification pipeline."
        ),
        "output": None,
    },
    {
        "term": "Prophet",
        "definition": (
            "The time-series model used in HealthWatch, configured with "
            "multiplicative seasonality (seasonal effects scale with the trend), "
            "an additive trend component, and the deterministic wet/dry seasonal "
            "indicator; a yearly Fourier seasonality term was evaluated during "
            "development and dropped because it was collinear with the seasonal "
            "indicator (R2 approximately 1.0) and scored worse on held-out error."
        ),
        "output": None,
    },
    {
        "term": "Recommended Interventions",
        "definition": (
            "Advisory measures mapped to each risk tier through a study-defined "
            "rule table, presented as decision support rather than directives."
        ),
        "output": None,
    },
    {
        "term": "Region-Month",
        "definition": (
            "The unit of hotspot analysis: one region's case series for one "
            "calendar month, the basis of each risk classification."
        ),
        "output": "hotspot",
    },
    {
        "term": "Seasonal Illness (Notifiable)",
        "definition": (
            "The umbrella grouping of diseases that follow the wet-dry calendar "
            "and that health providers report to the surveillance system. This "
            "study covers dengue as its pilot illness and acute bloody diarrhea, "
            "cholera, typhoid fever, and acute viral hepatitis as food and "
            "waterborne disease extensions."
        ),
        "output": None,
    },
    {
        "term": "Seasonal Probe",
        "definition": (
            "The 3-month prediction slice on which the outbreak rules run: dry, "
            "January to March; wet, July to September."
        ),
        "output": "outbreak",
    },
    {
        "term": "Time-Series Analysis and Trend-Seasonal-Residual Decomposition",
        "definition": (
            "The method that studies how a value changes over time, here monthly "
            "Prophet models of case counts capturing seasonal patterns, trends, "
            "and recurring annual cycles; the decomposition separates each series "
            "into trend, seasonal, and residual components to display those cycles."
        ),
        "output": None,
    },
    {
        "term": "Validation (Walk-Forward, Holdout, and Out-of-Sample)",
        "definition": (
            "Refitting the model on an expanding window of past data and "
            "forecasting each successive unseen period. The model is fit only "
            "through the December 2024 training cutoff, and the 2025 dry and wet "
            "seasons plus the September 2025 to August 2026 window are held out "
            "as unseen data."
        ),
        "output": None,
    },
]


def glossary():
    """Payload for GET /vocabulary."""
    return {
        "version": GLOSSARY_VERSION,
        "outputs": OUTPUTS,
        "locked_terms": LOCKED_TERMS,
        "terms": TERMS,
    }