#!/bin/bash

echo "=== DETAILED LINT REPORT BY FILE ==="
echo ""

npm run lint 2>&1 | grep "^/" | while read line; do
    file=$(echo "$line" | awk '{print $1}')
    echo "$file"
done | sort | uniq -c | sort -rn | head -50 | while read count file; do
    filename=$(basename "$file")
    errors=$(npm run lint 2>&1 | grep "$file" | grep "error" | wc -l | xargs)
    warnings=$(npm run lint 2>&1 | grep "$file" | grep "warning" | wc -l | xargs)
    total=$((errors + warnings))
    echo "$total issues ($errors errors, $warnings warnings) - $filename"
done
