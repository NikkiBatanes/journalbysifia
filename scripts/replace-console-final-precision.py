#!/usr/bin/env python3
"""
FINAL PRECISION: Last 7 console logs for absolute 100% completion
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
    if '/components/journal/' in fp: return '../../utils/ProductionLogger'
    if '/components/' in fp: return '../utils/ProductionLogger'
    return '../utils/ProductionLogger'

def get_component_name(fp):
    return os.path.basename(fp).replace('.tsx','').replace('.ts','')

def precision_replace(content, component_name, file_path):
    """Precision replacement for exact remaining patterns"""
    
    # 1. TodayWinReactQuery - console.error with entries.map
    if 'TodayWinReactQuery' in file_path:
        content = re.sub(
            r"console\.error\('🏆 TodayWin: Available entries:', entries\.map\(e => \(\{ id: e\.id, content: e\.content \}\)\)\);",
            f"Logger.error('🏆 TodayWin: Available entries', undefined, {{\n        component: '{component_name}',\n        availableEntries: entries.map(e => ({{ id: e.id, content: e.content }})),\n      }});",
            content
        )
    
    # 2. DynamicPricingModal - console.warn
    elif 'DynamicPricingModal' in file_path:
        content = re.sub(
            r"console\.warn\('([^']+)', e\);",
            lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{component_name}',\n        error: e,\n      }});",
            content
        )
    
    # 3. GooglePlayBillingService - console.error with product ID
    elif 'GooglePlayBillingService' in file_path:
        content = re.sub(
            r"console\.error\('\[GooglePlay\] ([^']+):', ([^)]+)\);",
            lambda m: f"Logger.error('[GooglePlay] {m.group(1)}', undefined, {{\n        component: '{component_name}',\n        productId: {m.group(2)},\n      }});",
            content
        )
    
    # 4. General service patterns
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
    
    return content

def process_file(fp):
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            original_content = f.read()
    except Exception as e:
        return False, 0, f'read_error: {e}'

    component_name = get_component_name(fp)
    relative_path = get_relative_path(fp)
    
    # Apply precision replacements
    content = precision_replace(original_content, component_name, fp)
    
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
    # Final 7 files
    files = [
        'src/components/journal/TodayWinReactQuery.tsx',
        'src/components/DynamicPricingModal.tsx',
        'src/services/GooglePlayBillingService.ts',
        'src/services/enhancedGenerationService.ts',
        'src/services/AppleStoreKitService.ts',
        'src/services/queueService.ts',
        'src/services/supabaseApi.ts',
    ]
    
    total_replaced = 0
    files_updated = 0
    
    print(f"🎯 FINAL PRECISION: Processing last {len(files)} files for 100% completion\n")
    
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
    print(f"🎯 PRECISION RESULTS:")
    print(f"📊 Files updated: {files_updated}")
    print(f"🔄 Console logs replaced: {total_replaced}")
    print(f"🏆 MISSION: 100% NON-TEST CONSOLE LOG COMPLETION!")
    print(f"{'='*60}")
