import unittest
from pathlib import Path
import pandas as pd
from src.availability import describe
from src.heat_ingest import normalize_heat
from src import config


class AvailabilityTests(unittest.TestCase):
    def test_missing_months_are_not_observed_zeroes(self):
        history=pd.DataFrame({'date':pd.date_range('2024-01-01',periods=24,freq='MS'),'cases':[0]*12+[None]*12})
        result=describe(history,pd.DataFrame(),{'status':'conditional','forecast_available':True})
        self.assertEqual(result['observed_months'],12)
        self.assertEqual(result['last_observed'],'2024-12-01')
        self.assertEqual(result['reason_code'],'insufficient_observed_history')
        self.assertFalse(result['forecast_available'])

    def test_provisional_ili_can_forecast_without_becoming_confirmed(self):
        meta=config.DISEASE_METADATA['Influenza-like Illness']
        history=pd.DataFrame({'date':pd.date_range('2020-01-01',periods=24,freq='MS'),'cases':[1]*24})
        forecast=pd.DataFrame({'target_date':['2022-01-01'],'yhat':[0.]})
        result=describe(history,forecast,meta)
        self.assertTrue(result['forecast_available'])
        self.assertEqual(result['source_status'],'provisional')
        self.assertIn('not source-confirmed',result['source_warning'])

    def test_disabled_source_cannot_expose_stale_forecast_dates(self):
        forecast=pd.DataFrame({'target_date':['2026-01-01'],'yhat':[1]})
        for disease,reason in [('Acute Viral Hepatitis','source_confirmation_pending'),('Leptospirosis','unresolved_measure'),('Heat-Related Illness','annual_reference_only')]:
            result=describe(pd.DataFrame(),forecast,config.DISEASE_METADATA[disease])
            self.assertEqual(result['reason_code'],reason)
            self.assertFalse(result['forecast_available'])
            self.assertIsNone(result['forecast_start'])

    def test_heat_mapping_preserves_actual_counts_and_rejects_unknown_labels(self):
        raw=pd.read_csv(Path(__file__).parents[1]/'data/audit/heat_events.csv')
        result=normalize_heat(raw)
        self.assertEqual(tuple(result[['events','cases','deaths']].sum()),(113,1275,20))
        self.assertEqual(result.loc[result.region=='IV-A','canonical_region'].unique().tolist(),['CALABARZON'])
        self.assertEqual(result.loc[result.region=='NCR','cases'].sum(),226)
        with self.assertRaises(ValueError):normalize_heat(pd.DataFrame({'region':['UNMAPPED']}))


if __name__=='__main__':unittest.main()
