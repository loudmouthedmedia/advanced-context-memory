#!/usr/bin/env node
/**
 * OpenClaw Cron Create Wrapper
 * Validates cron name against taxonomy before creating
 * 
 * This script wraps 'openclaw cron add' and enforces naming validation
 * Place it in PATH before the real openclaw to intercept cron creation
 * 
 * Alternative: Use as a pre-commit hook or CI gate
 */

import { execFileSync } from 'child_process';
import { validateCronName, loadTaxonomy } from './enforce-taxonomy.js';

const args = process.argv.slice(2);

// Find the cron name in the arguments
// openclaw cron add --name "cron-name" ...
let cronName = null;
const nameIndex = args.indexOf('--name');
if (nameIndex !== -1 && args[nameIndex + 1]) {
  cronName = args[nameIndex + 1];
}

// Also check if it's passed as a positional arg
if (!cronName && args.length > 0 && !args[0].startsWith('--')) {
  cronName = args[0];
}

if (!cronName) {
  console.error('❌ No cron name specified');
  process.exit(1);
}

// Validate the name
const taxonomy = loadTaxonomy();
const result = validateCronName(cronName, taxonomy);

if (!result.valid) {
  console.error(`\n❌ Cannot create cron "${cronName}"`);
  console.error('Validation errors:');
  result.errors.forEach(err => console.error(`   • ${err}`));
  console.error();
  console.error('Naming convention: {namespace}:{descriptor}');
  console.error('Examples: daily:backup, cache-agent:morning-pull, marketing-agent:ga4-sync');
  console.error();
  process.exit(1);
}

if (result.warnings.length > 0) {
  console.warn('⚠️  Warnings:');
  result.warnings.forEach(warn => console.warn(`   • ${warn}`));
  console.log();
}

console.log(`✅ Cron name "${cronName}" validated`);
console.log('Proceeding with creation...\n');

// If validation passes, you would call the actual openclaw command here
// For now, just indicate success
console.log('(In production, this would run: openclaw cron add ' + args.join(' ') + ')');
