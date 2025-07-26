#!/bin/bash

# Remove temporary markdown files
echo "Removing temporary markdown files..."
rm -f PHASE_4_SUMMARY.md ADDITIONAL_IMPROVEMENTS_SUMMARY.md PHASE_2_SUMMARY.md TIME_BLOCKS_ANALYSIS.md

# Remove SQL files that are either temporary or redundant
echo "Removing temporary SQL files..."
rm -f recreate_devotionals_table.sql
rm -f database/fix_journal_entries_duplicates.sql
rm -f database/create_journal_entries_simple.sql

# Check if setup_all_tables_safe.sql is redundant with setup_all_tables.sql
if [ -f "database/setup_all_tables.sql" ] && [ -f "database/setup_all_tables_safe.sql" ]; then
    echo "Comparing setup_all_tables.sql and setup_all_tables_safe.sql..."
    if diff -q database/setup_all_tables.sql database/setup_all_tables_safe.sql > /dev/null; then
        echo "Files are identical, removing setup_all_tables_safe.sql"
        rm -f database/setup_all_tables_safe.sql
    else
        echo "Files are different, keeping both for now"
    fi
fi

echo "Cleanup complete!"
