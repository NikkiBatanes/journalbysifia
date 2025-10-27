#!/usr/bin/env python3
"""
Targeted Console Log Replacement - Real patterns found
"""

import re
import os

def add_logger_import(content, relative_path):
    if 'import { Logger } from' not in content:
        m = re.search(r"(import .+ from ['\"].+['\"];)", content)
        if m:
            first = m.group(0)
            content = content.replace(first, f"{first}\nimport {{ Logger }} from '{relative_path}';", 1)
    return content

def rel_path(fp):
    if '/services/hooks/' in fp: return '../../utils/ProductionLogger'
    if '/services/' in fp: return '../utils/ProductionLogger'
    if '/utils/' in fp: return './ProductionLogger'
    if '/storage/' in fp: return '../utils/ProductionLogger'
    if '/screens/' in fp: return '../utils/ProductionLogger'
    if '/config/' in fp: return '../utils/ProductionLogger'
    return '../utils/ProductionLogger'

def comp(fp):
    return os.path.basename(fp).replace('.tsx','').replace('.ts','')

def replace_file(fp):
    try:
        with open(fp, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception:
        return False, 0, 'read_failed'

    orig = content
    name = comp(fp)
    content = add_logger_import(content, rel_path(fp))

    # Target the actual patterns found in inspection

    # Pattern: console.error('Error creating/fetching ...:', error/err);
    content = re.sub(r"console\.error\('(Error [^']+):', (error|err)\);",
                     lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n        component: '{name}',\n      }});",
                     content)

    # Pattern: console.error('Error ...:', variable);
    content = re.sub(r"console\.error\('([^']+):', (\w+)\);",
                     lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n        component: '{name}',\n      }});",
                     content)

    # Remove commented console logs entirely
    content = re.sub(r"^\s*//\s*console\.[^;]+;.*$", "", content, flags=re.MULTILINE)

    replaced = content.count('Logger.') - orig.count('Logger.')
    if content != orig:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, replaced, None
    return False, 0, None

if __name__ == '__main__':
    # All files with remaining console logs
    import subprocess
    result = subprocess.run(
        "find src/ -name '*.ts' -o -name '*.tsx' | xargs grep -l 'console\\.' | grep -v 'ProductionLogger\\|enterpriseLogger\\|logger\\.ts'",
        shell=True, capture_output=True, text=True
    )
    
    files = [f.strip() for f in result.stdout.split('\n') if f.strip()]
    
    total = 0
    done = 0
    
    print(f"🎯 TARGETED BATCH: {len(files)} files with remaining console logs\n")

    for fp in files:
        ok, cnt, err = replace_file(fp)
        if ok and cnt > 0:
            done += 1
            total += cnt
            print(f"✅ {fp}: {cnt} logs replaced")
        elif err:
            print(f"❌ {fp}: {err}")
        # Skip "No patterns matched" to reduce noise
    
    print(f"\n🎯 Targeted Total: {total} logs replaced in {done} files")
