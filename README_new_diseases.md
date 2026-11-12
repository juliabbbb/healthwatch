# Additional sources: current status

See [the current workflow](docs/IMPLEMENTATION_WORKFLOW.md) and source_registry.py.

- ILI header reversal/calendar is provisional, not source-confirmed. Ingestion now preserves source row alignment and missing reports; absent deaths are unavailable.
- Leptospirosis yearly layouts remain unresolved. The numeric field labeled Deaths must not be treated as cases outside 2023. Old derived monthly files are legacy/unverified and excluded from loading and serving. The importer refuses to generate totals.
- Heat has 43 annual reference rows, 113 events, 1,275 cases and 20 deaths. It has no supplied monthly forecasting series. Forty-three is the row count, not the event total.
- Hep A counting/label is provisional and operational forecasts are disabled.

The historical-only/reference flags do not establish source confirmation. Use new offline output directories and verified manifests; no shared database rebuild follows automatically. The four-model comparison is separately exposed as research, with operational Prophet unchanged.
