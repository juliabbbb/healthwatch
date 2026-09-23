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
Evaluation uses expanding-window walk-forward across held-out windows (the out-of-sample 2025 dry- and wet-season check and September 2025 to August 2026) with MAE, RMSE, MAPE, and precision, recall, and F1. Data are DOH PIDSR records from an approved FOI request, monthly region-level cases and deaths from January 2022 to August 2026; region populations from the PSA 2024 Census of Population serve as metadata for per-capita reporting only. The system is a web application (Python forecasting backend, PostgreSQL database, interactive frontend).

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

# **CHAPTER THREE**

# **METHODOLOGY**

## **3.1 Research Design**

This study uses a **computational research design** built on real surveillance data: the Philippine Department of Health (DOH) Epidemic Bulletin reporting (DOH-EB) monthly dengue counts from January 2022 to August 2026 across all 18 administrative regions, with the national series derived as the sum of the regional series rather than a raw national feed. The design answers four methodological questions in sequence:

1. Can a monthly **time-series analysis** of each region's observed case history produce an expected case count per region-month (**a point prediction with an interval**) that is competitive against a seasonal-naive baseline?
2. Do region-month **risk tiers** derived from each region's own pre-2025 history (P50/P75 percentiles) translate observed and predicted loads into a stable Low / Moderate / High label?
3. Do two complementary, deterministic **seasonal probes** (the next dry season, January to March, and the next wet season, July to September) produce a season-level **outbreak prediction** that matches observed 2025 outcomes?
4. How sensitive are those outputs to a documented modelling and calendar assumption, and can that sensitivity be measured and disclosed rather than assumed?

The research design deliberately separates **method** from **product**. The method is time-series analysis (Prophet) exercised over two walk-forward validation windows; the product is the combination of predictions, risk tiers, and season-level outbreak labels that the dashboard presents to a public-health reader. The umbrella term used throughout this chapter for that combination is **system outputs**. The term *prediction* always means the continuous numeric output (expected cases per region-month), *classification* means the risk tier, and *outbreak prediction* means the season-level Rule A / Rule B label; no other sense is loaded onto these words.

The design is anchored by an external, independent check: the classification logic is re-applied at weekly (ISO-week) resolution to the known 2019 national dengue epidemic, declared on 6 August 2019, using a separate 2016 to 2021 historical fixture. This check validates the *method* (percentile-threshold classification) against a real declared epidemic that predates the study's 2022 to 2026 data window, and is deliberately decoupled from the live monthly pipeline so it can never inherit that pipeline's decisions.

The study is **predictive but non-causal**: none of the modules asserts a causal mechanism between weather and case counts. A documented guard in the narration layer (Section 3.5.3) actively forbids the system from such claims, which matters because the region-level percentiles are climate-agnostic by construction.

## **3.2 Data Analytics Life Cycle**

The project follows a six-stage life cycle, each stage implemented as a deterministic module in the `src/` package and each writing a versioned artifact into `data/processed/`. No stage consumes a human decision at runtime; a full run is scriptable end to end.

- **Ingestion.** `src/doh_eb_ingest.py` reads the canonical DOH-EB export and normalizes it: raw DOH region labels are mapped to 18 canonical regions (including the Negros Island Region), morbidity weeks are summed into calendar months, the national series is derived as the sum of the 18 regional series (never taken from a raw national row), and every case count is clipped at zero before aggregation (`src/doh_eb_ingest.py:83`). Outputs: `national_monthly.csv`, `regional_dengue_monthly.csv`, and the weekly regional file retained for inspection.
- **Time-series analysis (Specific Objective 1).** `src/forecast.py` fits a monthly Prophet model per series, produces a 12-month production prediction, and runs a monthly-refit walk-forward backtest over two 12-month holdout windows. It also fits the two seasonal probe predictions (Section 3.5.1). Outputs: `forecasts.csv`, `season_probes.csv`, `validation_metrics.csv`, `validation_predictions.csv`.
- **Classification (Specific Objective 2).** `src/classify.py` computes each region's P50/P75 risk thresholds from the 36-month pre-2025 baseline and labels every predicted month Low / Moderate / High. Outputs: `risk_thresholds.csv`, `seasonal_thresholds.csv`, `risk_classification.csv`, `seasonal_classification.csv`, `tier_accuracy.csv`.
- **Outbreak detection (Specific Objective 2).** `src/outbreak.py` combines the classified seasonal probes with the seasonal P75 baseline to produce one outbreak label per (region, season). Outputs: `outbreak_indicators.csv`.
- **Evaluation.** `src/validate_2025.py` compares predicted 2025 flags against observed 2025 data and reports a confusion matrix plus macro metrics; `src/validate_known_epidemic.py` re-applies the classification method to the 2019 epidemic fixture; `src/sensitivity.py` quantifies the Type II climate-calendar sensitivity; `src/ablation.py` measures the cost of the modelling configuration decision. Outputs: `outbreak_validation_2025.csv`, `known_epidemic_check.csv`, `sensitivity_type2_flags.csv`, `ablation_*.csv`.
- **Relational persistence.** `src/db.py` rebuilds a nine-table schema from the processed artifacts; the rebuild is idempotent, and each run inserts a traceability row (`pipeline_runs`) recording generation time, data cutoff, and model version.

## **3.3 System Architecture**

The system is a batch-analysis pipeline with a visualization front end. It is not implemented as a web service; all computation happens at pipeline time and all results are materialized as flat files and relational rows, so the dashboard reads pre-computed artifacts instead of invoking models at request time.

- **Analysis layer.** Pure-Python modules over `pandas` and `numpy` that implement the life cycle in Section 3.2. The model fitting is the only sub-second-to-minutes operation and is confined to `src/forecast.py` and the verification studies.
- **Model layer.** Prophet (Taylor and Letham, 2018) for the monthly time-series analysis. The model is fit once per region per stage of the life cycle; there is no rolling retest during dashboard interaction.
- **Narration layer.** An opt-in interpretability subsystem that generates one-sentence plain-language narratives over already-computed artifacts, then applies deterministic guards (weather-lexicon check and numeric-fidelity check) before any narrative is shown (Section 3.5.3).
- **Presentation layer.** A React single-page dashboard (TanStack Router, Leaflet choropleth) that renders the stored artifacts: a national map with region risk states, region overview cards, comparative tables, seasonality decompositions, and a documented design system governed by `PRODUCT.md` and `DESIGN.md`.

Because every analysis artefact ships inside the repository and the presentation layer reads only those artifacts, the dashboard remains deterministic and reproducible without a live backend.

## **3.4 System Requirements**

The analysis pipeline is designed to run on a desktop workstation; no server is required.

- **Operating system.** Windows 10/11, macOS 12+, or Linux on x86-64.
- **Runtime.** Python 3.10+. Model fitting (Prophet) executes locally with the Stan backend; no cloud compute is invoked by the core pipeline.
- **Data stack.** `pandas`, `numpy`, `prophet`, `cmdstanpy`; a PostgreSQL relational layer (Postgres-only, requires `DATABASE_URL`), rebuilt from the pipeline CSVs by `src.db`.
- **Hardware.** A single modern CPU is sufficient. The full pipeline (56 observed months, 19 series) fits in minutes on four or more cores; the verification studies (Section 3.5.5) are proportionally heavier and are run detached.
- **Front end.** A modern evergreen browser (Chrome 90+, Firefox 90+, Safari 15+, Edge 90+) with WebGL for the Leaflet choropleth. Rendering is client-side; no compute is offloaded.

## **3.5 Methods and Tools**

### **3.5.1 Time-Series Analysis with Prophet (Specific Objective 1)**

Each of the 19 series (18 regions plus the derived national series) is modelled as a monthly time series with `freq="MS"` (`src/forecast.py:47`). The series length is 56 observed months (January 2022 to August 2026), which the methodology discloses as a data-window limitation: at deployment time only three full yearly cycles were available, enough for a deterministic season marker but thin for a data-hungry seasonal model.

The deployed configuration is **Config B**: Prophet in multiplicative form,

```
y_t = g_t * (1 + w_t) + eps
```

where `g_t` is Prophet's piecewise-linear trend with automatic changepoint detection and `w_t = beta * 1[t in {6, 7, 8, 9, 10, 11}]` is a deterministic wet-season step regressor equal to 1 in June through November and 0 in December through May (`features.WET_SEASON_MONTHS`). Weekly and daily seasonality are disabled; the yearly Fourier seasonality is disabled in production (`use_year_seasonality=False`) because the wet-season step and the Fourier yearly columns are statistically collinear on this training calendar.

**Capturing seasonal patterns, trend and the recurring annual cycle.** Alongside the fitted model, the system computes a deterministic additive decomposition of each observed series (`decompose()` in `frontend/src/lib/healthwatch/data.ts:711-750`, ported server-side in `src/api.py:643-719` for narration): a centred 13-month simple moving-average trend, a month-of-year seasonal index from the detrended residuals, and a residual noise component (observed minus trend minus seasonal). The **recurring annual cycle** is verified independently of the fit via the autocorrelation function (ACF) over lags 1 to 24; a dominant 12-month lag confirms an annual cycle, and a seasonality-strength ratio (seasonal variance over seasonal-plus-residual variance) quantifies how much of the series movement is periodic rather than noise. This decomposition also feeds the seasonality narration and the dashboard decomposition charts, so the trend, the seasonal index, the residual, and the dominant cycle lag are each surfaced as explicit, auditable figures rather than buried in the fitted model.

Each series yields a 12-month **point prediction with an 80% interval** from `build_forecast()` and a second, shorter output: the **seasonal probes** fit through 31 December 2024 (`TRAIN_END`), covering the next dry window (January to March) and the wet climatological peak (July to September) via month offsets `(1, 3)` and `(7, 9)` (`src/forecast.py:43-44`). Probes exist to feed the outbreak detector (Section 3.5.2) and keep the 2025 seasons true prospective holdouts.

**Non-negativity.** All predictions are clipped at a floor of one case in production and zero in probes and validation folds, and no upper bound is clipped (`src/forecast.py:150-151, 169-170, 110`). The chapter discloses why: a one-case floor keeps log-scaled multiplicative ratios finite and presentation sane; a zero floor preserves distributional fidelity for percentiles and error metrics. A documented `excluded_zero_actual` counter in the scorer separates these choices from silent data loss (Section 3.5.5).

**Walk-forward validation.** Every series is backtested over two fixed 12-month holdouts in `WINDOWS` (`src/forecast.py:31-34`):

- `last_12m`: trained through 2025-08, holding out 2025-09 to 2026-08;
- `2025_prospective`: trained through 2024-12, holding out 2025-01 to 2025-12.

The walk-forward implementation **refits every month** (`REFIT_EVERY = 1`) and requires a 24-month minimum training history (`MIN_TRAIN_MONTHS`), so the two regimes approximate a truly rolling operational estimate and never use holdout data during training.

**Modelling ablation.** `src/ablation.py` exercises three configurations through the identical walk-forward and production paths (`src/ablation.py:28-32`):

- Config A: yearly seasonality only (no wet step);
- Config B: wet step only (deployed);
- Config C: both (the previous default).

The collinearity is quantified directly with a projected R-squared of the wet step on the Fourier columns and the condition number of the joint design matrix. On the shipped training calendar the projected R-squared is 1.0 with a condition number near 7.6e16 (`ablation_overlap.csv`): the wet-day indicator is fully spanned by the Fourier columns, so Config C forces the optimization to split one signal across two channels. Nationwide mean error on the `2025_prospective` window was 1715.84 (B) versus 2072.37 (C) and 2382.09 (A) in MAE, with MAPE 54.30% (B) versus 83.23% (C) and 73.81% (A); Config B is best on MAE, RMSE, and MAPE in both windows and produces the highest mean predicted volume (2053.06 vs 1745.07 A and 1559.93 C), which the report records as the empirical cost of every schema decision: no decision is asserted, each is measured and disclosed. The trade-off is that the flag-level 2025 F1 is essentially unchanged by the choice (0.47 under B versus 0.53 under the former C), and the chapter reports the deployed configuration's numbers throughout.

### **3.5.2 Classification: Risk Tiers and Seasonal Outbreak Prediction (Specific Objective 2)**

**Risk thresholds.** For each (disease, region, month-of-year) cell, the P50 and P75 of observed monthly cases are computed from the 36-month pre-2025 baseline (January 2022 through December 2024) using pandas' default linear interpolation (`compute_thresholds` in `src/classify.py`). The fixed baseline means the thresholds are frozen at pipeline time and never re-derived from data the model has already predicted; the 36-month span yields three historical values per (region, month) cell, which the methodology discloses as a thin per-cell sample.

**Risk tiers.** Every predicted month is labelled Low (below P50), Moderate (P50 to P75), or High (above P75) by the monotone rule in `classify.label` (`src/classify.py:127-131`). Because the thresholds are per-(region, month), the tiers are **region-specific and climate-agnostic by construction**; a region with a permanently low case load and a region with a high load are compared against their own histories, never against each other. A region-month in the High tier is a **hotspot** (the operational definition used throughout this paper), so this module implements the hotspot classification algorithm of Specific Objective 2: a region with its predicted month above its own P75 is flagged as a hotspot for that month.

**Seasonal probe classification.** The same monthly thresholds label each month of the dry and wet probes, producing a seasonal row set consumed only by the outbreak detector (`classify_seasonal`).

**Outbreak detector.** `src/outbreak.py` emits one label per (region, season) using two complementary rules:

- **Rule A (consecutive High):** the longest run of consecutive High months inside the three-month probe must be at least three (`CONSECUTIVE_HIGH_N = 3`, `src/outbreak.py:27`). Because the probe window is strictly bounded to exactly three months, the longest run can never exceed three, so the rule is logically equivalent to "every probe month classified High": sustained elevation, not a single anomalous month.
- **Rule B (season P75 uplift):** the average of the three probe months' predicted loads exceeds the season's pooled historical P75 (`season_avg > season_p75`, `src/outbreak.py:81`). The seasonal P75 pools every historical monthly count inside the season (wet = June to November, dry = December to May) over the same 36-month baseline, and captures elevated *seasonal* load even when no individual month crosses High.

A region-season is flagged at *seasonal outbreak risk* if either rule fires; the trigger is recorded as `consecutive_high`, `season_p75`, or `both`. On the shipped 2026 data, 28 of 38 region-seasons are flagged (20 by both rules, 8 by Rule B only, 10 not flagged).

### **3.5.3 Interpretability and the Narration Guard (Specific Objective 3)**

An opt-in narration layer explains the pre-computed artifacts in plain language for map panels, region cards, and seasonality charts. Its defining property is that it **restates, never creates**: the narration request is issued over a JSON grounding payload built only from already-computed pipeline numbers (last observed month, next-month prediction with interval, next-month risk tier, the season probe label and trigger, validation MAPE).

Two deterministic guards keep the narration honest:

1. **Weather-lexicon guard.** The system prompt forbids attributing cases to weather, rainfall, the monsoon, typhoons, or 'the rainy season', and requires talking about which calendar months rise and fall and which season label applies. The guard then deterministically scans the generated text; any forbidden token trips it.
2. **Numeric-fidelity guard.** The set of numeric values a narrative may use is collected recursively from the grounding payload, and every numeric token in the generated prose must trace back to that allowed set. Any number without a grounded counterpart trips the guard.

On either violation the narration is replaced by a **deterministic templated fallback** built from the same grounding payload (so no unverified figure is ever dispatched), and the client is told that the safe fallback was used. For the three Type II climate regions (Bicol Region, Eastern Visayas, Caraga) the grounding payload carries a climate-type annotation so the narration can note the local pattern without inventing causality.

The structural guarantee is verified by a **narrative-fidelity corpus**: one narration per (endpoint, region, seasonality component) through the exact constrained path used in production, 19 series times (1 insight + 1 analysis + 5 seasonality components + 1 explain-element) = **152 narratives**, with violations, fallbacks fired, and any unverified dispatched numbers recorded (`src/validate_narratives.py`).

### **3.5.4 The Dashboard and Benchmarking Module (Specific Objective 4)**

The dashboard is a React + Vite + TanStack Router single-page application with a Leaflet choropleth map. It renders only pre-computed artifacts and exposes five analytical surfaces:

- **National map.** Region polygons tinted by current risk tier, with a month slider spanning past months (reported cases) and future months (predicted cases) and optional per-region outbreak markers.
- **Comparative table.** A filterable, sortable side-by-side benchmark of Philippine regions on predicted load, risk tier, a 95% band from the prediction's upper and lower bounds, a continuous **percentile column** (the month's percentile rank shown as "Nth"), 3-month change, dominant illness, and click-to-expand intervention recommendations. A unified filter panel plus per-region selection toggles let users narrow the benchmark to any subset of regions before comparing, and the default metric is the **per-capita rate** (cases per 100,000 population), with a raw-count toggle.
- **Escalation ranking.** An objective-4 priority list (Specific Objective 4's benchmarking module) whose rank key is purely change-based: `tier_climbs` (sum of upward tier transitions, Low to Moderate and Moderate to High each counting one), followed by months at High, never raw volume (`src/rank_escalation.py`). Complementary fields include final tier and first High month.
- **Seasonality page.** Additive decomposition (observed, trend, seasonal, residual) with 12-month autocorrelation (ACF) indicators confirming the annual outbreak cycle.
- **Methodology page.** The live verification numbers are pulled from the shipped artifacts, with an example row of the escalation ranking shown for transparency.

**Exports.** CSV per-chart generation writes a region- and component-scoped file as a browser Blob. For PDF, `@react-pdf/renderer` renders the report client-side in executive, comprehensive, or custom layouts, each a configurable assembly of six sections (regional profiles, comparative table, trajectory, seasonality, model performance, recommendations) by toggling section switches.

All UI work is governed by a documented design system (`PRODUCT.md` as product truth, `DESIGN.md` as rules and tokens, with a machine-readable sidecar), including one coral accent, green/amber/red reserved for risk data, mono label-caps for metadata, and glass panels carrying shadow only behind non-body content.

### **3.5.5 Evaluation and Verification Studies (Specific Objective 5)**

**Point-prediction error.** The walk-forward scorer reports MAE, RMSE, MAPE, months, and a neutral **excluded_zero_actual** counter (`src/forecast.py:114-128`). MAPE excludes zero-actual months (division would be undefined), and the counter records how many were dropped per window so future datasets with common zeros immediately surface data loss instead of silently. The grader also reports NAIVE-MAE and a **skill score** against the seasonal-naive baseline:

- skill% = (1 - MAE / naive_MAE) * 100

On the deployed Config B the overall (mean across regions) results were: `last_12m` MAE 1687.11, MAPE 74.89%, skill +6.64%; `2025_prospective` MAE 1715.84, MAPE 54.30%, skill -1.71%; `excluded_zero_actual` was 0 in every window (zero of the 1,064 region-month cells in the 2022 to 2026 dataset recorded zero actual cases).

**Tier accuracy.** `tier_backtest` joins the walk-forward predictions onto the frozen thresholds and compares predicted tier to actual tier, reporting exact-tier agreement and the **severe-miss rate** (a tier jump of two, e.g., Low predicted where High occurred). Overall agreement was 51.3% on `last_12m` and 38.6% on `2025_prospective`, with severe-miss rates 21.5% and 30.3% respectively. The chapter emphasizes the boundaries: threshold-based tiers inherit the roughness of the thin pre-2025 sample, and a declining regional curve can sit below a High threshold by one case.

**Prospective 2025 flag validation.** `src/validate_2025.py` compares the predicted Rule A / Rule B flags against observed 2025 data. Ground truth mirrors the detector's own semantics on observed counts (Rule A: a run of three or more months above the historical P75; Rule B: seasonal mean above the seasonal P75). Because probes were fit through 2024-12-31, the 2025 dry and wet windows were never trained on. Overall: **TP 11, FP 17, FN 8, TN 2; precision 0.393, recall 0.579, F1 0.468** over 38 region-seasons.

**Known-epidemic anchor.** `src/validate_known_epidemic.py` re-applies the classification method at weekly resolution over its own 2016 to 2021 fixture, summing subnational reporting units into a national weekly series. Weekly P50/P75 thresholds come from years before 2020, and the 2019 window (ISO weeks 29 to 35, bracketing the 6 August 2019 declaration) is classified; **7 of 7 weeks classify High**.

**Climate-type sensitivity.** `src/sensitivity.py` re-runs the seasonal classification and outbreak detector under the region-aware calendar for the three Type II regions (their local wet window is December to May). The month-anchored percentile tiers and Rule A cannot move because they consume per-month thresholds and run lengths only; only the probe labels and Rule B's seasonal bucket can change. Under the override, **zero region-season flags flip** and the 2025 confusion matrix is identical, which the chapter uses to report that the national-calendar assumption does not materially change any published flag on the shipped data.

**Fidelity corpus.** Described in Section 3.5.3; the shipped corpus records 152 scenarios with violations and fallbacks.

## **3.6 References**

Areed, H. (2024). Deep learning time-series models for early dengue disease forecasting.

Cawiding, O. R. et al. (2025). Rainfall-driven dengue outbreak forecasting for six regions in the Philippines using machine learning.

Chen, Y., and Moraga, P. (2025). Uncertainty-aware prediction of dengue outbreaks.

Freitas, L. P. et al. (2023). Dengue forecasting on a national scale.

Galvez, D., and Tarepe, M. V. (2023). Time-series prediction of dengue cases in the Philippines.

Guo, S. et al. (2024). Integrating climatic covariates with epidemiological models for dengue prediction.

Hewamalage, H. et al. (2022). Forecast evaluation and naive benchmarks.

Hodson, T. O. (2022). Skill scores for forecast verification.

Keyel, A. T., and Kilpatrick, A. M. (2023). Open data and the burden of malaria and dengue.

Lavazza, L., and Morasca, S. (2022). Time-series prediction techniques for application metrics.

Leung, X. Y. et al. (2022). A systematic review of dengue outbreak models.

Liu, Y. et al. (2023). Neural basis expansion for interpretable time-series prediction.

Olana, L. et al. (2024). Dengue epidemic prediction and forecast models.

PAGASA. (2021). Modified Corona climatic types of the Philippines.

Rabiei, M. et al. (2023). A systematic review of dengue forecasting approaches.

Schlesinger, T. et al. (2024). Dengue outbreak detection via count-based rules.

Shapiro, J., and Panvelwala, A. (2026). Operational surveillance for climate-sensitive diseases.

Taylor, S. J., and Letham, B. (2018). Forecasting at scale. *The American Statistician*, 72(1), 37-45.

Thayer, E. et al. (2025). Applied dengue forecasting for the Philippines.

Umaña, M. et al. (2024). Dengue forecasting pilots in the Americas.

Vambol, S. et al. (2023). A literature review of dengue outbreak prediction on climate change.