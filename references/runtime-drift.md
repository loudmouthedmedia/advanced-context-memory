# Playbook: Runtime drift

## Problem

OpenClaw can have three different truths at once:
- workspace source code
- globally installed live runtime
- current config/state files

That drift causes "I fixed it, but production still behaves the old way" failures.

## Check in this order

1. Is the source patched in the workspace?
2. Is the running gateway using that patched code, or an older global install?
3. Is config mitigating the issue already?
4. Was the service restarted after the change?

## Common symptoms

- code fix exists locally but behavior unchanged
- config change works but root bug remains
- old session/runtime behavior survives after source edits

## Response pattern

1. apply the smallest safe live mitigation
2. document whether a source fix exists
3. deploy/restart the live runtime when appropriate
4. verify behavior after rollout

## Key rule

Never describe a workspace patch as fully fixed until the live runtime path is verified.