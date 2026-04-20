#!/usr/bin/env node
/**
 * Cron Taxonomy Enforcement Hook
 * Validates cron names against taxonomy before creation
 * 
 * Usage: node enforce-taxonomy.js --validate <cron-name>
 *        node enforce-taxonomy.js --pre-create <cron-name> [--dry-run]
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
    console.error('Taxonomy file not found:', taxonomyPath);
    process.exit(1);
  }
  const taxonomy = JSON.parse(fs.readFileSync(taxonomyPath, 'utf8'));
  
  // Extract allowed categories and agents from namespaces
  const allowedCategories = Object.keys(taxonomy.namespaces).filter(ns => 
    !ns.includes('agent')
  );
  const allowedAgents = Object.keys(taxonomy.namespaces).filter(ns => 
    ns.includes('agent')
  );
  
  return {
    ...taxonomy,
    allowedCategories,
    allowedAgents
  };
}

// Validate a cron name against taxonomy
function validateCronName(name, taxonomy) {
  const errors = [];
  const warnings = [];
  
  // Check if name matches any allowed pattern
  const validPatterns = [
    // Category prefix with colon: category:name
    new RegExp(`^(${taxonomy.allowedCategories.join('|')}):[a-z0-9-]+$`),
    // Agent prefix with colon: agent:name
    new RegExp(`^(${taxonomy.allowedAgents.join('|')}):[a-z0-9-]+$`),
    // Legacy hyphen format: category-name or agent-name
    new RegExp(`^(${taxonomy.allowedCategories.join('|')})-[a-z0-9-]+$`),
    new RegExp(`^(${taxonomy.allowedAgents.join('|')})-[a-z0-9-]+$/`)
  ];
  
  const matchesPattern = validPatterns.some(pattern => pattern.test(name));
  
  if (!matchesPattern) {
    // Try to identify what they were going for
    const hasColon = name.includes(':');
    const hasHyphen = name.includes('-');
    
    if (hasColon) {
      const [prefix] = name.split(':');
      const isValidCategory = taxonomy.allowedCategories.includes(prefix);
      const isValidAgent = taxonomy.allowedAgents.includes(prefix);
      
      if (!isValidCategory && !isValidAgent) {
        errors.push(`Unknown namespace "${prefix}". Allowed categories: ${taxonomy.allowedCategories.join(', ')}`);
        errors.push(`Allowed agents: ${taxonomy.allowedAgents.join(', ')}`);
      } else {
        // Prefix is valid but format after colon might be wrong
        const afterColon = name.split(':')[1];
        if (!afterColon || !/^[a-z0-9-]+$/.test(afterColon)) {
          errors.push(`Invalid name format after colon. Use only lowercase letters, numbers, and hyphens.`);
        }
      }
    } else if (hasHyphen) {
      const prefix = name.split('-')[0];
      const isValidCategory = taxonomy.allowedCategories.includes(prefix);
      const isValidAgent = taxonomy.allowedAgents.includes(prefix);
      
      if (isValidCategory || isValidAgent) {
        warnings.push(`Legacy hyphen format detected. Consider using colon format "${prefix}:..." for consistency.`);
      } else {
        errors.push(`Name must follow pattern "category:name" or "agent:name". Examples: "daily:backup", "cache-agent:morning-pull"`);
        errors.push(`Allowed categories: ${taxonomy.allowedCategories.join(', ')}`);
        errors.push(`Allowed agents: ${taxonomy.allowedAgents.join(', ')}`);
      }
    } else {
      errors.push(`Name must include a colon separator. Format: "category:name" or "agent:name"`);
      errors.push(`Examples: "daily:backup", "marketing-agent:freshbooks-sync"`);
    }
  }
  
  // Check for duplicate-like names
  const registry = loadCronRegistry();
  const existingCrons = Object.keys(registry.crons || {});
  
  // Check for semantic duplicates (similar purpose)
  const baseName = name.replace(/^[^:]+:/, '').toLowerCase();
  const similarCrons = existingCrons.filter(cron => {
    const cronBase = cron.replace(/^[^:]+:/, '').toLowerCase();
    return cronBase === baseName && cron !== name;
  });
  
  if (similarCrons.length > 0) {
    warnings.push(`Similar cron(s) already exist: ${similarCrons.join(', ')}. Consider if this is a duplicate.`);
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings,
    name,
    format: matchesPattern ? 'standard' : 'unknown'
  };
}

// Load cron registry
function loadCronRegistry() {
  const registryPath = path.join(process.env.HOME, '.openclaw', 'cron-registry.json');
  if (!fs.existsSync(registryPath)) {
    return { version: '1.0', crons: {} };
  }
  return JSON.parse(fs.readFileSync(registryPath, 'utf8'));
}

// Interactive mode for pre-create validation
async function interactiveValidation(name, dryRun = false) {
  const taxonomy = loadTaxonomy();
  const result = validateCronName(name, taxonomy);
  
  console.log(`\n🔍 Validating cron name: "${name}"\n`);
  
  if (result.errors.length > 0) {
    console.log('❌ Validation FAILED:');
    result.errors.forEach(err => console.log(`   • ${err}`));
    console.log();
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️  Warnings:');
    result.warnings.forEach(warn => console.log(`   • ${warn}`));
    console.log();
  }
  
  if (result.valid) {
    console.log('✅ Name follows taxonomy guidelines');
    if (dryRun) {
      console.log('   (Dry run - would allow creation)');
    }
    return true;
  } else {
    console.log('❌ Cannot create cron - name violates taxonomy');
    console.log();
    console.log('Suggested fixes:');
    
    // Provide suggestions
    if (name.includes('-') && !name.includes(':')) {
      const [prefix, ...rest] = name.split('-');
      const newName = `${prefix}:${rest.join('-')}`;
      console.log(`   • Try: "${newName}" (colon instead of hyphen)`);
    }
    
    console.log(`   • Use format: "category:name" or "agent:name"`);
    console.log(`   • Categories: ${taxonomy.allowedCategories.slice(0, 5).join(', ')}...`);
    console.log(`   • Agents: ${taxonomy.allowedAgents.slice(0, 5).join(', ')}...`);
    return false;
  }
}

// Export for use as module
export { validateCronName, loadTaxonomy };

// CLI entry point
async function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('--help') || args.length === 0) {
    console.log('Cron Taxonomy Enforcement\n');
    console.log('Usage:');
    console.log('  node enforce-taxonomy.js --validate <name>     Validate a cron name');
    console.log('  node enforce-taxonomy.js --pre-create <name>   Check before creating');
    console.log('  node enforce-taxonomy.js --dry-run <name>      Dry run validation');
    console.log('  node enforce-taxonomy.js --hook               Install as pre-create hook');
    console.log();
    console.log('Examples:');
    console.log('  node enforce-taxonomy.js --validate daily:backup');
    console.log('  node enforce-taxonomy.js --pre-create marketing-agent:freshbooks-sync');
    process.exit(0);
  }
  
  const validateIndex = args.indexOf('--validate');
  const preCreateIndex = args.indexOf('--pre-create');
  const dryRun = args.includes('--dry-run');
  const hook = args.includes('--hook');
  
  let name;
  if (validateIndex !== -1) {
    name = args[validateIndex + 1];
  } else if (preCreateIndex !== -1) {
    name = args[preCreateIndex + 1];
  }
  
  if (hook) {
    console.log('Installing pre-create hook...');
    console.log('(Hook installation would modify OpenClaw config)');
    process.exit(0);
  }
  
  if (!name) {
    console.error('Error: No cron name provided');
    process.exit(1);
  }
  
  const valid = await interactiveValidation(name, dryRun);
  process.exit(valid ? 0 : 1);
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  main().catch(err => {
    console.error('💥 Error:', err.message);
    process.exit(1);
  });
}
