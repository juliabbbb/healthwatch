"""Parallel disease-level research reruns; reuse only verified identical source series."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
import os
from pathlib import Path
import subprocess
import sys
import pandas as pd
from .artifacts import verify, seal, sha
from .source_decisions import decisions, digest

FILES = ['predictions','metrics','eligibility','fit_log','tier_predictions','season_predictions']
CHANGED = ['Acute Bloody Diarrhea','Cholera','Typhoid Fever','Hep A','Leptospirosis']


def rebuild(operational, baseline, output, weka, workers):
    operational, baseline, output = map(lambda p:Path(p).resolve(), [operational,baseline,output])
    previous = verify(baseline)
    if output.exists(): raise ValueError('Choose a new research directory')
    output.mkdir(parents=True);(output/'data').mkdir();(output/'results').mkdir();(output/'parts').mkdir()
    frames=[]
    for name in ['regional_dengue_monthly','national_monthly','regional_fwbd_monthly','national_fwbd_monthly','regional_ili_monthly','national_ili_monthly','regional_leptospirosis_monthly','national_leptospirosis_monthly']:
        frame=pd.read_csv(operational/(name+'.csv'),parse_dates=['date'])
        frame=frame[frame.date.between('2019-01-01','2026-08-01') & frame.cases.notna()].copy()
        frame.disease=frame.disease.replace({'Influenza-like Illness':'ILI','Acute Viral Hepatitis':'Hep A'})
        frame['provisional']=frame.disease.isin({'ILI','Hep A','Leptospirosis'})
        frames.append(frame)
    observations=pd.concat(frames,ignore_index=True)
    observations=observations[['disease','region','date','cases','provisional']+[c for c in ['observation_status','coverage_basis'] if c in observations]]
    if observations.duplicated(['disease','region','date']).any():raise ValueError('Duplicate observation keys')
    path=output/'data/source_monthly_observed.csv';observations.to_csv(path,index=False)
    old=pd.read_csv(baseline/'data/source_monthly_observed.csv',parse_dates=['date'])
    # These targets and all prior-year values are unchanged; prove this before reuse.
    cols=['disease','region','date','cases']
    for disease in ['Dengue','ILI']:
        a=old[(old.disease==disease)&old.date.between('2019-01-01','2025-12-01')][cols].dropna().sort_values(cols[:3]).reset_index(drop=True)
        b=observations[(observations.disease==disease)&observations.date.between('2019-01-01','2025-12-01')][cols].dropna().sort_values(cols[:3]).reset_index(drop=True)
        pd.testing.assert_frame_equal(a,b,check_dtype=False,rtol=1e-12,atol=1e-12)
    def job(disease):
        dest=output/'parts'/disease.replace(' ','_')
        env=os.environ.copy()
        for name in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:env[name]='1'
        with (output/'parts'/(dest.name+'.log')).open('w',encoding='utf-8') as log:
            subprocess.run([sys.executable,'-u','-m','src.benchmark','--observations',str(path),'--output',str(dest),'--weka-jar',str(weka),'--include-provisional','--diseases',disease],stdout=log,stderr=subprocess.STDOUT,env=env,check=True)
        verify(dest);print('VERIFIED RESEARCH DISEASE',disease,flush=True)
        return dest
    with ThreadPoolExecutor(max_workers=workers) as pool:parts=list(pool.map(job,CHANGED))
    preservation=[]
    for name in FILES:
        original=pd.read_csv(baseline/'results'/(name+'.csv'))
        kept=original[original.disease.isin(['Dengue','ILI'])].copy()
        combined=pd.concat([kept]+[pd.read_csv(part/'results'/(name+'.csv')) for part in parts],ignore_index=True)
        combined.to_csv(output/'results'/(name+'.csv'),index=False)
        preservation.append(dict(artifact=name,preserved_dengue_ili_rows=len(kept)))
    pd.DataFrame(preservation).to_csv(output/'preservation.csv',index=False)
    protocol=json.loads((parts[0]/'protocol_frozen.json').read_text(encoding='utf-8'))
    run_id='research-gap-'+__import__('uuid').uuid4().hex[:12];protocol['run_id']=run_id
    protocol['preserved_sources']=['Dengue','ILI'];protocol['source_decisions']=decisions()
    (output/'protocol_frozen.json').write_text(json.dumps(protocol,indent=2),encoding='utf-8')
    (output/'input_hashes.json').write_text(json.dumps(dict(observations_sha256=sha(path),source_decisions_sha256=digest(),baseline_manifest_sha256=sha(baseline/'manifest.json')),indent=2),encoding='utf-8')
    scores=pd.read_csv(output/'results/metrics.csv');pred=pd.read_csv(output/'results/predictions.csv')
    if scores.groupby(['disease','region','fold']).model.nunique().ne(4).any():raise ValueError('Unmatched models')
    if scores.groupby(['disease','region','fold']).n.nunique().ne(1).any():raise ValueError('Unmatched target masks')
    if not (pd.to_datetime(pred.train_end)<pd.to_datetime(pred.target_date)).all():raise ValueError('Target leakage')
    seal(output,run_id,'fixed_origin_2019_CV2022_2024_TEST2025',dict(source_decisions_sha256=digest(),holdout='retrospective',operational_model_replaced=False,preserved_unaffected_diseases=['Dengue','ILI']))
    print('VERIFIED RESEARCH REBUILD',output,flush=True)


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--operational',required=True);p.add_argument('--baseline',required=True);p.add_argument('--output',required=True);p.add_argument('--weka-jar',required=True);p.add_argument('--workers',type=int,default=3)
    a=p.parse_args();rebuild(a.operational,a.baseline,a.output,a.weka_jar,a.workers)
