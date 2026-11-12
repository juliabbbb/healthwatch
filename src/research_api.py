"""Serve only explicitly configured, hash-verified research runs."""
from functools import lru_cache
from pathlib import Path
import os
import pandas as pd
from fastapi import APIRouter, HTTPException, Query
from .artifacts import verify, sha

router = APIRouter(prefix='/research', tags=['research_comparison'])


def _verified(root, digest):
    return verify(root)


def current():
    name = os.environ.get('HEALTHWATCH_RESEARCH_RUN')
    if not name:
        raise HTTPException(503, 'No verified research run configured; production model is unchanged')
    root=Path(name).resolve()
    try:
        manifest=_verified(str(root),sha(root/'manifest.json'))
    except (ValueError,OSError,KeyError) as exc:
        raise HTTPException(503,'Research artifact verification failed') from exc
    return root,manifest


def records(df):
    return df.astype(object).where(pd.notna(df),None).to_dict(orient='records')


@router.get('/status')
def status():
    root,manifest=current()
    return dict(run_id=manifest['run_id'], experiment_id=manifest['experiment_id'],
                validation_status=manifest['validation_status'], retrospective=True,
                production_model_unchanged=True, source_confirmation='conditional',
                models=['Seasonal Naive','Prophet','SARIMAX','Random Forest WEKA'])


@router.get('/comparison')
def comparison(disease: str, region: str, fold: str = Query('TEST2025'), region_code: str | None = None):
    root,manifest=current()
    if region_code:
        from .db import REGION_CODE_BY_NAME, NATIONAL_CODE
        region='National' if region_code==NATIONAL_CODE else next((name for name,code in REGION_CODE_BY_NAME.items() if code==region_code),region)
    if fold not in {'CV2022','CV2023','CV2024','TEST2025'}: raise HTTPException(422,'Unknown experiment fold')
    metrics=pd.read_csv(root/'results/metrics.csv')
    selected=metrics[(metrics.disease==disease)&(metrics.region==region)&(metrics.fold==fold)]
    if selected.empty: raise HTTPException(404,'Series/fold ineligible or unavailable; no substitute window returned')
    predictions=pd.read_csv(root/'results/predictions.csv')
    predictions=predictions[(predictions.disease==disease)&(predictions.region==region)&(predictions.fold==fold)]
    seasonal=pd.read_csv(root/'results/season_predictions.csv')
    seasonal=seasonal[(seasonal.disease==disease)&(seasonal.region==region)&(seasonal.fold==fold)]
    return dict(run_id=manifest['run_id'],experiment_id=manifest['experiment_id'], disease=disease,region=region,fold=fold,
                retrospective=True,point_only=True,provisional=disease=='ILI',
                metrics=records(selected),predictions=records(predictions),seasonal=records(seasonal))
