# HEALTHWATCH: A REGIONAL TIME-SERIES ANALYSIS SYSTEM FOR SEASONAL ILLNESS OUTBREAK PREDICTION AND HOTSPOT CLASSIFICATION

# **CHAPTER ONE**

# **INTRODUCTION**

## **1.1 Background of the Study**

Recurring seasonal illness outbreaks place a heavy toll on Philippine healthcare. Dengue, this study's pilot illness, demonstrates this pattern: its incidence rises and falls with the wet and dry seasonal cycle, and cases peak in the wet season, when flooding and standing water multiply mosquito-breeding sites (Cruz et al., 2024; PAGASA, n.d.). News reports from 2026 show how heavy this toll can be. Bohol declared a dengue outbreak after recording 1,883 cases and 21 deaths by August 2026, following three consecutive weeks above the epidemic threshold (Udtohan, 2026). This study's Rule A follows a similar logic at a monthly resolution. It flags three consecutive high-risk months against region-specific percentile thresholds rather than a fixed epidemic threshold, and it raises an outbreak signal instead of an official declaration.  
	Despite these seasonal cycles, public health surveillance systems still contend with fragmented data systems, variable reporting timeliness, and limited analytical infrastructure (Lofgren et al., 2025; Rabiei et al., 2024), which constrains routine analysis of temporal patterns at the regional level. Without accessible and automated time-series analysis tools, regional authorities may depend on aggregated figures, and delays in reporting (Lofgren et al., 2025) shorten the lead time available to allocate resources before outbreaks escalate. Furthermore, some existing data-driven forecasting approaches emphasize numerical accuracy over operational interpretability and omit the domain-specific seasonal knowledge that regional health units already rely on (Leung et al., 2023), while standalone statistical or machine learning forecasts likewise frequently return raw numbers without actionable risk categories (Babanejaddehaki et al., 2025).  
	To close this gap, public health agencies require platforms that convert forecasts into region-level risk categories and surface them through comparative dashboards, map-based views, and side-by-side region benchmarking with exportable summary reports. This study proposes HealthWatch, a regional time-series analysis system for seasonal illness outbreak prediction and hotspot classification. It pairs a time-series analysis module with a hotspot classification algorithm. The time-series module returns continuous, non-negative case-count estimates for each region-month, while the algorithm assigns each predicted region-month to a low, moderate, or high risk tier relative to the region's own historical thresholds. These tiers feed a season-level outbreak signal, raised when Rule A (three consecutive high-risk months within a season) or Rule B (a season probe mean exceeding that season's historical P75) is met. To keep these outputs interpretable without statistical training, HealthWatch includes an opt-in generative-AI explanation feature that restates only figures already computed by the pipeline and never generates forecasts or classifications itself. Outputs are delivered through a web dashboard with comparative views, maps, benchmarking, and PDF and CSV exports.  
	The model combines an additive trend and a deterministic wet/dry seasonal indicator that encodes the climate calendar (Cawiding et al., 2025; PAGASA, n.d.), fit in multiplicative seasonality mode. With this design, time-series analysis extracts seasonal patterns, trends, and recurring annual cycles from each region's history and projects expected case volumes for the dry and wet seasons, while a trend-seasonal-residual decomposition surfaces those cycles on the dashboard. Non-negativity constraints keep forecasted volumes epidemiologically plausible and ensure they never drop below zero. Forecast reliability is assessed empirically on held-out walk-forward windows and on an out-of-sample 2025 dry and wet season check: the model is fitted only through December 2024, and the withheld windows are forecasted as unseen data. Risk thresholds are derived from each region's own historical case distribution.  
	Scoped to a limited development timeline, HealthWatch covers the 18 Philippine administrative regions and is trained and validated on monthly DOH PIDSR regional dengue records (2022-2026) obtained through an approved Freedom of Information request. Dengue is the pilot illness because regional surveillance records were available for it. The wet/dry indicator applies one national calendar (wet: June-November; dry: December-May) to all regions, so local variation in season timing is not modeled. Classification labels for the 2025 check are recomputed from reported counts using the same Rules A and B, so the check assesses agreement between analyzed and observed signals rather than independent outbreak confirmation. Region-level population metadata from the Philippine Statistics Authority (2024) are stored for per-capita reporting but are not used in the forecasting or classification pipeline. Recommended interventions are advisory: each risk tier is mapped to a study-defined rule table of recommended measures (specified in the methodology) and presented as decision support rather than directives. Because local and DOH response logs are not available, historical intervention data are out of scope. While this study's evaluation is scoped to dengue, the underlying data pipeline and regional classification framework are designed to extend to other notifiable seasonal illnesses as their surveillance datasets become available.

## **1.2 Statement of the Problem**

This study aims to develop a regional time-series analysis system for predicting seasonal illness outbreaks, with dengue as this study's pilot illness, and classifying regional hotspots based on those predictions. Specifically, it seeks to answer the following questions: 

1. How can a regional time-series analysis system be built to identify seasonal patterns and predict case volumes in defined seasons as a basis for illness outbreak prediction?  
2. How can a system classify regions and their predicted months as low, moderate, or high risk and flag potential outbreaks at the season level?  
3. How can a generative-AI explanation feature explain the system's predictions and classifications in plain language for non-expert stakeholders?  
4. How can a system module support side-by-side comparison of regions, with exportable reports, to aid data-driven decision-making?  
5. How can the system's predictions and classifications be evaluated to ensure accurate and reliable outputs?

## **1.3 Objectives of the Study**

	This study is guided by one general objective, from which five specific objectives are derived to address each dimension of the research problem outlined in the Statement of the Problem. Mainly, it seeks the following:   
**1.3.1 General Objective**  
To design, develop, and evaluate HealthWatch, a regional time-series analysis system that predicts dengue case volumes and seasonal patterns; classifies predicted months into low-, moderate-, or high-risk tiers and issues a season-level outbreak signal; provides grounded, opt-in generative-AI explanations for non-expert stakeholders; benchmarks Philippine regions side-by-side with exportable PDF and CSV reports; and validates its outputs on held-out walk-forward windows and an out-of-sample 2025 dry- and wet-season check to ensure accurate, reliable predictions for public health planning.   
**1.3.2 Specific Objectives**

1. To develop a regional time-series analysis system that analyzes historical surveillance data of the selected illness (dengue) to capture seasonal patterns, trends, and recurring annual cycles, and predicts the expected number of cases for the dry and wet seasons, incorporating a deterministic seasonal indicator and non-negativity constraints that keep case volumes epidemiologically plausible, as a basis for illness outbreak prediction.   
2. To implement a hotspot classification algorithm that assigns a low-, moderate-, or high-risk level to each region’s predicted months relative to historical percentile thresholds, and a season-level outbreak signal based on Rule A (three consecutive high-risk months within a season) and Rule B (probe mean exceeding the seasonal P75).   
3. To integrate a grounded, opt-in generative-AI feature that translates the system's computed predictions, risk classifications, outbreak signals, and seasonal patterns in plain English, using only pipeline figures and never generating predictions itself, so non-expert health stakeholders can interpret outputs without statistical training.  
4. To develop a module that lets users filter and benchmark Philippine regions side-by-side by predicted case volume, hotspot risk tier, and recommended interventions, with export options for an aggregated comparative epidemiological report (PDF) and per-component time-series datasets (CSV) for deeper analysis.  
5. To evaluate the system's prediction and classification performance on held-out walk-forward windows and an out-of-sample 2025 dry- and wet-season check, using error metrics (MAE, RMSE, MAPE) and classification metrics (precision, recall, F1). 

## **1.4 Significance of the Study**

This study informs decision-making, guides resource allocation and policy development, and supports public health administration at national and regional levels, contributing to reducing the burden of the pilot illness (dengue).

1. **National Government Agencies**. The DOH and other national agencies gain a data-driven tool that moves beyond retrospective reporting. Seasonal case predictions and hotspot classifications can guide dengue prevention programs that reflect each region's needs and vulnerabilities. The benchmarking module also allows side-by-side comparison of regions by case volume, risk tier, and recommended interventions, with PDF and CSV exports for planning workflows.   
2. **Local Government Units (LGUs).**  LGUs can monitor localized dengue risk without advanced technical expertise. By identifying hotspot areas and their risk levels, they can proactively prioritize prevention and control measures to prevent or contain outbreaks.   
3. **Healthcare Providers and Hospital Administrators**.  Providers can anticipate expected cases for the upcoming dry and wet seasons and adjust staffing and resources accordingly during surge periods.   
4. **Filipino Citizens and the General Public.**  Citizens get an accessible view of regional dengue risk and seasonal trends, supported by generative-AI explanations that translate risk classifications, outbreak signals, and seasonal patterns into plain language for more informed personal health decisions.   
5. **Future Researchers and Data Science Practitioners**. This study serves as a blueprint for a low-resource, high-impact predictive system built on publicly available health data, which future researchers can extend with more advanced deep learning or spatiotemporal approaches. 

## **1.5 Scope and Limitations**

This section defines the operational boundaries of the study. It details the core functionalities and target objectives of HealthWatch, alongside the explicit methodological, technical, and data-related limitations that constrain the current implementation.  
**1.5.1 Scope**  
	HealthWatch is a regional time-series analysis system for seasonal illness outbreak prediction and hotspot classification, with dengue as the pilot illness. It ingests monthly surveillance for 19 series: the 18 Philippine regions plus a derived National aggregate (their sum). Surveillance data are analyzed with Prophet combining an additive trend and a deterministic wet/dry seasonal regressor that mirrors the Philippine climate calendar and is fit in multiplicative seasonality mode, capturing seasonal patterns, trends, and recurring annual cycles. The forecasting step (a regression task, since it outputs continuous case counts per region-month) predicts expected cases for the dry and wet seasons, with a non-negativity floor keeping volumes epidemiologically plausible. A separate trend-seasonal-residual decomposition surfaces annual cycles on the Seasonality page.  
Predicted counts are classified into low, moderate, or high risk against P50/P75 percentile thresholds per region-month from a fixed 36-month baseline (2022 to 2024). Season-level outbreak detection adds 3-month probes (Rule A: three consecutive high-risk months within a season; Rule B: probe mean exceeding the seasonal P75), fit through a fixed December 2024 cutoff and validated against the held-out 2025 seasons. The National aggregate is modeled independently so single-region instability does not propagate.  
The dashboard shows predictions, classifications, and outbreak signals on maps and charts, with a tabular fallback. A benchmarking module lets users filter and compare regions side-by-side by predicted case volume, hotspot risk tier, and recommended interventions, with exports for an aggregated comparative epidemiological report (PDF) and per-component time-series datasets (CSV). A grounded, opt-in generative-AI feature translates predictions, classifications, outbreak signals, and seasonal patterns into plain English for non-expert stakeholders, using only pipeline figures and never generating predictions itself.  
Evaluation uses expanding-window walk-forward across held-out windows (the out-of-sample 2025 dry- and wet-season check and September 2025 to August 2026) with MAE, RMSE, MAPE, and precision, recall, and F1. Data are DOH PIDSR records from an approved FOI request, monthly region-level cases and deaths from January 2022 to August 2026; region populations from the PSA 2024 Census of Population serve as metadata for per-capita reporting only. The system is a web application (Python forecasting backend, PostgreSQL with SQLite fallback, interactive frontend).

### **1.5.2 Limitations**

The study covers dengue only, the sole illness with complete regional data at the time of development; related wet- and dry-season illnesses are excluded for now, though the pipeline can extend to them as data allow. PIDSR data are subject to underreporting and reporting delays, not adjusted for in threshold calibration. Thresholds rest on three observations per region-month from the 36-month window, making them sensitive to any single historical year and unable to anticipate unprecedented outbreak magnitudes. Wet/dry indicators are deterministic heuristics, not causal variables.   
	The outbreak signal is locked to a December 2024 cutoff so Rule A and Rule B are honestly validated on held-out 2025 seasons (Methodology page). One region-specific failure is disclosed: under multiplicative seasonality, the deployed Config B model's low-volume regions collapse late in the production horizon, binding the one-case non-negativity floor in five of 228 forecast months (Northern Mindanao: July-August 2027; Western Visayas: June-August 2027); they are the only affected series, their metrics are still reported, and the National forecast is unaffected. A volume-based fallback (e.g., additive seasonality for low-count regions) is future work. The system does not use deep learning, ensembles, spatiotemporal hotspot mapping, or external-platform integrations, and depends on timely DOH data. Findings reflect Philippine patterns through August 2026 and may not generalize to other settings. 

## **1.6 Definition of Terms**

To facilitate the understanding of this study, different terms are defined herein. Four key terms are used the same way throughout this paper. "Time-series analysis" is the modeling method used to study seasonality, trends, and cycles. "Prediction" (also called "forecasting") is the continuous, numeric case-count output the model produces per region-month; because that output is numeric, statisticians call the task a regression. "Classification" turns those counts into risk tiers (low, moderate, high) against historical percentiles. "Outbreak prediction" is the season-level label derived from classification through Rule A and Rule B, not a forecast amount. 

**Benchmarking Module.** A feature that lets users filter and compare Philippine regions side by side by predicted case volume, hotspot risk tier, and recommended interventions, with PDF report and CSV dataset exports.

**Causal Variables.** Variables that would establish a cause-and-effect driver of transmission, such as rainfall or temperature; none are treated as causal in HealthWatch, so the wet/dry seasonal indicator makes no causal claim.

**Classification and Risk Tiers.** The step that turns predicted case counts into low, moderate, or high risk: Low below the region's P50, Moderate between P50 and P75, and High above P75. A region-month in the High tier is a hotspot.

**Classification Metrics (Precision, Recall, F1-Score).** Precision is the share of flagged outbreaks or high-risk events that were real, recall is the share of real events that were flagged, and F1 is their harmonic balance; together they measure how well the system's labels agree with observed signals.

**Dengue and Pilot Illness.** Dengue is the study's pilot illness and the only illness with complete regional surveillance data at the time of development; a vector-borne disease that peaks during the rainy season.

**Department of Health (DOH) and Philippine Integrated Disease Surveillance and Response (PIDSR).** The DOH is the national agency responsible for public health, and PIDSR is its surveillance system, the source of this study's dengue data, subject to passive-surveillance limits such as underreporting and reporting delays.

**Deterministic Seasonal Indicator (Wet/Dry Seasonal Regressor).** A fixed, non-causal calendar variable, equal to one inside the wet season (June to November) and zero otherwise (December to May), that encodes the dry-wet climate calendar in the model.

**Epidemic Threshold.** The fixed, official case-count cutoff used to declare an outbreak, as in the 2026 Bohol declaration of three consecutive weeks above threshold. HealthWatch instead uses region-specific percentile thresholds and Rule A.

**Epidemiologically Plausible.** The property of predicted case counts staying within realistic, physically reasonable bounds, kept inline by the non-negativity constraint.

**Error Metrics (MAE, RMSE, MAPE).** Measures of prediction accuracy: MAE is the average absolute deviation, RMSE penalizes larger errors more heavily, and MAPE expresses error as a percentage of observed counts, excluding zero-case months to avoid division by zero.

**Prediction (Forecasting) and Regression.** Outputting a continuous, non-negative expected case count per region-month for the dry and wet seasons. Because the output is numeric, statisticians call this a regression task, so in this study the two terms refer to the same step.

**Freedom of Information (FOI) Request.** The approved mechanism through which the study obtained DOH regional dengue case and fatality data from January 2022 to August 2026.

**Generative-AI Explanation Feature.** The opt-in feature that translates already-computed predictions, classifications, outbreak signals, and seasonal patterns into plain English for non-expert stakeholders; it uses only pipeline figures and never generates predictions itself.

**HealthWatch.** The regional time-series analysis system developed in this study, pairing time-series analysis, hotspot classification, a grounded generative-AI explanation feature, a dashboard, and a benchmarking module. 

**Local Government Unit (LGU).** The local-level stakeholders intended to use the system's hotspot classifications for monitoring and response.

**National Aggregate.** The derived national series equal to the sum of the 18 regional series, giving the 19 series HealthWatch models independently.

**Non-Negativity Constraint.** The rule preventing predicted counts from dropping below zero, keeping case volumes epidemiologically plausible; it floors point predictions and their lower bounds above zero, and probes and validation folds at zero.

**Outbreak Prediction and Outbreak Rules (Rule A and Rule B).** The binary season-level signal derived from classification. Rule A flags three consecutive high-risk months within a season; Rule B flags a season whose probe mean exceeds that season's historical P75.

**Percentile Thresholds (P50 and P75).** The statistical cutoffs from each region's historical monthly case distribution over the fixed 36-month baseline (2022 to 2024), per region and calendar month, against which predicted cases are compared.

**Per-Capita Reporting**. Expressing case counts relative to population for context only; population metadata are used solely for this, not in the prediction or classification pipeline.

**Prophet**. The time-series model used in HealthWatch, configured with multiplicative seasonality (seasonal effects scale with the trend), an additive trend component, and the deterministic wet/dry seasonal indicator; a yearly Fourier seasonality term was evaluated during development and dropped because it was collinear with the seasonal indicator (R² ≈ 1.0) and scored worse on held-out error.

**Recommended Interventions.** Advisory measures mapped to each risk tier through a study-defined rule table, presented as decision support rather than directives.

**Region-Month**. The unit of analysis: one region's case series for one calendar month, the basis of each prediction and risk classification.

**Seasonal Illness (Notifiable).** The umbrella grouping of diseases that follow the wet-dry calendar and that health providers report to the surveillance system; this study's scope covers dengue only, though the pipeline can extend to other such illnesses as data become available.

**Seasonal Probe.** The 3-month prediction slice on which the outbreak rules run: dry, January to March; wet, July to September.

**Time-Series Analysis and Trend-Seasonal-Residual Decomposition.** The method that studies how a value changes over time, here monthly Prophet models of dengue counts capturing seasonal patterns, trends, and recurring annual cycles; the decomposition separates each series into trend, seasonal, and residual components to display those cycles.

**Validation (Walk-Forward, Holdout, and Out-of-Sample).** Refitting the model on an expanding window of past data and forecasting each successive unseen period. The model is fit only through the December 2024 training cutoff, and the 2025 dry and wet seasons plus the September 2025 to August 2026 window are held out as unseen data.

## **1.7 References**

Babanejaddehaki, M., An, A., & Papagelis, M. (2025). Disease outbreak detection and forecasting: A review of methods and data sources. ACM Transactions on Computing for Healthcare, 6(2). https://doi.org/10.1145/3708549

Cawiding, O. R., Jeon, S., Tubera-Panes, D., de los Reyes V, A. A., & Kim, J. K. (2025). Disentangling climate's dual role in dengue dynamics: A multiregion causal analysis study. Science Advances, 11(7), eadq1901. https://doi.org/10.1126/sciadv.adq1901

Cruz, E. I., Salazar, F. V., Aguila, A. M. A., Villaruel-Jagmis, M. V., Ramos, J., & Paul, R. E. (2024). Current and lagged associations of meteorological variables and Aedes mosquito indices with dengue incidence in the Philippines. PLOS Neglected Tropical Diseases, 18(7), e0011603. https://doi.org/10.1371/journal.pntd.0011603

Leung, X. Y., Islam, R. M., Adhami, M., Ilic, D., McDonald, L., Palawaththa, S., Diug, B., Munshi, S. U., & Karim, M. N. (2023). A systematic review of dengue outbreak prediction models: Current scenario and future directions. PLOS Neglected Tropical Diseases, 17(2), e0010631. https://doi.org/10.1371/journal.pntd.0010631

Lofgren, H., Donadel, M., Lacson, R. S., Pacial, D. R., de Guzman, A. R., Almendares, O., Philippines COVID-19 Surveillance System Evaluation Team, Escober, M. G. A., Tolentino, H., Bongalos, C., Montevirgen, M. R., Sotto, K. J., Mausisa, J., Salvatore, P. P., Yiu, S. M., & Chen, M.-Y. (2025). Optimizing surveillance post-pandemic: An evaluation of COVID-19 and other respiratory virus surveillance systems in the Philippines, April 2023. BMC Public Health, 25, Article 3378. https://doi.org/10.1186/s12889-025-24208-8

PAGASA. (n.d.). Climate of the Philippines. Philippine Atmospheric, Geophysical and Astronomical Services Administration. https://www.pagasa.dost.gov.ph/information/climate-philippines

Philippine Statistics Authority. (2024). 2024 Census of Population: Population by province, city/municipality, and barangay. https://psa.gov.ph/

Rabiei, R., Bastani, P., Ahmadi, H., Dehghan, S., & Almasi, S. (2024). Developing public health surveillance dashboards: A scoping review on the design principles. BMC Public Health, 24(1), Article 392. https://doi.org/10.1186/s12889-024-17841-2

Udtohan, L. (2026, August 29). Dengue outbreak declared in Bohol as cases surge. Philippine Daily Inquirer. https://newsinfo.inquirer.net/2294477/dengue-outbreak-declared-in-bohol-as-cases-surge

---

# **CHAPTER TWO**
# **REVIEW OF RELATED LITERATURE**

## **A. Seasonal & Climatic Basis of Illness Outbreaks in the Philippines**

### **A.1 DOH-Documented Seasonal Illness Patterns in the Philippines**

Department of Health advisories and DOH-related reports identify several illnesses associated with the rainy season in the Philippines. Water-borne diseases, influenza-like illness, leptospirosis, and dengue are repeatedly presented under the W.I.L.D. classification, and the sources relate these illnesses to rainy-season conditions such as contaminated water, flooding, increased exposure to floodwater, and the formation of mosquito-breeding sites (Banal, 2026; Department of Health-Cordillera Administrative Region, 2024; GMA Integrated News, 2025). The DOH summer advisory identifies food-borne illness and heat-related illness as the key dry-season concerns (Ager, 2024; MindaNews, 2025; Montemayor, 2023). This official record establishes the seasonal basis of outbreak burden in the Philippines but is descriptive rather than quantitative, providing no numerical thresholds, no forecast horizon, and no automated warning logic.

Banal, D. (2026). DOH issues warning against "Wild" diseases during rainy season. SunStar Publishing. https://www.sunstar.com.ph/manila/doh-issues-warning-against-wild-diseases-during-rainy-season

Department of Health-Cordillera Administrative Region. (2024). Dengue rising with rain; mosquitoes to blame. https://bit.ly/carodov-dengue-rising-with

GMA Integrated News. (2025). DOH warns vs. leptospirosis, dengue, other common illnesses during rainy season. GMA Network. https://www.gmanetwork.com/news/lifestyle/healthandwellness/950249/doh-warns-vs-leptospirosis-dengue-common-illnesses-during-rainy-season/story/

Ager, M. (2024). DOH chief reminds public: Hydrate, "cool off" vs summer diseases. Philippine Daily Inquirer. https://newsinfo.inquirer.net/1925095/doh-chief-reminds-public-hydrate-cool-off-vs-summer-diseases

MindaNews. (2025). DOH warns against exposure to extreme heat. https://mindanews.com/top-stories/2025/04/doh-warns-against-exposure-to-extreme-heat/

Montemayor, M. T. (2023). DOH warns public against summer diseases. Philippine News Agency. https://www.pna.gov.ph/articles/1196302

### **A.2 PAGASA-Based Deterministic Seasonal Features and Indicators in Time-Series Prediction**

PAGASA defines the rainy season as June-November and the dry season as December-May (PAGASA, n.d., 2025). Studies show such seasonal windows can be encoded as exogenous indicators, typically a dummy equal to one inside the target season and zero otherwise, rather than relying only on patterns learned from the target series; an autoregressive model with seasonal dummies outperformed decomposition, ARMA, and ARIMA alternatives (Vambol et al., 2022). Philippine research has applied Prophet and related models to capture recurring seasonal case patterns, and national studies show rainfall, temperature, and related climate variables can meaningfully improve weather-sensitive disease prediction, though their effects vary across regions (Cruz et al., 2024; Galvez & Tarepe, 2023). No study combines deterministic seasonal indicators with regional forecasting, risk tiers, and user-centered evaluation in one framework, the gap HealthWatch fills with its PAGASA-calendar wet/dry regressor.

Philippine Atmospheric, Geophysical and Astronomical Services Administration. (n.d.). Climate of the Philippines. https://www.pagasa.dost.gov.ph/information/climate-philippines

Philippine Atmospheric, Geophysical and Astronomical Services Administration. (2025). Onset of the rainy season. https://www.pagasa.dost.gov.ph/index.php/press-release/181?page=4

Vambol, S., Soomro, R., Ghauri, S., Marri, A., Dung, H. T., & Manzoor, N. (2022). Viable forecasting monthly weather data using time series methods. Ecological Questions. https://doi.org/10.12775/eq.2023.003

Cruz, E., Salazar, F. V., Aguila, A., Villaruel-Jagmis, M. V., Ramos, J., & Paul, R. E. (2024). Current and lagged associations of meteorological variables and Aedes mosquito indices with dengue incidence in the Philippines. PLOS Neglected Tropical Diseases, e0011603. https://doi.org/10.1371/journal.pntd.0011603

Galvez, R. M., & Tarepe, D. A. (2023). Predicting dengue outbreaks in Cagayan de Oro, Philippines using Facebook Prophet and the ARIMA model for time series forecasting. Journal of Advances in Mathematics and Computer Science, 38(9). https://doi.org/10.9734/jamcs/2023/v38i91800

### **A.3 The Wet-Dry Calendar and Disease Burden: Season-Illness Relationship and Relevance in the Philippines**

For this study, "illness" is used as an umbrella term, per the Philippine Information Agency (PIA) report, covering six specific conditions: dengue, leptospirosis, influenza-like illness, water-borne (cholera, typhoid, acute bloody diarrhea), heat-related, and food-borne (Del Rosario, 2026). The PAGASA wet-dry calendar functions as a structural predictor of illness burden because each season maps onto a distinct cluster of illnesses, giving the deterministic seasonal features explanatory relevance beyond temporal correlation. The dry season concentrates the food-borne and heat-related group (Villa, 2026), while the rainy season and its associated flooding activate the water-borne, vector-borne, and influenza clusters (Montemayor, 2026; G. Villanueva, 2026), with dengue peaking as continuous rain accumulates stagnant pools, as demonstrated by Bohol's 2026 province-wide outbreak declaration after 1,883 cases and 21 deaths and three consecutive weeks above the epidemic threshold (Udtohan, 2026), and influenza-like illness rising with exposure to rain and cold weather, with 86,113 cases recorded from January to August (R. Villanueva, 2026). This deterministic season-to-illness mapping is what HealthWatch encodes as its wet/dry regressor.

Del Rosario, J. C. (2026). DOH reminds public: Safe food practices crucial during hot season. Philippine Information Agency. https://pia.gov.ph/news/doh-reminds-public-safe-food-practices-crucial-during-hot-season/

Villa, H. P. (2026). Iloilo tightens health protocols as dangerous heat levels persist. INQUIRER.net. https://newsinfo.inquirer.net/2212700/iloilo-tightens-health-protocols-as-dangerous-heat-levels-persist

Montemayor, M. T. (2026). Nationwide leptospirosis cases reach 6,253. Philippine News Agency. https://www.pna.gov.ph/articles/1283388

Villanueva, G. (2026). DOH: 6,253 leptospirosis cases logged as of August 29. INQUIRER.net. https://newsinfo.inquirer.net/2298518/doh-6253-leptospirosis-cases-logged-as-of-august-29

Udtohan, L. (2026). Dengue outbreak declared in Bohol as cases surge. Philippine Daily Inquirer. https://newsinfo.inquirer.net/2294477/dengue-outbreak-declared-in-bohol-as-cases-surge

Villanueva, R. (2026). 86,113 influenza-like cases recorded this year. The Philippine Star. https://www.philstar.com/nation/2026/09/05/2554074/86113-influenza-cases-recorded-year

---

## **B. Time-Series Forecasting for Disease Outbreaks** (Obj 1)

### **B.1 Prophet as a Reproducible Forecasting Framework**

Shapiro and Panvelwala (2026) frame Prophet as a reproducibly specified additive model of trend, seasonality, external regressors, and uncertainty intervals, positioning it as a practical, auditable framework rather than a new algorithm. This reproducibility argument directly supports HealthWatch's choice of a transparent, auditable model over uninterpretable black-box alternatives.

Shapiro, S., & Panvelwala, B. (2026). Prophet as a reproducible forecasting framework: A methodological guide for business and financial analytics. arXiv. https://doi.org/10.48550/arXiv.2601.05929

### **B.2 Assessing Dengue Forecasting Methods in Rio de Janeiro, Brazil**

Chen and Moraga (2024) applied Prophet to dengue forecasting in Rio de Janeiro, comparing a broad model set across forward-moving windows for 1-12-week horizons. Prophet with climate covariates won at the 12-week horizon (MAE 342.47) at a fraction of the computational cost of LSTM alternatives. The study covers one city and omits mobility and socioeconomic predictors, testing no wet-dry regressor or Philippine thresholds. HealthWatch addresses this with a simpler monthly regional design featuring an integrated transparent wet-season regressor, point forecasts, and MAE/RMSE/MAPE reporting across Philippine regions without deep-ensemble cost.

Chen, X., & Moraga, P. (2024). Assessing dengue forecasting methods: A comparative study of statistical models and machine learning techniques in Rio de Janeiro, Brazil. Tropical Medicine and Health, 53. https://doi.org/10.1186/s41182-025-00723-7

### **B.3 Spatial Distribution Analysis and Comparative Forecasting of Dengue Resurgence in the Philippines**

Olana and colleagues (2025) compared monthly dengue prediction methods across all Philippine provinces on 1,903,425 cases over five years, training through 2023, testing on 2024, and projecting 2025-2027. NNAR led the test set (MAE 5,506.36, MAPE 13.23, MASE 0.40, RMSE 8,256.99) while Prophet lagged (MAE 17,129.33, MAPE 40.23), with strong July-September peaks driving a projected annual average of 444,678 cases. Only case-count error was evaluated, with no tier-level warning. HealthWatch closes this gap by testing a deliberately transparent Prophet configuration: a wet/dry regressor, regional risk tiers, seasonal outbreak probes, clipping, and explicit tier-level evaluation rather than case-count error alone.

Olana, K. O. A., Poprom, N., Siewchaisakul, P., Punyapornwithaya, V., & Thongprachum, A. (2025). Spatial distribution analysis and comparative forecasting of dengue resurgence in the Philippines, 2025-2027: A nationwide study. Transboundary and Emerging Diseases. https://doi.org/10.1155/tbed/7480710

### **B.4 Disentangling Climate's Dual Role in Dengue Dynamics in the Philippines**

Cawiding and colleagues (2025) applied an extended GOBI causal-inference framework with delayed rainfall/temperature functions and moving year-long windows to 16 Philippine regions. Temperature raised incidence in all regions, while rainfall either increased or dampened incidence depending on dry-season variability. This justifies fitting each of HealthWatch's 19 regional series independently with its own wet/dry regressor rather than a shared national effect, and reporting the series separately.

Cawiding, O., Jeon, S., Tubera-Panes, D., de los Reyes V, A. A., & Kim, J. K. (2025). Disentangling climate's dual role in dengue dynamics: A multiregion causal analysis study. Science Advances, 11. https://doi.org/10.1126/sciadv.adq1901

### **B.5 A District-Level Ensemble Model for Dengue Prediction in the Mekong Delta**

Areed and colleagues (2024) built a probabilistic dengue system for 112 Mekong Delta districts by weighting five Bayesian and PCA models, using the same-month/same-district 95th percentile as the outbreak threshold, and achieving 69% three-month accuracy. This confirms calendar-period percentile logic works in a Southeast Asian setting. HealthWatch adapts the same percentile logic to regional monthly series, testing whether simpler P50/P75 tiers and seasonal probes give interpretable warnings without that ensemble complexity.

Areed, W. D., Nguyễn, T., Do, K. Q., Nguyễn, T., Bui, V., Nelson, E., Warren, J. L., Doan, Q., Sinh, N. V., Osborne, N. J., Richards, R., Tran, N. Q. L., Le, H. H. T. C., Pham, T., Hung, T. M., Nghiem, S., Phung, H., Chu, C., Dubrow, R. S., ... Phung, D. (2024). A district-level ensemble model to enhance dengue prediction and control for the Mekong Delta Region of Vietnam. PLOS Neglected Tropical Diseases, 18, e0013571. https://doi.org/10.1371/journal.pntd.0013571

### **B.6 Poisson Count Time Series**

Kong and Lund (2023) review count time-series methods whose marginal distributions are Poisson, arguing discrete observations need non-Gaussian treatment with time-varying intensity and covariates. Their work grounds HealthWatch's non-negativity floor: predictions should respect count support rather than assume Gaussian coherence, and clipping should be audited for its effect on MAE, RMSE, percentile tiers, and interval behavior.

Kong, J., & Lund, R. (2023). Poisson count time series. Journal of Time Series Analysis, 44(2), 279-303. https://doi.org/10.1111/jtsa.12799

*Optional additions (used in current Ch2): Campbell et al. (2026) D-MOSS evaluation (operationality cost contrast); Latigay & Gonzaga (2026) Prophet-XGBoost leptospirosis (wet-season context, error reduction only).*

---

## **C. Outbreak Detection and Risk Classification** (Obj 2)

### **C.1 A Statistical Model for Probabilistic Epidemic Bands for Dengue Cases in Brazil**

Freitas and colleagues (2025) built P50/P75/P90 epidemic bands for 118 Brazilian districts using a Bayesian negative binomial model with INLA fitting. The tier structure parallels HealthWatch's P50/P75 tiers as transparent monitoring tiers, while Freitas explicitly warns no historical model anticipates unprecedented magnitudes. HealthWatch documents its 36-month baseline may fail under black-swan shifts and keeps point-prediction and uncertainty display separate.

Freitas, L. P., Ferreira, D. A. da C., Lana, R. M., Câmara, D. C. P., Portella, T. P., Carvalho, M. S., Gouveia, A. S., Almeida, I. F. de, Araujo, E., Vacaro, L. B., Ganem, F., Cruz, O., Coelho, F. C., Codeço, C., Carvalho, L. M., & Bastos, L. S. (2025). A statistical model for forecasting probabilistic epidemic bands for dengue cases in Brazil. Infectious Disease Modelling, 10, 1479-1487. https://doi.org/10.1016/j.idm.2025.07.014

### **C.2 Dengue Epidemic Alert Thresholds for Surveillance and Decision-Making in Puerto Rico**

Thayer and colleagues (2025) built a dengue alert system from Puerto Rico surveillance data, fitting intercept-only negative binomial regressions per calendar week and evaluating P60/P75/P90 of the modeled distribution, with an epidemic declared when cases exceed the threshold two consecutive weeks. Retrospective coverage ran 2001-2023, with P75 achieving 100% sensitivity and 89% specificity across six historical epidemic years and supporting the March 2024 emergency declaration. This persistence rule underlies HealthWatch's Rule A (three consecutive High months); HealthWatch applies calendar-month thresholds to regional forecasts, makes the consecutive-high rule explicit, and evaluates performance on a held-out Philippine period.

Thayer, M. B., Marzán-Rodríguez, M., Torres Aponte, J., Rivera, A., Rodríguez, D. M., Madewell, Z., Rysava, K., Paz-Bailey, G., Adams, L. E., & Johansson, M. A. (2025). Dengue epidemic alert thresholds for surveillance and decision-making in Puerto Rico: Development and prospective application of an early warning system using routine surveillance data. BMJ Open, 15, e106182. https://doi.org/10.1136/bmjopen-2025-106182

### **C.3 Endemic Channel Parametrization in Dengue Surveillance**

Umaña and colleagues (2025) evaluated the endemic channel as a descriptive surveillance tool with safety/warning/epidemic levels, varying central-tendency measure, retrospective window, epidemic-year treatment, and zero-case handling across Colombian transmission profiles. Shorter windows improved performance about 6.34%, and a minimal zero shift beat adding one by 23.07%. The study justifies documenting HealthWatch's 36-month threshold baseline explicitly and testing whether its P50/P75 thresholds stay stable under alternative historical windows.

Umaña, J. D., Montenegro-Torres, J., Otero, J., Tavera-Cifuentes, M. C., Niño-Machado, N., González-Uribe, C., Cordovez, J. M., & Santos-Vega, M. (2025). Endemic channel parametrization in dengue surveillance: Methodological assessment of retrospective windows, outbreak trends, and zero-case periods in Colombia. JMIR Public Health and Surveillance, 11, e79914. https://doi.org/10.2196/79914

### **C.4 Optimized Surveillance Thresholds in Malaysia**

Singh and colleagues (2026) compared a standard-deviation endemic channel against a log-scale version with an enhanced persistence rule on weekly Malaysian data (2014-2024); the optimized log-scale method (m = 0.50) beat the conventional channel on sensitivity (0.60 vs 0.56), specificity (0.82 vs 0.70), and Youden index (0.43 vs 0.26). HealthWatch keeps transparent P50/P75 logic while testing how its Rule A and Rule B behave under regional Philippine aggregation rather than national data.

Singh, S., Iderus, N. H. M., Ahmad, L. C. R. Q., Ghazali, S. M., Ghazali, N. M., Nadzri, M. N. M., Anuar, A., Kamarudin, M. K., Cheng, L., Huey, T. C., Lin, C., Keong, W. M., & Chew, C. (2026). Optimizing dengue surveillance thresholds in Malaysia: A comparative evaluation of endemic channel approaches. Tropical Medicine and Infectious Disease, 11(8), 231. https://doi.org/10.3390/tropicalmed11080231

### **C.5 Early Warning and Response Systems: From Research to Operational Implementation**

The WHO handbook (foundational, 2016) frames outbreak prediction as surveillance combining epidemiological, meteorological, and entomological alarms with an endemic-channel definition, its exemplar triggering when cases exceed a moving threshold two consecutive weeks. Schlesinger and colleagues (2024) validated EWARS-csd across 11 Colombian municipalities at median sensitivity 0.97 and specificity 0.94, and Sánchez Tejeda and colleagues (2023) traced EWARS' integration into Mexico's national platform. These confirm persistence-based threshold alerts remain the operational standard. HealthWatch keeps WHO's consecutive-persistence principle at monthly scale as Rule A, evaluated on a held-out Philippine period.

World Health Organization. (2016). Technical handbook for dengue surveillance, dengue outbreak prediction/detection and outbreak response. WHO.

Schlesinger, M., Prieto Alvarado, F. E., Borbón Ramos, M. E., Sewe, M., Merle, C. S., Kroeger, A., & Hussain-Alkhateeb, L. (2024). Enabling countries to manage outbreaks: Statistical, operational, and contextual analysis of the early warning and response system (EWARS-csd) for dengue outbreaks. Frontiers in Public Health, 12, 1323618. https://doi.org/10.3389/fpubh.2024.1323618

Sánchez Tejeda, G., Benítez Valladares, D., Correa Morales, F., Toledo Cisneros, J., Espinoza Tamarindo, B. E., Hussain-Alkhateeb, L., Merle, C. S., & Kroeger, A. (2023). Early warning and response system for dengue outbreaks: Moving from research to operational implementation in Mexico. PLOS Global Public Health, 3(9), e0001691. https://doi.org/10.1371/journal.pgph.0001691

### **C.6 Pre- and Post-COVID-19 Pandemic Identification of Dengue Hotspots and Exploration of Determinants in Quezon City**

Medina and colleagues (2025) analyzed quarterly dengue cases across 142 Quezon City barangays using Local Moran's I, finding hotspots fell from 32 barangays in Q4 2019 to two in Q1 2020 before resurging in late 2021-2022. The study maps retrospective quarterly clusters rather than forecasting future risk. HealthWatch fills this by classifying forecasted regional risk monthly instead of mapping only past clusters.

Medina, J. R. C., Kawamura, S., Takeuchi, R., Cruz, R. V., Mendoza, J., Hernandez, P. M. R., Garcia, F. B., Gregorio, E., & Kobayashi, J. (2025). Pre- and post-COVID-19 pandemic identification of dengue hotspots and exploration of population and environmental determinants of dengue in Quezon City, Philippines. Tropical Medicine and Health, 53, 109. https://doi.org/10.1186/s41182-025-00789-3

### **C.7 Spatiotemporal Analysis of Dengue Cases Distribution in Cavite, Philippines**

Acosta and Nacion (2024) conducted a spatiotemporal study of dengue in Cavite from 2016 to 2020 using Local Moran's I and Getis-Ord Gi* with additive time-series decomposition, categorizing municipalities into risk profiles including low, medium, and high hotspots. The hotspot classifications were derived from past reported cases rather than forward-looking predictive models. HealthWatch addresses this by forecasting upcoming seasonal counts and dynamically classifying risk levels as Low/Moderate/High for public-health planning.

Acosta, N. N., & Nacion, N. (2024). Spatiotemporal analysis of dengue cases distribution in Cavite, Philippines with geographic choropleth mapping and emerging hotspot analysis. Philippine Journal of Science, 153(5), 1605-1622. https://doi.org/10.56899/153.05.10

---

## **D. Generative-AI / LLM Plain-Language Interpretability** (Obj 3)

### **D.1 An Equity-Aware Generative AI Copilot for Digital Public Health Surveillance**

Albahli (2026) combined forecasting, outbreak detection, and retrieval-augmented narrative generation into an equity-aware public-health surveillance copilot. A graph-augmented Temporal Fusion Transformer produced four-week forecasts (RMSE 0.183, MAPE 9.7%), an anomaly head detected elevated-risk periods (AUROC 0.936, F1 0.842), and a retrieval-augmented LLM generated summaries from retrieved public-health passages, keeping analysts in the review loop, with entity-level F1 0.88 and citation coverage 93%. HealthWatch follows the same deterministic-first separation, forecast, P50/P75 tiers, probe values, and outbreak flags computed before any LLM call, but constrains its language layer further: instead of open retrieval, the LLM narrates only a serialized typed forecast object containing permitted facts.

Albahli, S. (2026). An equity-aware generative AI copilot for digital public health surveillance. Frontiers in Public Health, 14. https://doi.org/10.3389/fpubh.2026.1827709

### **D.2 Are LLM-Generated Plain Language Summaries Truly Understandable?**

Guo and colleagues (2025) compared human-written plain-language summaries with six GPT-4 prompting conditions across 50 scientific abstracts. LLM summaries scored similarly to human summaries on subjective quality, yet participants answered comprehension questions significantly better after reading the human-written versions, and faithfulness was the strongest subjective predictor of comprehension. This justifies HealthWatch's Objective 3 evaluation design: perceived clarity is not evidence of understanding, so the study plans comprehension and recall measures, identifying the correct risk tier, forecast direction, and underlying uncertainty, alongside numeric fidelity checks.

Guo, Y., Sohn, J. H., Leroy, G., & Cohen, T. (2025). Are LLM-generated plain language summaries truly understandable? A large-scale crowdsourced evaluation. Journal of Biomedical Informatics, 179, 105038. https://doi.org/10.48550/arXiv.2505.10409

### **D.3 ASHABot: An LLM-Powered Chatbot to Support the Informational Needs of Community Health Workers**

Ramjee and colleagues (2024) deployed ASHABot, a WhatsApp chatbot using GPT-4 over a doctor-curated knowledge base, for community health workers in Rajasthan, India. Medical reviewers rated automated answers accurate in 85% or more of cases, but health workers sometimes treated the bot as authoritative and over-relied on its answers. This low-resource deployment mirrors HealthWatch's intended users, regional public health staff without statistical training, and grounds three design choices: the LLM is presented as an assistant with explicit AI-generated disclosure, the underlying outputs remain fully visible beside the prose, and human escalation paths are provided.

Ramjee, P., Chhokar, M., Sachdeva, B., Meena, M., Abdullah, H., Vashistha, A., Nagar, R., & Jain, M. (2024). ASHABot: An LLM-powered chatbot to support the informational needs of community health workers. In Proceedings of the 2025 CHI Conference on Human Factors in Computing Systems. https://doi.org/10.1145/3706598.3713680

---

## **E. Dashboards, Comparative Benchmarking & Exportable Reporting** (Obj 4)

### **E.1 Design Principles for Public-Health Surveillance Dashboards**

Rabiei and colleagues (2024) synthesized 67 articles on public-health dashboard design, grouping principles into users/aims, content and KPIs, interface/interactivity, analysis/presentation, and infrastructure, with dashboards mostly at national (58%), then regional (27%) level, and recommending local customization, data-quality assessment, and clear KPIs. HealthWatch responds with a Philippine regional dashboard built around health-officer users, forecast and tier KPIs, interactive regional views, and CSV/PDF outputs.

Rabiei, R., Bastani, P., Ahmadi, H., Dehghan, S., & Almasi, S. (2024). Developing public health surveillance dashboards: A scoping review on the design principles. BMC Public Health, 24, 392. https://doi.org/10.1186/s12889-024-17841-2

### **E.2 Data Export, Automated Reporting, and Data Quality in Surveillance Dashboards**

Garvey and colleagues (2026) describe Ireland's shift from static PDF reports to public-facing dashboards for infectious-disease notifications, with weekly case data, time trends, disease/region filters, and downloadable aggregate CSVs, targeting policymakers, practitioners, academics, media, and the public. This directly parallels HealthWatch's exportable comparative reporting: regional filters, tier views, and PDF/CSV outputs intended for regional health stakeholders rather than a national platform.

Garvey, D., McCarthy, M., Alves, M., Ortiz, A., MacKenzie, K., Timoney, K., Oza, A., & O'Connor, E. (2026). A strategy to visualise infectious disease notification data in dynamic customisable dashboards for policymakers, health practitioners, academics, the media and the public in Ireland. Journal of Public Health, 48, i2. https://doi.org/10.1093/pubmed/fdag046.003

### **E.3 A Data-Driven Monitoring Platform for Barangay Health Workers in Community Health Services**

Tena and colleagues (2026) developed a web-based monitoring platform for Barangay Health Workers in Santa Maria, Laguna, covering census, maternal care, immunization, and deworming services, with geo-mapping, automated report generation, and simple forecasting, assessed as highly acceptable under the Technology Acceptance Model (BHWs 4.24, midwives 4.42). The study shows simple, interpretable forecasting works in barangay-level health planning but evaluates user acceptability rather than forecast accuracy. HealthWatch addresses this gap by applying the dashboard-for-health-workers context to regional monthly forecasting with Prophet, a seasonal-naïve baseline, P50/P75 risk tiers, and statistical forecast and warning metrics rather than acceptability ratings alone.

Tena, J., Perida, G., Mabras, R., & Balahadia, F. (2026). Data-driven monitoring platform for Barangay Health Workers (BHWs) in community health services. International Journal of Computing Sciences Research, 10, 4371-4403. https://doi.org/10.25147/ijcsr.v10i0.851

---

## **F. Model Validation & Prediction Metrics** (Obj 5)

### **F.1 Prediction Evaluation for Data Scientists: Common Pitfalls and Best Practices**

Hewamalage and colleagues (2022) reviewed time-series evaluation for machine learning researchers, recommending preserved temporal order, validation/testing separation, and rolling-origin or expanding-window evaluation over random cross-validation, and documenting MAPE's failure on zero-heavy series in favor of scaled alternatives. This guidance directly underpins HealthWatch's walk-forward design: a preserved 2025 holdout with MAE, RMSE, MAPE, skill, tier agreement, and warning confusion-matrix reporting.

Hewamalage, H., Ackermann, K., & Bergmeir, C. (2022). Forecast evaluation for data scientists: Common pitfalls and best practices. Data Mining and Knowledge Discovery, 37, 788-832. https://doi.org/10.1007/s10618-022-00894-5

### **F.2 A Systematic Review of Dengue Outbreak Prediction Models**

Leung and colleagues (2023) systematically reviewed dengue outbreak prediction models, finding 100% used climate predictors and that validation was weak: 24.4% had none, 69.2% only internal, and 6.4% external. This documented scarcity of external validation is exactly what HealthWatch's held-out evaluation addresses: a temporally honest holdout and walk-forward scheme with both count-error and warning-classification metrics across Philippine regional series.

Leung, X. Y., Islam, R. M., Adhami, M., Ilic, D., McDonald, L., Palawaththa, S., Diug, B., Munshi, S. U., & Karim, M. N. (2023). A systematic review of dengue outbreak prediction models: Current scenario and future directions. PLOS Neglected Tropical Diseases, 17(2), e0010631. https://doi.org/10.1371/journal.pntd.0010631

### **F.3 Root-Mean-Square Error or Mean Absolute Error: When to Use Them or Not**

Hodson (2022) revisited the RMSE-versus-MAE debate, deriving RMSE from squared-error loss under a Gaussian error assumption and MAE from absolute-error loss under a Laplace assumption, arguing neither metric is inherently superior. Sparse dengue counts with occasional heavy spikes make squared-error dominance a real concern. HealthWatch reports both MAE and RMSE, inspects error patterns, and avoids claiming one metric alone proves model superiority.

Hodson, T. (2022). Root-mean-square error (RMSE) or mean absolute error (MAE): When to use them or not. Geoscientific Model Development, 15, 5481-5487. https://doi.org/10.5194/gmd-15-5481-2022

### **F.4 Common Problems with the Usage of F-Measure and Accuracy Metrics in Medical Research**

Lavazza and Morasca (2023) show how reported accuracy/precision/recall/F-measure can mask only marginal improvement when benchmarked against the Matthews correlation coefficient, urging reporting full confusion matrices, comparing F-measure against prevalence and random baselines, and weighing misclassification costs. Since HealthWatch's warning evaluation is a three-tier ordered outcome, accuracy alone is insufficient, so it reports the full confusion matrix, precision, recall, F1, prevalence, and tier-specific errors.

Lavazza, L., & Morasca, S. (2023). Common problems with the usage of F-measure and accuracy metrics in medical research. IEEE Access, 11, 51515-51526. https://doi.org/10.1109/ACCESS.2023.3278996