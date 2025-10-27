#!/usr/bin/env python3
import re, os

def add_logger_import(content, relative_path):
    if 'import { Logger } from' not in content:
        match = re.search(r"(import .+ from ['\"].+['\"];)", content)
        if match:
            content = content.replace(match.group(0), f"{match.group(0)}\nimport {{ Logger }} from '{relative_path}';", 1)
    return content

def get_path(f):
    if '/services/api/' in f or '/services/hooks/' in f: return '../../utils/ProductionLogger'
    elif '/services/' in f: return '../utils/ProductionLogger'
    elif '/components/journal/' in f or '/components/dashboard/' in f: return '../../utils/ProductionLogger'
    elif '/screens/onboarding/' in f: return '../../utils/ProductionLogger'
    elif '/components/' in f or '/screens/' in f or '/hooks/' in f: return '../utils/ProductionLogger'
    return '../utils/ProductionLogger'

def replace(f):
    try:
        with open(f, 'r') as file: content = file.read()
    except: return False, 0
    if 'Logger.ts' in f or 'logger.ts' in f: return False, 0
    orig, c = content, os.path.basename(f).replace('.tsx','').replace('.ts','')
    content = add_logger_import(content, get_path(f))
    content = re.sub(r"console\.log\('([^']+)'\);", lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{c}',\n    }});", content)
    content = re.sub(r"console\.error\('([^']+)'\);", lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n      component: '{c}',\n    }});", content)
    content = re.sub(r"console\.warn\('([^']+)'\);", lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{c}',\n    }});", content)
    content = re.sub(r"console\.log\('([^']+):', (\w+)\);", lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{c}',\n      data: {m.group(2)},\n    }});", content)
    r = len(re.findall(r'Logger\.(error|warn|debug)', content)) - len(re.findall(r'Logger\.(error|warn|debug)', orig))
    if content != orig:
        with open(f, 'w') as file: file.write(content)
        return True, r
    return False, 0

files = ['src/services/modernPlaybookApi.ts','src/services/hooks/useJournalData.ts','src/screens/PlaybookListScreen.tsx','src/screens/onboarding/OnboardingPlaybookGenerationScreen.tsx','src/screens/onboarding/OnboardingPersonalizationScreen.tsx','src/screens/DashboardHomeScreen.tsx','src/hooks/usePlatformSubscription.ts','src/components/journal/TodayWinReactQuery.tsx','src/components/journal/GratitudeListReactQuery.tsx','src/components/dashboard/PlaybookCarousel.tsx']
total = 0
print("🔍 Batch 5...\n")
for f in files:
    s, c = replace(f)
    if s: total += c; print(f"✅ {f}: {c}")
print(f"\n🎯 Batch 5: {total} logs")
