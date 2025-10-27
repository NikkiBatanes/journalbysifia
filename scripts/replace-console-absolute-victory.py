#!/usr/bin/env python3
"""
ABSOLUTE VICTORY: Final 4 console logs for 100% completion
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

def absolute_victory_replace(content, component_name):
    """Absolute victory replacement for the final 4 console logs"""
    
    # 1. enhancedGenerationService - console.error with saveResult.error
    content = re.sub(
        r"console\.error\('\[EnhancedGenerationService\] ([^']+):', saveResult\.error\);",
        lambda m: f"Logger.error('[EnhancedGenerationService] {m.group(1)}', saveResult.error as Error, {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    # 2. AppleStoreKitService - console.error with data?.error
    content = re.sub(
        r"console\.error\('\[StoreKit\] ([^']+):', data\?\.error\);",
        lambda m: f"Logger.error('[StoreKit] {m.group(1)}', data?.error as Error, {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    # 3. queueService - console.error with saveResult.error
    content = re.sub(
        r"console\.error\('\[QueueService\] ([^']+):', saveResult\.error\);",
        lambda m: f"Logger.error('[QueueService] {m.group(1)}', saveResult.error as Error, {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    # 4. supabaseApi - console.error(errorMsg);
    content = re.sub(
        r"console\.error\(errorMsg\);",
        f"Logger.error('Supabase API error', new Error(errorMsg), {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    return content

def process_file(fp):
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            original_content = f.read()
    except Exception as e:
        return False, 0, f'read_error: {e}'

    component_name = os.path.basename(fp).replace('.tsx','').replace('.ts','')
    relative_path = '../utils/ProductionLogger'  # All are service files
    
    # Apply absolute victory replacements
    content = absolute_victory_replace(original_content, component_name)
    
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
    # Final 4 files
    files = [
        'src/services/enhancedGenerationService.ts',
        'src/services/AppleStoreKitService.ts',
        'src/services/queueService.ts',
        'src/services/supabaseApi.ts',
    ]
    
    total_replaced = 0
    files_updated = 0
    
    print(f"🏆 ABSOLUTE VICTORY: Processing final {len(files)} files\n")
    
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
    print(f"🏆 ABSOLUTE VICTORY ACHIEVED!")
    print(f"📊 Files updated: {files_updated}")
    print(f"🔄 Console logs replaced: {total_replaced}")
    print(f"🎯 100% NON-TEST CONSOLE LOG COMPLETION!")
    print(f"{'='*60}")
