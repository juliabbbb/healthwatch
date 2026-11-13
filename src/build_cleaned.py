"""Build the cleaned-input SARIMAX pipeline offline; never publishes a database."""
from pathlib import Path
import argparse,json,os,time

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--input',type=Path)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--model',choices=['SARIMAX'],default='SARIMAX')
    a=p.parse_args();root=a.output.resolve()
    if root.exists():p.error('Choose a NEW run directory; do not mix outputs')
    forbidden=Path(__file__).resolve().parents[1]/'data/processed'
    if root==forbidden or forbidden in root.parents:p.error('Use a new verified run directory, not legacy data/processed')
    os.environ['HEALTHWATCH_OUTPUT_DIR']=str(root)
    os.environ['HEALTHWATCH_FORECAST_MODEL']=a.model
    for key in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:os.environ[key]='1'
    from . import cleaned_data,forecast,classify,rank_escalation,outbreak,validate_2025,validate_known_epidemic
    from .verify_build import verify_operational
    from .artifacts import seal
    from .operational_model import experiment_id
    start=time.perf_counter();cleaned_data.prepare(a.input or cleaned_data.DEFAULT)
    (root/'build_status.json').write_text(json.dumps(dict(status='building',model=a.model,pid=os.getpid())))
    try:
        forecast.run();classify.run();rank_escalation.run();outbreak.run();validate_2025.run()
        validate_known_epidemic.run()
        checks=verify_operational(root)
        checks.update(runtime_seconds=time.perf_counter()-start,weather_role='PAGASA_advisory_only_no_forecast_tier_or_outbreak_changes',main_diseases=6)
        seal(root,root.name,experiment_id(),checks)
        (root/'build_status.json').write_text(json.dumps(dict(status='verified_local',model=a.model,runtime_seconds=time.perf_counter()-start)))
        # Seal after the final status write as the status file is itself hashed.
        seal(root,root.name,experiment_id(),checks)
        print(json.dumps(checks,indent=2),flush=True)
    except Exception as exc:
        (root/'build_status.json').write_text(json.dumps(dict(status='failed',error=f'{type(exc).__name__}: {exc}',model=a.model)))
        raise
if __name__=='__main__':main()
