"""Feature engineering for the monthly pipeline.

Season flags stay calendar-month based (wet = Jun-Nov) — months never split
across seasons. Lag features reference the monthly natural lags (1 = last
month, 12 = same month last year) and rolling windows are months.
"""

import pandas as pd

WET_SEASON_MONTHS = (6, 7, 8, 9, 10, 11)


def add_season_flags(df, date_col="date"):
    out = df.copy()
    month = pd.to_datetime(out[date_col]).dt.month
    out["month"] = month
    out["is_wet_season"] = month.isin(WET_SEASON_MONTHS).astype(int)
    return out


def add_lag_features(df, lags=(1, 12), value_col="cases"):
    out = df.sort_values(["disease", "region", "date"], ignore_index=True)
    grouped = out.groupby(["disease", "region"], sort=False)[value_col]
    for lag in lags:
        out[f"{value_col}_lag_{lag}"] = grouped.shift(lag)
    return out


def add_rolling_features(df, windows=(3,), value_col="cases"):
    out = df.sort_values(["disease", "region", "date"], ignore_index=True)
    grouped = out.groupby(["disease", "region"], sort=False)[value_col]
    for w in windows:
        out[f"{value_col}_roll_mean_{w}"] = grouped.transform(
            lambda s: s.shift(1).rolling(w).mean()
        )
    return out


def clip_non_negative(df, cols=None):
    out = df.copy()
    if cols is None:
        cols = [
            c
            for c in out.select_dtypes("number").columns
            if c.startswith(("cases", "pred"))
        ]
    out[cols] = out[cols].clip(lower=0)
    return out


def build_features(df):
    out = add_season_flags(df)
    out = add_lag_features(out)
    out = add_rolling_features(out)
    out = clip_non_negative(out)
    return out