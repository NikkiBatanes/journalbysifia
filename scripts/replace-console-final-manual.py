#!/usr/bin/env python3
"""
FINAL MANUAL Console Log Replacement - Last 48 logs
Targeted manual patterns for 100% completion
"""

import re
import os

def add_logger_import(content, relative_path):
    if 'import { Logger } from' not in content:
        # Find the last import statement
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

def manual_replace_patterns(content, component_name):
    """Manual replacement for specific remaining patterns"""
    
    # 1. .catch((e) => console.warn('text:', e)) patterns
    content = re.sub(
        r"\.catch\(\(e\) => console\.warn\('([^']+):', e\)\)",
        f".catch((e) => Logger.warn('{component_name}: \\1', {{ component: '{component_name}', error: e }}))",
        content
    )
    
    # 2. console.warn('text', error) patterns  
    content = re.sub(
        r"console\.warn\('([^']+)', (error|err)\);",
        lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{component_name}',\n        error: {m.group(2)},\n      }});",
        content
    )
    
    # 3. console.warn('[Service] text', error) patterns
    content = re.sub(
        r"console\.warn\('\[([^\]]+)\] ([^']+)', (error|err)\);",
        lambda m: f"Logger.warn('[{m.group(1)}] {m.group(2)}', {{\n        component: '{component_name}',\n        error: {m.group(3)},\n      }});",
        content
    )
    
    # 4. Don't replace test file console.error assignments (they're for mocking)
    if '.test.' not in component_name and '__tests__' not in component_name:
        # Regular console.error patterns
        content = re.sub(
            r"console\.error\('([^']+)', (\w+)\);",
            lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n        component: '{component_name}',\n      }});",
            content
        )
    
    # 5. console.warn with table/column not found patterns
    content = re.sub(
        r"console\.warn\('([^']+):', ([^)]+)\);",
        lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{component_name}',\n        details: {m.group(2)},\n      }});",
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
    
    # Skip test files for console.error assignments (they're mocking)
    if '.test.' in fp or '__tests__' in fp:
        # Only replace actual console log calls, not assignments
        content = re.sub(
            r"(?<!console\.error = )(?<!= )console\.(warn|log)\('([^']+)'\);",
            lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}('{m.group(2)}', {{\n        component: '{component_name}',\n      }});",
            original_content
        )
        if content != original_content:
            content = add_logger_import(content, relative_path)
    else:
        # Add Logger import if needed
        content = add_logger_import(original_content, relative_path)
        # Apply manual replacements
        content = manual_replace_patterns(content, component_name)
    
    # Count replacements
    original_logger_count = original_content.count('Logger.')
    new_logger_count = content.count('Logger.')
    replacements = new_logger_count - original_logger_count
    
    if content != original_content:
        try:
            with open(fp, 'w', encoding='utf-8') as f:
                f.write(content)
            return True, replacements, None
        except Exception as e:
            return False, 0, f'write_error: {e}'
    
    return False, 0, 'no_changes'

if __name__ == '__main__':
    # Files with remaining console logs
    files = [
        'src/screens/DashboardHomeScreen.tsx',
        'src/components/__tests__/OnboardingErrorBoundary.test.tsx',
        'src/services/notificationManagementService.ts',
        'src/services/faithPointsService.ts',
        'src/services/enterpriseLoggingService.ts',
        'src/services/AppleStoreKitService.ts',
        'src/components/dashboard/PlaybookCarousel.tsx',
        'src/storage/reflectionStorage.ts',
        'src/services/supabaseApi.ts',
        'src/services/queueService.ts',
        'src/services/PlatformPaymentService.ts',
        'src/services/network/networkManager.ts',
        'src/services/GooglePlayBillingService.ts',
        'src/services/enhancedGenerationService.ts',
        'src/screens/UserProfileScreen.tsx',
        'src/screens/SmartJournalingReflectionModal.tsx',
        'src/screens/DevotionalsScreen.tsx',
        'src/components/journal/TodosReactQuery.tsx',
        'src/components/journal/TodayWinReactQuery.tsx',
        'src/components/journal/GratitudeListReactQuery.tsx',
        'src/components/ErrorBoundary/QueryErrorBoundary.tsx',
        'src/components/ErrorBoundary/ComponentErrorBoundary.tsx',
        'src/components/ErrorBoundary.tsx',
        'src/components/DynamicPricingModal.tsx',
        'src/components/dashboard/ReflectionQuestionsCard.tsx',
    ]
    
    total_replaced = 0
    files_updated = 0
    errors = []
    
    print(f"🎯 FINAL MANUAL REVIEW: Processing {len(files)} files with remaining console logs\n")
    
    for fp in files:
        if os.path.exists(fp):
            success, count, error = process_file(fp)
            
            if success and count > 0:
                files_updated += 1
                total_replaced += count
                print(f"✅ {fp}: {count} logs replaced")
            elif error and 'error' in error:
                errors.append(f"❌ {fp}: {error}")
                print(f"❌ {fp}: {error}")
            # Skip no_changes to reduce noise
        else:
            print(f"⚠️  {fp}: File not found")
    
    print(f"\n{'='*60}")
    print(f"🎯 MANUAL REVIEW RESULTS:")
    print(f"📊 Files updated: {files_updated}")
    print(f"🔄 Console logs replaced: {total_replaced}")
    print(f"❌ Errors: {len(errors)}")
    
    if errors:
        print(f"\n⚠️  Files with errors:")
        for error in errors:
            print(f"   {error}")
    
    print(f"{'='*60}")
