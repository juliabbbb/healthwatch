from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import json
import unittest
import pandas as pd
import numpy as np
from sqlalchemy import create_engine, text
from fastapi import FastAPI
from fastapi.testclient import TestClient
from src import ingest, classify, validate_2025, db
from src.artifacts import seal, verify, activate
from src.integrity import legacy_week_month, seasonal_rules
from src.source_registry import policy
from src.leptospirosis_ingest import process_leptospirosis
from src.model_adapters import ModelAdapters
from src.research_api import router


class SourceAndEvaluationContracts(unittest.TestCase):
    def test_unknown_raw_codes_are_not_reported_as_confirmed_alive_or_not_admitted(self):
        from src.fwbd_ingest import FWD_FILES,load_fwbd_case_records
        with TemporaryDirectory() as tmp:
            for disease,name in FWD_FILES.items():
                data=pd.read_csv(ingest.RAW_DIR/name,nrows=2)
                data['Year']=2020
                data.loc[0,'Case Classification']='X'
                data.loc[0,'Outcome']='X'
                data.loc[0,'Admitted']='X'
                data.to_csv(Path(tmp)/name,index=False)
            records=load_fwbd_case_records(Path(tmp))
            unknown=records[records.outcome=='Unknown']
            self.assertEqual(len(unknown),4)
            self.assertTrue(unknown.case_classification.eq('Unknown').all())
            self.assertTrue(unknown.admitted.isna().all())
            self.assertTrue(unknown.deaths.isna().all())

    def test_invalid_counts_produce_quarantine_ledger(self):
        from src.integrity import count_values
        with TemporaryDirectory() as tmp,patch.dict('os.environ',{'HEALTHWATCH_OUTPUT_DIR':tmp}):
            with self.assertRaises(ValueError):count_values(pd.Series([-1,0,1.5]),'fixture cases')
            files=list((Path(tmp)/'quarantine').glob('*.csv'))
            self.assertEqual(len(files),1)
            self.assertEqual(pd.read_csv(files[0]).input_index.tolist(),[0,2])

    def test_fractional_age_is_not_truncated(self):
        from src.fwbd_ingest import _age_bucket
        self.assertEqual(_age_bucket(4.9),'Unresolved age')
        self.assertEqual(_age_bucket(-1),'Unresolved age')

    def test_fractional_calendar_inputs_cannot_be_truncated(self):
        for year,week in [(2020,1.5),(2020.5,1),(2020,0),(2020,54)]:
            with self.assertRaises(ValueError):legacy_week_month([year],[week])

    def test_gapped_three_months_cannot_fire_rule_a(self):
        result=seasonal_rules(pd.to_datetime(['2025-01-01','2025-03-01','2025-04-01']),[5]*3,[1]*3,[2]*3,2)
        self.assertFalse(result['eligible'])

    def test_rules_truth_table(self):
        dates=pd.date_range('2025-01-01',periods=3,freq='MS')
        for cases,s75,expected in [([3,3,3],4,(True,False)),([1,1,3],1,(False,True)),([3,3,3],2,(True,True)),([1,1,1],2,(False,False))]:
            result=seasonal_rules(dates,cases,[1]*3,[2]*3,s75)
            self.assertEqual((result['rule_a'],result['rule_b']),expected)
    def test_zero_and_missing_remain_distinct(self):
        raw=pd.DataFrame(dict(date=pd.to_datetime(['2020-01-01','2020-03-01']),region=['R']*2,disease=['D']*2,cases=[0,2]))
        out=ingest.to_monthly(raw)
        self.assertEqual(out.cases.iloc[0],0)
        self.assertTrue(pd.isna(out.cases.iloc[1]))
        self.assertEqual(ingest.to_monthly(raw,fill_missing='zero').cases.tolist(),[0,0,2])

    def test_legacy_lepto_requires_new_record_count_audit(self):
        from src.source_decisions import require_lepto_audit
        with TemporaryDirectory() as tmp:
            with self.assertRaisesRegex(ValueError,'Legacy'):require_lepto_audit(tmp)
        self.assertEqual(policy('Leptospirosis')['status'],'provisional')
        self.assertEqual(policy('Leptospirosis')['fatality_measure'],'unresolved')
        self.assertEqual(policy('Influenza-like Illness')['status'],'provisional')

    def test_threshold_boundaries_and_missing(self):
        self.assertEqual(classify.label([0,1,2,3,np.nan],[1]*5,[2]*5).tolist(),['Low','Moderate','Moderate','High','Unavailable'])

    def test_threshold_support_and_future_isolation(self):
        history=pd.DataFrame(dict(date=pd.to_datetime(['2020-01-01','2021-01-01']),disease=['D']*2,region=['R']*2,cases=[1,3]))
        thr=classify.compute_thresholds(history)
        self.assertEqual(thr.p50.iloc[0],2)
        unsupported=classify.compute_thresholds(history.iloc[:1])
        self.assertTrue(pd.isna(unsupported.p75.iloc[0]))
        future=pd.DataFrame(dict(date=pd.to_datetime(['2025-01-01']),disease=['D'],region=['R'],cases=[1000000]))
        with patch.object(ingest,'load_monthly_series',return_value=pd.concat([history,future],ignore_index=True)):
            frozen=classify.compute_thresholds(classify.load_history())
        self.assertEqual(frozen.p50.iloc[0],thr.p50.iloc[0])
        self.assertEqual(frozen.p75.iloc[0],thr.p75.iloc[0])

    def test_incomplete_actual_never_scores_as_negative(self):
        observed=pd.DataFrame(dict(date=pd.to_datetime(['2025-01-01','2025-03-01']),disease=['D']*2,region=['R']*2,cases=[1,1]))
        ind=pd.DataFrame(dict(disease=['D'],region=['R'],season=['dry'],outbreak=[False],season_avg=[0.],eligible=[True],target_start=['2025-01-01'],target_end=['2025-03-01']))
        mon=pd.DataFrame(dict(disease=['D']*3,region=['R']*3,month=[1,2,3],p50=[1]*3,p75=[2]*3))
        seas=pd.DataFrame(dict(disease=['D'],region=['R'],season=['dry'],p75=[2.]))
        with TemporaryDirectory() as tmp, patch.object(ingest,'PROCESSED_DIR',Path(tmp)):
            result=validate_2025.validate(observed,ind,mon,seas)
            self.assertTrue(result.empty)
            self.assertEqual(len(pd.read_csv(Path(tmp)/'outbreak_validation_exclusions.csv')),2)

    def test_adapters_reject_wrong_forecast_calendar(self):
        train=pd.Series(1.,index=pd.date_range('2019-01-01',periods=36,freq='MS'))
        with TemporaryDirectory() as tmp, ModelAdapters(tmp) as adapter:
            with self.assertRaisesRegex(ValueError,'calendar'):
                adapter.predict('Seasonal Naive',train,pd.date_range('2021-01-01',periods=12,freq='MS'))
            out,_=adapter.predict('Seasonal Naive',train,pd.date_range('2022-01-01',periods=12,freq='MS'))
            self.assertEqual(out.tolist(),[1.]*12)


class PublicationContracts(unittest.TestCase):
    def test_artifact_corruption_prevents_activation(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp)/'run';root.mkdir();(root/'values.csv').write_text('x\n1\n')
            seal(root,'test','fixture');verify(root)
            (root/'values.csv').write_text('x\n2\n')
            with self.assertRaises(ValueError):activate(root,Path(tmp)/'current.json')
            self.assertFalse((Path(tmp)/'current.json').exists())

    def test_atomic_pointer_keeps_previous_on_failure(self):
        with TemporaryDirectory() as tmp:
            target=Path(tmp)/'current.json'
            for i in [1,2]:
                root=Path(tmp)/str(i);root.mkdir();(root/'x.csv').write_text('x\n1\n');seal(root,str(i),'fixture')
            activate(Path(tmp)/'1',target);before=target.read_bytes()
            with self.assertRaises(RuntimeError):activate(Path(tmp)/'2',target,fail_before_activate=True)
            self.assertEqual(target.read_bytes(),before)

    def test_database_failure_rolls_back_previous_rows(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'fixture.csv').write_text('x\n1\n');seal(root,'test','fixture')
            eng=create_engine('sqlite:///'+str(root/'test.db'));db.metadata.create_all(eng)
            with eng.begin() as conn:
                conn.execute(db.pipeline_runs.insert(),dict(generated_at='2026-11-12',data_through=pd.Timestamp('2025-12-01').date(),version='prior',model='test',notes='fixture'))
            with patch.object(ingest,'PROCESSED_DIR',root):
                with self.assertRaisesRegex(RuntimeError,'Injected'):db.build_db(eng=eng,manifest_path=root,fail_after_clear=True)
            with eng.connect() as conn:self.assertEqual(conn.execute(text('select count(*) from pipeline_runs')).scalar(),1)
            eng.dispose()

    def test_missing_explicit_database_never_falls_back(self):
        cache=getattr(db._engine,'_cached',None)
        if hasattr(db._engine,'_cached'):del db._engine._cached
        try:
            with patch.dict('os.environ',{},clear=True):
                with self.assertRaisesRegex(RuntimeError,'DATABASE_URL'):db.engine()
        finally:
            if cache is not None:db._engine._cached=cache

    def test_research_api_missing_run_explicitly_unavailable(self):
        app=FastAPI();app.include_router(router)
        with patch.dict('os.environ',{},clear=True),TestClient(app) as client:
            self.assertEqual(client.get('/research/status').status_code,503)

if __name__=='__main__':unittest.main()
