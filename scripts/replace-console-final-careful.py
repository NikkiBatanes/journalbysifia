#!/usr/bin/env python3
"""
Careful Console Log Replacement - Final batches
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
    """Calculate relative import path based on file location"""
    if '/services/api/' in file_path or '/services/hooks/' in file_path:
        return '../../utils/ProductionLogger'
    elif '/services/' in file_path:
        return '../utils/ProductionLogger'
    elif '/components/journal/' in file_path or '/components/dashboard/' in file_path:
        return '../../utils/ProductionLogger'
    elif '/components/' in file_path or '/screens/' in file_path or '/context/' in file_path or '/utils/' in file_path:
        return '../utils/ProductionLogger'
    else:
        return '../utils/ProductionLogger'

def get_component_name(file_path):
    """Extract component name from file path"""
    return os.path.basename(file_path).replace('.tsx', '').replace('.ts', '')

def replace_console_logs(file_path):
    """Replace console logs carefully"""
    
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return False, 0, str(e)
    
    original_content = content
    component_name = get_component_name(file_path)
    relative_import = get_relative_import_path(file_path)
    
    # Skip logger files
    if 'Logger.ts' in file_path or 'logger.ts' in file_path:
        return False, 0, "Skipping logger file"
    
    # Add Logger import
    content = add_logger_import(content, relative_import)
    
    # Very simple, safe patterns only
    content = re.sub(r"console\.log\('([^']+)'\);", lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{component_name}',\n    }});", content)
    content = re.sub(r"console\.error\('([^']+)'\);", lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n      component: '{component_name}',\n    }});", content)
    content = re.sub(r"console\.warn\('([^']+)'\);", lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{component_name}',\n    }});", content)
    
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
    # Get all files with console logs
    import subprocess
    result = subprocess.run(
        "find src/ -name '*.ts' -o -name '*.tsx' | xargs grep -l 'console\\.' 2>/dev/null",
        shell=True,
        capture_output=True,
        text=True
    )
    
    files_with_console = [f.strip() for f in result.stdout.split('\n') if f.strip() and 'ProductionLogger' not in f and 'enterpriseLogger' not in f and 'logger.ts' not in f]
    
    total_replaced = 0
    total_files = 0
    errors = []
    
    print(f"🔍 Found {len(files_with_console)} files with remaining console logs\n")
    
    for file_path in files_with_console:
        success, count, error = replace_console_logs(file_path)
        if success:
            total_files += 1
            total_replaced += count
            print(f"✅ {file_path}: {count} logs")
        elif error and "Skipping" not in error:
            errors.append(f"{file_path}: {error}")
    
    print(f"\n{'='*60}")
    print(f"🎯 Total: {total_replaced} console logs replaced in {total_files} files")
    
    if errors:
        print(f"\n⚠️  Errors in {len(errors)} files:")
        for err in errors[:10]:
            print(f"  - {err}")
    
    print(f"{'='*60}")
