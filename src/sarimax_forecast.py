"""Frozen calendar SARIMAX with exact monthly dates and uncalibrated 80% intervals."""
from dataclasses import dataclass
import warnings
import numpy as np
import pandas as pd
from statsmodels.tsa.statespace.sarimax import SARIMAX

@dataclass
class Fitted:
    result: object
    origin: pd.Timestamp
    warnings: list

def wet(dates):
    return np.asarray([int(6<=d.month<=11) for d in dates],dtype=float).reshape(-1,1)

def fit(train,start_params=None):
    data=train[['ds','y']].copy().sort_values('ds')
    data['ds']=pd.to_datetime(data.ds)
    if data.empty or data.ds.duplicated().any() or not data.ds.dt.is_month_start.all():
        raise ValueError('SARIMAX requires unique month-start training dates')
    series=data.set_index('ds').y.astype(float).asfreq('MS')
    observed=series.dropna()
    if len(observed)<24:raise ValueError('Insufficient observed training history')
    if not np.isfinite(observed).all() or observed.lt(0).any():raise ValueError('Invalid training counts')
    if observed.eq(0).all():raise ValueError('All-zero series requires a separately declared deterministic method')
    with warnings.catch_warnings(record=True) as captured:
        warnings.simplefilter('always')
        options={} if start_params is None else {'start_params':np.asarray(start_params,dtype=float)}
        result=SARIMAX(series,exog=wet(series.index),order=(1,0,0),seasonal_order=(1,0,0,12),
                       trend='c',enforce_stationarity=True,enforce_invertibility=True).fit(disp=False,maxiter=200,**options)
    if not result.mle_retvals.get('converged',False):raise ValueError('SARIMAX optimization did not converge')
    if not np.isfinite(result.params).all():raise ValueError('Nonfinite SARIMAX parameters')
    return Fitted(result,series.index[-1],[str(w.message) for w in captured])

def predict(model,dates,include_intervals=True):
    requested=pd.DatetimeIndex(pd.to_datetime(dates))
    if requested.empty:return pd.DataFrame(columns=['ds','yhat','yhat_lower','yhat_upper'])
    if requested.has_duplicates or not requested.is_month_start.all() or not (requested>model.origin).all():
        raise ValueError('Requested dates must be unique month starts after training origin')
    calendar=pd.date_range(model.origin+pd.offsets.MonthBegin(1),requested.max(),freq='MS')
    fc=model.result.get_forecast(steps=len(calendar),exog=wet(calendar))
    point=np.asarray(fc.predicted_mean,dtype=float)
    if not np.isfinite(point).all():raise ValueError(f'Nonfinite SARIMAX point forecast at origin {model.origin}')
    if not include_intervals:
        return pd.DataFrame({'ds':calendar,'yhat':np.maximum(point,0)}).set_index('ds').loc[requested].rename_axis('ds').reset_index()
    bounds=np.asarray(fc.conf_int(alpha=.2),dtype=float)
    if not np.isfinite(bounds).all():raise ValueError(f'Nonfinite SARIMAX interval at origin {model.origin}')
    if not (bounds[:,0]<=bounds[:,1]).all():raise ValueError('Invalid SARIMAX interval')
    out=pd.DataFrame({'ds':calendar,'yhat':np.maximum(point,0),'yhat_lower':np.maximum(bounds[:,0],0),'yhat_upper':np.maximum(bounds[:,1],0)})
    return out.set_index('ds').loc[requested].rename_axis('ds').reset_index()
