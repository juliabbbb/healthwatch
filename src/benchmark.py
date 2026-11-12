"""Chronological four-model research build. No database or provider access."""
from pathlib import Path
import argparse, json, hashlib, time
import numpy as np
import pandas as pd
from .model_adapters import ModelAdapters, MODELS
from .artifacts import seal
from .source_registry import policy

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--observations',required=True,help='Observed-only disease/region/date/cases/provisional CSV; never a zero-filled legacy grid')
    parser.add_argument('--output',required=True)
    parser.add_argument('--weka-jar',required=True)
    parser.add_argument('--include-provisional-ili',action='store_true')
    parser.add_argument('--include-provisional',action='store_true')
    parser.add_argument('--diseases',nargs='+')
    args=parser.parse_args()
    O=Path(args.output).resolve()
    if O.exists(): raise ValueError('Choose a new immutable run directory')
    for part in ['data','results','weka']: (O/part).mkdir(parents=True,exist_ok=True)
    CONFIG=json.loads((Path(__file__).parent.parent/'docs/research_protocol.json').read_text(encoding='utf-8'))
    from .source_decisions import decisions,digest
    CONFIG['source_decisions']=decisions();CONFIG['source_decisions_sha256']=digest()
    CONFIG['provisional']=['ILI','Hep A','Leptospirosis']
    CONFIG['missingness']='Unknown actuals remain missing. User-relayed zero reporting is applied only to interior gaps inside each FWBD region series, with lineage; no leading/trailing or ILI/leptospirosis zeros are invented.'
    CONFIG['case_policy']='Leptospirosis and Hep A use provisional one-source-record-per-case rules; numeric primary sources retain weighted counts; duplicate candidates retained.'
    CONFIG['run_id']='HW-'+time.strftime('%Y%m%d-%H%M%S')+'-'+__import__('uuid').uuid4().hex[:8]
    allmonthly=pd.read_csv(args.observations,parse_dates=['date'])
    required={'disease','region','date','cases','provisional'}
    if not required.issubset(allmonthly): raise ValueError('Missing observation provenance/columns')
    if allmonthly.duplicated(['disease','region','date']).any(): raise ValueError('Duplicate observation key')
    allowed=set(CONFIG['primary_diseases']) | ({'ILI'} if args.include_provisional_ili else set())
    if args.include_provisional:allowed|={'ILI','Hep A','Leptospirosis'}
    if args.diseases:allowed&=set(args.diseases)
    allmonthly=allmonthly[allmonthly.disease.isin(allowed)].copy()
    if allmonthly.empty: raise ValueError('No eligible source diseases')
    allmonthly['provisional']=allmonthly.disease.isin({'ILI','Hep A','Leptospirosis'})
    if (pd.to_numeric(allmonthly.cases,errors='raise').dropna()<0).any(): raise ValueError('Negative observed cases')
    allmonthly.to_csv(O/'data/source_monthly_observed.csv',index=False)
    (O/'protocol_frozen.json').write_text(json.dumps(CONFIG,indent=2),encoding='utf-8')
    (O/'input_hashes.json').write_text(json.dumps({'observations_sha256':hashlib.sha256(Path(args.observations).read_bytes()).hexdigest()},indent=2),encoding='utf-8')
    with ModelAdapters(O/'weka',args.weka_jar) as adapters:
        def forecast(train,dates,model,jobid):
            start=time.perf_counter();pred,info=adapters.predict(model,train,dates,jobid)
            return pred,time.perf_counter()-start,info
        predrows=[];metrics=[];elig=[];fits=[];tierrows=[];seasonrows=[];counter=0
        for (disease,region),g in allmonthly.groupby(['disease','region'],sort=True):
            obs=g.set_index('date').cases.sort_index();obs=obs[~obs.index.duplicated()];provisional=bool(g.provisional.iloc[0])
            for fold,yeartext in CONFIG['folds'].items():
                year=int(yeartext);cutoff=pd.Timestamp(year=year-1,month=12,day=1);dates=pd.date_range(f'{year}-01-01',periods=12,freq='MS')
                train=obs.reindex(pd.date_range('2019-01-01',cutoff,freq='MS'));actual=obs.reindex(dates);naive=obs.reindex(dates-pd.DateOffset(years=1)).to_numpy();scoremask=actual.notna().to_numpy()&np.isfinite(naive)
                reasons=[]
                if train.dropna().eq(0).all():reasons.append('all_zero_training_requires_separate_method')
                if train.notna().sum()<24:reasons.append('fewer than24 observed training months')
                if train.iloc[12:].notna().sum()<12:reasons.append('fewer than12 RF target months after initial lags')
                if scoremask.sum()<9:reasons.append('fewer than9 paired actual/prior-year target months')
                eid=dict(disease=disease,region=region,fold=fold,provisional=provisional,train_end=str(cutoff.date()),train_calendar_months=len(train),train_observed=int(train.notna().sum()),train_missing=int(train.isna().sum()),actual_observed=int(actual.notna().sum()),shared_target_months=int(scoremask.sum()),eligible=not reasons,exclusion='; '.join(reasons))
                elig.append(eid)
                if reasons:continue
                counter+=1;jobid=f'job_{counter:04}';model_preds={};model_ok=True
                delta=(train-train.shift(12)).abs().dropna();scale=float(delta.mean()) if len(delta) else np.nan
                for model in MODELS:
                    try:
                        pred,seconds,info=forecast(train,dates,model,jobid)
                        ok=bool(np.isfinite(pred[scoremask]).all()) and info.get('converged',True)
                        model_ok &=ok;model_preds[model]=pred
                        fits.append(dict(disease=disease,region=region,fold=fold,model=model,seconds=seconds,status='ok' if ok else 'nonconverged_or_nonfinite',**info))
                    except Exception as e:
                        model_ok=False;fits.append(dict(disease=disease,region=region,fold=fold,model=model,status='error',error=str(e)));print('FIT ERROR',disease,region,fold,model,str(e),flush=True)
                eid['all_models_valid']=model_ok
                if model_ok:
                    for model,pred in model_preds.items():
                        aa=actual.to_numpy()[scoremask];pp=pred[scoremask];err=pp-aa;nonzero=aa!=0
                        metrics.append(dict(disease=disease,region=region,fold=fold,model=model,provisional=provisional,n=len(aa),MAE=float(np.abs(err).mean()),RMSE=float(np.sqrt(np.mean(err**2))),MAPE=float(np.mean(np.abs(err[nonzero]/aa[nonzero]))*100) if nonzero.any() else np.nan,MAPE_excluded_zero=int((~nonzero).sum()),bias=float(err.mean()),MASE=float(np.abs(err).mean()/scale) if scale>0 else np.nan,scale=scale))
                        for dt,a,p,n,include in zip(dates,actual,pred,naive,scoremask):
                            predrows.append(dict(disease=disease,region=region,fold=fold,model=model,target_date=str(dt.date()),train_end=str(cutoff.date()),actual=a,predicted=p,naive=n,scored=bool(include),provisional=provisional))
                        for ix,dt in enumerate(dates):
                            pool=train[(train.index.month==dt.month)&train.notna()]
                            if scoremask[ix] and len(pool)>=2:
                                p50,p75=pool.quantile([.5,.75]);label=lambda x:'Low' if x<p50 else 'Moderate' if x<=p75 else 'High'
                                tierrows.append(dict(disease=disease,region=region,fold=fold,model=model,target_date=str(dt.date()),actual_tier=label(actual.iloc[ix]),predicted_tier=label(pred[ix]),p50=p50,p75=p75,threshold_end=str(cutoff.date()),provisional=provisional))
                        for season,indexes in [('dry',[0,1,2]),('wet',[6,7,8])]:
                            target_actual=actual.iloc[indexes];pool=train[(np.isin(train.index.month,[6,7,8,9,10,11]) if season=='wet' else ~np.isin(train.index.month,[6,7,8,9,10,11]))&train.notna()]
                            monthpools=[train[(train.index.month==dates[i].month)&train.notna()] for i in indexes]
                            if target_actual.notna().all() and all(np.isfinite(v[indexes]).all() for v in model_preds.values()) and len(pool)>=6 and all(len(p)>=2 for p in monthpools):
                                thresholds=np.array([p.quantile(.75) for p in monthpools]);s75=float(pool.quantile(.75));pa=bool((pred[indexes]>thresholds).all());pb=bool(np.mean(pred[indexes])>s75);aa=bool((target_actual.to_numpy()>thresholds).all());ab=bool(target_actual.mean()>s75)
                                seasonrows.append(dict(disease=disease,region=region,fold=fold,model=model,season=season,target_start=str(dates[indexes[0]].date()),target_end=str(dates[indexes[-1]].date()),predicted_rule_a=pa,predicted_rule_b=pb,actual_rule_a=aa,actual_rule_b=ab,predicted=pa or pb,actual=aa or ab,forecast_mean=float(np.mean(pred[indexes])),actual_mean=float(target_actual.mean()),season_p75=s75,threshold_end=str(cutoff.date()),provisional=provisional))
                for name,records in [('predictions',predrows),('metrics',metrics),('eligibility',elig),('fit_log',fits),('tier_predictions',tierrows),('season_predictions',seasonrows)]:pd.DataFrame(records).to_csv(O/'results'/f'{name}.csv',index=False)
                print('JOB',counter,disease,region,fold,'OK' if model_ok else 'EXCLUDED_MODEL_FAILURE',flush=True)
    # Fail closed on invalid recorded calendar/fit invariants before sealing.
    predictions=pd.DataFrame(predrows);scores=pd.DataFrame(metrics)
    if scores.empty: raise ValueError('No successful matched comparisons')
    if not (pd.to_datetime(predictions.train_end)<pd.to_datetime(predictions.target_date)).all(): raise ValueError('Target leakage')
    if scores.groupby(['disease','region','fold']).model.nunique().ne(4).any(): raise ValueError('Unmatched models')
    if scores.groupby(['disease','region','fold']).n.nunique().ne(1).any(): raise ValueError('Unequal score masks')
    seal(O,CONFIG['run_id'],'fixed_origin_2019_CV2022_2024_TEST2025',dict(holdout='retrospective',source_confirmation='conditional',operational_model_replaced=False))
    print('Verified local research run:', O)

if __name__=='__main__': main()
