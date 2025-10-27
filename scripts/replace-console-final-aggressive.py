#!/usr/bin/env python3
"""
FINAL AGGRESSIVE Console Log Replacement - All remaining 85 logs
Maximum pattern coverage with error handling
"""

import re
import os
import subprocess

def add_logger_import(content, relative_path):
    if 'import { Logger } from' not in content:
        # Find the last import statement
        imports = re.findall(r"import .+ from ['\"].+['\"];", content)
        if imports:
            last_import = imports[-1]
            content = content.replace(last_import, f"{last_import}\nimport {{ Logger }} from '{relative_path}';", 1)
    return content

def get_relative_path(fp):
    """Calculate correct relative import path"""
    if '/services/hooks/' in fp: return '../../utils/ProductionLogger'
    if '/services/api/' in fp: return '../../utils/ProductionLogger'  
    if '/services/' in fp: return '../utils/ProductionLogger'
    if '/utils/' in fp: return './ProductionLogger'
    if '/storage/' in fp: return '../utils/ProductionLogger'
    if '/screens/onboarding/' in fp: return '../../utils/ProductionLogger'
    if '/screens/' in fp: return '../utils/ProductionLogger'
    if '/config/' in fp: return '../utils/ProductionLogger'
    if '/components/__tests__/' in fp: return '../../utils/ProductionLogger'
    if '/components/' in fp: return '../utils/ProductionLogger'
    return '../utils/ProductionLogger'

def get_component_name(fp):
    return os.path.basename(fp).replace('.tsx','').replace('.ts','').replace('.test','')

def aggressive_replace(content, component_name):
    """Apply all possible console log patterns aggressively"""
    
    # 1. console.error('text:', variable);
    content = re.sub(
        r"console\.error\('([^']+):', (\w+)\);",
        lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    # 2. console.warn('text:', variable);
    content = re.sub(
        r"console\.warn\('([^']+):', (\w+)\);",
        lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{component_name}',\n        data: {m.group(2)},\n      }});",
        content
    )
    
    # 3. console.log('text:', variable);
    content = re.sub(
        r"console\.log\('([^']+):', (\w+)\);",
        lambda m: f"Logger.debug('{m.group(1)}', {{\n        component: '{component_name}',\n        data: {m.group(2)},\n      }});",
        content
    )
    
    # 4. Simple string only patterns
    content = re.sub(
        r"console\.error\('([^']+)'\);",
        lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    content = re.sub(
        r"console\.warn\('([^']+)'\);",
        lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    content = re.sub(
        r"console\.log\('([^']+)'\);",
        lambda m: f"Logger.debug('{m.group(1)}', {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    # 5. Template literals
    content = re.sub(
        r"console\.(error|warn|log)\(`([^`]+)`, ([^\)]*)\);",
        lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}(`{m.group(2)}`, {{\n        component: '{component_name}',\n        data: {m.group(3)},\n      }});",
        content
    )
    
    # 6. Template literals without data
    content = re.sub(
        r"console\.(error|warn|log)\(`([^`]+)`\);",
        lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}(`{m.group(2)}`, {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    # 7. Multi-line object starts - handle opening brace
    content = re.sub(
        r"console\.(error|warn)\('([^']+):', \{",
        lambda m: f"Logger.{m.group(1)}('{m.group(2)}', {'undefined, {' if m.group(1)=='error' else '{'}\n        component: '{component_name}',",
        content
    )
    
    # 8. JSON.stringify patterns
    content = re.sub(
        r"console\.(error|warn|log)\('([^']+):', JSON\.stringify\(([^\)]*)\)\);",
        lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}('{m.group(2)}', {'undefined, ' if m.group(1)=='error' else ''}{{\n        component: '{component_name}',\n        data: {m.group(3)},\n      }});",
        content
    )
    
    # 9. .catch(console.error) and similar
    content = re.sub(
        r"\.catch\(console\.(error|warn)\)",
        f".catch((e) => Logger.error('Async error', e as Error, {{ component: '{component_name}' }}))",
        content
    )
    
    # 10. Complex multi-parameter (aggressive)
    content = re.sub(
        r"console\.(error|warn|log)\('([^']+)', ([^,]+), '([^']+)', ([^\)]+)\);",
        lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}('{m.group(2)} {m.group(4)}', {'undefined, ' if m.group(1)=='error' else ''}{{\n        component: '{component_name}',\n        data1: {m.group(3)},\n        data2: {m.group(5)},\n      }});",
        content
    )
    
    # 11. Handle escaped quotes
    content = re.sub(
        r"console\.error\('([^']*\\'[^']*)', (\w+)\);",
        lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n        component: '{component_name}',\n      }});",
        content
    )
    
    # 12. Remove commented console logs entirely
    content = re.sub(r"^\s*//.*console\.[^;]*;.*$", "", content, flags=re.MULTILINE)
    
    return content

def process_file(fp):
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            original_content = f.read()
    except Exception as e:
        return False, 0, f'read_error: {e}'

    component_name = get_component_name(fp)
    relative_path = get_relative_path(fp)
    
    # Add Logger import if needed
    content = add_logger_import(original_content, relative_path)
    
    # Apply aggressive replacements
    content = aggressive_replace(content, component_name)
    
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
    # Get all files with console logs
    result = subprocess.run(
        "find src/ -name '*.ts' -o -name '*.tsx' | xargs grep -l 'console\\.' | grep -v 'ProductionLogger\\|enterpriseLogger\\|logger\\.ts'",
        shell=True, capture_output=True, text=True
    )
    
    files = [f.strip() for f in result.stdout.split('\n') if f.strip()]
    
    total_replaced = 0
    files_updated = 0
    errors = []
    
    print(f"🚀 FINAL AGGRESSIVE PUSH: Processing {len(files)} files with console logs\n")
    
    for fp in files:
        success, count, error = process_file(fp)
        
        if success and count > 0:
            files_updated += 1
            total_replaced += count
            print(f"✅ {fp}: {count} logs replaced")
        elif error and 'error' in error:
            errors.append(f"❌ {fp}: {error}")
            print(f"❌ {fp}: {error}")
        # Skip no_changes to reduce noise
    
    print(f"\n{'='*60}")
    print(f"🎯 FINAL RESULTS:")
    print(f"📊 Files updated: {files_updated}")
    print(f"🔄 Console logs replaced: {total_replaced}")
    print(f"❌ Errors: {len(errors)}")
    
    if errors:
        print(f"\n⚠️  Files with errors:")
        for error in errors:
            print(f"   {error}")
    
    print(f"{'='*60}")
