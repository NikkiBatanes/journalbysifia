#!/usr/bin/env python3
"""
VICTORY LAP: Final 24 console logs for 100% completion
Precision targeting for the last remaining patterns
"""

import re
import os

def add_logger_import(content, relative_path):
    if 'import { Logger } from' not in content:
        imports = re.findall(r"import .+ from ['\"].+['\"];", content)
        if imports:
            last_import = imports[-1]
            content = content.replace(last_import, f"{last_import}\nimport {{ Logger }} from '{relative_path}';", 1)
    return content

def get_relative_path(fp):
    if '/services/' in fp: return '../utils/ProductionLogger'
    if '/screens/' in fp: return '../utils/ProductionLogger'
    if '/components/journal/' in fp: return '../../utils/ProductionLogger'
    if '/components/' in fp: return '../utils/ProductionLogger'
    return '../utils/ProductionLogger'

def get_component_name(fp):
    return os.path.basename(fp).replace('.tsx','').replace('.ts','').replace('.test','')

def victory_lap_replace(content, component_name, file_path):
    """Victory lap replacement for the final 24 console logs"""
    
    # Skip test files entirely
    if '.test.' in file_path or '__tests__' in file_path:
        return content
    
    # 1. UserProfileScreen - console.error with result.error
    if 'UserProfileScreen' in file_path:
        content = re.sub(
            r"console\.error\('\[([^\]]+)\] ([^']+):', result\.error\);",
            lambda m: f"Logger.error('[{m.group(1)}] {m.group(2)}', result.error as Error, {{\n        component: '{component_name}',\n      }});",
            content
        )
    
    # 2. TodayWinReactQuery - console.error with entries.map
    elif 'TodayWinReactQuery' in file_path:
        content = re.sub(
            r"console\.error\('([^']+):', entries\.map\([^)]+\)\);",
            lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n        component: '{component_name}',\n        availableEntries: entries.map(e => ({{ id: e.id, content: e.content }})),\n      }});",
            content
        )
    
    # 3. GratitudeListReactQuery - console.warn with variable
    elif 'GratitudeListReactQuery' in file_path:
        content = re.sub(
            r"console\.warn\('([^']+)', (\w+)\);",
            lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{component_name}',\n        itemId: {m.group(2)},\n      }});",
            content
        )
    
    # 4. General service files - console.error/warn patterns
    else:
        # console.error('text:', variable);
        content = re.sub(
            r"console\.error\('([^']+):', (\w+)\);",
            lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n        component: '{component_name}',\n      }});",
            content
        )
        
        # console.warn('text:', variable);
        content = re.sub(
            r"console\.warn\('([^']+):', (\w+)\);",
            lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{component_name}',\n        data: {m.group(2)},\n      }});",
            content
        )
        
        # console.log('text:', variable);
        content = re.sub(
            r"console\.log\('([^']+):', (\w+)\);",
            lambda m: f"Logger.debug('{m.group(1)}', {{\n        component: '{component_name}',\n        data: {m.group(2)},\n      }});",
            content
        )
        
        # Simple console calls
        content = re.sub(
            r"console\.(error|warn|log)\('([^']+)'\);",
            lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}('{m.group(2)}', {{\n        component: '{component_name}',\n      }});",
            content
        )
        
        # console.error with [Service] prefix
        content = re.sub(
            r"console\.error\('\[([^\]]+)\] ([^']+):', (\w+)\);",
            lambda m: f"Logger.error('[{m.group(1)}] {m.group(2)}', {m.group(3)} as Error, {{\n        component: '{component_name}',\n      }});",
            content
        )
    
    return content

def process_file(fp):
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            original_content = f.read()
    except Exception as e:
        return False, 0, f'read_error: {e}'

    component_name = get_component_name(fp)
    relative_path = get_relative_path(fp)
    
    # Apply victory lap replacements
    content = victory_lap_replace(original_content, component_name, fp)
    
    # Add Logger import if needed and content changed
    if content != original_content:
        content = add_logger_import(content, relative_path)
    
    # Count replacements
    original_console_count = len(re.findall(r'console\.(error|warn|log)', original_content))
    new_console_count = len(re.findall(r'console\.(error|warn|log)', content))
    replacements = original_console_count - new_console_count
    
    if content != original_content:
        try:
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            return True, replacements, None
        except Exception as e:
            return False, 0, f'write_error: {e}'
    
    return False, 0, 'no_changes'

if __name__ == '__main__':
    # Final remaining files (excluding test files)
    files = [
        'src/services/supabaseApi.ts',
        'src/services/queueService.ts',
        'src/services/GooglePlayBillingService.ts',
        'src/services/enhancedGenerationService.ts',
        'src/services/AppleStoreKitService.ts',
        'src/screens/UserProfileScreen.tsx',
        'src/components/journal/TodayWinReactQuery.tsx',
        'src/components/journal/GratitudeListReactQuery.tsx',
        'src/components/DynamicPricingModal.tsx',
    ]
    
    total_replaced = 0
    files_updated = 0
    
    print(f"🏆 VICTORY LAP: Processing final {len(files)} non-test files\n")
    
    for fp in files:
        if os.path.exists(fp):
            success, count, error = process_file(fp)
            
            if success and count > 0:
                files_updated += 1
                total_replaced += count
                print(f"✅ {fp}: {count} logs replaced")
            elif error and 'error' in error:
                print(f"❌ {fp}: {error}")
        else:
            print(f"⚠️  {fp}: File not found")
    
    print(f"\n{'='*60}")
    print(f"🏆 VICTORY LAP RESULTS:")
    print(f"📊 Files updated: {files_updated}")
    print(f"🔄 Console logs replaced: {total_replaced}")
    print(f"🎯 TARGET: 100% completion of non-test console logs!")
    print(f"{'='*60}")
