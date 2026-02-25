---
phase: 10-opsai-intelligence
plan: 02
status: complete
completed: 2026-02-25
---

# 10-02 Summary: Proactive Intelligence Engine & Alert Endpoints

## What was built

### 1. ProactiveEngine (`python-backend/app/utils/proactive_engine.py`)

Core class providing five detection methods plus AI-powered summaries:

| Method | Detection | Severity Logic |
|---|---|---|
| `detect_over_servicing()` | Clients with high billable hours but low ZAR/Hr (30-day window) | High if ZAR/Hr < 50% of threshold |
| `detect_utilization_drops()` | Current week vs 4-week rolling average, flags >15% drop | High if drop > 2x threshold |
| `detect_cash_alerts()` | Latest financial snapshot: low cash, high AR, AP outstanding | High if cash < 50% of warning level |
| `detect_scope_creep()` | Tasks with hours > 1.5x average and 10+ time log entries | High if hours > 3x average |
| `detect_deadline_risks()` | Non-done tasks within 3 days of due date or overdue | High if overdue or high/urgent priority |

Additional methods:
- `run_all_checks()` — executes all five detections, returns combined alerts sorted by severity with summary counts and `checked_at` timestamp.
- `generate_insight_summary(alerts)` — uses OpenAI (gpt-4o-mini) to produce a CEO briefing; falls back to rule-based summary if OpenAI is unavailable.
- `_load_thresholds()` — loads configurable thresholds from Firestore `opsai_config/thresholds` with sensible defaults.

### 2. Alert endpoints added to `python-backend/app/api/opsai.py`

| Endpoint | Method | Auth | Description |
|---|---|---|---|
| `/opsai/alerts` | GET | Any authenticated user | Runs all proactive checks, returns alerts |
| `/opsai/alerts/summary` | GET | Any authenticated user | Runs checks + generates AI executive summary |
| `/opsai/alerts/configure` | POST | CEO only | Save threshold overrides to Firestore `opsai_config` |

### Default thresholds (configurable via `/alerts/configure`)

```python
{
    "over_servicing_zar_hr_min": 350.0,
    "over_servicing_hours_min": 20.0,
    "utilization_drop_pct": 15.0,
    "cash_warning_level": 50000.0,
    "ar_warning_level": 100000.0,
    "ap_due_days": 7,
    "scope_creep_hours_multiplier": 1.5,
    "scope_creep_min_logs": 10,
    "deadline_risk_days": 3,
}
```

## Files modified

- `python-backend/app/utils/proactive_engine.py` — **created** (ProactiveEngine class)
- `python-backend/app/api/opsai.py` — **modified** (added alert imports, schemas, helper, 3 endpoints)

## Verification

```
cd python-backend && python3 -c "from app.utils.proactive_engine import ProactiveEngine; print('OK')"
# Output: OK
```

## Design decisions

- **Graceful degradation**: Every detection method catches exceptions internally and returns an empty list on failure, so a single data source error does not block other checks.
- **Missing key handling**: `.get()` with defaults used throughout; no `KeyError` can propagate.
- **OpenAI optional**: Engine works without OpenAI — `generate_insight_summary` falls back to a rule-based summary.
- **CEO-only config**: The `/alerts/configure` endpoint uses `require_ceo` dependency to restrict threshold changes to the CEO role.
- **Firestore merge**: Threshold config uses `set(..., merge=True)` so partial updates preserve existing values.
