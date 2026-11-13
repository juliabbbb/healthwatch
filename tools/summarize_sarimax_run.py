"""Independent stdlib-only audit/report of a sealed local operational run."""
import argparse,csv,json,hashlib,math,statistics
from pathlib import Path
from collections import defaultdict,Counter

def read(p):
    with p.open(encoding='utf-8-sig',newline='') as f:return list(csv.DictReader(f))
def number(x):
    try:return float(x)
    except (ValueError,TypeError):return math.nan
def mean(xs):
    xs=[x for x in xs if math.isfinite(x)]
    return statistics.fmean(xs) if xs else math.nan
def save(path,rows):
    if not rows:return
    with path.open('w',encoding='utf-8',newline='') as f:
        w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(rows)
def label(x,p50,p75):return 'Low' if x<p50 else 'Moderate' if x<=p75 else 'High'
def main():
    p=argparse.ArgumentParser();p.add_argument('run',type=Path);p.add_argument('--output',type=Path,required=True);a=p.parse_args()
    a.output.mkdir(parents=True,exist_ok=True);manifest=json.loads((a.run/'manifest.json').read_text())
    for rel,digest in manifest['artifacts'].items():
        path=(a.run/rel).resolve();assert path.is_relative_to(a.run.resolve());assert hashlib.sha256(path.read_bytes()).hexdigest()==digest,rel
    assert manifest['metadata']['production_model']=='SARIMAX'
    obs={(r['disease'],r['region'],r['date']):number(r['cases']) for r in read(a.run/'cleaned_input_source.csv')}
    forecasts=read(a.run/'forecasts.csv');seen=set();byseries=defaultdict(list)
    for r in forecasts:
        key=(r['disease'],r['region'],r['target_date']);assert key not in seen;seen.add(key)
        vals=[number(r[k]) for k in ['yhat_lower','yhat','yhat_upper']];assert all(math.isfinite(v) for v in vals);assert 0<=vals[0]<=vals[1]<=vals[2]
        byseries[key[:2]].append(key[2])
    for (d,r),dates in byseries.items():
        assert len(dates)==12
        assert min(dates)==('2025-10-01' if d=='Acute Viral Hepatitis' else '2026-09-01')
        assert max(dates)==('2026-09-01' if d=='Acute Viral Hepatitis' else '2027-08-01')
    groups=defaultdict(list)
    for r in read(a.run/'validation_predictions.csv'):groups[r['disease'],r['region'],r['window']].append(r)
    refs={(r['disease'],r['region'],r['window']):r for r in read(a.run/'validation_metrics.csv')};checks=0
    for key,rows in groups.items():
        if key not in refs:continue
        errors=[];pct=[];baseline=[]
        for r in rows:
            date=r['ds'];actual=number(r['y']);expected=obs.get((key[0],key[1],date),math.nan)
            assert (math.isnan(actual) and math.isnan(expected)) or actual==expected
            previous=str(int(date[:4])-1)+date[4:];naive=obs.get((key[0],key[1],previous),math.nan)
            if not(math.isfinite(actual) and math.isfinite(naive)):continue
            error=number(r['yhat'])-actual;assert math.isfinite(error);errors.append(error);baseline.append(abs(actual-naive))
            if actual:pct.append(abs(error/actual)*100)
        saved=refs[key];mae=mean([abs(e) for e in errors]);values=dict(MAE=mae,RMSE=math.sqrt(mean([e*e for e in errors])),MAPE=mean(pct),naive_MAE=mean(baseline),months=len(errors))
        for metric,v in values.items():
            got=number(saved[metric]);assert (math.isnan(v) and math.isnan(got)) or math.isclose(v,got,rel_tol=1e-10,abs_tol=1e-8),(key,metric,v,got);checks+=1
    summary=[]
    for d in sorted({k[0] for k in refs}):
        for window in ['2025_prospective','last_12m']:
            rows=[r for (dd,region,w),r in refs.items() if dd==d and region!='National' and w==window]
            if not rows:continue
            summary.append(dict(disease=d,window=window,regional_cells=len(rows),scored_months=sum(int(r['months']) for r in rows),**{k:mean([number(r[k]) for r in rows]) for k in ['MAE','RMSE','MAPE','skill_vs_naive_pct']}))
    save(a.output/'operational_regression_summary.csv',summary)
    thr={(r['disease'],r['region'],int(r['month'])):(number(r['p50']),number(r['p75'])) for r in read(a.run/'validation_thresholds.csv')}
    matrices=defaultdict(Counter);counts=defaultdict(Counter)
    for (d,region,window),rows in groups.items():
        for r in rows:
            aa,pp=number(r['y']),number(r['yhat']);q=thr.get((d,region,int(r['ds'][5:7])),(math.nan,math.nan))
            if not all(math.isfinite(v) for v in [aa,pp,*q]):continue
            actual,pred=label(aa,*q),label(pp,*q);counts[d,region,window][actual,pred]+=1
            if region!='National':matrices[d,window][actual,pred]+=1
    tierrefs={(r['disease'],r['region'],r['window']):r for r in read(a.run/'tier_accuracy.csv')}
    for key,c in counts.items():
        rr=tierrefs[key];total=sum(c.values());accuracy=100*sum(c[x,x] for x in ['Low','Moderate','High'])/total
        severe=100*(c['Low','High']+c['High','Low'])/total
        assert abs(number(rr['tier_accuracy_pct'])-accuracy)<=.051
        assert abs(number(rr['severe_miss_pct'])-severe)<=.051
    confusion=[];tiermetrics=[]
    for (d,w),c in sorted(matrices.items()):
        total=sum(c.values());high=sum(v for (actual,pred),v in c.items() if actual=='High')
        f1s=[]
        for actual in ['Low','Moderate','High']:
            confusion.append(dict(disease=d,window=w,actual_tier=actual,**{pred:c[actual,pred] for pred in ['Low','Moderate','High']}))
            tp=c[actual,actual];fp=sum(v for (aa,pp),v in c.items() if pp==actual and aa!=actual);fn=sum(v for (aa,pp),v in c.items() if aa==actual and pp!=actual)
            f1s.append(2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else 0.)
        tiermetrics.append(dict(disease=d,window=w,months=total,accuracy=sum(c[x,x] for x in ['Low','Moderate','High'])/total,macro_f1=sum(f1s)/3,high_recall=c['High','High']/high if high else '',high_to_low_miss_rate=c['High','Low']/high if high else '',existing_two_direction_severe_rate=(c['High','Low']+c['Low','High'])/total))
    save(a.output/'tier_confusion_matrix.csv',confusion);save(a.output/'tier_summary.csv',tiermetrics)
    outbreak=defaultdict(Counter)
    for r in read(a.run/'outbreak_validation_2025.csv'):
        if r['region']=='National' or r['disease']=='Acute Viral Hepatitis':continue
        for k in ['tp','fp','fn','tn']:outbreak[r['disease']][k]+=str(r[k]).lower()=='true'
    flags=[]
    for d,c in sorted(outbreak.items()):
        tp,fp,fn,tn=[c[k] for k in ['tp','fp','fn','tn']]
        flags.append(dict(disease=d,**c,eligible_probes=tp+fp+fn+tn,precision=tp/(tp+fp) if tp+fp else '',recall=tp/(tp+fn) if tp+fn else '',f1=2*tp/(2*tp+fp+fn) if 2*tp+fp+fn else ''))
    save(a.output/'outbreak_2025_summary.csv',flags)
    result=dict(verified_manifest=True,run_id=manifest['run_id'],model='SARIMAX',forecast_series=len(byseries),forecast_rows=len(forecasts),regression_checks=checks,tier_cells_checked=len(counts),numerical_retries=len(read(a.run/'fit_numerical_retries.csv')),interval_calibration='not_established',runtime_seconds=json.loads((a.run/'build_status.json').read_text())['runtime_seconds'])
    (a.output/'audit.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,indent=2))
if __name__=='__main__':main()
