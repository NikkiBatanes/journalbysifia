#!/bin/bash

echo "=== LINT ANALYSIS REPORT ==="
echo ""

# Total counts
echo "TOTAL SUMMARY:"
npm run lint 2>&1 | tail -5

echo ""
echo "=== ERROR TYPE BREAKDOWN ==="
npm run lint 2>&1 | grep -E "(error|warning)" | awk '{print $NF}' | sort | uniq -c | sort -rn

echo ""
echo "=== TOP 20 FILES WITH MOST ISSUES ==="
npm run lint 2>&1 | grep "^/" | sed 's/  */ /g' | cut -d' ' -f1,2,3 | sort | uniq -c | sort -rn | head -20

echo ""
echo "=== FILES BY CATEGORY ==="
echo ""
echo "SCREENS:"
npm run lint 2>&1 | grep "src/screens" | cut -d':' -f1 | sort -u | wc -l
echo ""
echo "COMPONENTS:"
npm run lint 2>&1 | grep "src/components" | cut -d':' -f1 | sort -u | wc -l
echo ""
echo "SERVICES:"
npm run lint 2>&1 | grep "src/services" | cut -d':' -f1 | sort -u | wc -l
echo ""
echo "UTILS:"
npm run lint 2>&1 | grep "src/utils" | cut -d':' -f1 | sort -u | wc -l
echo ""
echo "SUPABASE FUNCTIONS:"
npm run lint 2>&1 | grep "supabase/functions" | cut -d':' -f1 | sort -u | wc -l
