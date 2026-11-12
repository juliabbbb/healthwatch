"""Source meaning is explicit; schema inference is never confirmation."""
from hashlib import sha256
from pathlib import Path
import json

POLICIES = {
    'Dengue': dict(measure='No. of Cases', status='conditional_calendar', calendar='provisional_iso_thursday_w53_fold52', forecast=True),
    'Acute Bloody Diarrhea': dict(measure='Total Cases', status='numeric_count', calendar='explicit_month', forecast=True),
    'Cholera': dict(measure='Total Cases', status='numeric_count', calendar='explicit_month', forecast=True),
    'Typhoid Fever': dict(measure='Total Cases', status='numeric_count', calendar='explicit_month', forecast=True),
    'Acute Viral Hepatitis': dict(measure='provisional_row_count', status='provisional', calendar='explicit_month', forecast=False, source_label='Hep A'),
    'Influenza-like Illness': dict(measure='Cases', status='provisional', calendar='provisional_reversed_headers_iso_thursday_w53_fold52', forecast=True, operational_mode='provisional'),
    'Leptospirosis': dict(measure=None, status='excluded_unresolved_measure', calendar=None, forecast=False),
    'Heat-Related Illness': dict(measure='annual_events_cases_deaths', status='reference_only', calendar='annual', forecast=False),
}


def policy(disease):
    return dict(POLICIES[disease], confirmation_reference=None,
                duplicate_policy='retain_candidates_pending_source_grain', definition_status='source_confirmation_pending')


def file_record(path, root=None):
    path = Path(path)
    return dict(file=str(path.relative_to(root)) if root else path.name,
                sha256=sha256(path.read_bytes()).hexdigest(), bytes=path.stat().st_size)


def write_registry(raw_root, output):
    raw_root, output = Path(raw_root), Path(output)
    records = [file_record(p, raw_root) for p in sorted(raw_root.rglob('*')) if p.is_file() and p.suffix.lower() in {'.csv','.xlsx','.pdf'}]
    output.mkdir(parents=True, exist_ok=True)
    (output/'source_registry.json').write_text(json.dumps(dict(sources=records, policies={d:policy(d) for d in POLICIES}),indent=2),encoding='utf-8')
    return records
