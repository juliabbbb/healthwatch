"""Provisional leptospirosis record counts; source numeric fields are retained, not summed.

The user authorized one case per nonblank source row across all years. The DOH
classification letter does not independently confirm row grain or numeric deaths.
"""
from pathlib import Path
import pandas as pd

from . import config, ingest

LEPTO_RAW_GLOB = "*Lepto*.csv"
DISEASE = "Leptospirosis"
DATA_END = pd.Timestamp("2026-08-31")

REGION_LABELS = {
    "NATIONAL CAPITAL REGION (NCR)": "National Capital Region",
    "CORDILLERA ADMINISTRATIVE REGION (CAR)": "Cordillera Administrative Region",
    "REGION I (ILOCOS REGION)": "Ilocos Region",
    "REGION II (CAGAYAN VALLEY)": "Cagayan Valley",
    "REGION III (CENTRAL LUZON)": "Central Luzon",
    "REGION IV-A (CALABARZON)": "CALABARZON",
    "MIMAROPA REGION": "MIMAROPA",
    "REGION IV-B (MIMAROPA)": "MIMAROPA",
    "REGION V (BICOL REGION)": "Bicol Region",
    "NEGROS ISLAND REGION (NIR)": "Negros Island Region",
    "REGION VI (WESTERN VISAYAS)": "Western Visayas",
    "REGION VII (CENTRAL VISAYAS)": "Central Visayas",
    "REGION VIII (EASTERN VISAYAS)": "Eastern Visayas",
    "REGION IX (ZAMBOANGA PENINSULA)": "Zamboanga Peninsula",
    "REGION X (NORTHERN MINDANAO)": "Northern Mindanao",
    "REGION XI (DAVAO REGION)": "Davao Region",
    "REGION XII (SOCCSKSARGEN)": "SOCCSKSARGEN",
    "REGION XIII (CARAGA)": "Caraga",
    "BANGSAMORO AUTONOMOUS REGION IN MUSLIM MINDANAO (BARMM)": "Bangsamoro (BARMM)",
}


def _epi_week_month(year_series, week_series):
    from .integrity import legacy_week_month
    return legacy_week_month(year_series, week_series)


def process_leptospirosis(raw_dir=None):
    import json
    from .source_decisions import decisions, digest
    from .lineage import trace
    root = Path(raw_dir) if raw_dir else ingest.RAW_DIR / 'new_diseases'
    paths = sorted(root.glob(LEPTO_RAW_GLOB))
    if len(paths) != 1: raise ValueError('Expected one canonical leptospirosis source')
    path = paths[0]; raw = pd.read_csv(path, dtype=str).fillna('')
    raw.columns = raw.columns.str.strip(); raw['source_record'] = raw.index + 1
    blank = raw.drop(columns='source_record').apply(lambda col: col.str.strip().eq('')).all(axis=1)
    frame = raw.loc[~blank].copy()
    frame['date'] = _epi_week_month(frame['Year'], frame['Morbidity Week'])
    frame['region'] = frame['Region'].str.strip().map(REGION_LABELS)
    if frame.region.isna().any(): raise ValueError('Unmapped leptospirosis region')
    label = frame['Case Classification'].str.strip()
    label = label.where(label.ne(''), frame['Cases'].str.strip())
    frame['case_classification'] = label.map(decisions()['leptospirosis']['classifications']).fillna('Unknown')
    frame['disease'] = DISEASE; frame['cases'] = 1.; frame['deaths'] = float('nan')
    frame = frame[frame.date.between(config.DATA_START, DATA_END)].copy()
    ingest.PROCESSED_DIR.mkdir(parents=True, exist_ok=True)
    trace(frame, path, ingest.PROCESSED_DIR, len(raw))
    # Full retained source columns are auditable without rewriting the input.
    frame.to_csv(ingest.PROCESSED_DIR / 'leptospirosis_record_ledger.csv', index=False)
    regional = frame.groupby(['disease','region','date'], as_index=False).agg(cases=('cases','sum'), source_record_count=('source_record','size'))
    regional['deaths'] = float('nan')
    regional['observation_status'] = 'observed_positive'
    regional['coverage_basis'] = 'provisional_source_record_count'
    national = regional.groupby(['disease','date'], as_index=False).agg(cases=('cases','sum'),source_record_count=('source_record_count','sum'))
    national['region']='National';national['deaths']=float('nan')
    national['observation_status']='sum_available_regional_records';national['coverage_basis']='provisional_source_record_count'
    ingest.save_processed(regional, 'regional_leptospirosis_monthly.csv')
    ingest.save_processed(national, 'national_leptospirosis_monthly.csv')
    audit = dict(measure='one_case_per_nonblank_source_record', source_decisions_sha256=digest(),
        source_rows=len(raw), blank_rows=int(blank.sum()), nonblank_rows=int((~blank).sum()),
        retained_rows=len(frame), duplicate_candidates=int(raw.loc[~blank].drop(columns='source_record').duplicated().sum()),
        cases=float(regional.cases.sum()), regions=regional.region.nunique(), status='provisional', deaths='unresolved')
    (ingest.PROCESSED_DIR/'leptospirosis_record_audit.json').write_text(json.dumps(audit,indent=2),encoding='utf-8')
    print(json.dumps(audit,indent=2))
    return regional, national


if __name__ == "__main__":
    process_leptospirosis()
