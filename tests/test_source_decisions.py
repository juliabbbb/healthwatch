from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch
import unittest
import pandas as pd
from src import ingest, config, db
from src.source_decisions import covered_zeros, require_lepto_audit
from src.leptospirosis_ingest import process_leptospirosis


class SourceDecisionTests(unittest.TestCase):
    def test_interior_zeros_preserve_edges_other_sources_and_death_unknowns(self):
        x=pd.DataFrame(dict(disease=['Cholera']*2+['Influenza-like Illness']*2,region=['R']*4,
            date=pd.to_datetime(['2020-02-01','2020-04-01']*2),cases=[2.,3.,4.,5.],deaths=[0.,1.,None,None],source_record_count=[1]*4))
        out=covered_zeros(x,dict(version='test',coverage_mode='interior_only_between_existing_reports_per_region'))
        cholera=out[out.disease=='Cholera']
        self.assertEqual(cholera.date.dt.month.tolist(),[2,3,4])
        self.assertEqual(cholera.cases.tolist(),[2.,0.,3.])
        added=cholera.iloc[1]
        self.assertEqual(added.observation_status,'zero_by_user_relayed_DOH_rule')
        self.assertEqual(added.source_record_count,0)
        self.assertTrue(pd.isna(added.deaths))
        self.assertEqual(len(out[out.disease=='Influenza-like Illness']),2)

    def test_unconfirmed_coverage_does_not_fill_values(self):
        x=pd.DataFrame(dict(disease=['Cholera']*2,region=['R']*2,date=pd.to_datetime(['2020-01-01','2020-03-01']),cases=[0,2],deaths=[None,None]))
        spec=dict(version='test',coverage=[dict(disease='Cholera',regions=['R'],start='2019-01-01',end='2021-01-01',status='unresolved')])
        out=covered_zeros(x,spec)
        self.assertEqual(len(out),2)
        self.assertEqual(out.cases.tolist(),[0,2])

    def test_lepto_counts_records_not_numeric_fields_and_retains_duplicates(self):
        rows=[dict(Year='2023',**{'Morbidity Week':'1','Region':'NATIONAL CAPITAL REGION (NCR)','Case Classification':'S','Cases':'31','Deaths':'6'})]*2
        rows += [dict(Year='2024',**{'Morbidity Week':'1','Region':'NATIONAL CAPITAL REGION (NCR)','Case Classification':'','Cases':'C','Deaths':'77'}),
                 dict(Year='2026',**{'Morbidity Week':'40','Region':'NATIONAL CAPITAL REGION (NCR)','Case Classification':'','Cases':'P','Deaths':'20'}),
                 dict(Year='',**{'Morbidity Week':'','Region':'','Case Classification':'','Cases':'','Deaths':''})]
        with TemporaryDirectory() as tmp:
            root=Path(tmp);raw=root/'raw';raw.mkdir();output=root/'output'
            pd.DataFrame(rows).to_csv(raw/'Lepto.csv',index=False)
            with patch.object(ingest,'PROCESSED_DIR',output):
                regional,national=process_leptospirosis(raw)
            self.assertEqual(regional.cases.sum(),3)
            self.assertEqual(national.cases.sum(),3)
            self.assertTrue(regional.deaths.isna().all())
            audit=require_lepto_audit(output)
            self.assertEqual(audit['blank_rows'],1)
            self.assertEqual(audit['duplicate_candidates'],1)
            ledger=pd.read_csv(output/'leptospirosis_record_ledger.csv')
            self.assertEqual(ledger.case_classification.tolist(),['Suspect','Suspect','Confirmed'])
            self.assertEqual(ledger.Deaths.tolist(),[6,6,77])

    def test_lepto_requires_matching_decision_version(self):
        with TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'leptospirosis_record_audit.json').write_text('{"measure":"one_case_per_nonblank_source_record","source_decisions_sha256":"old"}')
            with self.assertRaisesRegex(ValueError,'match'):require_lepto_audit(root)

    def test_provisional_capability_and_display_label(self):
        for name in ['Leptospirosis','Acute Viral Hepatitis']:
            meta=config.DISEASE_METADATA[name]
            self.assertTrue(meta['forecast_available'])
            self.assertEqual(meta['source_policy']['status'],'provisional')
        self.assertEqual(config.DISEASE_METADATA['Acute Viral Hepatitis']['name'],'Hepatitis A')

    def test_database_rows_retain_added_zero_lineage(self):
        x=pd.DataFrame(dict(region=['National'],disease=['Cholera'],date=pd.to_datetime(['2020-02-01']),cases=[0.],deaths=[None],observation_status=['zero_by_user_relayed_DOH_rule'],source_record_count=[0],coverage_basis=['test']))
        row=db._monthly_observation_rows(x)[0]
        self.assertEqual(row['cases'],0)
        self.assertIsNone(row['deaths'])
        self.assertEqual(row['observation_status'],'zero_by_user_relayed_DOH_rule')


if __name__=='__main__':unittest.main()
