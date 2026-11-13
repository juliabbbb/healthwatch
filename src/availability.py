"""Describe separate source, history and forecast availability without manufacturing zeros."""
import pandas as pd

REQUIRED_OBSERVED_MONTHS=24


def describe(history,forecasts,metadata):
    observed=history[history.cases.notna()] if 'cases' in history else history.iloc[:0]
    forecasts=forecasts[forecasts.yhat.notna()] if 'yhat' in forecasts else forecasts.iloc[:0]
    status=metadata.get('source_policy',{}).get('status',metadata.get('status','unknown'))
    enabled=metadata.get('forecast_available',False)
    count=len(observed)
    if not enabled or count<REQUIRED_OBSERVED_MONTHS:
        forecasts=forecasts.iloc[:0]
    def boundary(frame,column,which):
        return None if frame.empty else getattr(pd.to_datetime(frame[column]),which)().date().isoformat()
    first=boundary(observed,'date','min');last=boundary(observed,'date','max')
    if status=='reference_only':reason='annual_reference_only';message='Annual reference data only; no supplied monthly series.'
    elif status=='excluded_unresolved_measure':reason='unresolved_measure';message=metadata.get('unavailable_reason')
    elif not enabled:reason='source_confirmation_pending';message=metadata.get('unavailable_reason','Forecasting is not enabled for this source.')
    elif count<REQUIRED_OBSERVED_MONTHS:reason='insufficient_observed_history';message=f'{count} observed months; {REQUIRED_OBSERVED_MONTHS} required. Missing reports are not assumed zero.'
    elif forecasts.empty:reason='forecast_not_built';message='History is available, but this snapshot has no forecast for the region.'
    else:reason=None;message=None
    return dict(source_status=status,source_warning=metadata.get('source_warning'),
        history_available=bool(count),observed_months=count,required_observed_months=REQUIRED_OBSERVED_MONTHS,
        first_observed=first,last_observed=last,disease_forecast_enabled=enabled,
        zero_rule_months=int(observed.observation_status.eq('zero_by_user_relayed_DOH_rule').sum()) if 'observation_status' in observed else 0,
        forecast_available=bool(enabled and count>=REQUIRED_OBSERVED_MONTHS and not forecasts.empty),
        forecast_start=boundary(forecasts,'target_date','min'),forecast_end=boundary(forecasts,'target_date','max'),
        reason_code=reason,message=message)
