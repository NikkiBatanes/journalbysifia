#!/usr/bin/env python3
"""
Careful Console Log Replacement - Batch 1 (10 files)
Safe pattern matching with proper newlines
"""

import re
import os

def add_logger_import(content, relative_path):
    """Add Logger import if not present"""
    if 'import { Logger } from' not in content:
        import_pattern = r"(import .+ from ['\"].+['\"];)"
        match = re.search(import_pattern, content)
        if match:
            first_import = match.group(0)
            content = content.replace(first_import, f"{first_import}\nimport {{ Logger }} from '{relative_path}';", 1)
    return content

def get_relative_import_path(file_path):
    """Calculate relative import path"""
    if '/services/api/' in file_path or '/services/hooks/' in file_path:
        return '../../utils/ProductionLogger'
    elif '/services/' in file_path:
        return '../utils/ProductionLogger'
    elif '/components/journal/' in file_path:
        return '../../utils/ProductionLogger'
    else:
        return '../utils/ProductionLogger'

def get_component_name(file_path):
    """Extract component name"""
    return os.path.basename(file_path).replace('.tsx', '').replace('.ts', '')

def replace_console_logs(file_path):
    """Replace console logs with safe patterns only"""

    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return False, 0, str(e)

    original_content = content
    component_name = get_component_name(file_path)
    relative_import = get_relative_import_path(file_path)

    content = add_logger_import(content, relative_import)

    # Only safe, simple patterns
    
    # Pattern 1: console.log('simple string');
    content = re.sub(
        r"console\.log\('([^']+)'\);",
        lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{component_name}',\n    }});",
        content
    )
    
    # Pattern 2: console.error('simple string');
    content = re.sub(
        r"console\.error\('([^']+)'\);",
        lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n      component: '{component_name}',\n    }});",
        content
    )
    
    # Pattern 3: console.warn('simple string');
    content = re.sub(
        r"console\.warn\('([^']+)'\);",
        lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{component_name}',\n    }});",
        content
    )
    
    # Pattern 4: console.log('string:', variable);
    content = re.sub(
        r"console\.log\('([^']+):', (\w+)\);",
        lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{component_name}',\n      data: {m.group(2)},\n    }});",
        content
    )
    
    # Pattern 5: console.error('string:', error);
    content = re.sub(
        r"console\.error\('([^']+):', (error|err)\);",
        lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n      component: '{component_name}',\n    }});",
        content
    )

    replacements = len(re.findall(r'Logger\.(error|warn|debug|info)', content)) - len(re.findall(r'Logger\.(error|warn|debug|info)', original_content))

    if content != original_content:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True, replacements, None
        except Exception as e:
            return False, 0, str(e)
    return False, 0, None

if __name__ == "__main__":
    files = [
        'src/components/journal/TodosReactQuery.tsx',
        'src/services/api/prayerApi.ts',
        'src/components/journal/TimeBlockReactQuery.tsx',
        'src/services/modernPlaybookApi.ts',
        'src/services/hooks/useJournalData.ts',
        'src/components/journal/TodayWinReactQuery.tsx',
        'src/components/journal/GratitudeListReactQuery.tsx',
        'src/services/supabaseClient.ts',
        'src/services/supabaseApi.ts',
        'src/services/AppleStoreKitService.ts',
    ]

    total_replaced = 0
    total_files = 0

    print(f"🎯 Processing Batch 1: {len(files)} files with most console logs\n")

    for file_path in files:
        success, count, error = replace_console_logs(file_path)
        if success:
            total_files += 1
            total_replaced += count
            print(f"✅ {file_path}: {count} logs replaced")
        elif error:
            print(f"❌ {file_path}: {error}")
        else:
            print(f"⚠️  {file_path}: No simple patterns found")

    print(f"\n{'='*60}")
    print(f"🎯 Batch 1 Total: {total_replaced} console logs replaced in {total_files} files")
    print(f"{'='*60}")
