#!/usr/bin/env python3
"""Final comprehensive console log replacement"""
import re, os, subprocess

def get_files_with_console():
    result = subprocess.run("find src/ -name '*.ts' -o -name '*.tsx' | xargs grep -l 'console\\.' 2>/dev/null", shell=True, capture_output=True, text=True)
    return [f.strip() for f in result.stdout.split('\n') if f.strip() and 'ProductionLogger' not in f and 'enterpriseLogger' not in f and 'logger.ts' not in f]

def get_path(f):
    if '/services/api/' in f or '/services/hooks/' in f or '/services/cache/' in f or '/services/config/' in f or '/services/network/' in f: return '../../utils/ProductionLogger'
    elif '/services/' in f: return '../utils/ProductionLogger'
    elif '/components/journal/' in f or '/components/dashboard/' in f or '/components/onboarding/' in f: return '../../utils/ProductionLogger'
    elif '/screens/onboarding/' in f: return '../../utils/ProductionLogger'
    elif '/components/' in f or '/screens/' in f or '/context/' in f or '/hooks/' in f or '/utils/' in f or '/config/' in f or '/providers/' in f or '/navigation/' in f or '/store/' in f or '/scripts/' in f or '/systems/' in f: return '../utils/ProductionLogger'
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
    
    # Simple patterns
    content = re.sub(r"console\.log\('([^']+)'\);", lambda m: f"Logger.debug('{m.group(1)}', {{ component: '{c}' }});", content)
    content = re.sub(r"console\.error\('([^']+)'\);", lambda m: f"Logger.error('{m.group(1)}', undefined, {{ component: '{c}' }});", content)
    content = re.sub(r"console\.warn\('([^']+)'\);", lambda m: f"Logger.warn('{m.group(1)}', {{ component: '{c}' }});", content)
    content = re.sub(r"console\.log\('([^']+):', (\w+)\);", lambda m: f"Logger.debug('{m.group(1)}', {{ component: '{c}', data: {m.group(2)} }});", content)
    content = re.sub(r"console\.error\('([^']+):', (error|err|e)\);", lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{ component: '{c}' }});", content)
    content = re.sub(r"console\.warn\('([^']+):', (\w+)\);", lambda m: f"Logger.warn('{m.group(1)}', {{ component: '{c}', data: {m.group(2)} }});", content)
    
    r = content.count('Logger.') - orig.count('Logger.')
    if r > 0:
        with open(f, 'w') as file: file.write(content)
    return r

files = get_files_with_console()
total = sum(replace_file(f) for f in files)
print(f"🎯 Final batch: {total} logs replaced in {len(files)} files")
