"""Reproducible analytical tables and manuscript revision from verified local runs."""
from pathlib import Path
import argparse, json
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def main():
    p=argparse.ArgumentParser();p.add_argument('--operational',required=True);p.add_argument('--research',required=True);p.add_argument('--output',required=True);p.add_argument('--prior-paper',required=True)
    a=p.parse_args();op,research,out=map(Path,[a.operational,a.research,a.output]);out.mkdir(parents=True,exist_ok=True)
    tables=out/'results';figures=out/'figures';tables.mkdir(exist_ok=True);figures.mkdir(exist_ok=True)
    om=json.loads((op/'manifest.json').read_text());rm=json.loads((research/'manifest.json').read_text())
    primary=['Dengue','Acute Bloody Diarrhea','Cholera','Typhoid Fever'];models=['Seasonal Naive','Prophet','SARIMAX','Random Forest WEKA']
    short={'Acute Bloody Diarrhea':'ABD','Acute Viral Hepatitis':'Hepatitis A','Influenza-like Illness':'ILI','Typhoid Fever':'Typhoid','Leptospirosis':'Leptospirosis','Dengue':'Dengue','ILI':'ILI','Cholera':'Cholera','Hep A':'Hepatitis A'}
    metrics=pd.read_csv(research/'results/metrics.csv');pred=pd.read_csv(research/'results/predictions.csv');seasons=pd.read_csv(research/'results/season_predictions.csv');tiers=pd.read_csv(research/'results/tier_predictions.csv');elig=pd.read_csv(research/'results/eligibility.csv');fits=pd.read_csv(research/'results/fit_log.csv')
    regional=metrics[metrics.region.ne('National')]
    cv=regional[regional.disease.isin(primary)&regional.fold.ne('TEST2025')].groupby(['disease','model']).MASE.mean().reset_index()
    ranking=cv.groupby('model').MASE.mean().sort_values().rename('CV_disease_macro_MASE').reset_index();ranking['rank']=np.arange(1,len(ranking)+1)
    test=regional[regional.fold.eq('TEST2025')].groupby(['disease','model']).agg(MAE=('MAE','mean'),RMSE=('RMSE','mean'),MAPE=('MAPE','mean'),MASE=('MASE','mean'),regions=('region','nunique'),scored_months=('n','sum'),MAPE_zero_exclusions=('MAPE_excluded_zero','sum')).reset_index()
    testmacro=test[test.disease.isin(primary)].groupby('model').MASE.mean().rename('TEST_disease_macro_MASE').reset_index()
    ranking=ranking.merge(testmacro,on='model');ranking.to_csv(tables/'model_selection.csv',index=False);test.to_csv(tables/'test2025_by_disease.csv',index=False)
    classrows=[];seasonrows=[]
    def ratio(a,b):return a/b if b else np.nan
    for cohort,ds in [('Primary',primary),('ILI',['ILI']),('Hepatitis A',['Hep A']),('Leptospirosis',['Leptospirosis'])]:
        for model in models:
            t=tiers[tiers.region.ne('National')&tiers.fold.eq('TEST2025')&tiers.disease.isin(ds)&tiers.model.eq(model)]
            if len(t):
                cm=pd.crosstab(pd.Categorical(t.actual_tier,categories=['Low','Moderate','High']),pd.Categorical(t.predicted_tier,categories=['Low','Moderate','High']),dropna=False).to_numpy()
                f1=[ratio(2*cm[i,i],cm[i,:].sum()+cm[:,i].sum()) for i in range(3)]
                classrows.append(dict(cohort=cohort,model=model,n=int(cm.sum()),accuracy=float(np.trace(cm)/cm.sum()),macro_F1=float(np.nanmean(f1)),high_recall=ratio(cm[2,2],cm[2,:].sum()),high_to_low=int(cm[2,0])))
            s=seasons[seasons.region.ne('National')&seasons.fold.eq('TEST2025')&seasons.disease.isin(ds)&seasons.model.eq(model)]
            if len(s):
                tp=int((s.predicted&s.actual).sum());fp=int((s.predicted&~s.actual).sum());fn=int((~s.predicted&s.actual).sum());tn=int((~s.predicted&~s.actual).sum())
                seasonrows.append(dict(cohort=cohort,model=model,n=len(s),tp=tp,fp=fp,fn=fn,tn=tn,precision=ratio(tp,tp+fp),recall=ratio(tp,tp+fn),F1=ratio(2*tp,2*tp+fp+fn)))
    classification=pd.DataFrame(classrows);seasonal=pd.DataFrame(seasonrows);classification.to_csv(tables/'monthly_classification.csv',index=False);seasonal.to_csv(tables/'seasonal_reference.csv',index=False)
    elig.groupby(['disease','fold']).agg(candidate_series=('region','size'),eligible=('eligible','sum'),matched_models=('all_models_valid','sum'),actual_months=('actual_observed','sum'),paired_months=('shared_target_months','sum')).reset_index().to_csv(tables/'eligibility.csv',index=False)
    coverage=[];annual=[]
    for file in ['regional_dengue_monthly.csv','regional_fwbd_monthly.csv','regional_ili_monthly.csv','regional_leptospirosis_monthly.csv']:
        d=pd.read_csv(op/file,parse_dates=['date']);d=d[d.date.between('2019-01-01','2026-08-01')]
        for disease,g in d.groupby('disease'):
            known=int(g.cases.notna().sum());added=int(g.observation_status.eq('zero_by_user_relayed_DOH_rule').sum()) if 'observation_status' in g else 0
            coverage.append(dict(disease=disease,supplied_region_months=known-added,added_zero_months=added,unknown_study_positions=1656-known,known_months=known,cases=float(g.cases.sum())))
            annual.extend(dict(disease=disease,year=int(year),cases=float(h.cases.sum())) for year,h in g.groupby(g.date.dt.year))
    coverage=pd.DataFrame(coverage);coverage.to_csv(tables/'coverage.csv',index=False);pd.DataFrame(annual).to_csv(tables/'annual_cases.csv',index=False)
    fc=pd.read_csv(op/'forecasts.csv');vm=pd.read_csv(op/'validation_metrics.csv');ex=pd.read_csv(op/'forecast_exclusions.csv')
    fc.groupby(['disease','region']).agg(start=('target_date','min'),end=('target_date','max'),forecast_rows=('target_date','size')).reset_index().to_csv(tables/'forecast_coverage.csv',index=False)
    plt.rcParams.update({'font.family':'DejaVu Sans','font.size':10,'axes.spines.top':False,'axes.spines.right':False})
    c=coverage.set_index('disease').reindex(['Dengue','Acute Bloody Diarrhea','Cholera','Typhoid Fever','Influenza-like Illness','Acute Viral Hepatitis','Leptospirosis'])
    fig,ax=plt.subplots(figsize=(9,4.7));left=np.zeros(len(c))
    for column,label,color in [('supplied_region_months','Months with source records','#355C7D'),('added_zero_months','Interior zeros: user-relayed rule','#D07849'),('unknown_study_positions','Unknown/outside coverage','#DDDDDD')]:
        ax.barh([short[k] for k in c.index],c[column],left=left,label=label,color=color);left+=c[column].to_numpy()
    ax.invert_yaxis();ax.set_xlabel('Region-month positions (18 regions × 92 study months)');ax.legend(loc='upper center',bbox_to_anchor=(.5,-.17),ncol=1,frameon=False);fig.tight_layout();fig.savefig(figures/'coverage.png',dpi=180,bbox_inches='tight');plt.close(fig)
    fig,ax=plt.subplots(figsize=(8,3.7));r=ranking.sort_values('rank');ax.barh(r.model,r.CV_disease_macro_MASE,color='#355C7D');ax.invert_yaxis();ax.set_xlabel('Cross-validation disease-balanced MASE (lower is better)');fig.tight_layout();fig.savefig(figures/'model_selection.png',dpi=180,bbox_inches='tight');plt.close(fig)
    example=pred[pred.disease.eq('Leptospirosis')&pred.region.eq('National')&pred.fold.eq('TEST2025')]
    fig,ax=plt.subplots(figsize=(9,4));actual=example[example.model.eq('Prophet')];ax.plot(pd.to_datetime(actual.target_date),actual.actual,'k-o',label='Observed case-records',linewidth=2)
    for model in models:
        q=example[example.model.eq(model)];ax.plot(pd.to_datetime(q.target_date),q.predicted,label=model,alpha=.8)
    ax.set_ylabel('Provisional case-record count');ax.legend(ncol=2,fontsize=8);fig.autofmt_xdate();fig.tight_layout();fig.savefig(figures/'leptospirosis_2025.png',dpi=180);plt.close(fig)
    def n(value,digits=3):return 'Unavailable' if pd.isna(value) else f'{value:,.{digits}f}'
    def table(headers,rows):return '\n'.join(['| '+' | '.join(headers)+' |','| '+' | '.join(['---']*len(headers))+' |']+['| '+' | '.join(map(str,row))+' |' for row in rows])+'\n'
    parts=[]
    def add(text):parts.append(text.strip()+'\n')
    winner=ranking.iloc[0];pc=classification[classification.cohort.eq('Primary')];ps=seasonal[seasonal.cohort.eq('Primary')]
    add('''# CHAPTER FOUR
# RESULTS AND DISCUSSION

## 4.1 Overview and Evidence Scope

This revision evaluates HealthWatch after implementing the approved source-record and bounded zero-reporting decisions. The local application combines regional time-series forecasting, monthly historical-percentile classification, retrospective seasonal reference flags, grounded explanation safeguards and comparative reports. Results are tied to versioned local builds rather than inferred from the presence of dashboard components. Shared database publication and hosted deployment are separate from this local implementation.

The study retains January 2019 through August 2026 as its operational observation window. Seven disease series are available for analysis: dengue, Acute Bloody Diarrhea (ABD), cholera, typhoid fever, influenza-like illness (ILI), the Hepatitis A source and leptospirosis. Heat-related events remain annual descriptive evidence. Dengue, ABD, cholera and typhoid form the primary model-selection cohort. ILI, Hepatitis A and leptospirosis are separate provisional analyses; they cannot choose the primary winning model.

The results address five objectives: regional pattern analysis and forecasting; hotspot and seasonal classification; grounded generative-AI interpretation; regional comparison and export; and predictive/classification evaluation. Software tests, empirical model results and uncompleted user/provider studies are reported separately. Neither a passing test nor a low forecasting error establishes clinical reliability or an official outbreak.

## 4.2 Application of Data Preprocessing Techniques

### 4.2.1 Counting Units and Source Decisions

Dengue and the ABD, cholera and typhoid files retain their explicit numeric case counts. Each retained nonblank Hepatitis A and leptospirosis record contributes one provisional case-record under the user's instruction. This is not a claim of independently verified patient uniqueness. For leptospirosis, the DOH release dated 12 October 2026 supports the Suspect/Probable/Confirmed classification categories but does not independently establish row grain. The 2023 file contains 4,252 nonblank records while its numeric Cases field sums to 6,563; this revision deliberately uses the record count under the provisional rule, retaining original numeric fields for audit.

The leptospirosis CSV contains 30,605 nonblank records and 187 blank records. Seven nonblank exact-duplicate candidates beyond first occurrences are retained because identical strata do not prove duplicate patients. The current conditional weekly calendar and study cutoff retain 29,476 provisional case-records across 18 regions. S/P/C are classification labels; classifications are read from Case Classification in 2023 and the code-bearing Cases column in other years. Numeric Deaths values are not added to cases, and leptospirosis fatality totals remain unavailable.

The Hep A source is displayed as Hepatitis A while preserving its existing internal application identifier for compatibility. It is not broadened to all acute viral hepatitis. Raw records and row identifiers are retained; identifiers refer to parsed source records, not people. Invalid fields must be quarantined or rejected rather than silently repaired.

### 4.2.2 Interior Zero Reporting and Calendar Boundaries

The user relayed a DOH clarification that absent FWBD records represent zero cases within covered reporting periods, then selected a conservative implementation: fill only gaps between existing reports within each disease-region series. The original dated zero-reporting clarification was not supplied and its provenance remains user-relayed. No leading or trailing months are filled. Wider reporting coverage and historical regional comparability remain unresolved. The rule applies to ABD, cholera, typhoid and Hepatitis A; it is not transferred to ILI or leptospirosis.

This preprocessing added 100 ABD, 539 cholera, 2 typhoid and 806 Hepatitis A region-month zeros, totaling 1,447. Original case totals are unchanged by these added zeros. Every added row records its status, zero source-record count and decision version. Deaths remain unavailable on added rows because a zero-case clarification is not a zero-death clarification. The transformation is source-rule-based completion of an interior calendar, not interpolation of case counts or substitution of model predictions for observed targets.

FWBD dates use the supplied morbidity month. Dengue and leptospirosis retain the declared ISO-Thursday conversion with week 53 folded to week 52; ILI also retains its provisional year/week header reversal. These calendar conventions remain conditional. September 2026 source records are excluded from the August operational cutoff. The Hepatitis A source and individual regions can end earlier, and forecasts begin after each series' actual training end.

## 4.3 Identification and Assessment of Biases and Anomalies

Record counts, weighted case counts and unique persons are different units. Leptospirosis and Hepatitis A results therefore remain provisional even after their forecasts become available. Different disease case definitions and classification eras can create discontinuities; applying a current definition to all historical rows would require additional evidence. Date-typed ages and unknown categories are preserved as unresolved rather than converted into fabricated demographic information.

Zero reporting changes training history, seasonal baselines and eligible evaluation months even when total cases do not change. A sparse region can gain enough calendar observations for modeling while remaining poorly represented by positive events. Missing leading/trailing periods, reporting delays, source-side proxy dates and changes in regional boundaries limit interpretation. National totals sum available regional reports and are not proof of complete national incidence. Provisional case-records should not be compared as though they share the confirmed counting grain of numeric sources.

Extreme observed values are retained unless a source or validation rule establishes an error. Statistical unusualness alone is not a reason to delete an outbreak-like peak. Duplicate candidates are retained with lineage; neither arbitrary deduplication nor synthetic balancing was used. Heat's annual counts are not distributed into invented monthly observations.

## 4.4 Evaluation of Data Quality and Preprocessed Results

Table 4.1 separates months with source records, added interior zeros and remaining unknown study positions. The denominator is the analytical grid of 18 regions by 92 months; it is not a claim that every source was continuously covered over that entire grid.

Table 4.1 Regional monthly coverage within the operational study window''')
    add(table(['Disease','Source months','Added zeros','Unknown positions'],[[short[r.disease],r.supplied_region_months,r.added_zero_months,r.unknown_study_positions] for r in coverage.itertuples()]))
    add('![Figure 4.1 Source months, approved interior zeros and unknown study positions.](figures/coverage.png)')
    history=pd.DataFrame(annual);history=history[history.year<=2025]
    annualrows=[]
    for disease,g in history.groupby('disease',sort=False):
        peak=g.loc[g.cases.idxmax()];byyear=g.set_index('year').cases
        annualrows.append([short[disease],n(byyear.get(2019),0),n(byyear.get(2025),0),int(peak.year),n(peak.cases,0)])
    add("Table 4.2 Available annual case counts and provisional record counts, 2019-2025")
    add(table(['Disease','2019','2025','Peak year','Peak count'],annualrows))
    add("Dengue's available count is highest in 2019 (437,089), decreases to 80,919 in 2021 and rises to 413,981 in 2024 before 309,097 in 2025. This is a descriptive temporal pattern, not a causal attribution. Provisional leptospirosis source-record counts rise from 2,338 in 2019 to 6,987 in 2025; reporting coverage and row grain prevent treating that difference as a verified change in incidence. Hepatitis A's 2025 reporting periods end earlier than a full calendar year, so its annual sum is not a complete-year comparison. All annual values sum available reports; added zeros do not increase these totals, and missing regional periods remain a coverage limitation.")

    add('''Supplied zero observations remain distinguishable from added zero-rule months and from unavailable periods. The new database retains observation status, source-record count and coverage basis. A zero-rule month has zero cases and no supplied demographic rows; its demographic endpoint states that limitation and leaves deaths unavailable. This prevents a blank breakdown from being interpreted as missing case data or as evidence of zero deaths.

All 18 leptospirosis regional series have at least 24 record-containing months under the provisional rule. The new operational build produces 12 future points for each of those regions and National. Hepatitis A has one ineligible regional series: NIR has only 12 observed/interior-zero months, below the 24-month requirement. Forecast availability is also date-specific: a series ending in an earlier year does not supply a forecast for a later selected month merely because it has a historical fitted horizon.

Heat remains 43 annual table rows representing 113 events, 1,275 cases and 20 deaths across the listed source regions. These are annual event aggregates, not a continuous monthly surveillance series. Its region labels are normalized for reference display, including Roman-numeral labels. The partial 2026 source window is retained, and no monthly risk or forecast is assigned.

## 4.5 Model Training, Testing and Chronological Validation

### 4.5.1 Operational and Research Experiments

The operational model remains Prophet, independently fitted per eligible disease-region series. It uses multiplicative mode, automatic trend changes and a June-November indicator, with yearly, weekly and daily seasonalities disabled. Actual weather measurements are not forecasting regressors. At least 24 observed or approved-zero training months are required; an entirely zero series requires a separately declared deterministic method. Operational predictions permit zero and expose an uncalibrated 80% model interval.

Operational evaluation refits monthly for January-December 2025 and September 2025-August 2026. Actuals missing outside reporting coverage remain missing in the target calendar; metrics use paired actual/prior-year dates. A short scored window must not be presented as a complete twelve-month accuracy study. Exact January-March and July-September 2025 probes use history ending in December 2024, with corresponding past-only reference thresholds. These are retrospective evaluations because earlier project work had already inspected 2025.

The separate four-model research experiment compares Seasonal Naive, Prophet, SARIMAX and native WEKA Random Forest. Training starts in 2019, expanding-history validation years are 2022-2024, and 2025 is the retrospective test year. Each origin forecasts twelve months without learning held-out outcomes during that horizon. The four models share the same actual/prior-year scoring mask; at least nine paired target months are required. Ineligible windows and nonconverged/nonfinite model cells are excluded explicitly, with all four models removed from a failed matched comparison.

### 4.5.2 Implemented Techniques and Metrics

Seasonal Naive copies the previous year's calendar month. SARIMAX uses (1,0,0)(1,0,0,12), a constant trend and the calendar wet-season indicator, with a 200-iteration fitting limit. Random Forest runs in installed WEKA 3.8.7, using 200 trees, maximum depth 8, minimum leaf size 2, seed 2026 and one execution slot. Its eleven inputs are lags 1/2/3/6/12, past means over 3/6 months, month sine/cosine, the wet indicator and a time index. Future lag features use prior predictions recursively. Missing lag fallback uses earlier training observations, not future actuals. WEKA's random cross-validation option was not used; chronological train/test blocks were supplied explicitly.

MAE and RMSE retain each disease's count units. MAPE excludes actual zero targets and is unavailable without a nonzero denominator. MASE divides absolute error by the training seasonal-naive absolute difference and is unavailable when that scale is zero or absent. Primary selection averages regional/fold MASE within each of the four numeric-count diseases, then weights those diseases equally. National and provisional sources do not select the winner. Native WEKA outputs and chronological checks provide software evidence, not proof that all source assumptions are confirmed. Method definitions follow the retained methodological references [1]-[8].

## 4.6 Forecast Comparison and Interpretation

### 4.6.1 Cross-validation Selection

Table 4.3 reports the primary cohort's disease-balanced scores. The test column evaluates the selected protocol retrospectively; it does not choose the model using future outcomes.

Table 4.3 Primary four-disease model comparison''')
    add(table(['Model','CV MASE','Test MASE','CV rank'],[[r.model,n(r.CV_disease_macro_MASE),n(r.TEST_disease_macro_MASE),r.rank] for r in ranking.itertuples()]))
    add(f"The lowest cross-validation MASE is {n(winner.CV_disease_macro_MASE)}, obtained by {winner.model}. This establishes the preferred candidate under the declared primary selection criterion. It does not automatically replace operational Prophet: deployment choice must also consider alert behavior, source limitations and a separately reviewed activation decision.")
    add('![Figure 4.2 Primary disease-balanced cross-validation MASE.](figures/model_selection.png)')
    add('''### 4.6.2 Retrospective 2025 Errors by Disease

Table 4.4 averages regional metrics over matched eligible series. Raw errors should be compared within a disease, because case units and burden differ across diseases. MASE supports the declared scaled comparison but remains sensitive to its training denominator.

Table 4.4 Regional 2025 forecasting performance''')
    add(table(['Disease','Model','MAE','RMSE','MASE'],[[short[r.disease],r.model,n(r.MAE,2),n(r.RMSE,2),n(r.MASE)] for r in test[test.disease.isin(primary)].itertuples()]))
    add('''### 4.6.3 Provisional Expanded Sources

Table 4.5 reports ILI, Hepatitis A and leptospirosis separately. These results are conditional on their stated source interpretations. Scored target months and zero exclusions are retained in the accompanying tables; no absent target is replaced with a prediction. The number of evaluated regions can vary by source and fold.

Table 4.5 Provisional sources in the retrospective 2025 comparison''')
    add(table(['Disease','Model','Regions','MAE','MASE'],[[short[r.disease],r.model,r.regions,n(r.MAE,2),n(r.MASE)] for r in test[~test.disease.isin(primary)].itertuples()]))
    add('![Figure 4.3 National leptospirosis case-records and fixed-origin 2025 model predictions; provisional counting unit.](figures/leptospirosis_2025.png)')
    add('''The leptospirosis graph is a comparison of the approved record-count interpretation, not a reconciliation with the unresolved aggregate numeric fields. Hepatitis A's sparse positives and earlier reporting ends limit the number of valid target months. Neither expansion removes the need for a source dictionary, current coverage confirmation and future-period validation.

## 4.7 Hotspot Classification and Seasonal Reference Results

Each disease-region has its own historical calendar-month P50/P75 thresholds. Low is below P50; Moderate includes both boundaries; High is strictly above P75. Cross-region percentile is a separate burden comparison and does not replace the canonical tier. Applying a population scale consistently to values and thresholds does not change that tier. Missing values or insufficient threshold support remain unavailable. All Illnesses is a descriptive four-primary-disease sum with explicit contributors; no combined disease risk threshold or calibrated aggregate interval is invented.

Table 4.6 evaluates monthly tiers against the same past-only, rule-derived classification of held-out actuals. Macro F1 averages defined class scores. The result is agreement with a historical reference rule, not diagnostic accuracy or confirmed outbreak detection.

Table 4.6 Primary monthly-tier classification, 2025''')
    add(table(['Model','Months','Accuracy','Macro F1','High recall'],[[r.model,r.n,n(r.accuracy),n(r.macro_F1),n(r.high_recall)] for r in pc.itertuples()]))
    add('''Rule A requires three consecutive High months in a complete probe. Rule B requires the probe mean to exceed the historical seasonal P75. Either rule raises the seasonal reference flag. The experiment uses exact January-March and July-September 2025 probes and matched past-only pools. Missing prerequisites are excluded, not converted to negative labels.

Table 4.7 Primary seasonal-reference classification, 2025''')
    add(table(['Model','Probes','Precision','Recall','F1'],[[r.model,r.n,n(r.precision),n(r.recall),n(r.F1)] for r in ps.itertuples()]))
    add('''Forecast-error ranking and High-tier/seasonal recall answer different questions. A model can reduce average count error while missing infrequent elevated periods. Recommendations therefore consider both error and classification denominators. Sparse zero-heavy histories also create repeated threshold boundaries; a High label means an exceedance of this declared historical reference, not a clinical probability.

## 4.8 System Implementation, Interpretation and Export Evidence

The local implementation uses FastAPI and SQLAlchemy for verified snapshots, pandas for transformations and reconciliation, Prophet/statsmodels for model adapters, native Java WEKA for Random Forest and React/Vite for the dashboard. Source decisions and raw hashes accompany immutable operational/research manifests. Explicit local SQLite publication is transactional; it is not a silent fallback from a failed shared PostgreSQL connection. Source versions, run identities and target dates separate operational and research results.

The dashboard distinguishes record-supported history, interior zero-rule months, forecasts, unknown coverage and annual references. Regional availability includes observed-month counts, actual first/last history dates, zero-rule month counts and forecast bounds. Unsupported ILI/leptospirosis/heat demographic breakdowns return an explanation rather than querying another disease's table. Provisional labels remain visible in explanations and exports. The local frontend is served on port 8080 with the backend on 8000.

CSV construction now uses a common tested schema across comparison, forecast and complete-series exports. Rows include source status, operational run identity, validation status, target date, observation status, coverage basis and source-record count. Unknown values export as blank cells, actual zero remains zero, and forecast exports include only forecast points. This corrects a full-series header/body mismatch found during the revision. PDF provenance and unavailable metric guards preserve the same interpretation; full browser/device/export coverage remains a wider acceptance task.

The backend regression suite contains 42 passing tests, covering counting, retained duplicate candidates, cutoff handling, interior-only zeros, unknown deaths, legacy audit rejection, canonical thresholds, finite JSON and transactional contracts. Disposable-database/API checks verify all seven disease histories, the 29,476 national leptospirosis records, provisional forecast gates, zero-rule demographics and four-model comparison responses. These checks establish the tested contracts; they do not establish clinical validity, complete surveillance coverage or real-user benefit.

Generative explanations remain constrained to structured evidence with deterministic fallback safeguards. This revision did not run a live provider-fidelity corpus or a participant comprehension study. Weather context is not an evaluated causal regressor. Objective 3 therefore has implementation and offline guard evidence, while its claimed benefit to users remains unverified. The dashboard design review [10] informs further interface evaluation rather than establishing an outcome for this system. The seasonal-naive benchmark also addresses the need for meaningful null comparisons [9].

## 4.9 Significant Findings and Objective-level Interpretation

The principal data-quality result is the separation of source records, added interior zeros and unknown coverage. Case totals are preserved for the FWBD sources while their analytical calendars change. Leptospirosis is now analyzable under an explicitly provisional record-count rule rather than an unsupported interpretation of Deaths. Hepatitis A retains an earlier and region-dependent horizon. The empirical model comparison is reproducible under these rules, with a primary selection criterion that excludes provisional sources.

Table 4.8 Evidence against the five case-study objectives
''')
    add(table(['Objective','Evidence','Practical limit'],[
        ['1. Patterns and forecasts','Seven monthly disease analyses, source/calendar audits, versioned Prophet forecasts and plots.','Conditional calendars, source-record units and uncovered periods remain explicit.'],
        ['2. Hotspot classification','Own-region monthly tiers and matched 2025 seasonal-reference comparisons.','Rule-derived references are not official outbreak ground truth.'],
        ['3. Grounded AI interpretation','Structured grounding/fallback implementation and offline safeguard tests.','Live fidelity and participant comprehension have not been demonstrated.'],
        ['4. Regional comparison/export','Local API/UI integration, source-status metadata, corrected CSV schemas and export checks.','Complete device/filter coverage and shared hosted activation remain separate.'],
        ['5. Predictive evaluation','Chronological four-model comparison with matched scoring masks and primary selection.','2025 is retrospective; future-period validation and interval calibration remain needed.']]))
    add('''# CHAPTER FIVE
# CONCLUSION AND RECOMMENDATION

## 5.1 Summary of the Case Study

HealthWatch applies regional time-series techniques to supplied Philippine surveillance sources. This revision implements user-approved provisional row counting for leptospirosis and Hepatitis A, bounded FWBD interior-zero reporting, independent operational Prophet forecasts and a chronological four-model comparison. The analysis preserves missing periods, source uncertainty and provenance instead of treating every unavailable dashboard value as a software fault. Heat is maintained as an annual reference source.

## 5.2 Summary of Major Findings by Objective

For Objective 1, the system provides seven disease histories and eligible forecasts, including 29,476 in-window provisional leptospirosis case-records. The FWBD zero rule adds 1,447 interior months without extending leading/trailing coverage or increasing case totals. One Hepatitis A region remains below the training-history minimum, and earlier-ended series have earlier forecast horizons.

For Objective 2, canonical tiers are based on each region's own calendar-month history and are invariant to a consistently applied population scale. Monthly/seasonal comparison scores quantify agreement with declared historical reference rules. They do not verify official outbreaks. Missing observations and unsupported thresholds remain unavailable rather than Low.

For Objective 3, the application has grounded explanation and deterministic fallback mechanisms, but this revision supplies no completed live-response fidelity or user-comprehension result. Strong claims of improved understanding, clinical correctness or causal weather explanation would exceed the available evidence.

For Objective 4, the local API/dashboard and corrected exports carry actual dates, source status and observation provenance. Added zero rows do not create demographic or mortality evidence. Comparative views preserve partial-report totals and distinguish descriptive All counts from disease-specific risk. Hosted publication and complete cross-device acceptance are not inferred from local success.

For Objective 5, the study compares Seasonal Naive, Prophet, SARIMAX and native WEKA Random Forest on common chronological evaluation masks. Primary selection balances four numeric-count diseases and excludes National/provisional sources. The evaluation is retrospective, and differing error/alert results require an explicit deployment tradeoff.

## 5.3 Conclusions Based on the Analytical Results
''')
    add(f"Under the revised data and frozen primary selection criterion, {winner.model} has the lowest cross-validation disease-balanced MASE ({n(winner.CV_disease_macro_MASE)}). Its corresponding 2025 primary macro MASE is {n(winner.TEST_disease_macro_MASE)}. This supports its consideration as a candidate under the declared experiment, while operational Prophet remains unchanged pending a separate model-replacement decision. The comparison must not be generalized to clinically reliable outbreak prediction or to unsupported sources.")
    add('''The expanded analysis demonstrates that eligibility is partly a data-contract question. Explicit record counting makes a provisional leptospirosis study possible, while explicit interior zero reporting changes sparse FWBD calendars. Neither decision confirms patient-level grain, resolves historical geography nor recovers unknown periods outside coverage. Data preparation and its provenance are therefore part of the empirical result rather than an invisible preliminary step.

The five objectives are supported to different degrees. Forecasting, rule-based classification and local comparative integration have measurable outputs. Live AI fidelity, participant comprehension, interval calibration and shared deployment acceptance remain incomplete. A conclusion that all objectives are fully validated would not follow from the actual evidence.

## 5.4 Implications of the Findings

For analysts, explicit source decisions make sensitivity to record grain and zero reporting visible and reproducible. For developers, availability must be computed per region and target date, with source versioning across operational and research artifacts. For project reporting, a working display should not be equated with source confirmation; an unavailable month can be a correct representation of coverage rather than a defect. For decision support, a historical High tier and an uncalibrated model interval must not be described as a probability of disease or a prescribed clinical action.

## 5.5 Recommendations Based on the Results

Obtain the dated DOH zero-reporting clarification, per-disease/per-region coverage statements, leptospirosis row-grain and numeric-field dictionaries, Hepatitis A scope and calendar confirmation. Retain provisional status until that evidence is available. Preserve raw inputs, versioned decisions, added-zero ledgers, excluded windows and old verified snapshots.

Review count error together with High-tier and seasonal-reference recall before replacing the operational model. Keep the Seasonal Naive baseline and matched scoring masks. Report zero-target exclusions and undefined MASE/MAPE explicitly. Obtain genuinely later observations for future-period testing, and evaluate prediction-interval coverage separately from point errors.

Maintain transactional staging and rollback checks before shared publication, verify source-version matching between research and operational runs, and test the full browser/filter/export matrix. Complete an authorized live-provider semantic-fidelity study and an appropriately designed participant comprehension study before claiming benefits from generative explanations. Seek dated heat-event records if monthly heat analysis is required; do not disaggregate annual counts synthetically.

## 5.6 Recommendations for Future Data Analytics Studies

Future studies should preregister the evaluation origins, reporting calendar and selection criteria before inspecting new outcomes. Investigate count models or separately declared deterministic baselines for zero-heavy series, while maintaining common target masks. Study region-boundary harmonization using source-supported crosswalks, source-definition change points and reporting-delay behavior. Additional covariates should be introduced only with dated, aligned data and an evaluation demonstrating benefit; descriptive weather association alone is insufficient.

## 5.7 Proposed Improvements to the Dataset, Methods and Models

The dataset should include explicit coverage intervals, zero-report indicators, original and revised submission identifiers, case-count units, official dictionaries, revision dates and harmonized geographic codes. The model pipeline should retain per-series diagnostics and calibrated uncertainty studies. The interface should continue to distinguish history, approved zero reporting, forecast, annual reference and unavailable states. Research selection and operational activation should remain separate, auditable decisions.

## 5.8 Suggested Revisions to Chapters One to Three

Align the stated scope with seven monthly disease sources and annual-only heat references. Define leptospirosis/Hepatitis A as provisional source-record counts, document the user-relayed FWBD interior-zero rule and preserve leading/trailing unknown periods. Describe 2019-August 2026 as the operational study window while allowing earlier regional ends. Replace claims of random cross-validation with the actual chronological folds; label 2025 retrospective. Separate operational monthly-refit Prophet from fixed-origin research comparisons. Update the architecture/ERD with observation status, source-record count, coverage basis, immutable manifests and explicit local publication. Keep live AI, comprehension and hosted acceptance claims conditional on completed studies.

# APPENDIX A: REPRODUCIBILITY AND ACCEPTANCE
''')
    add(f"Operational run: {om['run_id']}. Research run: {rm['run_id']}. Source decision version: record_rules_2026_11_12_v1. The operational manifest contains {len(om['artifacts'])} hashed artifacts; the research manifest contains {len(rm['artifacts'])}. Retained Dengue/ILI research outputs were reused only after exact source-observation comparisons over the 2019-2025 analytical window. Changed sources were rerun using native adapters.")
    add(f"The operational build contains {len(fc):,} forecast rows, including National, and {len(vm):,} evaluation-metric rows. Research contains {len(metrics):,} matched metric rows and {len(pred):,} target-prediction rows. Fit logs contain {int(fits.status.ne('ok').sum())} non-ok model attempts; these must be interpreted together with eligibility exclusions, not omitted from acceptance. The accompanying results directory contains coverage, annual case totals, forecast bounds, model selection, per-disease errors, eligibility and monthly/seasonal comparison tables. Numerical tables are generated from these artifacts rather than manually entered.")
    add('''This revised PDF supersedes the earlier Chapters 4-5 numerical snapshot for the source decisions described here; the earlier artifact is preserved. It does not modify the live Google document. Local implementation evidence does not authorize shared source-data dissemination or establish completion of the remaining external studies. The source release remains a local supporting record.

# REFERENCES FOR THIS REVISION''')
    prior=Path(a.prior_paper).read_text(encoding='utf-8')
    references=prior.split('# REFERENCES FOR THIS REVISION',1)[1].split('Project evidence:',1)[0]
    add(references)
    add('Project evidence for this revision: supplied raw disease CSVs and FWBD workbook; the leptospirosis DOH classification release dated 12 October 2026; the user-approved source-decision register; the verified operational/research manifests; and the local test/API evidence. These records provide the empirical counts, scores and implementation findings. The zero-reporting clarification is user-relayed and has no original dated reference supplied in this revision.')
    (out/'HealthWatch_Chapters_4_and_5.md').write_text('\n'.join(parts),encoding='utf-8')
    (out/'revision_evidence.json').write_text(json.dumps(dict(operational_run=om['run_id'],research_run=rm['run_id'],forecast_rows=len(fc),metric_rows=len(metrics),prediction_rows=len(pred),zero_rule_months=int(coverage.added_zero_months.sum()),selection=winner.model),indent=2),encoding='utf-8')
    print(ranking.to_string(index=False));print('REPORT READY',out)


if __name__=='__main__':main()
