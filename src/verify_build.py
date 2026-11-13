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
    if not ((fcst.yhat_lower<=fcst.yhat)&(fcst.yhat<=fcst.yhat_upper)&fcst.yhat_lower.ge(0)).all():
        raise ValueError('Point forecast must lie inside finite nonnegative interval')
    from .source_decisions import require_lepto_audit
    require_lepto_audit(root)
    observations=[]
    for name in ingest.MONTHLY_FILES:
        if (root/name).is_file():
            df=pd.read_csv(root/name)
            if 'Leptospirosis' in set(df.disease):
                from .source_decisions import require_lepto_audit
                audit=require_lepto_audit(root)
                if not np.isclose(df.cases.sum(),audit['retained_rows']):raise ValueError('Leptospirosis row-count reconciliation failed')
                if df.deaths.notna().any():raise ValueError('Unresolved leptospirosis deaths entered build')
            observations.append(df)
    for regional,national,keys in [('regional_dengue_monthly.csv','national_monthly.csv',['date']),('regional_fwbd_monthly.csv','national_fwbd_monthly.csv',['disease','date']),('regional_ili_monthly.csv','national_ili_monthly.csv',['disease','date']),('regional_leptospirosis_monthly.csv','national_leptospirosis_monthly.csv',['disease','date'])]:
        r=pd.read_csv(root/regional);n=pd.read_csv(root/national)
        sums=r.groupby(keys).cases.sum(min_count=1).rename('regional_sum').reset_index()
        merged=n.merge(sums,on=keys,how='outer',validate='one_to_one')
        if not np.allclose(merged.cases,merged.regional_sum,equal_nan=True): raise ValueError('National/regional mismatch')
    ledger=pd.concat(observations,ignore_index=True)
    fallback=pd.Series(np.where(ledger.cases.isna(),'missing_report',np.where(ledger.cases.eq(0),'observed_zero','observed_positive')),index=ledger.index)
    ledger['observation_status']=ledger.get('observation_status',fallback).fillna(fallback)
    cleaned=(root/'cleaned_input.json').is_file()
    if cleaned:
        import hashlib
        record=json.loads((root/'cleaned_input.json').read_text())
        if hashlib.sha256((root/'cleaned_input_source.csv').read_bytes()).hexdigest()!=record['sha256']:
            raise ValueError('Cleaned input snapshot hash mismatch')
        if write_evidence:
            ledger.to_csv(root/'observation_ledger.csv',index=False)
            (root/'source_registry.json').write_text(json.dumps(dict(kind='approved_cleaned_input',sources=[record]),indent=2))
    elif write_evidence:
        ledger.to_csv(root/'observation_ledger.csv',index=False)
        write_registry(ingest.RAW_DIR,root)
    else:
        from .source_registry import file_record
        registry=json.loads((root/'source_registry.json').read_text(encoding='utf-8'))
        for item in registry['sources']:
            if file_record(ingest.RAW_DIR/item['file'])['sha256'] != item['sha256']:
                raise ValueError('Raw input changed after build: '+item['file'])
    from .source_decisions import decisions,digest
    from .operational_model import model_name, fingerprint
    return dict(target_dates=True,probe_dates=True,finite_forecasts=True,national_arithmetic=True,source_status='conditional',production_model=model_name(),model_fingerprint=fingerprint(),interval_level=.8,interval_calibration='not_established',case_record_rules_version=decisions()['version'],source_decisions_sha256=digest(),input_kind='approved_cleaned' if cleaned else 'raw_ingest')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--run',required=True);p.add_argument('--run-id',required=True);a=p.parse_args()
    checks=verify_operational(a.run)
    from .operational_model import experiment_id
    seal(a.run,a.run_id,experiment_id(),checks)
    print(json.dumps(checks,indent=2))
