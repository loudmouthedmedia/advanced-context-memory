#!/usr/bin/env node
/**
 * Cron Duplicate Detector
 * Advanced duplicate detection beyond same-schedule matching
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

// Load taxonomy rules
function loadTaxonomy() {
  const taxonomyPath = path.join(ROOT, 'rules', 'cron-taxonomy.json');
  if (!fs.existsSync(taxonomyPath)) {
    throw new Error(`Taxonomy file not found: ${taxonomyPath}`);
  }
  return JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
}

// Load current cron registry
function loadCronRegistry() {
  const registryPath = path.join(process.env.HOME, '.openclaw', 'cron-registry.json');
  if (!fs.existsSync(registryPath)) {
    return { version: '1.0', crons: {} };
  }
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

// Parse schedule to minutes since midnight
function parseScheduleToMinutes(schedule) {
  if (!schedule) return null;
  
  // Handle cron expressions like "0 7,14 * * *"
  if (schedule.includes(' ')) {
    const parts = schedule.split(' ');
    const minute = parseInt(parts[0]) || 0;
    const hours = parts[1].split(',').map(h => parseInt(h)).filter(h => !isNaN(h));
    return hours.map(h => h * 60 + minute);
  }
  
  // Handle "every Xh" format
  if (schedule.startsWith('every')) {
    const match = schedule.match(/every\s+(\d+)h/i);
    if (match) {
      const hours = parseInt(match[1]);
      // Return multiple times throughout the day
      const times = [];
      for (let h = 0; h < 24; h += hours) {
        times.push(h * 60);
      }
      return times;
    }
  }
  
  return null;
}

// Check if two schedules overlap
function schedulesOverlap(sched1, sched2, toleranceMinutes = 30) {
  const times1 = parseScheduleToMinutes(sched1);
  const times2 = parseScheduleToMinutes(sched2);
  
  if (!times1 || !times2) return false;
  
  for (const t1 of times1) {
    for (const t2 of times2) {
      const diff = Math.abs(t1 - t2);
      if (diff <= toleranceMinutes) return true;
    }
  }
  
  return false;
}

// Extract semantic purpose from cron name
function extractPurpose(name) {
  // Remove frequency/time indicators
  const purpose = name
    .replace(/-(daily|weekly|hourly|morning|midday|evening|twice-daily)$/i, '')
    .replace(/:.*$/, '')  // Remove everything after colon
    .replace(/^cache-agent/, 'cache')
    .replace(/^systems-engineer/, 'systems')
    .replace(/^marketing-agent/, 'marketing')
    .replace(/^stats-agent/, 'stats')
    .toLowerCase();
  
  return purpose;
}

// Check for semantic duplicates
function findSemanticDuplicates(crons) {
  const duplicates = [];
  const byPurpose = {};
  
  for (const [name, cron] of Object.entries(crons)) {
    const purpose = extractPurpose(name);
    if (!byPurpose[purpose]) byPurpose[purpose] = [];
    byPurpose[purpose].push({ name, ...cron, purpose });
  }
  
  for (const [purpose, purposeCrons] of Object.entries(byPurpose)) {
    if (purposeCrons.length > 1) {
      duplicates.push({
        type: 'semantic',
        purpose,
        crons: purposeCrons.map(c => c.name),
        suggestion: `Consider consolidating ${purposeCrons.length} crons with similar purpose "${purpose}"`,
        confidence: purposeCrons.length > 2 ? 'high' : 'medium'
      });
    }
  }
  
  return duplicates;
}

// Check for schedule overlaps
function findScheduleOverlaps(crons) {
  const overlaps = [];
  const cronList = Object.entries(crons).map(([name, cron]) => ({ name, ...cron }));
  
  for (let i = 0; i < cronList.length; i++) {
    for (let j = i + 1; j < cronList.length; j++) {
      const c1 = cronList[i];
      const c2 = cronList[j];
      
      if (schedulesOverlap(c1.schedule, c2.schedule)) {
        overlaps.push({
          type: 'schedule-overlap',
          crons: [c1.name, c2.name],
          schedule1: c1.schedule,
          schedule2: c2.schedule,
          suggestion: `Cron "${c1.name}" and "${c2.name}" run at similar times`,
          confidence: 'medium'
        });
      }
    }
  }
  
  return overlaps;
}

// Check for exact schedule duplicates
function findExactScheduleDuplicates(crons) {
  const duplicates = [];
  const bySchedule = {};
  
  for (const [name, cron] of Object.entries(crons)) {
    const scheduleKey = cron.schedule || 'unknown';
    if (!bySchedule[scheduleKey]) bySchedule[scheduleKey] = [];
    bySchedule[scheduleKey].push({ name, ...cron });
  }
  
  for (const [schedule, matchingCrons] of Object.entries(bySchedule)) {
    if (matchingCrons.length > 1) {
      duplicates.push({
        type: 'exact-schedule',
        schedule,
        crons: matchingCrons.map(c => c.name),
        suggestion: `${matchingCrons.length} crons run at "${schedule}" - consider consolidating`,
        confidence: 'high'
      });
    }
  }
  
  return duplicates;
}

// Find redundant health checks
function findRedundantHealthChecks(crons) {
  const redundant = [];
  const healthChecks = [];
  
  for (const [name, cron] of Object.entries(crons)) {
    const lower = name.toLowerCase();
    if (lower.includes('health') || lower.includes('check') || lower.includes('system')) {
      healthChecks.push({ name, ...cron });
    }
  }
  
  // Group by similar schedules
  const byHour = {};
  for (const hc of healthChecks) {
    const times = parseScheduleToMinutes(hc.schedule);
    if (times) {
      for (const t of times) {
        const hour = Math.floor(t / 60);
        if (!byHour[hour]) byHour[hour] = [];
        byHour[hour].push(hc.name);
      }
    }
  }
  
  for (const [hour, names] of Object.entries(byHour)) {
    if (names.length > 1) {
      redundant.push({
        type: 'redundant-health-check',
        hour: `${hour}:00`,
        crons: names,
        suggestion: `${names.length} health checks at ${hour}:00 - consider consolidating into one`,
        confidence: 'high'
      });
    }
  }
  
  return redundant;
}

// Main detection function
async function detectDuplicates() {
  console.log('🔍 Cron Duplicate Detector v1.2\n');
  
  try {
    const taxonomy = loadTaxonomy();
    const registry = loadCronRegistry();
    
    console.log(`📋 Loaded ${Object.keys(registry.crons || {}).length} crons\n`);
    
    const allIssues = [];
    
    // Run all detection methods
    console.log('Running detection algorithms...\n');
    
    const exactDuplicates = findExactScheduleDuplicates(registry.crons || {});
    const semanticDuplicates = findSemanticDuplicates(registry.crons || {});
    const scheduleOverlaps = findScheduleOverlaps(registry.crons || {});
    const redundantHealth = findRedundantHealthChecks(registry.crons || {});
    
    allIssues.push(...exactDuplicates, ...semanticDuplicates, ...scheduleOverlaps, ...redundantHealth);
    
    // Sort by confidence
    allIssues.sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2 };
      return confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
    });
    
    // Report results
    const highConfidence = allIssues.filter(i => i.confidence === 'high');
    const mediumConfidence = allIssues.filter(i => i.confidence === 'medium');
    
    console.log(`🔴 High confidence issues: ${highConfidence.length}`);
    console.log(`🟡 Medium confidence issues: ${mediumConfidence.length}`);
    console.log(`✅ Total issues found: ${allIssues.length}\n`);
    
    if (allIssues.length === 0) {
      console.log('✨ No duplicates or overlaps detected!');
      return true;
    }
    
    // Display issues
    if (highConfidence.length > 0) {
      console.log('🔴 HIGH CONFIDENCE (Recommended action):\n');
      for (const issue of highConfidence) {
        displayIssue(issue);
      }
    }
    
    if (mediumConfidence.length > 0) {
      console.log('🟡 MEDIUM CONFIDENCE (Review suggested):\n');
      for (const issue of mediumConfidence) {
        displayIssue(issue);
      }
    }
    
    console.log('\n💡 Next steps:');
    console.log('  1. Review high confidence issues first');
    console.log('  2. Use "npm run cron:cleanup" for interactive removal');
    console.log('  3. Update taxonomy to prevent future duplicates');
    
    return allIssues.length === 0;
    
  } catch (error) {
    console.error('💥 Detection failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

function displayIssue(issue) {
  const icon = issue.type === 'exact-schedule' ? '🔄' :
               issue.type === 'semantic' ? '🔀' :
               issue.type === 'schedule-overlap' ? '⏰' :
               issue.type === 'redundant-health-check' ? '🏥' : '⚠️';
  
  console.log(`${icon} ${issue.type.toUpperCase().replace(/-/g, ' ')}`);
  
  if (issue.schedule) {
    console.log(`   Schedule: ${issue.schedule}`);
  }
  if (issue.purpose) {
    console.log(`   Purpose: ${issue.purpose}`);
  }
  if (issue.hour) {
    console.log(`   Hour: ${issue.hour}`);
  }
  
  console.log(`   Crons: ${issue.crons.join(', ')}`);
  console.log(`   💡 ${issue.suggestion}\n`);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  detectDuplicates().then(clean => {
    process.exit(clean ? 0 : 1);
  });
}

export { findSemanticDuplicates, findScheduleOverlaps, findExactScheduleDuplicates, schedulesOverlap };
