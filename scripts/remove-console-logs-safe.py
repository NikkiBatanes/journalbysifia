#!/usr/bin/env python3
"""
Safe console.log removal script
Only removes standalone console.log/debug/info statements
Preserves console.error and console.warn
"""

import os
import re
from pathlib import Path

# Directories to process
SRC_DIR = Path(__file__).parent.parent / 'src'

# Files to skip
SKIP_FILES = {'enterpriseLogger.ts', 'logger.ts', 'sentry.ts'}

# Pattern to match standalone console statements (not part of larger expressions)
# Matches: console.log(...); or console.debug(...); or console.info(...)
CONSOLE_PATTERN = re.compile(
    r'^\s*console\.(log|debug|info)\([^;]*\);?\s*$',
    re.MULTILINE
)

# Pattern to match console statements with comments
CONSOLE_WITH_COMMENT = re.compile(
    r'^\s*//.*console\.(log|debug|info)',
    re.MULTILINE
)

files_processed = 0
logs_removed = 0

def should_skip_file(file_path):
    """Check if file should be skipped"""
    return file_path.name in SKIP_FILES

def process_file(file_path):
    """Process a single file to remove console statements"""
    global files_processed, logs_removed
    
    if should_skip_file(file_path):
        print(f"⏭️  Skipping: {file_path}")
        return
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Count matches before removal
        matches = CONSOLE_PATTERN.findall(content)
        removed_count = len(matches)
        
        if removed_count == 0:
            return
        
        # Remove console statements
        content = CONSOLE_PATTERN.sub('', content)
        
        # Clean up multiple empty lines (max 2 consecutive)
        content = re.sub(r'\n\n\n+', '\n\n', content)
        
        # Only write if content changed
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            
            files_processed += 1
            logs_removed += removed_count
            print(f"✅ {file_path.relative_to(SRC_DIR)}: removed {removed_count} console statements")
    
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")

def walk_directory(directory):
    """Recursively process all TypeScript files"""
    for item in directory.rglob('*'):
        if item.is_file() and item.suffix in {'.ts', '.tsx'}:
            # Skip test files and node_modules
            if '__tests__' not in item.parts and 'node_modules' not in item.parts:
                process_file(item)

if __name__ == '__main__':
    print('🚀 Starting safe console.log removal...\n')
    walk_directory(SRC_DIR)
    print(f'\n✨ Complete! Processed {files_processed} files, removed {logs_removed} console statements.')
