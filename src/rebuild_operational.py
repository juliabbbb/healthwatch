"""Rebuild approved source rules in a new local run, with hashed prior checkpoints."""
import argparse
import json
import os
from pathlib import Path
import shutil


def rebuild(baseline, output):
    from .artifacts import verify, seal
    baseline, output = Path(baseline).resolve(), Path(output).resolve()
    previous = verify(baseline)
    if previous['experiment_id'] != 'operational_prophet_monthly_refit':
        raise ValueError('Expected verified operational baseline')
    if output.exists(): raise ValueError('Choose a new immutable output directory')
    shutil.copytree(baseline, output)
    (output/'baseline_manifest.json').write_text(json.dumps(previous,indent=2),encoding='utf-8')
    os.environ['HEALTHWATCH_OUTPUT_DIR'] = str(output)
    for name in ['OMP_NUM_THREADS','OPENBLAS_NUM_THREADS','MKL_NUM_THREADS']:os.environ[name]='1'
    from . import ingest
    ingest.PROCESSED_DIR = output
    from .preflight import check_sources
    from .source_decisions import decisions
    (output/'source_decisions.json').write_text(json.dumps(decisions(),indent=2),encoding='utf-8')
    check_sources(output)
    from . import fwbd_ingest, leptospirosis_ingest, heat_ingest, forecast, classify, rank_escalation, outbreak, validate_2025
    fwbd_ingest.save_all(); leptospirosis_ingest.process_leptospirosis(); heat_ingest.process_heat()
    forecast.run(); classify.run(); rank_escalation.run(); outbreak.run(); validate_2025.run()
    from .verify_build import verify_operational
    checks = verify_operational(output)
    checks['baseline_run_id'] = previous['run_id']
    seal(output, 'gap-rules-'+__import__('uuid').uuid4().hex[:12], 'operational_prophet_monthly_refit', checks)
    print('VERIFIED SOURCE-RULE REBUILD',output,flush=True)


if __name__ == '__main__':
    p=argparse.ArgumentParser();p.add_argument('--baseline',required=True);p.add_argument('--output',required=True)
    a=p.parse_args();rebuild(a.baseline,a.output)
