#!/usr/bin/env node
/**
 * Install Check Script
 * Detects original context-bridge and offers replacement
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function ask(question) {
  return new Promise(resolve => {
    rl.question(question, resolve);
  });
}

function checkOriginalContextBridge() {
  const possiblePaths = [
    path.join(process.env.HOME, '.openclaw', 'workspace', 'skills', 'context-bridge'),
    path.join(process.env.HOME, '.openclaw', 'skills', 'context-bridge'),
    path.join('/opt', 'openclaw', 'skills', 'context-bridge'),
  ];
  
  const foundPaths = [];
  
  for (const checkPath of possiblePaths) {
    if (fs.existsSync(checkPath)) {
      const stat = fs.statSync(checkPath);
      if (stat.isDirectory()) {
        // Check if it's actually context-bridge
        const readmePath = path.join(checkPath, 'README.md');
        const skillPath = path.join(checkPath, 'SKILL.md');
        
        if (fs.existsSync(readmePath) || fs.existsSync(skillPath)) {
          const content = fs.existsSync(readmePath) 
            ? fs.readFileSync(readmePath, 'utf8') 
            : fs.readFileSync(skillPath, 'utf8');
          
          if (content.includes('Context Bridge') || content.includes('context-bridge')) {
            foundPaths.push(checkPath);
          }
        }
      }
    }
  }
  
  return foundPaths;
}

function backupOriginal(installPath) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = `${installPath}.backup-${timestamp}`;
  
  console.log(`📦 Creating backup: ${backupPath}`);
  execSync(`cp -r "${installPath}" "${backupPath}"`, { stdio: 'inherit' });
  
  return backupPath;
}

function replaceOriginal(originalPath, newPath) {
  console.log(`\n🔄 Replacing context-bridge with advanced-context-memory...`);
  
  // Remove old
  console.log(`   Removing: ${originalPath}`);
  execSync(`rm -rf "${originalPath}"`, { stdio: 'inherit' });
  
  // Copy new
  console.log(`   Installing: ${newPath} → ${originalPath}`);
  execSync(`cp -r "${newPath}" "${originalPath}"`, { stdio: 'inherit' });
  
  console.log('   ✅ Replacement complete');
}

async function main() {
  const force = process.argv.includes('--force');
  const autoYes = process.argv.includes('--yes') || force;
  
  console.log('🔍 Checking for original context-bridge installation...\n');
  
  const foundPaths = checkOriginalContextBridge();
  
  if (foundPaths.length === 0) {
    console.log('✅ No original context-bridge found. Clean install.');
    console.log('   Proceeding with standard installation...\n');
    rl.close();
    return 0;
  }
  
  console.log(`⚠️  Found ${foundPaths.length} context-bridge installation(s):`);
  foundPaths.forEach(p => console.log(`   • ${p}`));
  console.log();
  
  let shouldReplace = autoYes;
  
  if (!autoYes) {
    const answer = await ask('Replace with advanced-context-memory? [y/N] ');
    shouldReplace = answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  } else {
    console.log('Auto-replacing ( --yes / --force flag detected )...');
  }
  
  if (shouldReplace) {
    const thisPath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
    
    for (const originalPath of foundPaths) {
      const backupPath = backupOriginal(originalPath);
      replaceOriginal(originalPath, thisPath);
      console.log(`\n   💾 Original backed up to: ${backupPath}`);
    }
    
    console.log('\n✅ Replacement complete!');
    console.log('   Advanced-context-memory is now active.\n');
  } else {
    console.log('\n⏭️  Skipping replacement.');
    console.log('   Installing alongside existing context-bridge...\n');
  }
  
  rl.close();
  return 0;
}

import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);

if (process.argv[1] === __filename) {
  main().then(code => process.exit(code)).catch(err => {
    console.error('💥 Error:', err.message);
    rl.close();
    process.exit(1);
  });
}

export { checkOriginalContextBridge, backupOriginal, replaceOriginal };
