import unittest
from pathlib import Path
from tempfile import TemporaryDirectory
import pandas as pd
from src.leptospirosis_records import build_reported_records
from src.source_registry import policy

class ReportedRecordsTests(unittest.TestCase):
    def write(self, rows, directory):
        path = Path(directory)/"Lepto.csv"
        pd.DataFrame(rows).to_csv(path, index=False)
        return path

    def test_unit_codes_and_weights(self):
        rows = [
            {"Year":2023,"Morbidity Week":1,"Region":"NATIONAL CAPITAL REGION (NCR)","Cases":77,"Case Classification":"C","Deaths":12},
            {"Year":2023,"Morbidity Week":1,"Region":"NATIONAL CAPITAL REGION (NCR)","Cases":"S","Case Classification":"P","Deaths":300},
            {"Year":2023,"Morbidity Week":9,"Region":"NATIONAL CAPITAL REGION (NCR)","Cases":"C","Case Classification":None,"Deaths":8},
            dict.fromkeys(["Year","Morbidity Week","Region","Cases","Case Classification","Deaths"])]
        with TemporaryDirectory() as d:
            regional, national = build_reported_records(self.write(rows,d))
        self.assertEqual(regional.cases.sum(),3)
        self.assertEqual(regional.iloc[0].cases,2)
        self.assertNotIn("deaths",regional.columns)
        self.assertEqual(set(regional.target_unit),{"reported_records"})
        self.assertFalse(regional.date.dt.month.eq(2).any())
        self.assertFalse(national.coverage_complete.any())

    def test_invalid_inclusion_code_rejected(self):
        rows=[{"Year":2023,"Morbidity Week":1,"Region":"NATIONAL CAPITAL REGION (NCR)","Cases":5,"Case Classification":"X"}]
        with TemporaryDirectory() as d:
            with self.assertRaisesRegex(ValueError,"S/P/C"):
                build_reported_records(self.write(rows,d))

    def test_reported_record_research_policy(self):
        p=policy("Leptospirosis")
        self.assertTrue(p["reported_records_research"])
        self.assertEqual(p["research_target_unit"],"reported_records")
