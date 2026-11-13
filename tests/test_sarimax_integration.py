from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import unittest
import pandas as pd
import numpy as np
from src import cleaned_data,forecast
from src.sarimax_forecast import Fitted,predict
from src.operational_model import model_name,fingerprint

class ForecastIntegration(unittest.TestCase):
    def test_cleaned_input_preserves_missing_and_target_units(self):
        df=cleaned_data.load()
        self.assertEqual(len(df),9832)
        self.assertTrue(df.cases.isna().any())
        self.assertTrue(df[df.disease.eq('Leptospirosis')].target_unit.eq('reported_records').all())
        self.assertFalse(df[df.disease.eq('Acute Viral Hepatitis')].main_disease.any())
        with TemporaryDirectory() as tmp:
            df.loc[df.region.eq('National'),'cases']=999999
            path=Path(tmp)/'bad.csv';df.to_csv(path,index=False)
            with self.assertRaisesRegex(ValueError,'National mismatch'):cleaned_data.load(path)

    def test_subset_forecast_uses_full_calendar_from_model_origin(self):
        class Result:
            def get_forecast(self,steps,exog):
                self.steps=steps
                self.exog=exog
                class Prediction:
                    predicted_mean=np.arange(steps,dtype=float)-2
                    def conf_int(self,alpha):return np.column_stack([np.arange(steps)-4,np.arange(steps)+3])
                return Prediction()
        r=Result();m=Fitted(r,pd.Timestamp('2024-12-01'),[])
        out=predict(m,['2025-07-01','2025-09-01'])
        self.assertEqual(r.steps,9)
        self.assertEqual(out.yhat.tolist(),[4.,6.])
        self.assertEqual(out.ds.dt.month.tolist(),[7,9])
        self.assertTrue((out.yhat_lower<=out.yhat_upper).all())
        self.assertEqual(r.exog[:,0].tolist(),[0,0,0,0,0,1,1,1,1])
        with self.assertRaisesRegex(ValueError,'after training'):predict(m,['2024-12-01'])

    def test_point_scoring_does_not_require_an_unreported_interval(self):
        class Prediction:
            predicted_mean=np.array([4.])
            def conf_int(self,alpha):return np.array([[np.nan,np.nan]])
        class Result:
            def get_forecast(self,**kwargs):return Prediction()
        m=Fitted(Result(),pd.Timestamp('2024-12-01'),[])
        self.assertEqual(predict(m,['2025-01-01'],include_intervals=False).yhat.iloc[0],4.)
        with self.assertRaisesRegex(ValueError,'Nonfinite SARIMAX interval'):predict(m,['2025-01-01'])

    def test_sarimax_only_identity_and_advisory_separation(self):
        with patch.dict('os.environ',{'HEALTHWATCH_FORECAST_MODEL':'SARIMAX'}):
            self.assertEqual(model_name(),'SARIMAX');self.assertEqual(len(fingerprint()),64)
        with patch.dict('os.environ',{'HEALTHWATCH_FORECAST_MODEL':'Prophet'}):
            with self.assertRaises(ValueError):model_name()
        source=(Path(__file__).parents[1]/'frontend/src/components/hw/LiveWeatherCard.tsx').read_text(encoding='utf-8')
        self.assertNotIn('nextForecast.value *',source)
        self.assertNotIn('weather surge modifier',source)

    def test_numerical_retry_uses_only_previous_origin_parameters(self):
        from types import SimpleNamespace
        series=pd.DataFrame(dict(ds=pd.date_range('2019-01-01','2025-12-01',freq='MS'),y=4.))
        previous=SimpleNamespace(result=SimpleNamespace(params=np.array([1.,2.])))
        calls=[]
        def fit(frame,start_params=None):
            calls.append((frame.ds.max(),start_params))
            if frame.ds.max()==pd.Timestamp('2025-01-01') and start_params is None:raise np.linalg.LinAlgError('LU fixture')
            return previous
        with patch.object(forecast,'fit_model',side_effect=fit),patch.object(forecast,'predict',side_effect=lambda _,ds,**kw:pd.DataFrame({'yhat':[2.]})):
            result=forecast.walk_forward_validation(series,end_date='2024-12-31')
        self.assertEqual(len(result.attrs['numerical_retries']),1)
        self.assertEqual(result.attrs['numerical_retries'][0]['target_date'],'2025-02-01')
        self.assertTrue(np.array_equal(calls[2][1],previous.result.params))

    def test_forecast_calendar_keeps_trailing_unknowns_and_hepa_own_end(self):
        d=pd.DataFrame(dict(disease=['Cholera','Acute Viral Hepatitis'],region=['R','R'],date=pd.to_datetime(['2024-01-01','2024-01-01']),cases=[1,2]))
        with patch.object(forecast.ingest,'load_monthly_series',return_value=d):out=forecast.load_series()
        self.assertEqual(out[out.disease=='Cholera'].date.max(),pd.Timestamp('2026-08-01'))
        self.assertEqual(out[out.disease=='Acute Viral Hepatitis'].date.max(),pd.Timestamp('2025-09-01'))
        self.assertTrue(out[out.disease=='Cholera'].iloc[-1].cases!=out[out.disease=='Cholera'].iloc[-1].cases)

if __name__=='__main__':unittest.main()
