"""Supplementary RF benchmark for leptospirosis reported records; no DB access."""
import argparse, hashlib, json, time
from pathlib import Path
import numpy as np
import pandas as pd
from . import ingest
from .leptospirosis_records import build_reported_records, TARGET_UNIT, DECISION_ID
from .model_adapters import ModelAdapters


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", required=True)
    parser.add_argument("--weka-jar", required=True)
    args = parser.parse_args()
    out = Path(args.output).resolve()
    if out.name.lower() == "processed" and out.parent.name.lower() == "data":
        raise ValueError("Select a new research run directory, not data/processed")
    if out.exists():
        raise ValueError("Choose a new run directory")
    regional, national = build_reported_records()
    out.mkdir(parents=True)
    data = pd.concat([regional, national], ignore_index=True)
    data.to_csv(out / "observed_records.csv", index=False)
    metrics, predictions, fits = [], [], []
    start = time.perf_counter()
    with ModelAdapters(out / "native_weka", args.weka_jar) as adapter:
        for region, g in data.groupby("region"):
            obs = g.set_index("date").cases.sort_index()
            for fold, year in [("CV2022", 2022), ("CV2023", 2023),
                               ("CV2024", 2024), ("TEST2025", 2025)]:
                train = obs.reindex(pd.date_range("2019-01-01", f"{year-1}-12-01", freq="MS"))
                dates = pd.date_range(f"{year}-01-01", periods=12, freq="MS")
                actual = obs.reindex(dates).to_numpy()
                naive = obs.reindex(dates - pd.DateOffset(years=1)).to_numpy()
                mask = np.isfinite(actual) & np.isfinite(naive)
                row = dict(disease="Leptospirosis", region=region, fold=fold,
                           train_end=str(train.index[-1].date()), target_unit=TARGET_UNIT,
                           provisional=True, primary_selection=False,
                           train_observed=int(train.notna().sum()),
                           train_missing=int(train.isna().sum()),
                           training_instances=int(train.iloc[12:].notna().sum()), n=int(mask.sum()))
                reasons = []
                if train.notna().sum() < 24:
                    reasons.append("fewer than 24 observed training months")
                if train.iloc[12:].notna().sum() < 12:
                    reasons.append("fewer than 12 RF targets after lag year")
                if mask.sum() < 9:
                    reasons.append("fewer than 9 paired targets")
                if train.notna().any() and not train.dropna().ne(0).any():
                    reasons.append("all-zero training")
                if reasons:
                    fits.append(dict(row, status="excluded", reason="; ".join(reasons)))
                    continue
                try:
                    pred, _ = adapter.predict("Random Forest WEKA", train, dates, f"job_{len(fits):04}")
                    if not np.isfinite(pred).all():
                        raise ValueError("Nonfinite forecast")
                    aa, pp = actual[mask], pred[mask]
                    err = pp - aa
                    nz = aa != 0
                    scale = (train - train.shift(12)).abs().dropna().mean()
                    metrics.append(dict(row, model="Random Forest WEKA",
                        MAE=float(np.abs(err).mean()), RMSE=float(np.sqrt(np.mean(err**2))),
                        MAPE=float(np.mean(np.abs(err[nz]/aa[nz]))*100) if nz.any() else np.nan,
                        MAPE_excluded_zero=int((~nz).sum()),
                        MASE=float(np.abs(err).mean()/scale) if scale > 0 else np.nan))
                    for date, av, pv, nv, scored in zip(dates, actual, pred, naive, mask):
                        predictions.append(dict(disease="Leptospirosis", region=region, fold=fold,
                            target_date=str(date.date()), actual=av, predicted=pv, naive=nv,
                            scored=bool(scored), target_unit=TARGET_UNIT,
                            train_end=row["train_end"], provisional=True))
                    fits.append(dict(row, status="ok"))
                except Exception as error:
                    fits.append(dict(row, status="failed", reason=str(error)))
                print(region, fold, fits[-1]["status"], flush=True)
    pd.DataFrame(metrics).to_csv(out/"metrics.csv", index=False)
    pd.DataFrame(predictions).to_csv(out/"predictions.csv", index=False)
    pd.DataFrame(fits).to_csv(out/"fit_log.csv", index=False)
    raw = sorted((ingest.RAW_DIR/"new_diseases").glob("*Lepto*.csv"))[0]
    info = dict(target_unit=TARGET_UNIT, counting_decision=DECISION_ID,
                source_sha256=hashlib.sha256(raw.read_bytes()).hexdigest(),
                successful=len(metrics), excluded=sum(r["status"]=="excluded" for r in fits),
                failed=sum(r["status"]=="failed" for r in fits),
                seconds=time.perf_counter()-start, primary_selection=False,
                national="sum of reporting regions; completeness in observed_records.csv",
                model="native WEKA 200 trees/depth8/leaf2/seed2026/slots1/K0")
    (out/"run_info.json").write_text(json.dumps(info, indent=2))
    if info["failed"] or not metrics:
        raise RuntimeError("RF fits failed or no eligible results; inspect fit_log.csv")
    print(json.dumps(info, indent=2))


if __name__ == "__main__":
    main()
