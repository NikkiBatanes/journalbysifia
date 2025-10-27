#!/usr/bin/env python3
"""
High-Impact Console Log Replacement - Files with 4+ logs
Aggressive but safe pattern matching for maximum impact
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
    if '/components/__tests__/' in fp: return '../../utils/ProductionLogger'
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

    # Aggressive pattern matching for high-impact files

    # 1. Simple console.error/warn/log with string + variable
    content = re.sub(r"console\.(error|warn|log)\('([^']+):', (\w+)\);",
                     lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}('{m.group(2)}', {'undefined' if m.group(1)=='error' else ''}{m.group(3)} {'as Error' if m.group(1)=='error' else ''}, {{\n  component: '{name}',\n}});",
                     content)

    # 2. Template literals with variables
    content = re.sub(r"console\.(error|warn|log)\(`([^`]+)`, ([^\)]*)\);",
                     lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}(`{m.group(2)}`, {{\n  component: '{name}',\n  data: {m.group(3)},\n}});",
                     content)

    # 3. Object parameters - start of multi-line
    content = re.sub(r"console\.(error|warn)\('([^']+):', \{",
                     lambda m: f"Logger.{m.group(1)}('{m.group(2)}', {'undefined, {' if m.group(1)=='error' else '{'}\n  component: '{name}',",
                     content)

    # 4. Simple string only
    content = re.sub(r"console\.(error|warn|log)\('([^']+)'\);",
                     lambda m: f"Logger.{'debug' if m.group(1)=='log' else m.group(1)}('{m.group(2)}', {'undefined, ' if m.group(1)=='error' else ''}{{\n  component: '{name}',\n}});",
                     content)

    # 5. JSON.stringify patterns
    content = re.sub(r"console\.(error|warn)\('([^']+):', JSON\.stringify\(([^\)]*)\)\);",
                     lambda m: f"Logger.{m.group(1)}('{m.group(2)}', {'undefined, ' if m.group(1)=='error' else ''}{{\n  component: '{name}',\n  data: {m.group(3)},\n}});",
                     content)

    # 6. .catch(console.error) patterns
    content = re.sub(r"\.catch\(console\.(error|warn)\)", f".catch((e) => Logger.error('Async error', e as Error, {{ component: '{name}' }}))", content)

    # 7. Complex multi-parameter patterns (be more aggressive)
    content = re.sub(r"console\.(error|warn)\('([^']+)', ([^,]+), '([^']+)', ([^\)]+)\);",
                     lambda m: f"Logger.{m.group(1)}('{m.group(2)} {m.group(4)}', {'undefined, ' if m.group(1)=='error' else ''}{{\n  component: '{name}',\n  data1: {m.group(3)},\n  data2: {m.group(5)},\n}});",
                     content)

    replaced = content.count('Logger.') - orig.count('Logger.')
    if content != orig:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, replaced, None
    return False, 0, None

if __name__ == '__main__':
    # High-impact files (4+ console logs each)
    files = [
        'src/services/supabaseClient.ts',
        'src/services/hooks/useJournalData.ts', 
        'src/services/AppleStoreKitService.ts',
        'src/components/__tests__/OnboardingErrorBoundary.test.tsx',
    ]

    total = 0
    done = 0
    
    print(f"🎯 HIGH-IMPACT BATCH: {len(files)} files with 4+ console logs each\n")

    for fp in files:
        ok, cnt, err = replace_file(fp)
        if ok:
            done += 1
            total += cnt
            print(f"✅ {fp}: {cnt} logs replaced")
        elif err:
            print(f"❌ {fp}: {err}")
        else:
            print(f"⚠️  {fp}: No patterns matched")
    
    print(f"\n🎯 High-Impact Total: {total} logs replaced in {done} files")
    print(f"📊 Expected impact: ~16 console logs removed")
