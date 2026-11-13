"""Retained-row transformation ledger; record indexes are not patient IDs."""
import json
from pathlib import Path
import pandas as pd
from .source_registry import file_record


def trace(frame,source,output,source_rows):
    source,output=Path(source),Path(output)/'lineage';output.mkdir(parents=True,exist_ok=True)
    name=source.stem.replace('[','').replace(']','').replace('#','')
    columns=[c for c in ['source_record','Year','Morbidity Week','Morbidity Month','Region','date','region','disease','cases','deaths','Case Classification','Outcome','Age Group','Age'] if c in frame]
    frame[columns].to_csv(output/(name+'.csv'),index=False)
    record=dict(source=file_record(source),source_rows=source_rows,retained_rows=len(frame),
                excluded_rows=source_rows-len(frame),row_id='one-based parsed CSV record; not physical text line or patient ID',
                exclusions='outside declared ingestion dates; input raw retained',duplicate_policy='retain_candidates',
                date_typed_age_policy='unresolved; no inferred age bands',calendar_status='source-specific; see registry',
                sum_cases=float(frame.cases.sum()) if 'cases' in frame else None)
    (output/(name+'.json')).write_text(json.dumps(record,indent=2),encoding='utf-8')
