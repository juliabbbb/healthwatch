"""Fixed-origin point forecast adapters matching the frozen research protocol."""
from pathlib import Path
import os
import subprocess
import numpy as np
import pandas as pd

MODELS = ('Seasonal Naive', 'Prophet', 'SARIMAX', 'Random Forest WEKA')


def wet(dates):
    return np.array([int(6 <= d.month <= 11) for d in dates])


class ModelAdapters:
    def __init__(self, output, weka_jar=None):
        self.output = Path(output).resolve(); self.output.mkdir(parents=True, exist_ok=True)
        self.jar = Path(weka_jar or os.environ.get('WEKA_JAR', ''))
        self.server = None; self.error_log = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        if self.server:
            try:
                self.server.stdin.write('STOP\n'); self.server.stdin.flush()
                self.server.communicate(timeout=30)
            except (BrokenPipeError, subprocess.TimeoutExpired):
                self.server.kill(); self.server.communicate()
        if self.error_log: self.error_log.close()

    def _weka(self, train, dates, job):
        if not self.jar.is_file(): raise ValueError('WEKA_JAR must name the installed WEKA jar')
        if self.server is None:
            source = Path(__file__).resolve().parent.parent/'tools/weka/WekaForecastServer.java'
            subprocess.run(['javac','-cp',str(self.jar),'-d',str(self.output),str(source)],check=True,capture_output=True,text=True)
            self.error_log=(self.output/'server_stderr.log').open('w',encoding='utf-8')
            self.server=subprocess.Popen(['java','--add-opens','java.base/java.lang=ALL-UNNAMED','-cp',str(self.jar)+os.pathsep+str(self.output),'WekaForecastServer'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=self.error_log,text=True,bufsize=1)
            (self.output/'version.txt').write_text(self.server.stdout.readline(),encoding='utf-8')
        paths=[self.output/f'{job}_{suffix}' for suffix in ['train.csv','predictions.csv','train.arff','test.arff']]
        train.rename_axis('date').reset_index(name='cases').to_csv(paths[0],index=False)
        self.server.stdin.write('\t'.join(map(str,paths))+'\n');self.server.stdin.flush()
        while True:
            response=self.server.stdout.readline()
            if not response or response.startswith('ERROR|'): raise RuntimeError('WEKA failure: '+response)
            if response.startswith('DONE|'): break
        frame=pd.read_csv(paths[1],parse_dates=['target_date'])
        if list(frame.target_date)!=list(dates): raise ValueError('WEKA target mismatch')
        return frame.yhat.to_numpy(), dict(implementation='WEKA',train_arff=paths[2].name,test_arff=paths[3].name)

    def predict(self, model, train, dates, job='job'):
        dates=pd.DatetimeIndex(dates);train=train.astype(float)
        if not train.index.is_unique or not train.index.is_monotonic_increasing: raise ValueError('Training index must be ordered and unique')
        if len(dates)!=12 or not dates.equals(pd.date_range(train.index[-1]+pd.offsets.MonthBegin(1),periods=12,freq='MS')): raise ValueError('Expected exact twelve-month fixed-origin target calendar')
        if train.notna().sum()<24: raise ValueError('Fewer than 24 observed training months')
        info={}
        if model=='Seasonal Naive': pred=train.reindex(dates-pd.DateOffset(years=1)).to_numpy()
        elif model=='Prophet':
            from prophet import Prophet
            tr=pd.DataFrame(dict(ds=train.index,y=train.values,is_wet_season=wet(train.index))).dropna()
            fit=Prophet(yearly_seasonality=False,weekly_seasonality=False,daily_seasonality=False,seasonality_mode='multiplicative',uncertainty_samples=0)
            fit.add_regressor('is_wet_season');fit.fit(tr,seed=2026)
            pred=fit.predict(pd.DataFrame(dict(ds=dates,is_wet_season=wet(dates)))).yhat.to_numpy()
        elif model=='SARIMAX':
            from statsmodels.tsa.statespace.sarimax import SARIMAX
            fit=SARIMAX(train,exog=wet(train.index).reshape(-1,1),order=(1,0,0),seasonal_order=(1,0,0,12),trend='c',enforce_stationarity=True,enforce_invertibility=True).fit(disp=False,maxiter=200)
            info['converged']=bool(fit.mle_retvals.get('converged',False))
            if not info['converged']: raise ValueError('SARIMAX optimization did not converge')
            pred=np.asarray(fit.get_forecast(steps=12,exog=wet(dates).reshape(-1,1)).predicted_mean)
        elif model=='Random Forest WEKA': pred,info=self._weka(train,dates,job)
        else: raise ValueError(f'Unknown model: {model}')
        return np.clip(pred,0,None),info
