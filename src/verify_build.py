"""Fail-closed operational build verification. Never connects to a database."""
from pathlib import Path
import argparse,json
import pandas as pd
import numpy as np
from .artifacts import seal
from .source_registry import write_registry
from . import ingest

REQUIRED=('regional_dengue_monthly.csv','national_monthly.csv','regional_fwbd_monthly.csv','national_fwbd_monthly.csv','forecasts.csv','validation_predictions.csv','validation_metrics.csv','season_probes.csv','risk_thresholds.csv','risk_classification.csv','outbreak_indicators.csv','outbreak_validation_2025.csv')


def verify_operational(root, write_evidence=True):
    root=Path(root).resolve()
    missing=[name for name in REQUIRED if not (root/name).is_file()]
    if missing: raise ValueError('Missing build artifacts: '+', '.join(missing))
    pred=pd.read_csv(root/'validation_predictions.csv',parse_dates=['ds'])
    windows={'2025_prospective':(pd.Timestamp('2025-01-01'),pd.Timestamp('2025-12-01')),'last_12m':(pd.Timestamp('2025-09-01'),pd.Timestamp('2026-08-01'))}
    for window,(start,end) in windows.items():
        subset=pred[pred.window==window]
        if subset.empty or not subset.ds.between(start,end).all(): raise ValueError('Incorrect evaluation target dates: '+window)
    probes=pd.read_csv(root/'season_probes.csv',parse_dates=['target_date'])
    if not probes.target_date.dt.year.eq(2025).all(): raise ValueError('Incorrect benchmark probe year')
    for key,group in probes.groupby(['disease','region','season']):
        expected=[1,2,3] if key[2]=='dry' else [7,8,9]
        if sorted(group.target_date.dt.month.tolist())!=expected: raise ValueError('Incomplete benchmark probe')
    fcst=pd.read_csv(root/'forecasts.csv')
    if not np.isfinite(fcst[['yhat','yhat_lower','yhat_upper']]).all().all(): raise ValueError('Nonfinite forecast')
    if not (fcst.yhat_lower<=fcst.yhat_upper).all(): raise ValueError('Invalid interval')
    observations=[]
    for name in ingest.MONTHLY_FILES:
        if (root/name).is_file() and 'leptospirosis' not in name:
            df=pd.read_csv(root/name)
            if 'Leptospirosis' in set(df.disease): raise ValueError('Unresolved measure entered analytical build')
            observations.append(df)
    for regional,national,keys in [('regional_dengue_monthly.csv','national_monthly.csv',['date']),('regional_fwbd_monthly.csv','national_fwbd_monthly.csv',['disease','date'])]:
        r=pd.read_csv(root/regional);n=pd.read_csv(root/national)
        sums=r.groupby(keys).cases.sum(min_count=1).rename('regional_sum').reset_index()
        merged=n.merge(sums,on=keys,how='outer',validate='one_to_one')
        if not np.allclose(merged.cases,merged.regional_sum,equal_nan=True): raise ValueError('National/regional mismatch')
    ledger=pd.concat(observations,ignore_index=True)
    ledger['observation_status']=np.where(ledger.cases.isna(),'missing_report',np.where(ledger.cases.eq(0),'observed_zero','observed_positive'))
    if write_evidence:
        ledger.to_csv(root/'observation_ledger.csv',index=False)
        write_registry(ingest.RAW_DIR,root)
    else:
        from .source_registry import file_record
        registry=json.loads((root/'source_registry.json').read_text(encoding='utf-8'))
        for item in registry['sources']:
            if file_record(ingest.RAW_DIR/item['file'])['sha256'] != item['sha256']:
                raise ValueError('Raw input changed after build: '+item['file'])
    return dict(target_dates=True,probe_dates=True,finite_forecasts=True,national_arithmetic=True,source_status='conditional',production_model='Prophet',interval_level=.8,interval_calibration='not_established')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--run',required=True);p.add_argument('--run-id',required=True);a=p.parse_args()
    checks=verify_operational(a.run)
    seal(a.run,a.run_id,'operational_prophet_monthly_refit',checks)
    print(json.dumps(checks,indent=2))
