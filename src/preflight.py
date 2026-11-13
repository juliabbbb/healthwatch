"""Local source/schema preflight before expensive fitting or explicit publication."""
import argparse,csv,json
from pathlib import Path
from . import ingest
from .doh_eb_ingest import DOH_FILE
from .fwbd_ingest import FWD_FILES
from .source_registry import write_registry


def check_sources(output):
    lepto=list((ingest.RAW_DIR/'new_diseases').glob('*Lepto*.csv'))
    if len(lepto)!=1:raise ValueError('Expected one leptospirosis source')
    expected={lepto[0]:{'Year','Morbidity Week','Region','Cases','Case Classification','Deaths'},ingest.RAW_DIR/DOH_FILE:{'Year','Morbidity Week','Region','No. of Cases','No. of Deaths'},
              ingest.RAW_DIR/'new_diseases/ILI - Cases - Data.csv':{'Year','Morbidity Week','Region','Cases'}}
    for disease,name in FWD_FILES.items():
        columns={'Year','Morbidity Month','Region','Case Classification','Outcome','Admitted'}
        if disease!='Acute Viral Hepatitis':columns.add('Total Cases')
        expected[ingest.RAW_DIR/name]=columns
    for path in [ingest.RAW_DIR/'new_diseases/Heat-Related.pdf',ingest.ROOT/'data/audit/heat_events.csv']:
        if not path.is_file():raise ValueError('Required reference input missing: '+str(path))
    for path,required in expected.items():
        if not path.is_file():raise ValueError('Required source missing: '+str(path))
        with path.open(encoding='utf-8-sig',newline='') as stream:header=[h.strip() for h in next(csv.reader(stream))]
        if len(header)!=len(set(header)):raise ValueError('Duplicate source columns: '+path.name)
        if not required.issubset(header):raise ValueError('Required columns missing: '+path.name)
    records=write_registry(ingest.RAW_DIR,output)
    return dict(schema_preflight=True,hashed_inputs=len(records),source_confirmation='conditional',leptospirosis='provisional_source_record_count')

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--output',required=True);a=p.parse_args();print(json.dumps(check_sources(a.output),indent=2))
