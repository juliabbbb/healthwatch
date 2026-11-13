"""Replay frozen CV cells with the operational SARIMAX adapter; no DB/network."""
from pathlib import Path
import sys,argparse,json,importlib.util
import numpy as np
import pandas as pd
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from src.sarimax_forecast import fit,predict

def main():
    ap=argparse.ArgumentParser();ap.add_argument('evidence',type=Path);ap.add_argument('--cells',type=int,default=40);ap.add_argument('--output',type=Path);ap.add_argument('--reference-adapter',type=Path);a=ap.parse_args()
    reference=None
    if a.reference_adapter:
        spec=importlib.util.spec_from_file_location('uploaded_reference',a.reference_adapter)
        reference=importlib.util.module_from_spec(spec);sys.modules[spec.name]=reference;spec.loader.exec_module(reference)
    predictions=pd.read_csv(a.evidence/'matched_predictions.csv',parse_dates=['target_date'])
    monthly=pd.read_csv(a.evidence/'data/monthly_inputs.csv',parse_dates=['date'])
    records=[]
    for (d,r,f),g in predictions[predictions.model.eq('SARIMAX')].groupby(['disease','region','fold']):
        end=pd.Timestamp(f'{int(f[-4:])-1}-12-01')
        train=monthly[monthly.disease.eq(d)&monthly.region.eq(r)&(monthly.date<=end)][['date','cases']].rename(columns={'date':'ds','cases':'y'})
        model=fit(train);out=predict(model,g.target_date,include_intervals=False).set_index('ds').yhat
        delta=float(np.max(np.abs(out.reindex(g.target_date).to_numpy()-g.predicted.to_numpy())))
        record=dict(disease=d,region=r,fold=f,max_absolute_difference=delta)
        if reference:
            baseline=reference.predict(reference.fit_sarimax(train),g.target_date).set_index('ds').yhat
            record['difference_from_uploaded_adapter']=float(np.max(np.abs(out.reindex(g.target_date).to_numpy()-baseline.reindex(g.target_date).to_numpy())))
        records.append(record)
        if len(records)>=a.cells:break
    worst=max(r['max_absolute_difference'] for r in records)
    result=dict(cells=len(records),max_absolute_difference=worst,tolerance=1e-3,passed=worst<1e-3,details=records)
    if reference:
        result['uploaded_adapter_max_difference']=max(r['difference_from_uploaded_adapter'] for r in records)
        result['uploaded_adapter_matches']=result['uploaded_adapter_max_difference']<1e-10
    if a.output:a.output.write_text(json.dumps(result,indent=2))
    print(json.dumps({k:v for k,v in result.items() if k!='details'},indent=2))
    if not result['passed']:raise SystemExit(1)
if __name__=='__main__':main()
