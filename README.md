# HEALTHWATCH

Regional time-series analysis system for seasonal illness outbreak prediction and hotspot classification.
Capstone project, PLM BSIT — Dela Cruz, Santiago, Villanueva.

## Setup

```powershell
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```

## Week 1 pipeline

```powershell
.venv\Scripts\python notebooks\week1_pipeline.py
```

Runs on synthetic dengue-like demo data until real DOH/Mendeley CSVs are placed in `data/raw/`.

## Structure

| Path | Purpose |
|---|---|
| `data/raw/` | Untouched DOH / Mendeley downloads |
| `data/processed/` | Cleaned weekly series (modeling input) |
| `src/ingest.py` | Column alias matching, cleaning, weekly resample, demo data |
| `src/features.py` | Wet/dry season flags, lag + rolling features, non-negativity clipping |
| `notebooks/week1_pipeline.py` | Ingest -> STL decomposition -> seasonal profile -> feature preview |

## Locked scope

- Prediction: Prophet only
- Risk classes: percentile thresholds (<50 Low, 50–75 Moderate, >75 High)
- Rules: deterministic post-processing only
- Dashboard: Streamlit · Map: Folium + PSGC GeoJSON (table fallback)
- API: FastAPI `/forecast`, `/risk-classification`
