# Additional sources: current status

See docs/IMPLEMENTATION_WORKFLOW.md, docs/GAP_RULE_IMPLEMENTATION.md and docs/source_decisions.json.

- ILI remains provisional under the header/calendar interpretation, with eligible operational forecasts and separate research results.
- Leptospirosis now uses user-authorized provisional one-case-per-nonblank-source-record counting in every year. Classification labels are retained; numeric Cases/Deaths fields are not added to those counts. Fatality measures remain unresolved. The legacy unsupported aggregates are blocked by the new audit requirement.
- Hep A is displayed as Hepatitis A, keeping the internal Acute Viral Hepatitis ID. Its one-record counting rule and eligible forecasts remain provisional. Earlier reporting ends are preserved.
- ABD/Cholera/Typhoid/Hep A fill only internal gaps between existing regional reports under the user-relayed DOH zero-case rule. No leading/trailing periods or death zeros are invented.
- Heat remains 43 annual reference rows, 113 events, 1,275 cases and 20 deaths, without monthly forecasts.

The current local snapshots are versioned; source confirmation, interval calibration and shared deployment are separate evidence states. Primary All Illnesses and model-selection cohorts remain the four numeric-count diseases. Operational Prophet has not been replaced by the research winner.
