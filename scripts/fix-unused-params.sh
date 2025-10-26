#!/bin/bash

# Fix unused function parameters by prefixing with underscore
# This script handles the most common patterns

cd "$(dirname "$0")/.."

echo "🔧 Fixing unused function parameters..."

# Function to fix unused params in a file
fix_file() {
    local file="$1"
    local param="$2"
    
    # Skip if file doesn't exist
    [ ! -f "$file" ] && return
    
    # Pattern 1: Arrow function params: (param) => or (param, other) =>
    sed -i '' -E "s/\(([^)]*[, ])${param}([,)])/(\1_${param}\2/g" "$file"
    
    # Pattern 2: Function params at start: (param) => or (param: Type) =>
    sed -i '' -E "s/\(${param}([,:])/(_${param}\1/g" "$file"
    
    # Pattern 3: Callback params: .map(param => or .filter(param =>
    sed -i '' -E "s/\.(map|filter|forEach|reduce|find|some|every)\(${param}\s*=>/.\1(_${param} =>/g" "$file"
}

# Get list of files with unused params from lint output
npm run lint 2>&1 | grep "is defined but never used. Allowed unused args must match" | while read -r line; do
    # Extract file path and parameter name
    if [[ $line =~ ^(/[^:]+):([0-9]+):[0-9]+.*\'([^\']+)\' ]]; then
        file="${BASH_REMATCH[1]}"
        param="${BASH_REMATCH[3]}"
        
        if [ -f "$file" ]; then
            echo "  Fixing $param in $(basename $file)"
            fix_file "$file" "$param"
        fi
    fi
done

echo "✨ Done! Run 'npm run lint' to check remaining issues."
