import sys
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt
from statsmodels.tsa.seasonal import STL

sys.path.insert(0, str(Path().resolve()))
from src import features, ingest

pd.set_option("display.max_columns", None)

national_path = ingest.PROCESSED_DIR / "national_weekly.csv"
if not national_path.exists():
    raise FileNotFoundError("Run: .venv\\Scripts\\python -m src.national_ingest")

weekly = pd.read_csv(national_path, parse_dates=["date"])
weekly.head()

ncr = weekly.set_index("date")["cases"]
stl = STL(ncr, period=52, robust=True).fit()
fig = stl.plot()
fig.set_size_inches(10, 8)
plt.tight_layout()
plt.show()

profile = (
    ncr.to_frame("cases")
    .assign(iso_week=lambda d: d.index.isocalendar().week)
    .groupby("iso_week")["cases"]
    .mean()
)
ax = profile.plot(figsize=(11, 4), title="Average dengue cases by ISO week (National), wet season Jun-Nov")
ax.axvspan(23, 44, color="tab:blue", alpha=0.15)
plt.show()

featured = features.build_features(weekly)
featured.tail()
