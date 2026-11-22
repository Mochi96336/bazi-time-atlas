# Year-26026 accepted orbital state

`.github/workflows/research-26026-seasonal.yml` reuses these files so that pull
requests do not re-project the orbit from the 1.5 GB DE441 kernel every time.

- `full-year-state.json` — output of `research-rebound-26026-full-year-state.py`
- `massloss-state.json` — output of `research-rebound-26026-massloss-state.py`
- `producers.txt` — `git ls-tree HEAD` of the producer scripts that made them

When a producer script changes, the workflow sees `producers.txt` no longer
match, rebuilds the state from DE441 and uploads it as an artifact
(`research-26026-timeline` / `research-26026-triage`). Commit the rebuilt
`state.json` / `result.json` here under the names above, together with the new
`producers.txt` from the same artifact.
