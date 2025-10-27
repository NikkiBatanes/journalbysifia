#!/usr/bin/env python3
"""
Automated Console Log Replacement for AppleStoreKitService, notificationManagementService, queueService
"""

import re

def add_logger_import(content):
    """Add Logger import if not present"""
    if 'import { Logger } from' not in content:
        import_pattern = r"(import .+ from '.+';)"
        match = re.search(import_pattern, content)
        if match:
            first_import = match.group(0)
            content = content.replace(first_import, first_import + "\nimport { Logger } from '../utils/ProductionLogger';", 1)
    return content

def replace_console_logs(file_path, component_name):
    """Replace console logs with Logger calls"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Add Logger import
    content = add_logger_import(content)
    
    # Pattern 1: console.error('...:', error);
    content = re.sub(
        r"console\.error\('([^']+):', (\w+)\);",
        lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n      component: '{component_name}',\n      action: 'error',\n    }});",
        content
    )
    
    # Pattern 2: console.error(`...`, error);
    content = re.sub(
        r"console\.error\(`([^`]+)`, (\w+)\);",
        lambda m: f"Logger.error(`{m.group(1)}`, {m.group(2)} as Error, {{\n      component: '{component_name}',\n      action: 'error',\n    }});",
        content
    )
    
    # Pattern 3: console.warn('...:', error);
    content = re.sub(
        r"console\.warn\('([^']+):', (\w+)\);",
        lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{component_name}',\n      error: {m.group(2)},\n    }});",
        content
    )
    
    # Pattern 4: console.warn(`...`, error);
    content = re.sub(
        r"console\.warn\(`([^`]+)`, (\w+)\);",
        lambda m: f"Logger.warn(`{m.group(1)}`, {{\n      component: '{component_name}',\n      error: {m.group(2)},\n    }});",
        content
    )
    
    # Pattern 5: console.warn('...');
    content = re.sub(
        r"console\.warn\('([^']+)'\);",
        lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{component_name}',\n    }});",
        content
    )
    
    # Pattern 6: console.warn(`...`);
    content = re.sub(
        r"console\.warn\(`([^`]+)`\);",
        lambda m: f"Logger.warn(`{m.group(1)}`, {{\n      component: '{component_name}',\n    }});",
        content
    )
    
    # Pattern 7: console.error('...');
    content = re.sub(
        r"console\.error\('([^']+)'\);",
        lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n      component: '{component_name}',\n      action: 'error',\n    }});",
        content
    )
    
    # Pattern 8: console.log('...:', value);
    content = re.sub(
        r"console\.log\('([^']+):', (\w+)\);",
        lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{component_name}',\n      data: {m.group(2)},\n    }});",
        content
    )
    
    # Pattern 9: console.log('...');
    content = re.sub(
        r"console\.log\('([^']+)'\);",
        lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{component_name}',\n    }});",
        content
    )
    
    replacements = content.count('Logger.error') + content.count('Logger.warn') + content.count('Logger.debug')
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, replacements
    else:
        return False, 0

if __name__ == "__main__":
    files = [
        ('src/services/AppleStoreKitService.ts', 'AppleStoreKitService'),
        ('src/services/notificationManagementService.ts', 'notificationManagementService'),
        ('src/services/queueService.ts', 'queueService'),
    ]
    
    total = 0
    for file_path, component in files:
        success, count = replace_console_logs(file_path, component)
        if success:
            print(f"✅ {file_path}: Replaced {count} console logs")
            total += count
        else:
            print(f"⚠️  {file_path}: No changes")
    
    print(f"\n🎯 Total: {total} console logs replaced")
