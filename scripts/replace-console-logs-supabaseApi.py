#!/usr/bin/env python3
"""
Automated Console Log Replacement Script for supabaseApi.ts
"""

import re

def replace_console_logs(file_path):
    """Replace console logs with Logger calls"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Add Logger import if not present
    if 'import { Logger } from' not in content:
        import_pattern = r"(import .+ from 'react-native';)"
        content = re.sub(import_pattern, r"\1\nimport { Logger } from '../utils/ProductionLogger';", content, count=1)
    
    # Replace console.error with Logger.error
    content = re.sub(
        r"console\.error\('(.+?):', (\w+)\);",
        r"Logger.error('\1', \2 as Error, {\n      component: 'supabaseApi',\n      action: 'error',\n    });",
        content
    )
    
    # Replace console.warn with Logger.warn
    content = re.sub(
        r"console\.warn\('(.+?)'\);",
        r"Logger.warn('\1', {\n      component: 'supabaseApi',\n    });",
        content
    )
    
    # Replace console.warn with variable
    content = re.sub(
        r"console\.warn\('(.+?):', (\w+)\);",
        r"Logger.warn('\1', {\n      component: 'supabaseApi',\n      error: \2,\n    });",
        content
    )
    
    # Replace console.warn with template literal
    content = re.sub(
        r"console\.warn\(`(.+?)`\);",
        r"Logger.warn(`\1`, {\n      component: 'supabaseApi',\n    });",
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
    file_path = "src/services/supabaseApi.ts"
    replace_console_logs(file_path)
