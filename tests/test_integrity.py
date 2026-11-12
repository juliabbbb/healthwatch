import ast
from pathlib import Path
import unittest
from unittest.mock import patch
import numpy as np
import pandas as pd
from src.integrity import binary_metrics, legacy_week_month, count_values, paired_score, seasonal_rules
from src import forecast


class AnalyticalRegressionTests(unittest.TestCase):
    def test_cutoffs_mean_last_training_date(self):
        s = pd.DataFrame({'ds': pd.date_range('2019-01-01', '2026-08-01', freq='MS')})
        for end, expected in [('2024-12-31', '2025-01-01'), ('2025-08-31', '2025-09-01')]:
            self.assertEqual(s.iloc[forecast._split_index(s, 12, end)].ds, pd.Timestamp(expected))

    def test_validation_calendar_survives_missing_target(self):
        s = pd.DataFrame({'ds': pd.date_range('2019-01-01', '2025-12-01', freq='MS'), 'y': 4.})
        s = s[s.ds != '2025-03-01']
        with patch.object(forecast, 'fit_prophet', return_value=object()), patch.object(forecast, 'predict', side_effect=lambda _, dates, **kwargs: pd.DataFrame({'yhat': [2.] * len(dates)})):
            out = forecast.walk_forward_validation(s, end_date='2024-12-31')
        self.assertEqual(len(out), 12)
        self.assertTrue(pd.isna(out.loc[out.ds == '2025-03-01', 'y'].iloc[0]))

    def test_monthly_fit_never_sees_its_target_actual(self):
        s=pd.DataFrame({'ds':pd.date_range('2019-01-01','2025-12-01',freq='MS'),'y':4.})
        fits=[]
        def fit(frame,**kwargs):
            fits.append(frame.ds.max());return frame.ds.max()
        def predict(origin,dates,**kwargs):
            self.assertLess(origin,dates[0]);return pd.DataFrame({'yhat':[2.]})
        with patch.object(forecast,'fit_prophet',side_effect=fit),patch.object(forecast,'predict',side_effect=predict):
            result=forecast.walk_forward_validation(s,end_date='2024-12-31')
        self.assertEqual(len(fits),12)
        self.assertEqual(fits[1],pd.Timestamp('2025-01-01'))

    def test_sparse_probe_anchored_to_calendar(self):
        s = pd.DataFrame({'ds': pd.date_range('2019-01-01', '2023-12-01', freq='MS'), 'y': 4.})
        def predict(_, dates):
            return pd.DataFrame({'ds': dates, 'yhat': 2., 'yhat_lower': 1., 'yhat_upper': 3.})
        with patch.object(forecast, 'fit_prophet', return_value=object()), patch.object(forecast, 'predict', side_effect=predict):
            out = forecast.build_season_probes(s)
        self.assertEqual(out.ds.dt.strftime('%Y-%m').tolist(), ['2025-01','2025-02','2025-03','2025-07','2025-08','2025-09'])

    def test_production_origin_is_not_the_benchmark_origin(self):
        s = pd.DataFrame({'ds': pd.date_range('2019-01-01', '2026-08-01', freq='MS'), 'y': 4.})
        def predict(_, dates):
            return pd.DataFrame({'ds': dates, 'yhat': 2., 'yhat_lower': 1., 'yhat_upper': 3.})
        with patch.object(forecast, 'fit_prophet', return_value=object()), patch.object(forecast, 'predict', side_effect=predict):
            out = forecast.build_forecast(s)
        self.assertEqual(out.ds.iloc[0],pd.Timestamp('2026-09-01'))
        self.assertEqual(out.ds.iloc[-1],pd.Timestamp('2027-08-01'))

    def test_source_row_alignment(self):
        y = pd.Series([2019, 2020], index=[101, 900])
        w = pd.Series([1, 53], index=[101, 900])
        out = legacy_week_month(y, w)
        self.assertEqual(out.index.tolist(), [101, 900])
        self.assertEqual(out.iloc[1], pd.Timestamp('2020-12-01'))

    def test_invalid_counts_not_repaired(self):
        for values in [[-1], [1.5], ['bad'], [np.inf], [None]]:
            with self.assertRaises(ValueError): count_values(pd.Series(values))
        self.assertEqual(count_values(pd.Series([0, 2])).tolist(), [0, 2])

    def test_defined_zero_versus_undefined(self):
        self.assertEqual(binary_metrics(0, 1, 1, 0)['f1'], 0.)
        self.assertIsNone(binary_metrics(0, 0, 0, 4)['f1'])
        self.assertEqual(binary_metrics(1, 1, 1, 1)['f1'], .5)

    def test_incomplete_probe_is_not_a_negative(self):
        out = seasonal_rules(pd.date_range('2025-01-01', periods=2, freq='MS'), [4,4], [1,1], [3,3], 3)
        self.assertFalse(out['eligible'])
        self.assertIsNone(out['combined_flag'])
        out = seasonal_rules(pd.date_range('2025-01-01', periods=3, freq='MS'), [4,4,4], [1]*3, [3]*3, 3)
        self.assertTrue(out['rule_a'] and out['rule_b'])

    def test_error_denominators(self):
        s = paired_score([0, None, 2], [1, 5, 2])
        self.assertEqual((s['months'], s['missing_targets'], s['excluded_zero_actual'], s['mape_denominator']), (2,1,1,1))
        self.assertEqual(s['MAE'], .5)
        self.assertIsNone(paired_score([0], [0])['MAPE'])

    def test_api_pure_summary_zero_f1(self):
        tree = ast.parse((Path(__file__).parents[1]/'src/api.py').read_text(encoding='utf-8'))
        fn = next(n for n in tree.body if isinstance(n, ast.FunctionDef) and n.name == 'outbreak_validation')
        fn.decorator_list=[]
        scope={'__name__':'src.api','__package__':'src','_OUTBREAK_VALIDATION':pd.DataFrame({'tp':[0], 'fp':[1], 'fn':[1], 'tn':[0], 'season':['dry']})}
        exec(compile(ast.Module(body=[fn],type_ignores=[]), 'api.py','exec'),scope)
        self.assertEqual(scope['outbreak_validation']()['overall']['f1'],0.)

if __name__ == '__main__': unittest.main()
