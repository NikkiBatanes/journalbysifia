#!/usr/bin/env python3
"""
Clean console.log statements from EnhancedMomentsRenderer.tsx
This file has extensive debug logging that needs to be removed
"""

import re
from pathlib import Path

FILE_PATH = Path(__file__).parent.parent / 'src/systems/journal/renderers/EnhancedMomentsRenderer.tsx'

def clean_file():
    """Remove all console.log statements from the file"""
    
    with open(FILE_PATH, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Pattern to match standalone console.log statements
    # Matches: console.log(...); with any content inside
    pattern = re.compile(
        r'^\s*console\.log\([^;]*\);?\s*$',
        re.MULTILINE
    )
    
    # Count matches
    matches = pattern.findall(content)
    count = len(matches)
    
    print(f"Found {count} console.log statements")
    
    # Remove console.log statements
    content = pattern.sub('', content)
    
    # Clean up multiple empty lines (max 2 consecutive)
    content = re.sub(r'\n\n\n+', '\n\n', content)
    
    # Write back
    if content != original_content:
        with open(FILE_PATH, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Removed {count} console.log statements from EnhancedMomentsRenderer.tsx")
    else:
        print("No changes needed")

if __name__ == '__main__':
    clean_file()
