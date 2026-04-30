# Playbook: Signal timeouts

## Pattern

Examples:
- `Signal HTTP exceeded deadline after 10000ms`
- Signal RPC deadline/timeout errors during outbound delivery

## What it usually means

This is usually a **delivery-path timeout**, not proof that the underlying cron/job logic failed.

## First checks

1. Check whether the job payload finished and produced output.
2. Check Signal daemon responsiveness.
3. Check `channels.signal.timeoutMs`.
4. Check whether the running gateway/runtime includes the latest Signal timeout fixes.

## Safe mitigations

1. Increase `channels.signal.timeoutMs` to a conservative value like `30000`.
2. Restart the gateway if config reload/restart is required.
3. If the workspace source is patched but the live install is older, deploy/restart the live build.

## Avoid

- Do not immediately rewrite the cron payload.
- Do not assume the script itself failed.
- Do not keep retrying without distinguishing delivery from execution.

## Durable fix checklist

- config mitigation applied
- source-level timeout/default fix applied if needed
- live runtime confirmed to be using the fixed build
- failure classification logged for future sessions