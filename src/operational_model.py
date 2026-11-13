"""Operational model identity, independent of historical research comparisons."""
import hashlib
import json
import os
from pathlib import Path

def model_name():
    name=os.environ.get('HEALTHWATCH_FORECAST_MODEL','SARIMAX')
    if name != 'SARIMAX':
        raise ValueError('This branch uses SARIMAX only; restore the prior snapshot/branch for Prophet rollback')
    return name

def experiment_id():
    return f'operational_{model_name().lower()}_monthly_refit'

def fingerprint():
    from importlib.metadata import version
    name=model_name()
    adapter=Path(__file__).with_name('sarimax_forecast.py')
    identity=dict(model=name,library_version=version('statsmodels'),
                  adapter_sha256=hashlib.sha256(adapter.read_bytes()).hexdigest(),
                  settings='(1,0,0)x(1,0,0,12);c;wet;stationary;invertible;maxiter=200;interval=.8')
    return hashlib.sha256(json.dumps(identity,sort_keys=True).encode()).hexdigest()
