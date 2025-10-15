#!/usr/bin/env node
/**
 * Script to replace console.log statements with structured logger
 * Usage: node scripts/replace-console-logs.js
 */

const fs = require('fs');
const path = require('path');

const ONBOARDING_DIR = path.join(__dirname, '../src/screens/onboarding');

// Mapping of console methods to logger methods
const replacements = [
  {
    pattern: /console\.log\(\s*'\[(\w+)\]\s*([^']+)'/g,
    replacement: (match, component, message) => {
      // Determine appropriate logger method based on message content
      if (message.includes('Error') || message.includes('Failed')) {
        return `logger.error('${message.trim()}'`;
      } else if (message.includes('Warning') || message.includes('⚠️')) {
        return `logger.warn('${message.trim()}'`;
      } else if (message.includes('🚀') || message.includes('✅') || message.includes('Navigation')) {
        return `logger.onboarding.navigation('${message.trim()}'`;
      } else if (message.includes('Step') || message.includes('completed')) {
        return `logger.onboarding.stepCompleted('${message.trim()}'`;
      } else {
        return `logger.debug('${message.trim()}'`;
      }
    }
  },
  {
    pattern: /console\.error\(\s*'\[(\w+)\]\s*([^']+)'/g,
    replacement: (match, component, message) => `logger.error('${message.trim()}'`
  },
  {
    pattern: /console\.warn\(\s*'\[(\w+)\]\s*([^']+)'/g,
    replacement: (match, component, message) => `logger.warn('${message.trim()}'`
  }
];

function processFile(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  let modified = false;

  // Check if logger is already imported
  const hasLoggerImport = content.includes("import { logger } from");
  
  // Apply replacements
  replacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(content)) {
      content = content.replace(pattern, replacement);
      modified = true;
    }
  });

  // Add logger import if needed
  if (modified && !hasLoggerImport) {
    // Find the last import statement
    const importRegex = /import\s+.*?from\s+['"].*?['"];?\n/g;
    const imports = content.match(importRegex);
    
    if (imports && imports.length > 0) {
      const lastImport = imports[imports.length - 1];
      const lastImportIndex = content.lastIndexOf(lastImport);
      const insertPosition = lastImportIndex + lastImport.length;
      
      content = content.slice(0, insertPosition) +
                "import { logger } from '../../utils/logger';\n" +
                content.slice(insertPosition);
    }
  }

  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    return true;
  }
  
  return false;
}

function main() {
  console.log('🔄 Starting console.log replacement...\n');
  
  const files = fs.readdirSync(ONBOARDING_DIR)
    .filter(file => file.endsWith('.tsx') || file.endsWith('.ts'))
    .map(file => path.join(ONBOARDING_DIR, file));

  let modifiedCount = 0;
  let totalFiles = files.length;

  files.forEach(file => {
    const fileName = path.basename(file);
    const wasModified = processFile(file);
    
    if (wasModified) {
      console.log(`✅ ${fileName} - Updated`);
      modifiedCount++;
    } else {
      console.log(`⏭️  ${fileName} - No changes needed`);
    }
  });

  console.log(`\n📊 Summary:`);
  console.log(`   Total files: ${totalFiles}`);
  console.log(`   Modified: ${modifiedCount}`);
  console.log(`   Unchanged: ${totalFiles - modifiedCount}`);
  console.log('\n✨ Console log replacement complete!');
}

main();
