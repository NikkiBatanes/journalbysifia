#!/usr/bin/env python3
"""
Automated Console Log Replacement Script for supabaseApiNormalized.ts
Replaces console.log/warn/error with Logger calls
"""

import re

def replace_console_logs(file_path):
    """Replace console logs with Logger calls in supabaseApiNormalized.ts"""
    
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Add Logger import if not present
    if 'import { Logger } from' not in content:
        # Find the last import statement
        import_pattern = r'(import .+ from .+;)\n(?!import)'
        content = re.sub(import_pattern, r"\1\nimport { Logger } from '../utils/ProductionLogger';\n", content, count=1)
    
    # Replace all console.error patterns with Logger.error
    # Pattern: console.error('[FunctionName] Message:', error);
    content = re.sub(
        r"console\.error\('\[(\w+)\] (.+?):', (\w+)\);",
        r"Logger.error('[\1] \2', \3 as Error, {\n      component: 'supabaseApiNormalized',\n      action: '\1',\n    });",
        content
    )
    
    # Replace console.warn patterns with Logger.warn
    content = re.sub(
        r"console\.warn\('\[(\w+)\] (.+?):', (\w+)\);",
        r"Logger.warn('[\1] \2', {\n          component: 'supabaseApiNormalized',\n          action: '\1',\n          data: \3,\n        });",
        content
    )
    
    # Count replacements
    replacements = content.count('Logger.error') + content.count('Logger.warn')
    
    # Write back if changes were made
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
    file_path = "src/services/supabaseApiNormalized.ts"
    replace_console_logs(file_path)
