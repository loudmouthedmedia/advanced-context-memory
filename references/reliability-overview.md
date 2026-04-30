# Reliability Playbooks

Use these playbooks when the failure is operational and repeatable rather than task-specific.

## Purpose

This layer helps Context Bridge carry forward:
- failure pattern recognition
- correct cause classification
- safe first-response remediation
- rollout-vs-runtime drift awareness

## Operating rules

1. Classify the failure before changing config.
2. Separate **job failure** from **delivery failure**.
3. Prefer reversible mitigations first.
4. If a live mitigation is applied, also note whether a source-level fix still needs deployment.
5. When a failure recurs, compare:
   - workspace source patch state
   - live installed runtime state
   - current config state

## Current playbooks

- `signal-timeouts.md`
- `cron-delivery-vs-job-failure.md`
- `runtime-drift.md`

## Helper script

For quick deterministic triage, run:

```bash
node ~/.openclaw/workspace/skills/context-bridge/scripts/classify-operational-failure.mjs "<error text>"
```

Use it as a classifier, not as a replacement for reading logs.