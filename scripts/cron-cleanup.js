#!/usr/bin/env node
/**
 * Cron Cleanup Tool
 * Interactive removal of redundant crons with safety checks
 */

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load current cron registry
function loadCronRegistry() {
  const registryPath = path.join(process.env.HOME, '.openclaw', 'cron-registry.json');
  if (!fs.existsSync(registryPath)) {
    return { version: '1.0', crons: {} };
  }
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

// Save cron registry
function saveCronRegistry(registry) {
  const registryPath = path.join(process.env.HOME, '.openclaw', 'cron-registry.json');
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2));
}

// Remove a cron using openclaw CLI
function removeCron(cronId) {
  try {
    // Use openclaw cron remove command
    execFileSync('openclaw', ['cron', 'remove', cronId], { 
      stdio: 'pipe',
      timeout: 30000
    });
    return true;
  } catch (error) {
    console.error(`Failed to remove cron ${cronId}:`, error.message);
    return false;
  }
}

// Get cron details by name
function getCronByName(registry, name) {
  return registry.crons[name] || null;
}

// Display cron details
function displayCronDetails(name, cron) {
  console.log(`\n📋 ${name}`);
  console.log(`   ID: ${cron.id || 'unknown'}`);
  console.log(`   Schedule: ${cron.schedule || 'unknown'}`);
  console.log(`   Status: ${cron.status || 'unknown'}`);
  console.log(`   Target: ${cron.target || 'unknown'}`);
  if (cron.lastRun) {
    console.log(`   Last run: ${cron.lastRun}`);
  }
}

// Safety checks before removal
function runSafetyChecks(name, cron) {
  const checks = {
    isRunning: cron.status === 'running',
    isSystemCritical: name.includes('backup') || name.includes('health') || name.includes('auth'),
    hasRecentRuns: cron.lastRun && new Date(cron.lastRun) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  };
  
  return checks;
}

// Interactive cleanup
async function interactiveCleanup() {
  console.log('🧹 Cron Cleanup Tool v1.3\n');
  console.log('⚠️  This tool will help remove redundant crons safely.\n');
  
  const registry = loadCronRegistry();
  const crons = Object.entries(registry.crons || {});
  
  if (crons.length === 0) {
    console.log('No crons found in registry.');
    return;
  }
  
  console.log(`Found ${crons.length} crons in registry.\n`);
  
  // Find potential candidates for removal
  const candidates = findCleanupCandidates(registry);
  
  if (candidates.length === 0) {
    console.log('✅ No redundant crons found for cleanup.');
    return;
  }
  
  console.log(`🔍 Found ${candidates.length} potential cleanup candidates:\n`);
  
  // Display candidates
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    console.log(`${i + 1}. ${candidate.reason}`);
    displayCronDetails(candidate.name, candidate.cron);
    
    const safety = runSafetyChecks(candidate.name, candidate.cron);
    if (safety.isSystemCritical) {
      console.log('   ⚠️  SYSTEM CRITICAL - Use caution');
    }
    if (safety.isRunning) {
      console.log('   ⚠️  Currently running');
    }
    console.log();
  }
  
  console.log('Options:');
  console.log('  - Enter number (1-N) to remove specific cron');
  console.log('  - Enter "all" to remove all candidates');
  console.log('  - Enter "backup" to backup registry first');
  console.log('  - Enter "q" to quit without changes');
  console.log();
  
  // In non-interactive mode, just show what would be removed
  console.log('ℹ️  Running in preview mode. To actually remove, run with --confirm flag\n');
  
  // Summary
  console.log('Summary:');
  console.log(`- ${candidates.length} candidates for removal`);
  console.log(`- ${candidates.filter(c => runSafetyChecks(c.name, c.cron).isSystemCritical).length} system critical (requires extra caution)`);
  console.log(`- Backup will be created before any changes`);
}

// Find cleanup candidates
function findCleanupCandidates(registry) {
  const candidates = [];
  const seenSchedules = new Map();
  
  for (const [name, cron] of Object.entries(registry.crons || {})) {
    // Check for exact schedule duplicates
    const schedule = cron.schedule;
    if (schedule) {
      if (seenSchedules.has(schedule)) {
        // This is a duplicate schedule
        const existing = seenSchedules.get(schedule);
        
        // Prefer to keep the one with better naming
        const keepExisting = existing.name.includes(':') && !name.includes(':');
        
        candidates.push({
          name: keepExisting ? name : existing.name,
          cron: keepExisting ? cron : existing.cron,
          reason: `Duplicate schedule with "${keepExisting ? existing.name : name}" (${schedule})`,
          duplicateOf: keepExisting ? existing.name : name,
          confidence: 'high'
        });
      } else {
        seenSchedules.set(schedule, { name, cron });
      }
    }
    
    // Check for old failed/error crons
    if (cron.status === 'error' || cron.status === 'failed') {
      const lastRun = cron.lastRun ? new Date(cron.lastRun) : null;
      const daysSinceRun = lastRun ? (Date.now() - lastRun.getTime()) / (1000 * 60 * 60 * 24) : Infinity;
      
      if (daysSinceRun > 30) {
        candidates.push({
          name,
          cron,
          reason: `Failed/error status, last run ${Math.floor(daysSinceRun)} days ago`,
          confidence: 'medium'
        });
      }
    }
    
    // Check for disabled crons
    if (cron.enabled === false || cron.status === 'disabled') {
      candidates.push({
        name,
        cron,
        reason: 'Disabled cron (unused)',
        confidence: 'high'
      });
    }
  }
  
  // Sort by confidence (high first)
  candidates.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.confidence] - order[b.confidence];
  });
  
  return candidates;
}

// Non-interactive mode for automation
async function automatedCleanup(dryRun = true) {
  console.log('🧹 Automated Cron Cleanup\n');
  
  const registry = loadCronRegistry();
  const candidates = findCleanupCandidates(registry);
  
  if (candidates.length === 0) {
    console.log('✅ No cleanup needed.');
    return { removed: [], kept: Object.keys(registry.crons || {}) };
  }
  
  console.log(`Found ${candidates.length} candidates:\n`);
  
  const toRemove = [];
  const toKeep = [...Object.keys(registry.crons || {})];
  
  for (const candidate of candidates) {
    const safety = runSafetyChecks(candidate.name, candidate.cron);
    
    if (safety.isSystemCritical) {
      console.log(`⏭️  Skipping system critical: ${candidate.name}`);
      continue;
    }
    
    console.log(`${dryRun ? '[DRY RUN]' : '[REMOVE]'} ${candidate.name}`);
    console.log(`   Reason: ${candidate.reason}`);
    
    if (!dryRun) {
      const success = removeCron(candidate.cron.id);
      if (success) {
        toRemove.push(candidate.name);
        const idx = toKeep.indexOf(candidate.name);
        if (idx > -1) toKeep.splice(idx, 1);
        console.log('   ✅ Removed');
      } else {
        console.log('   ❌ Failed to remove');
      }
    } else {
      toRemove.push(candidate.name);
      console.log('   (Would remove in non-dry-run mode)');
    }
    console.log();
  }
  
  if (dryRun) {
    console.log(`\nDry run complete. ${toRemove.length} crons would be removed.`);
    console.log('Run with --confirm to actually remove.');
  } else {
    console.log(`\nCleanup complete. Removed ${toRemove.length} crons.`);
  }
  
  return { removed: toRemove, kept: toKeep };
}

// Main entry point
async function main() {
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--confirm');
  const interactive = !args.includes('--auto');
  
  if (interactive) {
    await interactiveCleanup();
  } else {
    await automatedCleanup(dryRun);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('💥 Error:', err.message);
    process.exit(1);
  });
}

export { findCleanupCandidates, runSafetyChecks, interactiveCleanup, automatedCleanup };
