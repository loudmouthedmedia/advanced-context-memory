# Playbook: Auth decay / invalid_grant

## Pattern

Examples:
- `invalid_grant`
- `token refresh failed (400)`
- OAuth grant expired, revoked, mismatched redirect URI, or wrong client

## What it usually means

This is usually a **credential-state failure**, not a transient network issue.
Blind retries rarely fix it.

## First checks

1. Confirm which integration failed.
2. Check whether the token refresh path or callback/redirect URI changed.
3. Confirm whether the grant was revoked, expired, or issued for a different client.
4. Identify which cron/jobs depend on that auth and pause or downgrade them if needed.

## Safe mitigations

1. Mark the integration as blocked until re-auth completes.
2. Disable or quiet dependent cron jobs if they only generate noise while auth is broken.
3. Preserve the exact auth error text in memory/logs.
4. Re-authenticate with the canonical callback/client configuration.

## Avoid

- Do not treat this as a normal retryable timeout.
- Do not keep cron jobs spamming the same failure indefinitely.
- Do not rotate multiple related settings at once unless the root mismatch is clear.

## Durable fix checklist

- canonical auth path documented
- failing dependent jobs identified
- temporary cron behavior adjusted if needed
- successful re-auth verified
- note added describing why the grant failed