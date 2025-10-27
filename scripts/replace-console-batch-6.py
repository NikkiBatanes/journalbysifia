#!/usr/bin/env python3
"""
Careful Console Log Replacement - Batch of 6 files
"""

import re
import os

def add_logger_import(content, relative_path):
    """Add Logger import if not present"""
    if 'import { Logger } from' not in content:
        # Find the first import statement
        import_pattern = r"(import .+ from ['\"].+['\"];)"
        match = re.search(import_pattern, content)
        if match:
            first_import = match.group(0)
            content = content.replace(first_import, f"{first_import}\nimport {{ Logger }} from '{relative_path}';", 1)
    return content

def get_relative_import_path(file_path):
    """Calculate relative import path based on file location"""
    if '/services/hooks/' in file_path or '/services/cache/' in file_path:
        return '../../utils/ProductionLogger'
    elif '/services/' in file_path:
        return '../utils/ProductionLogger'
    elif '/components/' in file_path or '/screens/' in file_path or '/context/' in file_path or '/utils/' in file_path:
        return '../utils/ProductionLogger'
    else:
        return '../utils/ProductionLogger'

def get_component_name(file_path):
    """Extract component name from file path"""
    return os.path.basename(file_path).replace('.tsx', '').replace('.ts', '')

def replace_simple_console_logs(file_path):
    """Replace only simple, safe console log patterns"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return False, 0, str(e)
    
    original_content = content
    component_name = get_component_name(file_path)
    relative_import = get_relative_import_path(file_path)
    
    # Add Logger import
    content = add_logger_import(content, relative_import)
    
    # Only replace simple, single-line patterns
    
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
    
    # Pattern 6: console.warn('string:', variable);
    content = re.sub(
        r"console\.warn\('([^']+):', (\w+)\);",
        lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{component_name}',\n      data: {m.group(2)},\n    }});",
        content
    )
    
    replacements_made = len(re.findall(r'Logger\.(error|warn|debug|info)', content)) - len(re.findall(r'Logger\.(error|warn|debug|info)', original_content))
    
    if content != original_content:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True, replacements_made, None
        except Exception as e:
            return False, 0, str(e)
    else:
        return False, 0, None

if __name__ == "__main__":
    files = [
        'src/services/enhancedQueueService.ts',
        'src/context/OnboardingContext.tsx',
        'src/components/journal/TodosReactQuery.tsx',
        'src/components/AuthStateMonitor.tsx',
        'src/utils/authErrorHandler.ts',
        'src/services/hooks/useDevotionalDataSimplified.ts',
    ]
    
    total_replaced = 0
    total_files = 0
    errors = []
    
    print(f"🔍 Processing {len(files)} files carefully...\n")
    
    for file_path in files:
        success, count, error = replace_simple_console_logs(file_path)
        if success:
            total_files += 1
            total_replaced += count
            print(f"✅ {file_path}: {count} logs replaced")
        elif error:
            errors.append(f"{file_path}: {error}")
            print(f"❌ {file_path}: {error}")
        else:
            print(f"⚠️  {file_path}: No simple patterns found")
    
    print(f"\n{'='*60}")
    print(f"🎯 Total: {total_replaced} console logs replaced in {total_files} files")
    
    if errors:
        print(f"\n⚠️  Errors in {len(errors)} files:")
        for err in errors:
            print(f"  - {err}")
    
    print(f"{'='*60}")
