#!/bin/bash

# Move to database directory
cd "$(dirname "$0")/database"

echo "🔍 Analyzing database files..."

# List of files to keep
KEEP_FILES=(
  "complete_database_schema.sql"
  "migrations/"
)

# List of files to remove (with confirmation)
REMOVE_FILES=(
  "setup_all_tables.sql"
  "setup_all_tables_safe.sql"
  "journal_entries_table.sql"
  "reflection_entries_table.sql"
  "prayers_table.sql"
  "time_blocks_table.sql"
  "playbook_system_schema.sql"
  "devotionals_schema.sql"
)

# Show what will be kept and what will be removed
echo "✅ Will keep:"
for file in "${KEEP_FILES[@]}"; do
  echo "  - $file"
done

echo "\n❌ Will remove (if you confirm):"
for file in "${REMOVE_FILES[@]}"; do
  if [ -f "$file" ] || [ -d "$file" ]; then
    echo "  - $file"
  fi
done

# Ask for confirmation
read -p "\n⚠️  Are you sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Cleanup cancelled."
  exit 1
fi

# Remove files
echo "\n🗑️  Removing redundant files..."
for file in "${REMOVE_FILES[@]}"; do
  if [ -f "$file" ] || [ -d "$file" ]; then
    echo "  Removing $file..."
    rm -rf "$file"
  fi
done

echo "\n✅ Cleanup complete!"
echo "The database schema is now organized in complete_database_schema.sql"
echo "Migrations are preserved in the migrations/ directory"
