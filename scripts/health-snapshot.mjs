#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";

const args = new Set(process.argv.slice(2));
const fastMode = args.has("--fast");

function readJsonSafe(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function exists(file) {
  try {
    fs.accessSync(file);
    return true;
  } catch {
    return false;
  }
}

function cmd(command, cwd = process.cwd()) {
  try {
    return execSync(command, { cwd, stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
  } catch {
    return null;
  }
}

const home = os.homedir();
const workspace = path.join(home, ".openclaw", "workspace");
const configPath = path.join(home, ".openclaw", "openclaw.json");
const launchAgentPath = path.join(home, "Library", "LaunchAgents", "ai.openclaw.gateway.plist");

const config = readJsonSafe(configPath) || {};
const signal = config.channels?.signal || {};
const execCfg = config.tools?.exec || {};
const sessionCfg = config.session || {};

const gatewayStatus = fastMode ? null : cmd("openclaw gateway status", workspace);
const gatewayCommandMatch = gatewayStatus?.match(/Command:\s+(.+)/);
const runtimePidMatch = gatewayStatus?.match(/Runtime: running \(pid (\d+)/);
const launchAgentCommand = (() => {
  try {
    const raw = fs.readFileSync(launchAgentPath);
    const plist = raw.toString("utf8");
    const match = plist.match(/<key>ProgramArguments<\/key>[\s\S]*?<array>([\s\S]*?)<\/array>/);
    if (!match) return null;
    const strings = [...match[1].matchAll(/<string>([\s\S]*?)<\/string>/g)].map((m) => m[1]);
    return strings.join(" ") || null;
  } catch {
    return null;
  }
})();
const fastListener = cmd("lsof -n -P -iTCP:18789 -sTCP:LISTEN | tail -n +2 | head -n 1");
const fastPid = fastListener?.trim().split(/\s+/)[1] || null;

const sourcePatched = cmd("git diff --name-only -- src/signal/client.ts src/signal/send.ts src/auto-reply/reply/session.ts", workspace);
const contextBridgeChanges = cmd("git -C skills/context-bridge status --short", workspace);

const snapshot = {
  generatedAt: new Date().toISOString(),
  workspace,
  configPath,
  launchAgentPath,
  gateway: {
    running: fastMode ? Boolean(fastListener) : Boolean(gatewayStatus && gatewayStatus.includes("Runtime: running")),
    pid: (fastMode ? fastPid : runtimePidMatch?.[1]) || null,
    command: (gatewayCommandMatch?.[1] || launchAgentCommand) || null,
    usesGlobalDist: Boolean(
      (gatewayCommandMatch?.[1] || launchAgentCommand)?.includes(
        "/opt/homebrew/lib/node_modules/openclaw/dist/index.js",
      ),
    ),
    mode: fastMode ? "fast" : "full",
  },
  config: {
    signalTimeoutMs: typeof signal.timeoutMs === "number" ? signal.timeoutMs : null,
    signalAccount: signal.account || null,
    execHost: execCfg.host || null,
    execSecurity: execCfg.security || null,
    execAsk: execCfg.ask || null,
    sessionDmScope: sessionCfg.dmScope || null,
    sessionScope: sessionCfg.scope || null,
  },
  drift: {
    signalSourcePatched: Boolean(sourcePatched),
    signalPatchedFiles: sourcePatched ? sourcePatched.split(/\n+/).filter(Boolean) : [],
    contextBridgeDirty: Boolean(contextBridgeChanges),
  },
  files: {
    configExists: exists(configPath),
    launchAgentExists: exists(launchAgentPath),
  },
};

console.log(JSON.stringify(snapshot, null, 2));
