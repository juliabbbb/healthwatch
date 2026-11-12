"""Explicit, versioned user/source decisions. Never infer coverage from case dates."""
from pathlib import Path
import hashlib
import json
import pandas as pd

PATH = Path(__file__).resolve().parents[1] / 'docs/source_decisions.json'


def decisions():
    return json.loads(PATH.read_text(encoding='utf-8'))


def digest():
    return hashlib.sha256(PATH.read_bytes()).hexdigest()


def covered_zeros(monthly, specification=None):
    """Add case zeros only inside registered bounds; preserve supplied values/deaths."""
    specification = decisions() if specification is None else specification
    out = monthly.copy()
    if 'source_record_count' not in out:
        out['source_record_count'] = None
    out['observation_status'] = out.cases.map(lambda value: 'missing_report' if pd.isna(value) else 'observed_zero' if value == 0 else 'observed_positive')
    out['coverage_basis'] = 'supplied_record'
    entries = list(specification.get('coverage', []))
    if specification.get('coverage_mode') == 'interior_only_between_existing_reports_per_region':
        fwbd = {'Acute Bloody Diarrhea', 'Cholera', 'Typhoid Fever', 'Acute Viral Hepatitis'}
        for (disease, region), g in out[out.cases.notna()].groupby(['disease','region']):
            if disease in fwbd:
                entries.append(dict(disease=disease,regions=[region],start=str(g.date.min().date()),end=str(g.date.max().date()),status='user_declared_coverage'))
    for entry in entries:
        if entry.get('status') != 'user_declared_coverage':
            continue
        start, end = pd.Timestamp(entry['start']), pd.Timestamp(entry['end'])
        if start > end or start.day != 1 or end.day != 1:
            raise ValueError('Coverage requires ordered month-start dates')
        for region in entry['regions']:
            selected = out.disease.eq(entry['disease']) & out.region.eq(region)
            group = out.loc[selected].copy()
            dates = pd.date_range(start, end, freq='MS').union(pd.DatetimeIndex(group.date))
            g = group.set_index('date').reindex(dates).rename_axis('date').reset_index()
            inside = g.date.between(start, end)
            added = inside & g.cases.isna()
            g.loc[added, 'cases'] = 0.
            g.loc[added, 'source_record_count'] = 0
            g.loc[added, 'observation_status'] = 'zero_by_user_relayed_DOH_rule'
            g.loc[added, 'coverage_basis'] = specification['version']
            g['disease'], g['region'] = entry['disease'], region
            # Deaths remain unavailable for added rows: the clarification concerns cases.
            out = pd.concat([out.loc[~selected], g], ignore_index=True)
    return out.sort_values(['disease', 'region', 'date'], ignore_index=True)


def require_lepto_audit(root):
    path = Path(root) / 'leptospirosis_record_audit.json'
    if not path.is_file():
        raise ValueError('Legacy leptospirosis aggregates lack the approved row-count audit')
    audit = json.loads(path.read_text(encoding='utf-8'))
    if audit.get('measure') != 'one_case_per_nonblank_source_record' or audit.get('source_decisions_sha256') != digest():
        raise ValueError('Leptospirosis audit does not match the current counting decisions')
    return audit
