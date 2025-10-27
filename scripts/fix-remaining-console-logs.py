#!/usr/bin/env python3
"""
Fix remaining console logs with complex patterns
"""

import re

def fix_file(file_path, component_name):
    """Fix remaining console logs in a file"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    
    # Pattern 1: console.error(errorMsg); - single variable
    content = re.sub(
        r'console\.error\((\w+)\);',
        lambda m: f"Logger.error('Error occurred', {m.group(1)} as Error, {{\n      component: '{component_name}',\n    }});",
        content
    )
    
    # Pattern 2: console.warn with template literal and variable
    content = re.sub(
        r'console\.warn\(`([^`]+)`, (\w+)\);',
        lambda m: f"Logger.warn(`{m.group(1)}`, {{\n      component: '{component_name}',\n      error: {m.group(2)},\n    }});",
        content
    )
    
    # Pattern 3: console.warn with template literal only
    content = re.sub(
        r'console\.warn\(`([^`]+)`\);',
        lambda m: f"Logger.warn(`{m.group(1)}`, {{\n      component: '{component_name}',\n    }});",
        content
    )
    
    # Pattern 4: console.error with multi-line object (complex)
    # Match: console.error('message', { ... });
    content = re.sub(
        r"console\.error\('([^']+)',\s*\{[^}]+\}\);",
        lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n      component: '{component_name}',\n    }});",
        content,
        flags=re.DOTALL
    )
    
    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True
    return False

files = [
    ('src/services/supabaseApi.ts', 'supabaseApi'),
    ('src/storage/prayerStorage.ts', 'prayerStorage'),
    ('src/services/modernPlaybookApi.ts', 'modernPlaybookApi'),
]

print("🔧 Fixing remaining console logs...\n")

for file_path, component in files:
    if fix_file(file_path, component):
        print(f"✅ Fixed {file_path}")
    else:
        print(f"⚠️  No changes in {file_path}")

print("\n✅ Done!")
