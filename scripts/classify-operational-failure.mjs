#!/usr/bin/env node
import fs from "node:fs";

function loadInput() {
  const arg = process.argv.slice(2).join(" ").trim();
  if (arg) return arg;
  try {
    const stdin = fs.readFileSync(0, "utf8").trim();
    return stdin;
  } catch {
    return "";
  }
}

function classify(text) {
  const lower = text.toLowerCase();

  if (lower.includes("signal http exceeded deadline") || lower.includes("signal rpc") && lower.includes("deadline")) {
    return {
      category: "signal-delivery-timeout",
      severity: "medium",
      kind: "delivery_failure",
      likelyCause: "Signal HTTP request timed out before outbound delivery completed.",
      firstChecks: [
        "Check channels.signal.timeoutMs and current Signal daemon responsiveness.",
        "Confirm the cron payload completed; do not assume the job logic failed.",
        "Check whether the running gateway build includes the latest Signal timeout fixes.",
      ],
    };
  }

  if (lower.includes("invalid_grant") || (lower.includes("freshbooks") && lower.includes("auth failed"))) {
    return {
      category: "auth-expired-or-revoked",
      severity: "high",
      kind: "credential_failure",
      likelyCause: "OAuth token or grant is expired, revoked, mismatched, or tied to the wrong callback/client.",
      firstChecks: [
        "Re-authenticate the integration rather than retrying blindly.",
        "Pause dependent automations until auth is healthy.",
        "Check the auth-decay-invalid-grant playbook for callback/client mismatch causes.",
      ],
    };
  }

  if (lower.includes("approval-pending") || lower.includes("allow-once")) {
    return {
      category: "exec-approval-regression",
      severity: "medium",
      kind: "execution_policy_failure",
      likelyCause: "Session-level or runtime-level exec policy drift is overriding permissive defaults.",
      firstChecks: [
        "Compare active session key versus expected canonical session key.",
        "Inspect per-session execHost/execSecurity/execAsk state before changing global config.",
      ],
    };
  }

  return {
    category: "unknown",
    severity: "unknown",
    kind: "unknown",
    likelyCause: "No known failure pattern matched.",
    firstChecks: [
      "Capture the exact error text and surrounding log lines.",
      "Separate job execution failure from outbound delivery failure.",
    ],
  };
}

const input = loadInput();
if (!input) {
  console.error("Provide error text as an argument or via stdin.");
  process.exit(1);
}

console.log(JSON.stringify(classify(input), null, 2));
