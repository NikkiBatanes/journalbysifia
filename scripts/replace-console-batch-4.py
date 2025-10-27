#!/usr/bin/env python3
"""Console Log Replacement - Batch 4"""
import re, os

def add_logger_import(content, relative_path):
    if 'import { Logger } from' not in content:
        match = re.search(r"(import .+ from ['\"].+['\"];)", content)
        if match:
            content = content.replace(match.group(0), f"{match.group(0)}\nimport {{ Logger }} from '{relative_path}';", 1)
    return content

def get_relative_import_path(file_path):
    if '/services/api/' in file_path or '/services/hooks/' in file_path:
        return '../../utils/ProductionLogger'
    elif '/services/' in file_path:
        return '../utils/ProductionLogger'
    elif '/components/journal/' in file_path or '/components/dashboard/' in file_path:
        return '../../utils/ProductionLogger'
    elif '/components/' in file_path or '/screens/' in file_path or '/context/' in file_path:
        return '../utils/ProductionLogger'
    return '../utils/ProductionLogger'

def replace_console_logs(file_path):
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
    except Exception as e:
        return False, 0, str(e)
    
    if 'Logger.ts' in file_path or 'logger.ts' in file_path:
        return False, 0, "Skip"
    
    original = content
    component = os.path.basename(file_path).replace('.tsx', '').replace('.ts', '')
    content = add_logger_import(content, get_relative_import_path(file_path))
    
    content = re.sub(r"console\.log\('([^']+)'\);", lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{component}',\n    }});", content)
    content = re.sub(r"console\.error\('([^']+)'\);", lambda m: f"Logger.error('{m.group(1)}', undefined, {{\n      component: '{component}',\n    }});", content)
    content = re.sub(r"console\.warn\('([^']+)'\);", lambda m: f"Logger.warn('{m.group(1)}', {{\n      component: '{component}',\n    }});", content)
    content = re.sub(r"console\.log\('([^']+):', (\w+)\);", lambda m: f"Logger.debug('{m.group(1)}', {{\n      component: '{component}',\n      data: {m.group(2)},\n    }});", content)
    content = re.sub(r"console\.error\('([^']+):', (error|err)\);", lambda m: f"Logger.error('{m.group(1)}', {m.group(2)} as Error, {{\n      component: '{component}',\n    }});", content)
    
    replacements = len(re.findall(r'Logger\.(error|warn|debug)', content)) - len(re.findall(r'Logger\.(error|warn|debug)', original))
    
    if content != original:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        return True, replacements, None
    return False, 0, None

if __name__ == "__main__":
    files = [
        'src/services/api/prayerApi.ts',
        'src/screens/DevotionalDetailScreen.tsx',
        'src/context/AuthContext.tsx',
        'src/components/journal/TimeBlockReactQuery.tsx',
        'src/components/journal/PrayerLogEditor.tsx',
        'src/components/dashboard/PlaybookCarousel.tsx',
        'src/services/onboardingAnalyticsService.ts',
        'src/services/modernPlaybookApi.ts',
        'src/services/modernDevotionalApi.ts',
        'src/services/hooks/useJournalData.ts',
    ]
    
    total = 0
    print(f"🔍 Batch 4: {len(files)} files...\n")
    
    for f in files:
        success, count, _ = replace_console_logs(f)
        if success:
            total += count
            print(f"✅ {f}: {count}")
    
    print(f"\n🎯 Batch 4: {total} logs replaced")
