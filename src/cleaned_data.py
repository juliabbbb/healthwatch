"""Load the approved cleaned snapshot without re-ingesting or filling source gaps."""
from pathlib import Path
import hashlib,json
import numpy as np
import pandas as pd
from . import config,ingest
from .source_decisions import digest

DEFAULT=Path(__file__).resolve().parents[1]/'data/cleaned/monthly_observations.csv'

def load(path=DEFAULT):
    path=Path(path);df=pd.read_csv(path,parse_dates=['date'])
    required={'disease','region','date','cases','target_unit','main_disease'}
    if not required.issubset(df):raise ValueError('Cleaned input missing required columns')
    if df.duplicated(['disease','region','date']).any():raise ValueError('Duplicate cleaned monthly keys')
    if not df.date.dt.is_month_start.all():raise ValueError('Expected month-start dates')
    valid=df.cases.dropna()
    if not np.isfinite(valid).all() or valid.lt(0).any() or valid.mod(1).ne(0).any():raise ValueError('Invalid cleaned counts')
    end=pd.Timestamp(config.DATA_END_YEAR,config.DATA_END_MONTH,1)
    if not df.date.between(config.DATA_START,end).all():raise ValueError('Cleaned input outside declared modeling window')
    if not set(df.disease).issubset(config.SUPPORTED_DISEASES):raise ValueError('Unknown disease IDs in cleaned input')
    lepto=df[df.disease.eq('Leptospirosis')]
    if not lepto.target_unit.eq('reported_records').all():raise ValueError('Leptospirosis requires approved reported-record target')
    # Every national count must reconcile to available reports; missing regions are not zeros.
    for (d,date),g in df.groupby(['disease','date']):
        national=g.loc[g.region.eq('National'),'cases'];regional=g.loc[g.region.ne('National'),'cases']
        if len(national)!=1:raise ValueError(f'Expected one National observation for {d}/{date}')
        if not np.isclose(national.iloc[0],regional.sum(min_count=1),equal_nan=True):raise ValueError(f'National mismatch: {d}/{date}')
    return df

def prepare(path=DEFAULT):
    df=load(path);root=ingest.PROCESSED_DIR
    root.mkdir(parents=True,exist_ok=True)
    df=df.copy();df['deaths']=np.nan
    context=Path(path).with_name('monthly_death_context.csv')
    if context.is_file():
        extra=pd.read_csv(context,parse_dates=['date'])
        merged=df.merge(extra,on=['disease','region','date'],how='left',validate='one_to_one',suffixes=('','_context'))
        match=np.isclose(merged.cases,merged.cases_context,equal_nan=False)
        df['deaths']=merged.deaths_context.where(match).to_numpy()
        # Unresolved source targets never acquire a numeric death measure.
        df.loc[df.disease.isin(['Leptospirosis','Influenza-like Illness','Acute Viral Hepatitis']),'deaths']=np.nan
        (root/'monthly_death_context.csv').write_bytes(context.read_bytes())
    selections={'dengue':df.disease.eq('Dengue'),'fwbd':df.disease.isin(['Acute Bloody Diarrhea','Cholera','Typhoid Fever','Acute Viral Hepatitis']),
                'ili':df.disease.eq('Influenza-like Illness'),'leptospirosis':df.disease.eq('Leptospirosis')}
    for group,mask in selections.items():
        for national in [False,True]:
            name=('national_' if national else 'regional_')+('monthly.csv' if group=='dengue' and national else f'{group}_monthly.csv')
            frame=df[mask & df.region.eq('National').eq(national)].copy()
            if 'leptospirosis' in name:frame['deaths']=np.nan
            ingest.save_processed(frame,name)
    input_hash=hashlib.sha256(Path(path).read_bytes()).hexdigest()
    lepto=df[df.disease.eq('Leptospirosis')&df.region.ne('National')]
    audit=dict(measure='one_case_per_nonblank_source_record',source_decisions_sha256=digest(),
               retained_rows=int(lepto.cases.sum()),target_unit='reported_records',
               input_sha256=input_hash,provenance='Approved cleaned monthly snapshot; no re-interpretation of raw numeric Cases/Deaths',
               duplicate_policy='retain_candidates',deaths='unresolved_excluded')
    (root/'leptospirosis_record_audit.json').write_text(json.dumps(audit,indent=2))
    provenance=dict(kind='approved_cleaned_monthly_snapshot',sha256=input_hash,rows=len(df),filename=str(Path(path).resolve()),
                    source_decisions_sha256=digest(),gap_policy='preserve_unknown; no new filling or deduplication',
                    main_diseases=[d for d in config.FORECAST_READY_DISEASES if d!='Acute Viral Hepatitis'])
    (root/'cleaned_input.json').write_text(json.dumps(provenance,indent=2))
    (root/'cleaned_input_source.csv').write_bytes(Path(path).read_bytes())
    heat=Path(path).with_name('heat_reference_events.csv')
    if heat.is_file():(root/'heat_reference_events.csv').write_bytes(heat.read_bytes())
    df.to_csv(root/'cleaned_monthly_snapshot.csv',index=False)
    return df
