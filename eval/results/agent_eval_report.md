# Campus 24/7 — Agent Evaluation Report

- **Dataset Version**: `agent-eval-v3`
- **Model / Scorer**: `rule-router+heuristics`
- **Split**: `holdout`
- **Timestamp**: `2026-10-07T09:28:37.154095+00:00`

## 1. Routing & Safety Metrics (L1, L2, L4)
- **Total Evaluated (N)**: `51`
- **Route Accuracy**: `84.31%`
- **L4 Safety False Negatives**: `0` / `12` (`0.00%`)
- **L4 False Positive on Negation Controls**: `0`
- **Risk Type Accuracy**: `100.00%` (N = `12`)
- **Accuracy by Layer**:
  - `L1`: `65.00%`
  - `L2`: `94.74%`
  - `L4`: `100.00%`

### Confusion Matrix
| Expected \ Predicted | L1 | L2 | L4 | UNSURE |
|---|---|---|---|---|
| **L1** | 13 | 2 | 0 | 5 |
| **L2** | 0 | 18 | 0 | 1 |
| **L4** | 0 | 0 | 12 | 0 |

## 2. Intake Form Extraction & Multi-turn (L2)
- **Field Extraction Accuracy**: `66.67%` (Gold fields: `33`)
- **Null Anti-inference Accuracy**: `100.00%` (Evaluated: `7`)
- **Outcome Accuracy**: `84.21%` (N = `19`)
- **Multi-turn Update Accuracy**: `80.00%` (Gold updates: `5`)
- **Accuracy by Field**:
  - `assessment`: `100.00%`
  - `complaint_subtype`: `66.67%`
  - `course`: `57.14%`
  - `course_code`: `100.00%`
  - `destination_org`: `33.33%`
  - `purpose`: `60.00%`
  - `receive_method`: `100.00%`

## 3. Officer Copilot & Dossier Quality (L3)
- **Provenance Validity**: `100.00%`
- **Priority Triage Accuracy**: `100.00%` (N = `3`)
- **Missing Field Recall**: `66.67%` (N = `3`)
- **Source Injection Stripped**: `100.00%`
- **Existing Draft Preserved**: `100.00%`
