import unittest
import pandas as pd
from src.ili_ingest import normalize_ili_headers

class ILIHeaderTests(unittest.TestCase):
    def test_reversed_headers_and_row_alignment(self):
        raw=pd.DataFrame({"Year":[1,9],"Morbidity Week":[2018,2022],"Cases":[3,7]},index=[7,19])
        out=normalize_ili_headers(raw)
        self.assertEqual(out.Year.tolist(),[2018,2022])
        self.assertEqual(out["Morbidity Week"].tolist(),[1,9])
        self.assertEqual(out.index.tolist(),[7,19])
        self.assertEqual(out.Cases.tolist(),[3,7])
        self.assertEqual(raw.Year.tolist(),[1,9])
        self.assertEqual(out.attrs["ili_source_headers"],"reversed_normalized")

    def test_normal_headers_are_idempotent(self):
        raw=pd.DataFrame({"Year":[2020],"Morbidity Week":[53],"Cases":[5]})
        pd.testing.assert_frame_equal(normalize_ili_headers(raw),normalize_ili_headers(normalize_ili_headers(raw)))

    def test_mixed_missing_and_fractional_axes_rejected(self):
        for years,weeks in [([1,2020],[2020,1]),([2020],[None]),([2020],[1.5]),([2020],[54])]:
            with self.assertRaises(ValueError):
                normalize_ili_headers(pd.DataFrame({"Year":years,"Morbidity Week":weeks}))

    def test_ingestion_uses_normalized_axes_after_pre2019_filter(self):
        from tempfile import TemporaryDirectory
        from pathlib import Path
        from unittest.mock import patch
        from src import ingest
        from src.ili_ingest import process_ili
        raw=pd.DataFrame({"Year":[1,9],"Morbidity Week":[2018,2020],"Region":["NATIONAL CAPITAL REGION (NCR)"]*2,"Cases":[3,7]})
        with TemporaryDirectory() as tmp:
            path=Path(tmp)/"ili.csv"
            raw.to_csv(path,index=False)
            with patch.object(ingest,"PROCESSED_DIR",Path(tmp)):
                regional,_=process_ili(path)
            observed=regional[regional.cases.notna()]
            self.assertEqual(observed.cases.tolist(),[7])
            self.assertEqual(observed.date.iloc[0],pd.Timestamp("2020-02-01"))
