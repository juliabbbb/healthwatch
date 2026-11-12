from pathlib import Path
import ast,json,os
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch
import pandas as pd
import numpy as np
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from src import db,ingest
from src.narrative_contract import guard


class ServingAndNarrationTests(unittest.TestCase):
    def test_nonfinite_json_is_null_and_zero_survives(self):
        from src.json_contract import FiniteJSONResponse
        response=FiniteJSONResponse({'zero':0,'missing':np.nan,'invalid':np.inf})
        self.assertEqual(json.loads(response.body),{'zero':0,'missing':None,'invalid':None})

    def test_semantic_misattribution_rejected_even_with_allowed_numbers(self):
        payload=dict(region='R1',month='2025-01',cases=20)
        safe='R1 reported 20 cases in January 2025.'
        for candidate in ['R2 reported 20 cases in January 2025.','R1 will certainly have an outbreak.','Rain caused all 20 cases.']:
            result=guard(candidate,payload,safe,'stub')
            self.assertTrue(result['fallback'])
            self.assertEqual(result['text'],safe)
            self.assertEqual(result['raw_output'],candidate)
        self.assertFalse(guard(safe,payload,safe,'stub')['fallback'])

    def test_month_point_json_preserves_missing_and_zero(self):
        source=(Path(__file__).parents[1]/'src/api.py').read_text(encoding='utf-8')
        names={'_month_point','_season'}
        nodes=[n for n in ast.parse(source).body if isinstance(n,ast.FunctionDef) and n.name in names]
        ns=dict(pd=pd,np=np,WET_MONTHS=set(range(6,12)))
        exec(compile(ast.Module(body=nodes,type_ignores=[]),'api.py','exec'),ns)
        for value,status in [(np.nan,'missing_report'),(0,'observed_zero'),(3,'observed_positive')]:
            result=ns['_month_point'](0,pd.Timestamp('2025-01-01'),value,False)
            json.dumps(result,allow_nan=False)
            self.assertEqual(result['observation_status'],status)

    def test_real_http_api_preserves_both_metric_windows(self):
        from src.api import app
        cached=getattr(db._engine,'_cached',None)
        with TemporaryDirectory() as tmp:
            eng=create_engine('sqlite:///'+str(Path(tmp)/'api.db'))
            try:
                db._engine._cached=eng;db.metadata.create_all(eng)
                with eng.begin() as conn:
                    for window,mae in [('2025_prospective',1.),('last_12m',2.)]:
                        conn.execute(db.validation_metrics.insert(),dict(region_code=db.NATIONAL_CODE,disease='Dengue',window=window,MAE=mae,RMSE=3.,MAPE=20.,months=12,naive_MAE=4.,skill_vs_naive_pct=50.))
                with TestClient(app) as client:
                    health=client.get('/health')
                    self.assertEqual(health.status_code,200)
                    self.assertEqual(health.json()['system'],'HEALTHWATCH')
                    self.assertEqual(health.json()['database'],'sqlite')
                    self.assertFalse(health.json()['shared_database'])
                    self.assertFalse(health.json()['data_ready'])  # A metrics-only fixture is not a populated dashboard.
                    for window,mae in [('2025_prospective',1.),('last_12m',2.)]:
                        res=client.get('/metrics/National',params={'disease':'Dengue','window':window})
                        self.assertEqual(res.status_code,200,res.text)
                        self.assertEqual(res.json()['mae'],mae)
                        self.assertEqual(len(res.json()['windows']),2)
                    self.assertEqual(client.get('/metrics/National',params={'window':'absent'}).status_code,404)
                    result=client.get('/dashboard',params={'disease':'Leptospirosis'})
                    self.assertEqual(result.json()['series'],{})
                    self.assertEqual(result.json()['source_policy']['status'],'excluded_unresolved_measure')
                    availability=client.get('/availability',params={'disease':'Leptospirosis'}).json()['regions']
                    self.assertEqual(len(availability),18)
                    self.assertTrue(all(row['reason_code']=='unresolved_measure' for row in availability.values()))
                    for disease in ['Influenza-like Illness','Leptospirosis','Heat-Related Illness']:
                        response=client.get('/reported/National',params={'disease':disease,'year':2025,'month':1})
                        self.assertEqual(response.status_code,422)
            finally:
                eng.dispose()
                if cached is None:
                    if hasattr(db._engine,'_cached'):del db._engine._cached
                else:db._engine._cached=cached

if __name__=='__main__':unittest.main()
