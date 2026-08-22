import sys
from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt
from statsmodels.tsa.seasonal import STL

sys.path.insert(0, str(Path().resolve()))
from src import ingest, features

pd.set_option("display.max_columns", None)

raw = ingest.make_demo_data()
clean_df = ingest.clean(raw)
weekly = ingest.to_weekly(clean_df)
path = ingest.save_processed(weekly, "demo_dengue_weekly.csv")
print(f"Saved {len(weekly)} rows -> {path}")
weekly.head()

ncr = weekly[weekly["region"] == "NCR"].set_index("date")["cases"]
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
ax = profile.plot(figsize=(11, 4), title="Average cases by ISO week (NCR), wet season Jun-Nov")
ax.axvspan(23, 44, color="tab:blue", alpha=0.15)
plt.show()

featured = features.build_features(weekly)
featured.tail()
