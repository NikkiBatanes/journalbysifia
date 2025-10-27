#!/usr/bin/env python3
"""Handle complex console log patterns"""
import re, os, subprocess

def get_files():
    result = subprocess.run("find src/ -name '*.ts' -o -name '*.tsx' | xargs grep -l 'console\\.' 2>/dev/null", shell=True, capture_output=True, text=True)
    return [f.strip() for f in result.stdout.split('\n') if f.strip() and 'ProductionLogger' not in f and 'enterpriseLogger' not in f and 'logger.ts' not in f]

def get_path(f):
    if '/services/api/' in f or '/services/hooks/' in f or '/services/cache/' in f or '/services/config/' in f: return '../../utils/ProductionLogger'
    elif '/services/' in f: return '../utils/ProductionLogger'
    elif '/components/journal/' in f or '/components/dashboard/' in f: return '../../utils/ProductionLogger'
    elif '/screens/onboarding/' in f: return '../../utils/ProductionLogger'
    elif '/storage/' in f or '/components/' in f or '/screens/' in f or '/context/' in f or '/hooks/' in f or '/utils/' in f or '/config/' in f: return '../utils/ProductionLogger'
    return '../utils/ProductionLogger'

def add_import(content, path):
    if 'import { Logger } from' not in content:
        match = re.search(r"(import .+ from ['\"].+['\"];)", content)
        if match:
            content = content.replace(match.group(0), f"{match.group(0)}\nimport {{ Logger }} from '{path}';", 1)
    return content

def replace_file(f):
    try:
        with open(f, 'r') as file: content = file.read()
    except: return 0
    orig, c = content, os.path.basename(f).replace('.tsx','').replace('.ts','')
    content = add_import(content, get_path(f))
    
    # Pattern: console.error('text:', variable);
    content = re.sub(r"console\.error\('([^']+):', (\w+)\);", lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{ component: '{c}' }});", content)
    
    # Pattern: console.warn('text:', variable);
    content = re.sub(r"console\.warn\('([^']+):', (\w+)\);", lambda m: f"Logger.warn('{m.group(1)}', {{ component: '{c}', data: {m.group(2)} }});", content)
    
    # Pattern: console.warn(`template ${var}`, data);
    content = re.sub(r"console\.warn\(`([^`]+)`, (\w+)\);", lambda m: f"Logger.warn(`{m.group(1)}`, {{ component: '{c}', data: {m.group(2)} }});", content)
    
    # Pattern: .catch(console.error);
    content = re.sub(r"\.catch\(console\.error\);", f".catch((e) => Logger.error('Async error', e as Error, {{ component: '{c}' }}));", content)
    
    # Pattern: .catch((e) => console.warn('text', e));
    content = re.sub(r"\.catch\(\(e\) => console\.warn\('([^']+)', e\)\);", lambda m: f".catch((e) => Logger.warn('{m.group(1)}', {{ component: '{c}', error: e }}));", content)
    
    # Pattern: console.error('text', { ... });
    content = re.sub(r"console\.error\('([^']+)', \{", lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n        component: '{c}',", content)
    
    # Pattern: console.warn('text', { ... });
    content = re.sub(r"console\.warn\('([^']+)', \{", lambda m: f"Logger.warn('{m.group(1)}', {{\n        component: '{c}',", content)
    
    r = content.count('Logger.') - orig.count('Logger.')
    if r > 0:
        with open(f, 'w') as file: file.write(content)
    return r

files = get_files()
total = sum(replace_file(f) for f in files)
print(f"🎯 Complex patterns: {total} logs replaced")
