"""Extend a verified local operational build without changing primary-disease results."""
import os
from pathlib import Path
import argparse,json,shutil
from concurrent.futures import ProcessPoolExecutor
import pandas as pd
from . import forecast,ingest
from .artifacts import verify,seal,sha
from .verify_build import verify_operational

DISEASE='Influenza-like Illness'


def extend(baseline,output,workers=4):
    raise ValueError('Use src.build_cleaned for a full SARIMAX rebuild; do not mix Prophet and SARIMAX series')
    baseline,output=Path(baseline).resolve(),Path(output).resolve()
    previous=verify(baseline)
    if previous['experiment_id']!='operational_prophet_monthly_refit':raise ValueError('Expected operational baseline')
    if output.exists():raise ValueError('Choose a new run directory')
    shutil.copytree(baseline,output)
    (output/'baseline_manifest.json').write_text(json.dumps(previous,indent=2),encoding='utf-8')
    ingest.PROCESSED_DIR=output
    # Spawned workers inherit explicit output roots, with no DB or provider credentials needed.
    os.environ['HEALTHWATCH_OUTPUT_DIR']=str(output)
    for name in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
    observations=forecast.load_series();ili=observations[observations.disease==DISEASE]
    if ili.empty:raise ValueError('No audited provisional ILI observations')
    jobs=[(disease,region,group,False) for (disease,region),group in ili.groupby(['disease','region'])]
    collected={kind:[] for kind in ['forecasts','probes','metrics','validation','exclusions']}
    with ProcessPoolExecutor(max_workers=workers) as pool:
        for result in pool.map(forecast._series_job,jobs):
            for kind in collected:collected[kind].extend(dict(disease=DISEASE,region=result['region'],**row) for row in result[kind])
            print('ILI COMPLETE',result['region'],flush=True)
    files={'forecasts':'forecasts.csv','probes':'season_probes.csv','metrics':'validation_metrics.csv','validation':'validation_predictions.csv','exclusions':'forecast_exclusions.csv'}
    preservation=[]
    for kind,name in files.items():
        prior=pd.read_csv(output/name)
        primary=prior[prior.disease!=DISEASE].copy()
        extra=pd.DataFrame(collected[kind])
        if kind in {'forecasts','probes'}:extra=extra.rename(columns={'ds':'target_date'})
        merged=pd.concat([primary,extra],ignore_index=True)
        merged.to_csv(output/name,index=False)
        reloaded=pd.read_csv(output/name)
        pd.testing.assert_frame_equal(primary.reset_index(drop=True),reloaded[reloaded.disease!=DISEASE][primary.columns].reset_index(drop=True),check_dtype=False,check_exact=False,rtol=1e-12,atol=1e-12)
        preservation.append(dict(artifact=name,primary_rows_preserved=len(primary),added_ili_rows=len(extra)))
    pd.DataFrame(preservation).to_csv(output/'ili_extension_preservation.csv',index=False)
    # Regenerate cheap derived artifacts with matching evaluation-only pools.
    from . import classify,rank_escalation,outbreak,validate_2025
    classify.run();rank_escalation.run();outbreak.run();validate_2025.run()
    checks=verify_operational(output)
    checks.update(provisional_ili_enabled=True,baseline_run_id=previous['run_id'],baseline_manifest_sha256=sha(baseline/'manifest.json'),primary_artifacts_unchanged=True)
    seal(output,'operational-ili-'+__import__('uuid').uuid4().hex[:12],'operational_sarimax_monthly_refit',checks)
    print('VERIFIED ILI EXTENSION',output,flush=True)

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--baseline',required=True);p.add_argument('--output',required=True);p.add_argument('--workers',type=int,default=4);args=p.parse_args()
    extend(args.baseline,args.output,args.workers)
