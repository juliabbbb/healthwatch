import json
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from src import api, db, ingest


class DashboardDisplayTests(unittest.TestCase):
    def setUp(self):
        self.tmp = TemporaryDirectory()
        self.cached = getattr(db._engine, '_cached', None)
        self.engine = create_engine('sqlite:///' + str(Path(self.tmp.name) / 'display.db'))
        db._engine._cached = self.engine
        db.metadata.create_all(self.engine)
        self.diseases = [d for d in api.SUPPORTED_DISEASES if d != 'Heat-Related Illness']
        self.code = db.REGION_META[0]['code']
        self.short = db.REGION_META[0]['short']
        with self.engine.begin() as connection:
            connection.execute(db.pipeline_runs.insert(), dict(generated_at='2026-11-14', data_through=__import__('datetime').date(2026, 8, 1), version='display-fixture', model='SARIMAX', notes=json.dumps({'run_id': 'display-fixture', 'metadata': {'case_record_rules_version': 'fixture', 'production_model': 'SARIMAX'}})))
            for index, disease in enumerate(self.diseases):
                for month, cases in [(1, index + 10), (2, None), (3, 0)]:
                    connection.execute(db.monthly_observations.insert(), dict(region_code=self.code, disease=disease, year=2025, month=month, cases=cases, deaths=None, observation_status='missing_report' if cases is None else 'observed_zero' if cases == 0 else 'observed_positive'))
        # Force the packaged source fallback; deployment has no processed directory.
        self.processed = patch.object(ingest, 'PROCESSED_DIR', Path(self.tmp.name) / 'empty')
        self.processed.start()
        self.client = TestClient(api.app)
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.processed.stop()
        self.engine.dispose()
        if self.cached is None:
            del db._engine._cached
        else:
            db._engine._cached = self.cached
        api._dashboard_snapshot.cache_clear()
        self.tmp.cleanup()

    def test_every_monthly_illness_retains_source_values_and_missing_month(self):
        for index, disease in enumerate(self.diseases):
            with self.subTest(disease=disease):
                response = self.client.get('/dashboard', params={'disease': disease})
                self.assertEqual(response.status_code, 200, response.text)
                points = response.json()['series'][self.short]
                self.assertEqual([p['cases'] for p in points], [index + 10, None, 0])
                self.assertEqual(points[1]['observation_status'], 'missing_report')
                self.assertFalse(any(p['forecast'] for p in points))

    def test_cached_dashboard_can_be_compressed_repeatedly_without_corrupt_headers(self):
        for _ in range(2):
            with patch.object(api, '_dashboard_payload', side_effect=AssertionError('Snapshot must already be materialized')):
                response = self.client.get('/dashboard', params={'disease': 'Typhoid Fever'}, headers={'Accept-Encoding': 'gzip'})
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.headers['content-encoding'], 'gzip')
                self.assertEqual(response.json()['series'][self.short][0]['cases'], self.diseases.index('Typhoid Fever') + 10)
        plain = self.client.get('/dashboard', params={'disease': 'Typhoid Fever'}, headers={'Accept-Encoding': 'identity'})
        self.assertNotIn('content-encoding', plain.headers)
        self.assertEqual(plain.status_code, 200)

    def test_reloading_database_snapshot_invalidates_cached_reported_counts(self):
        with self.engine.begin() as connection:
            connection.execute(db.monthly_observations.update().where((db.monthly_observations.c.disease == 'Typhoid Fever') & (db.monthly_observations.c.month == 1)).values(cases=1234))
        api._load_all_data()
        response = self.client.get('/dashboard', params={'disease': 'Typhoid Fever'})
        self.assertEqual(response.json()['series'][self.short][0]['cases'], 1234)

    def test_heat_original_annual_source_is_served_without_fabricated_months(self):
        dashboard = self.client.get('/dashboard', params={'disease': 'Heat-Related Illness'}).json()
        reference = self.client.get('/reference/heat-events')
        self.assertEqual(reference.status_code, 200)
        self.assertEqual(dashboard['annual_reference'], reference.json()['items'])
        self.assertTrue(dashboard['annual_reference'])
        self.assertEqual(dashboard['series'], {})
        self.assertFalse(dashboard['forecast_available'])
        self.assertEqual({row['year'] for row in dashboard['annual_reference']}, {2019, 2023, 2024, 2025, 2026})


if __name__ == '__main__':
    unittest.main()
