#!/usr/bin/env python3
"""
Fix unused variable warnings by prefixing with underscore
This is the TypeScript convention for intentionally unused variables
"""

import re
import subprocess
from pathlib import Path

SRC_DIR = Path(__file__).parent.parent / 'src'

def get_unused_vars():
    """Get list of unused variables from ESLint"""
    result = subprocess.run(
        ['npm', 'run', 'lint'],
        cwd=SRC_DIR.parent,
        capture_output=True,
        text=True
    )
    
    # Parse ESLint output for unused variables
    unused_vars = []
    lines = result.stdout.split('\n')
    
    current_file = None
    for i, line in enumerate(lines):
        if line.startswith('/'):
            current_file = line.strip()
        elif 'is assigned a value but never used' in line or 'is defined but never used' in line:
            # Extract variable name
            match = re.search(r"'(\w+)' is (assigned a value but never used|defined but never used)", line)
            if match and current_file:
                var_name = match.group(1)
                # Extract line number
                line_match = re.search(r'(\d+):\d+\s+error', line)
                if line_match:
                    line_num = int(line_match.group(1))
                    unused_vars.append({
                        'file': current_file,
                        'var': var_name,
                        'line': line_num
                    })
    
    return unused_vars

def fix_unused_var(file_path, var_name, line_num):
    """Fix unused variable by prefixing with underscore"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        if line_num > len(lines):
            return False
        
        line = lines[line_num - 1]
        
        # Common patterns to fix
        patterns = [
            # Function parameters: (param) => or (param: Type) =>
            (rf'\b{var_name}\b(?=\s*[:\)])', f'_{var_name}'),
            # Destructuring: { var } = or const var =
            (rf'\b{var_name}\b(?=\s*[,}=])', f'_{var_name}'),
            # Variable declarations: const var = or let var =
            (rf'\b(const|let|var)\s+{var_name}\b', rf'\1 _{var_name}'),
        ]
        
        original_line = line
        for pattern, replacement in patterns:
            line = re.sub(pattern, replacement, line)
        
        if line != original_line:
            lines[line_num - 1] = line
            with open(file_path, 'w', encoding='utf-8') as f:
                f.writelines(lines)
            return True
        
        return False
    except Exception as e:
        print(f"Error fixing {file_path}:{line_num} - {e}")
        return False

def main():
    print("🔍 Analyzing unused variables...")
    unused_vars = get_unused_vars()
    
    print(f"Found {len(unused_vars)} unused variables")
    
    fixed_count = 0
    files_modified = set()
    
    for item in unused_vars:
        file_path = Path(item['file'])
        if file_path.exists():
            if fix_unused_var(file_path, item['var'], item['line']):
                fixed_count += 1
                files_modified.add(str(file_path))
                print(f"✅ Fixed {item['var']} in {file_path.name}:{item['line']}")
    
    print(f"\n✨ Complete! Fixed {fixed_count} unused variables in {len(files_modified)} files")

if __name__ == '__main__':
    main()
