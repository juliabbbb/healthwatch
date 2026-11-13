"""Trace workbook rows and cell types; report differences without guessing age bands."""
from pathlib import Path
import argparse,csv,json
from datetime import date,datetime
import openpyxl
import pandas as pd
from .source_registry import file_record


def convert(workbook,output,csv_root=None):
    output=Path(output);output.mkdir(parents=True,exist_ok=True)
    wb=openpyxl.load_workbook(workbook,read_only=True,data_only=False)
    summaries=[]
    for name in wb.sheetnames:
        sheet=wb[name];it=sheet.iter_rows();header=[str(c.value).strip() if c.value is not None else '' for c in next(it)]
        rows=[];types={};date_age=0
        with (output/(name.replace('/','_')+'_row_ledger.csv')).open('w',newline='',encoding='utf-8') as stream:
            writer=csv.writer(stream);writer.writerow(['sheet','excel_row','raw_values_json','cell_types_json','normalization'])
            for number,cells in enumerate(it,2):
                values=[c.value for c in cells];row=dict(zip(header,values));rows.append(row)
                celltypes={h:('datetime' if isinstance(c.value,(date,datetime)) else c.data_type) for h,c in zip(header,cells)}
                for h,t in celltypes.items():types[h+':'+t]=types.get(h+':'+t,0)+1
                if any('age' in h.lower() and isinstance(v,(date,datetime)) for h,v in row.items()):date_age+=1
                writer.writerow([name,number,json.dumps(values,default=str,ensure_ascii=False),json.dumps(celltypes),'none; raw retained'])
        df=pd.DataFrame(rows)
        record=dict(sheet=name,rows=len(df),duplicate_excess=int(df.duplicated().sum()),date_typed_age_rows=date_age,
                    total_cases=float(pd.to_numeric(df['Total Cases'],errors='raise').sum()) if 'Total Cases' in df else None,
                    nulls=df.isna().sum().to_dict(),cell_types=types,measure_status='explicit_numeric' if 'Total Cases' in df else 'unresolved_or_reference')
        if csv_root:
            matches=[p for p in Path(csv_root).glob('*.csv') if p.stem.endswith(' - '+name)]
            if len(matches)==1:
                other=pd.read_csv(matches[0]);record['csv_comparison']=dict(file=matches[0].name,rows=len(other),duplicate_excess=int(other.duplicated().sum()),nulls=other.isna().sum().to_dict(),total_cases=float(pd.to_numeric(other['Total Cases'],errors='raise').sum()) if 'Total Cases' in other else None)
                # Cellwise comparison is explicit, including date/string conversion effects.
                if len(other)==len(df) and list(other)==list(df):
                    a=df.map(lambda x: '' if pd.isna(x) else str(x));b=other.map(lambda x: '' if pd.isna(x) else str(x))
                    record['csv_comparison']['cell_differences']=a.ne(b).sum().to_dict()
                else:record['csv_comparison']['shape_or_column_mismatch']=True
        summaries.append(record)
    result=dict(source=file_record(workbook),sheets=summaries,policy='retain all rows; no age repair; no duplicate removal; Hep A measure not confirmed')
    (output/'workbook_reconciliation.json').write_text(json.dumps(result,indent=2,default=str),encoding='utf-8')
    return result

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--workbook',required=True);p.add_argument('--output',required=True);p.add_argument('--csv-root');a=p.parse_args();convert(a.workbook,a.output,a.csv_root)
