"""Shared analytical contracts. No I/O or database startup side effects."""
import numpy as np
import pandas as pd


def count_values(values, field="cases"):
    out = pd.to_numeric(values, errors="coerce")
    invalid = out.isna() | ~np.isfinite(out) | (out < 0) | (out % 1 != 0)
    if invalid.any():
        import os
        from pathlib import Path
        import hashlib
        root = os.environ.get('HEALTHWATCH_OUTPUT_DIR')
        if root:
            directory=Path(root)/'quarantine';directory.mkdir(parents=True,exist_ok=True)
            pd.DataFrame({'input_index':values.index[invalid], 'raw_value':values[invalid].astype(str),
                          'field':field,'reason':'not_finite_nonnegative_integer'}).to_csv(
                directory/(hashlib.sha256(field.encode()).hexdigest()[:12]+'.csv'),index=False)
        raise ValueError(f"Invalid {field} at source rows {list(values.index[invalid][:10])}")
    return out


def legacy_week_month(years, weeks):
    """Provisional ISO-Thursday/W53-fold convention; never source confirmation."""
    y, w = pd.to_numeric(pd.Series(years),errors='raise'), pd.to_numeric(pd.Series(weeks),errors='raise')
    if (not np.isfinite(y).all() or not np.isfinite(w).all() or
            y.mod(1).ne(0).any() or w.mod(1).ne(0).any()):
        raise ValueError('Year and week must be finite integers')
    if not w.between(1, 53).all():
        raise ValueError("Morbidity week must be in 1..53")
    dates = [pd.Timestamp.fromisocalendar(int(a), min(int(b), 52), 4)
             for a, b in zip(y, w)]
    return pd.Series(dates, index=y.index).dt.to_period("M").dt.to_timestamp()


def binary_metrics(tp, fp, fn, tn):
    def ratio(a, b):
        return a / b if b else None
    return dict(tp=int(tp), fp=int(fp), fn=int(fn), tn=int(tn),
                precision=ratio(tp, tp + fp), recall=ratio(tp, tp + fn),
                f1=ratio(2 * tp, 2 * tp + fp + fn), n=int(tp + fp + fn + tn))


def seasonal_rules(dates, values, p50, p75, seasonal_p75):
    """Exact three-month complete probe; unavailable prerequisites remain unavailable."""
    dates = pd.DatetimeIndex(pd.to_datetime(dates))
    arrays = [np.asarray(v, dtype=float) for v in (values, p50, p75)]
    if (len(dates) != 3 or len(set(dates)) != 3 or
            not dates.equals(pd.date_range(dates[0], periods=3, freq="MS")) or
            any(len(v) != 3 or not np.isfinite(v).all() for v in arrays) or
            not np.isfinite(seasonal_p75)):
        return dict(eligible=False, reason="incomplete_probe_or_threshold", rule_a=None, rule_b=None, combined_flag=None)
    high = arrays[0] > arrays[2]
    a, b = bool(high.all()), bool(arrays[0].mean() > seasonal_p75)
    return dict(eligible=True, reason=None, rule_a=a, rule_b=b, combined_flag=a or b)


def paired_score(actual, predicted):
    actual, predicted = pd.Series(actual, dtype=float), pd.Series(predicted, dtype=float)
    valid = np.isfinite(actual) & np.isfinite(predicted)
    y, p = actual[valid], predicted[valid]
    err, nonzero = y - p, y.ne(0)
    return dict(MAE=float(err.abs().mean()) if len(y) else None,
                RMSE=float(np.sqrt((err ** 2).mean())) if len(y) else None,
                MAPE=float((err[nonzero] / y[nonzero]).abs().mean() * 100) if nonzero.any() else None,
                months=len(y), excluded_zero_actual=int((~nonzero).sum()),
                missing_targets=int((~valid).sum()), mape_denominator=int(nonzero.sum()))
