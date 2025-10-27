#!/usr/bin/env python3
"""
ABSOLUTE FINAL Console Log Replacement - Last 32 logs
100% completion with manual precision
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
    if '/storage/' in fp: return '../utils/ProductionLogger'
    if '/components/dashboard/' in fp: return '../../utils/ProductionLogger'
    if '/components/journal/' in fp: return '../../utils/ProductionLogger'
    if '/components/ErrorBoundary/' in fp: return '../../utils/ProductionLogger'
    if '/components/' in fp: return '../utils/ProductionLogger'
    return '../utils/ProductionLogger'

def get_component_name(fp):
    return os.path.basename(fp).replace('.tsx','').replace('.ts','').replace('.test','')

def absolute_final_replace(content, component_name, file_path):
    """Absolute final replacement for the last remaining patterns"""
    
    # Skip test files entirely (they use console for mocking)
    if '.test.' in file_path or '__tests__' in file_path:
        return content
    
    # 1. ErrorBoundary files - console.error with multiple params
    if 'ErrorBoundary' in file_path:
        content = re.sub(
            r"console\.error\('([^']+):', error, errorInfo\);",
            f"Logger.error('{component_name}: \\1', error, {{\n        component: '{component_name}',\n        errorInfo,\n      }});",
            content
        )
    
    # 2. SmartJournalingReflectionModal - console.warn with variable
    elif 'SmartJournalingReflectionModal' in file_path:
        content = re.sub(
            r"console\.warn\('([^']+)', ([^)]+)\);",
            lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{component_name}',\n        error: {m.group(2)},\n      }});",
            content
        )
    
    # 3. TodosReactQuery - console.error with multiple params
    elif 'TodosReactQuery' in file_path:
        content = re.sub(
            r"console\.error\('([^']+):', ([^,]+), ([^)]+)\);",
            lambda m: f"Logger.error('{m.group(1)}', {m.group(3)} as Error, {{\n        component: '{component_name}',\n        todoText: {m.group(2)},\n      }});",
            content
        )
    
    # 4. General remaining patterns
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
        
        # Simple patterns
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
    
    # Apply absolute final replacements
    content = absolute_final_replace(original_content, component_name, fp)
    
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
    # Specific remaining files
    files = [
        'src/screens/SmartJournalingReflectionModal.tsx',
        'src/screens/UserProfileScreen.tsx',
        'src/components/journal/TodosReactQuery.tsx',
        'src/components/journal/TodayWinReactQuery.tsx',
        'src/components/journal/GratitudeListReactQuery.tsx',
        'src/components/DynamicPricingModal.tsx',
        'src/components/ErrorBoundary/ComponentErrorBoundary.tsx',
        'src/components/ErrorBoundary/QueryErrorBoundary.tsx',
        'src/components/ErrorBoundary.tsx',
        'src/services/supabaseApi.ts',
        'src/services/queueService.ts',
        'src/services/GooglePlayBillingService.ts',
        'src/services/enhancedGenerationService.ts',
        'src/services/AppleStoreKitService.ts',
    ]
    
    total_replaced = 0
    files_updated = 0
    
    print(f"🎯 ABSOLUTE FINAL REPLACEMENT: Processing {len(files)} files\n")
    
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
    print(f"🎯 ABSOLUTE FINAL RESULTS:")
    print(f"📊 Files updated: {files_updated}")
    print(f"🔄 Console logs replaced: {total_replaced}")
    print(f"{'='*60}")
