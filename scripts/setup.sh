#!/bin/bash
# Context Bridge Setup Script
# Creates and populates all required registry files

set -e

echo "=== Context Bridge Setup ==="
echo ""

# Create directories
echo "Creating directories..."
mkdir -p ~/.openclaw/model-agnostic-memory
mkdir -p ~/.openclaw/agents/defaults
mkdir -p ~/.openclaw/workspace/skills
mkdir -p ~/.openclaw/scripts

# Create skills-registry.json if missing
echo "Creating skills-registry.json..."
if [ ! -f ~/.openclaw/skills-registry.json ]; then
cat > ~/.openclaw/skills-registry.json << 'EOF'
{
  "version": "1.0",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "skills": {},
  "missing": {},
  "rules": {
    "beforeCreatingSkill": [
      "Check this registry - does skill already exist?",
      "If exists: UPDATE existing, don't create duplicate",
      "If not exists: CREATE new, then ADD to this registry",
      "Use canonical naming: {agent}-{purpose}"
    ],
    "namingConvention": "lowercase-with-hyphens",
    "examples": [
      "marketing-ga4-reporter",
      "fleet-reporter",
      "systems-engineer"
    ]
  }
}
EOF
echo "  ✓ Created skills-registry.json"
else
    echo "  ✓ skills-registry.json already exists"
fi

# Create cron-registry.json if missing
echo "Creating cron-registry.json..."
if [ ! -f ~/.openclaw/cron-registry.json ]; then
cat > ~/.openclaw/cron-registry.json << 'EOF'
{
  "version": "1.0",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "crons": {},
  "rules": {
    "beforeCreatingCron": [
      "Check this registry for existing cron with same purpose/name",
      "If exists: UPDATE existing, don't create duplicate",
      "If not exists: CREATE new, then ADD to this registry",
      "Use canonical naming: {agent}-{purpose}"
    ],
    "namingConvention": "{agent-name}-{purpose-or-time}"
  }
}
EOF
echo "  ✓ Created cron-registry.json"
else
    echo "  ✓ cron-registry.json already exists"
fi

# Create skills-discovery.json if missing
echo "Creating skills-discovery.json..."
if [ ! -f ~/.openclaw/skills-discovery.json ]; then
cat > ~/.openclaw/skills-discovery.json << 'EOF'
{
  "version": "1.0",
  "lastUpdated": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "discoveryMethod": "Auto-loaded on session start",
  "skills": [],
  "usageInstructions": {
    "forModels": "On session start, read this file and acknowledge available skills",
    "forUsers": "Say 'what skills do we have' to see current capabilities",
    "forSetup": "Skills marked 'setupRequired: true' need configuration before use"
  }
}
EOF
echo "  ✓ Created skills-discovery.json"
else
    echo "  ✓ skills-discovery.json already exists"
fi

# Create model-handoff.md if missing
echo "Creating model-handoff.md..."
if [ ! -f ~/.openclaw/model-agnostic-memory/model-handoff.md ]; then
cat > ~/.openclaw/model-agnostic-memory/model-handoff.md << 'EOF'
# Model Handoff Log

**Purpose:** Track context between model sessions to prevent "starting from zero"

---

## Latest Session

**Model:** (current model)  
**Started:** (timestamp)  
**Previous Model:** (previous model)

**Context:**
- (Add context here)

**Active Projects:**
- (Add projects here)

**Recent Actions:**
- (Add actions here)

---

## How to Update

After each session, append:
```
### TIMESTAMP - MODEL_NAME
**Actions:**
- What was done

**Context for next model:**
- What they should know
```

EOF
echo "  ✓ Created model-handoff.md"
else
    echo "  ✓ model-handoff.md already exists"
fi

# Create session-start-hook.md if missing
echo "Creating session-start-hook.md..."
if [ ! -f ~/.openclaw/agents/defaults/session-start-hook.md ]; then
cat > ~/.openclaw/agents/defaults/session-start-hook.md << 'EOF'
# Session Start Hook

**Purpose:** Auto-load shared context on every session start

---

## Auto-Load Sequence

On EVERY session start (`/new`, model switch, restart):

1. READ: ~/.openclaw/skills-discovery.json
2. READ: ~/.openclaw/model-agnostic-memory/model-handoff.md
3. READ: ~/.openclaw/cron-registry.json
4. READ: ~/.openclaw/skills-registry.json
5. CHECK: Recent memory files

## Output Format

If loaded successfully:
```
[Context Loaded]
📧 Skills available: (list)
🔁 Crons active: (count)
📋 Projects: (active)

Ready.
```

If auto-load FAILS:
```
[Session Started]
⚠️ Auto-context load failed
📋 Manual load: Say "load context"

Ready.
```
EOF
echo "  ✓ Created session-start-hook.md"
else
    echo "  ✓ session-start-hook.md already exists"
fi

# Create load-context.sh if missing
echo "Creating load-context.sh..."
if [ ! -f ~/.openclaw/scripts/load-context.sh ]; then
cat > ~/.openclaw/scripts/load-context.sh << 'EOF'
#!/bin/bash
# load-context.sh - Manual context loader

echo "=== Loading Session Context ==="
echo ""

echo "1. Skills Discovery..."
cat ~/.openclaw/skills-discovery.json 2>/dev/null | jq '.skills[].id' 2>/dev/null || echo "  (discovery file empty)"

echo ""
echo "2. Model Handoff..."
cat ~/.openclaw/model-agnostic-memory/model-handoff.md 2>/dev/null | head -30 || echo "  (handoff file empty)"

echo ""
echo "3. Active Crons..."
cat ~/.openclaw/cron-registry.json 2>/dev/null | jq '.crons | keys' 2>/dev/null || echo "  (cron registry empty)"

echo ""
echo "4. Installed Skills..."
cat ~/.openclaw/skills-registry.json 2>/dev/null | jq '.skills | keys' 2>/dev/null || echo "  (skills registry empty)"

echo ""
echo "=== Context Loaded ==="
EOF
chmod +x ~/.openclaw/scripts/load-context.sh
echo "  ✓ Created load-context.sh"
else
    echo "  ✓ load-context.sh already exists"
fi

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Registry files initialized."
echo ""
echo "Next steps:"
echo "1. Populate registries with your existing skills/crons"
echo "2. Update AGENTS.md to require Context Bridge files on startup"
echo "3. Test with: ~/.openclaw/scripts/load-context.sh"
echo ""
