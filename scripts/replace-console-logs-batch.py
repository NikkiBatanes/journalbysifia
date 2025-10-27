#!/usr/bin/env python3
"""
Batch Console Log Replacement Script
Handles multiple files: onboardingService, supabaseApi, prayerStorage, modernPlaybookApi
"""

import re
import sys

def add_logger_import(content, relative_path='../utils/ProductionLogger'):
    """Add Logger import if not present"""
    if 'import { Logger } from' not in content:
        # Find the last import statement
        import_pattern = r'(import .+ from .+;)\n(?!import)'
        content = re.sub(import_pattern, f"\\1\nimport {{ Logger }} from '{relative_path}';\n", content, count=1)
    return content

def replace_console_logs_generic(content, component_name):
    """Generic console log replacement for any file"""
    replacements = 0
    
    # Pattern 1: console.error with message and error variable
    pattern1 = r"console\.error\('(.+?):', (\w+)\);"
    matches1 = re.findall(pattern1, content)
    content = re.sub(
        pattern1,
        lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n      component: '{component_name}',\n      action: 'error',\n    }});",
        content
    )
    replacements += len(matches1)
    
    # Pattern 2: console.error with template literal
    pattern2 = r"console\.error\(`(.+?)`, (\w+)\);"
    matches2 = re.findall(pattern2, content)
    content = re.sub(
        pattern2,
        lambda m: f"Logger.error(`{m.group(1)}`, {m.group(2)} as Error, {{\n      component: '{component_name}',\n      action: 'error',\n    }});",
        content
    )
    replacements += len(matches2)
    
    # Pattern 3: console.warn with message and variable
    pattern3 = r"console\.warn\('(.+?):', (\w+)\);"
    matches3 = re.findall(pattern3, content)
    content = re.sub(
        pattern3,
        lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{component_name}',\n      action: 'warning',\n      data: {m.group(2)},\n    }});",
        content
    )
    replacements += len(matches3)
    
    # Pattern 4: console.error with just message (no variable)
    pattern4 = r"console\.error\('([^']+)'\);"
    matches4 = re.findall(pattern4, content)
    content = re.sub(
        pattern4,
        lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n      component: '{component_name}',\n      action: 'error',\n    }});",
        content
    )
    replacements += len(matches4)
    
    # Pattern 5: console.warn with just message (no variable)
    pattern5 = r"console\.warn\('([^']+)'\);"
    matches5 = re.findall(pattern5, content)
    content = re.sub(
        pattern5,
        lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{component_name}',\n      action: 'warning',\n    }});",
        content
    )
    replacements += len(matches5)
    
    # Pattern 6: console.log (convert to Logger.debug)
    pattern6 = r"console\.log\('([^']+)'\);"
    matches6 = re.findall(pattern6, content)
    content = re.sub(
        pattern6,
        lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{component_name}',\n    }});",
        content
    )
    replacements += len(matches6)
    
    # Pattern 7: console.error with template literal and no variable
    pattern7 = r"console\.error\(`([^`]+)`\);"
    matches7 = re.findall(pattern7, content)
    content = re.sub(
        pattern7,
        lambda m: f"Logger.error(`{m.group(1)}`, undefined, {{\n      component: '{component_name}',\n      action: 'error',\n    }});",
        content
    )
    replacements += len(matches7)
    
    return content, replacements

def process_file(file_path, component_name, relative_import='../utils/ProductionLogger'):
    """Process a single file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # Add Logger import
        content = add_logger_import(content, relative_import)
        
        # Replace console logs
        content, replacements = replace_console_logs_generic(content, component_name)
        
        # Write back if changes were made
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True, replacements
        else:
            return False, 0
    except Exception as e:
        print(f"❌ Error processing {file_path}: {e}")
        return False, 0

def main():
    """Process all target files"""
    files = [
        ('src/services/onboardingService.ts', 'onboardingService', '../utils/ProductionLogger'),
        ('src/services/supabaseApi.ts', 'supabaseApi', '../utils/ProductionLogger'),
        ('src/storage/prayerStorage.ts', 'prayerStorage', '../utils/ProductionLogger'),
        ('src/services/modernPlaybookApi.ts', 'modernPlaybookApi', '../utils/ProductionLogger'),
    ]
    
    total_replacements = 0
    successful_files = 0
    
    print("🚀 Starting batch console log replacement...\n")
    
    for file_path, component_name, relative_import in files:
        print(f"📝 Processing {file_path}...")
        success, replacements = process_file(file_path, component_name, relative_import)
        
        if success:
            successful_files += 1
            total_replacements += replacements
            print(f"   ✅ Replaced {replacements} console logs")
        else:
            print(f"   ⚠️  No changes made")
        print()
    
    print("=" * 60)
    print(f"✅ Batch processing complete!")
    print(f"📊 Files processed: {successful_files}/{len(files)}")
    print(f"🎯 Total replacements: {total_replacements}")
    print("=" * 60)
    
    return 0 if successful_files > 0 else 1

if __name__ == "__main__":
    sys.exit(main())
