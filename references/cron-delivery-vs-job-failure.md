# Playbook: Cron delivery failure vs job failure

## Goal

Prevent misdiagnosing a finished cron job as broken when only the outbound announcement failed.

## Decision rule

### Treat as **job failure** when:
- the payload command/script/model run fails
- the cron run output contains the real task error
- no successful task result was produced

### Treat as **delivery failure** when:
- the task completed but the announce/send step failed
- the error mentions Signal/Telegram/Slack/iMessage transport deadlines or send errors
- the failure occurs after output was already generated

## Investigation order

1. Inspect the cron job definition.
2. Inspect the cron run result/output.
3. Inspect channel delivery logs.
4. Only then decide whether to edit the cron itself.

## Safe actions

- If delivery failure: tune channel/runtime delivery path first.
- If job failure: fix the payload/script/auth/runtime dependency.
- If mixed: split the remediation and avoid one giant speculative change.

## Memory to preserve

When resolved, log:
- which part failed (job vs delivery)
- exact error text
- mitigation applied
- whether live runtime still needed rollout