#!/usr/bin/env python3
"""
Careful Console Log Replacement - Batch 4 (10 files)
Handles common patterns safely
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
    if '/utils/' in fp: return './ProductionLogger'
    if '/services/' in fp: return '../utils/ProductionLogger'
    if '/services/network/' in fp: return '../../utils/ProductionLogger'
    if '/services/hooks/' in fp: return '../../utils/ProductionLogger'
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

    # console.error('text:', errorVar);
    content = re.sub(r"console\.error\('([^']+):', (\w+)\);",
                     lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n  component: '{name}',\n}});",
                     content)

    # console.error('text', errVar);
    content = re.sub(r"console\.error\('([^']+)', (\w+)\);",
                     lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n  component: '{name}',\n}});",
                     content)

    # console.warn('text:', { ... }) include component key
    content = re.sub(r"console\.warn\('([^']+):', \{",
                     lambda m: f"Logger.warn('{m.group(1)}', {{\n  component: '{name}',",
                     content)

    # template warn/info/log with data param
    content = re.sub(r"console\.(warn|info|log)\(`([^`]+)`, ([^\)]*)\);",
                     lambda m: f"Logger.{ 'debug' if m.group(1)=='log' else m.group(1) }(`{m.group(2)}`, {{\n  component: '{name}',\n  data: {m.group(3)},\n}});",
                     content)

    # .catch(console.error)
    content = re.sub(r"\.catch\(console\.error\)", f".catch((e) => Logger.error('Async error', e as Error, {{ component: '{name}' }}))", content)

    replaced = content.count('Logger.') - orig.count('Logger.')
    if content != orig:
        with open(fp, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, replaced, None
    return False, 0, None

if __name__ == '__main__':
    files = [
        'src/services/queueService.ts',
        'src/services/PlatformPaymentService.ts',
        'src/services/performanceMonitoringService.ts',
        'src/services/network/networkManager.ts',
        'src/services/hooks/useTimeBlockData.ts',
        'src/services/hooks/useReflectionData.ts',
        'src/services/enhancedGenerationService.ts',
        'src/services/DiscountCodeService.ts',
        'src/services/calendarSyncService.ts',
        'src/services/avatarService.ts',
    ]

    total = 0
    done = 0
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
    print(f"\n🎯 Batch 4 Total: {total} logs replaced in {done} files")
