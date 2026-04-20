#!/usr/bin/env node
/**
 * Cron Taxonomy Validator
 * Validates cron jobs against naming conventions and detects duplicates
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

// Parse cron name into namespace and components
function parseCronName(name) {
  // Try colon-separated first
  const colonParts = name.split(':');
  if (colonParts.length > 1) {
    return {
      namespace: colonParts[0] || null,
      components: colonParts.slice(1),
      separator: ':'
    };
  }
  
  // Handle hyphenated names by extracting known namespace prefixes
  // e.g., "meeting-prep-daily" -> namespace="meeting-prep", components=["daily"]
  return {
    namespace: name,
    components: [],
    separator: '-'
  };
}

// Validate a single cron name
function validateCronName(name, taxonomy) {
  const errors = [];
  const warnings = [];
  const parts = name.split(':');
  
  const { namespace, components } = parseCronName(name);
  
  // Check if namespace exists
  if (!namespace) {
    errors.push(`Missing namespace in "${name}". Must follow pattern: {namespace}:{name}`);
    return { valid: false, errors, warnings };
  }
  
  // Check if namespace is defined in taxonomy
  if (!taxonomy.namespaces[namespace]) {
    // Try to find a matching namespace prefix for hyphenated names
    const knownNamespaces = Object.keys(taxonomy.namespaces);
    let matchedNamespace = null;
    
    for (const ns of knownNamespaces) {
      if (namespace.startsWith(ns + '-') || namespace === ns) {
        matchedNamespace = ns;
        break;
      }
    }
    
    if (matchedNamespace) {
      const suffix = name.slice(matchedNamespace.length + 1);
      // In legacy mode, allow but warn
      if (taxonomy.globalRules.legacyMode) {
        warnings.push(`Name "${name}" uses hyphenated format. Consider migrating to colon format: "${matchedNamespace}:${suffix}"`);
        return { valid: true, errors, warnings, namespace: matchedNamespace };
      }
      errors.push(`Name "${name}" should use colon format: "${matchedNamespace}:${suffix}"`);
      return { valid: false, errors, warnings };
    }
    
    // In legacy mode, allow unknown namespaces but warn
    if (taxonomy.globalRules.legacyMode) {
      warnings.push(`Namespace "${namespace}" is not in taxonomy. Consider migrating to a standard namespace.`);
      return { valid: true, errors, warnings, namespace };
    }
    const allowedNamespaces = Object.keys(taxonomy.namespaces).join(', ');
    errors.push(`Unknown namespace "${namespace}" in "${name}". Allowed: ${allowedNamespaces}`);
    return { valid: false, errors, warnings };
  }
  
  const nsRules = taxonomy.namespaces[namespace];
  
  // Check prohibited names
  if (taxonomy.globalRules.prohibitedNames.some(p => name.toLowerCase().includes(p))) {
    warnings.push(`Name "${name}" contains prohibited term`);
  }
  
  // Check pattern match
  const hasValidPattern = nsRules.allowedPatterns.some(pattern => {
    // Handle both : and - as separators
    const nameParts = name.split(/[:-]/);
    const patternParts = pattern.split(/[:-]/);
    
    if (patternParts.length !== nameParts.length) return false;
    
    // Pattern matching - {placeholder} matches any non-empty string
    return patternParts.every((pp, i) => {
      if (pp.startsWith('{') && pp.endsWith('}')) {
        const placeholder = pp.slice(1, -1);
        const value = nameParts[i];
        
        // Check if value is in allowedValues for this placeholder
        if (nsRules.allowedValues && nsRules.allowedValues[placeholder]) {
          return nsRules.allowedValues[placeholder].includes(value);
        }
        
        return value?.length > 0;
      }
      return pp === nameParts[i];
    });
  });
  
  if (!hasValidPattern) {
    warnings.push(`Name "${name}" doesn't match expected patterns: ${nsRules.allowedPatterns.join(', ')}`);
  }
  
  return { valid: errors.length === 0, errors, warnings, namespace };
}

// Check for duplicates within a namespace
function checkDuplicates(crons, taxonomy) {
  const duplicates = [];
  const byNamespace = {};
  
  // Group crons by namespace
  for (const [name, cron] of Object.entries(crons)) {
    const { namespace } = parseCronName(name);
    if (!namespace) continue;
    
    if (!byNamespace[namespace]) byNamespace[namespace] = [];
    byNamespace[namespace].push({ name, ...cron });
  }
  
  // Check each namespace for duplicates
  for (const [namespace, nsCrons] of Object.entries(byNamespace)) {
    const rules = taxonomy.namespaces[namespace];
    if (!rules || !rules.preventDuplicates) continue;
    
    // Group by schedule to find potential duplicates
    const bySchedule = {};
    for (const cron of nsCrons) {
      const scheduleKey = cron.schedule || 'unknown';
      if (!bySchedule[scheduleKey]) bySchedule[scheduleKey] = [];
      bySchedule[scheduleKey].push(cron);
    }
    
    // Flag duplicates
    for (const [schedule, matchingCrons] of Object.entries(bySchedule)) {
      if (matchingCrons.length > 1) {
        duplicates.push({
          namespace,
          schedule,
          crons: matchingCrons.map(c => c.name),
          suggestion: `Consider consolidating: ${matchingCrons.map(c => c.name).join(', ')}`
        });
      }
    }
    
    // Check max instances
    if (nsCrons.length > rules.maxInstances) {
      duplicates.push({
        namespace,
        type: 'maxInstancesExceeded',
        count: nsCrons.length,
        max: rules.maxInstances,
        crons: nsCrons.map(c => c.name)
      });
    }
  }
  
  return duplicates;
}

// Main validation function
async function validateCrons() {
  console.log('🧹 Cron Taxonomy Validator v1.1\n');
  
  try {
    const taxonomy = loadTaxonomy();
    const registry = loadCronRegistry();
    
    console.log(`📋 Loaded taxonomy: ${Object.keys(taxonomy.namespaces).length} namespaces`);
    console.log(`📋 Loaded registry: ${Object.keys(registry.crons || {}).length} crons\n`);
    
    const results = {
      valid: [],
      invalid: [],
      warnings: [],
      duplicates: []
    };
    
    // Validate each cron
    for (const [name, cron] of Object.entries(registry.crons || {})) {
      const validation = validateCronName(name, taxonomy);
      
      if (!validation.valid) {
        results.invalid.push({ name, errors: validation.errors });
      } else if (validation.warnings.length > 0) {
        results.warnings.push({ name, warnings: validation.warnings });
      } else {
        results.valid.push(name);
      }
    }
    
    // Check for duplicates
    results.duplicates = checkDuplicates(registry.crons || {}, taxonomy);
    
    // Report results
    console.log('✅ Valid crons:', results.valid.length);
    console.log('❌ Invalid crons:', results.invalid.length);
    console.log('⚠️  Warnings:', results.warnings.length);
    console.log('🔄 Duplicates found:', results.duplicates.length);
    
    if (results.invalid.length > 0) {
      console.log('\n❌ INVALID CRONS:');
      for (const item of results.invalid) {
        console.log(`  • ${item.name}`);
        for (const error of item.errors) {
          console.log(`    - ${error}`);
        }
      }
    }
    
    if (results.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS:');
      for (const item of results.warnings) {
        console.log(`  • ${item.name}`);
        for (const warning of item.warnings) {
          console.log(`    - ${warning}`);
        }
      }
    }
    
    if (results.duplicates.length > 0) {
      console.log('\n🔄 POTENTIAL DUPLICATES:');
      for (const dup of results.duplicates) {
        if (dup.type === 'maxInstancesExceeded') {
          console.log(`  • Namespace "${dup.namespace}" has ${dup.count}/${dup.max} crons:`);
          for (const name of dup.crons) {
            console.log(`    - ${name}`);
          }
        } else {
          console.log(`  • Same schedule "${dup.schedule}":`);
          for (const name of dup.crons) {
            console.log(`    - ${name}`);
          }
          console.log(`    💡 ${dup.suggestion}`);
        }
      }
    }
    
    console.log('\n✨ Validation complete!');
    
    return results.invalid.length === 0 && results.duplicates.length === 0;
    
  } catch (error) {
    console.error('💥 Validation failed:', error.message);
    process.exit(1);
  }
}

// Run if called directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  validateCrons().then(valid => {
    process.exit(valid ? 0 : 1);
  });
}

export { validateCronName, checkDuplicates, loadTaxonomy };
