# Context Bridge

**The unified continuity system for OpenClaw.**

Ensures context persists across sessions, models, and time. Prevents "starting from zero" on every `/new`.

**Version:** 1.0  
**Created:** 2026-04-03

---

## Quick Start

### Installation

```bash
# 1. Install the skill
openclaw skills install https://github.com/loudmouthedmedia/context-bridge

# 2. Run setup to create registry files
cd ~/.openclaw/workspace/skills/context-bridge/scripts
./setup.sh

# 3. Update AGENTS.md (see below)
```

### Setup Script

The `setup.sh` script creates all required registry files:
- `~/.openclaw/skills-registry.json`
- `~/.openclaw/cron-registry.json`
- `~/.openclaw/skills-discovery.json`
- `~/.openclaw/model-agnostic-memory/model-handoff.md`
- `~/.openclaw/agents/defaults/session-start-hook.md`
- `~/.openclaw/scripts/load-context.sh`

---

## What It Does

**Before Context Bridge:**
```
You: /new
Model A: "Hello! How can I help?" [blank slate]
You: [re-explain everything]

You: /new  
Model B: "Hello! How can I help?" [blank slate again]
You: [re-explain everything again]
```

**After Context Bridge:**
```
You: /new
Model C: "📋 Continuity active. Previous model worked on X, Y is pending.
          Context loaded. Ready to continue."
```

---

## Components

### 1. Registries (The "What Exists")

| Registry | File | Tracks |
|----------|------|--------|
| **Skills** | `~/.openclaw/skills-registry.json` | All installed skills |
| **Crons** | `~/.openclaw/cron-registry.json` | Active scheduled jobs |
| **Agents** | `~/.openclaw/agents/*/agent.md` | Agent configurations |
| **Discovery** | `~/.openclaw/skills-discovery.json` | Skill capabilities |

### 2. Handoff Memory (The "What Happened")

**File:** `~/.openclaw/model-agnostic-memory/model-handoff.md`

- Session-to-session context
- What previous models did
- Active projects
- Recent actions

### 3. SOPs (The "Rules")

**Documentation:** `~/.openclaw/workspace/notes/openclaw-reliability-issues.md` (Issue #9)

- File responsibility assignments
- Before-adding-content checklist
- Cross-reference comments

---

## Session Startup Protocol

**Required by AGENTS.md:**

```
1. Read SOUL.md
2. Read USER.md  
3. Read memory files
4. READ CONTEXT BRIDGE FILES:
   - ~/.openclaw/skills-discovery.json
   - ~/.openclaw/model-agnostic-memory/model-handoff.md
   - ~/.openclaw/cron-registry.json
   - ~/.openclaw/skills-registry.json
5. ACKNOWLEDGE context in first response
```

---

## File Responsibilities (SOP)

| File | Responsibility | Must NOT |
|------|----------------|----------|
| AGENTS.md | Session startup rules | Periodic checks |
| HEARTBEAT.md | Periodic health checks | Session setup |
| SOUL.md | Personality/vibe | Technical instructions |
| Context Bridge | Registries & discovery | Implementation |

---

## Usage

### Automatic
On `/new` or model switch: Registries auto-load via AGENTS.md

### Manual Fallback
If needed, say: `load context`

### Update Workflow
When adding skills/crons/agents:
1. Update appropriate registry
2. Update discovery (if new capabilities)
3. Update handoff (log the change)
4. Git commit

### Cron Creation and Maintenance Protocol
When creating or modifying cron jobs, include these actions every time:
1. Check for an existing canonical job before adding a new one. Do not create a second active job that performs the same function on a similar schedule.
2. Prefer script-first cron design. The cron should call one stable script or narrowly-scoped workflow, not rely on open-ended agent improvisation when a script can do the job.
3. Set explicit delivery rules for any job that announces externally. Do not rely on ambiguous default channels when multiple channels are configured.
4. Immediately update `~/.openclaw/cron-registry.json` after cron creation, disablement, replacement, or major behavior change.
5. Mark replacements clearly in the registry and in memory so future sessions can see which job is canonical and which jobs were retired.
6. During cleanup passes, disable duplicate legacy jobs and prune stale one-off jobs that are no longer operationally useful.
7. Preserve meaningful audit history in memory, but keep the active cron surface small, canonical, and easy to inspect.

### Required Cron Hygiene Actions
For any cron maintenance pass, include this checklist:
- identify duplicate active jobs
- identify stale disabled one-off jobs
- keep one canonical active job per responsibility
- update `~/.openclaw/cron-registry.json`
- log the cleanup in workspace memory

---

## Why "Context Bridge"?

- **Context** = What the model knows
- **Bridge** = Connection between isolated sessions/Models

Builds bridges across the memory gap.