#!/usr/bin/env python3
"""
Automated Console Log Replacement Script for onboardingService.ts
Handles [OnboardingService] prefixed console logs
"""

import re

def replace_console_logs(file_path):
    """Replace console logs with Logger calls"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Add Logger import if not present
    if 'import { Logger } from' not in content:
        # Find first import and add after it
        import_pattern = r"(import .+ from '.+';)"
        match = re.search(import_pattern, content)
        if match:
            first_import = match.group(0)
            content = content.replace(first_import, first_import + "\nimport { Logger } from '../utils/ProductionLogger';", 1)
    
    # Pattern 1: console.error('[OnboardingService] ...:', error);
    content = re.sub(
        r"console\.error\('\[OnboardingService\] ([^']+):', (\w+)\);",
        r"Logger.error('[OnboardingService] \1', \2 as Error, {\n      component: 'onboardingService',\n      action: 'onboarding',\n    });",
        content
    )
    
    # Pattern 2: console.warn('[OnboardingService] ...:', error);
    content = re.sub(
        r"console\.warn\('\[OnboardingService\] ([^']+):', (\w+)\);",
        r"Logger.warn('[OnboardingService] \1', {\n      component: 'onboardingService',\n      error: \2,\n    });",
        content
    )
    
    # Pattern 3: console.warn('[OnboardingService] ...');
    content = re.sub(
        r"console\.warn\('\[OnboardingService\] ([^']+)'\);",
        r"Logger.warn('[OnboardingService] \1', {\n      component: 'onboardingService',\n    });",
        content
    )
    
    replacements = content.count('Logger.error') + content.count('Logger.warn')
    
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"✅ Successfully replaced {replacements} console log statements")
        print(f"📝 File updated: {file_path}")
        return True
    else:
        print("⚠️ No changes made")
        return False

if __name__ == "__main__":
    file_path = "src/services/onboardingService.ts"
    replace_console_logs(file_path)
