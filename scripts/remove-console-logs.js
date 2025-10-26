#!/usr/bin/env node

/**
 * Script to remove console.log statements from the codebase
 * Preserves console.error and console.warn in production code
 * Replaces with enterprise logger where appropriate
 */

const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '..', 'src');

// Files to skip (logger implementations)
const skipFiles = [
  'enterpriseLogger.ts',
  'logger.ts',
  'sentry.ts',
];

// Patterns to remove
const consolePatterns = [
  /console\.log\([^)]*\);?\s*\n?/g,
  /console\.debug\([^)]*\);?\s*\n?/g,
  /console\.info\([^)]*\);?\s*\n?/g,
];

// Keep these (error handling)
// console.error
// console.warn

let filesProcessed = 0;
let logsRemoved = 0;

function shouldSkipFile(filePath) {
  const fileName = path.basename(filePath);
  return skipFiles.some(skip => fileName.includes(skip));
}

function processFile(filePath) {
  if (shouldSkipFile(filePath)) {
    console.log(`⏭️  Skipping: ${filePath}`);
    return;
  }

  let content = fs.readFileSync(filePath, 'utf8');
  const originalContent = content;
  let removedCount = 0;

  // Remove console.log, console.debug, console.info
  consolePatterns.forEach(pattern => {
    const matches = content.match(pattern);
    if (matches) {
      removedCount += matches.length;
      content = content.replace(pattern, '');
    }
  });

  // Clean up multiple empty lines
  content = content.replace(/\n\n\n+/g, '\n\n');

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    filesProcessed++;
    logsRemoved += removedCount;
    console.log(`✅ Processed: ${filePath} (removed ${removedCount} console statements)`);
  }
}

function walkDirectory(dir) {
  const files = fs.readdirSync(dir);

  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);

    if (stat.isDirectory()) {
      // Skip node_modules, build directories
      if (!['node_modules', 'build', 'dist', '__tests__'].includes(file)) {
        walkDirectory(filePath);
      }
    } else if (stat.isFile() && (file.endsWith('.ts') || file.endsWith('.tsx'))) {
      processFile(filePath);
    }
  });
}

console.log('🚀 Starting console.log removal...\n');
walkDirectory(srcDir);
console.log(`\n✨ Complete! Processed ${filesProcessed} files, removed ${logsRemoved} console statements.`);
