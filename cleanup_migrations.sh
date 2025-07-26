#!/bin/bash

# Move to project root
cd "$(dirname "$0")"

echo "🔍 This will remove all migration files and update the project to use complete_database_schema.sql"
echo "A backup has been created in the database_backup/ directory"

# List of directories to clean
MIGRATION_DIRS=(
  "database/migrations"
  "supabase/migrations"
)

# Show what will be removed
echo "\n🗑️  The following directories will be removed:"
for dir in "${MIGRATION_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "  - $dir"
    echo "    Files to be removed:"
    find "$dir" -type f -name "*.sql" | sed 's/^/      /'
  fi
done

# Ask for confirmation
read -p "\n⚠️  Are you sure you want to proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "❌ Cleanup cancelled."
  exit 1
fi

# Remove migration directories
echo "\n🗑️  Removing migration directories..."
for dir in "${MIGRATION_DIRS[@]}"; do
  if [ -d "$dir" ]; then
    echo "  Removing $dir..."
    rm -rf "$dir"
  fi
done

# Create a README in the database directory explaining the new structure
cat > database/README.md << 'EOL'
# Database Schema Management

This directory contains the database schema and related files for the SiFia application.

## Files

- `complete_database_schema.sql` - The complete, current database schema.
  - Use this file to set up a new database instance.
  - All tables, indexes, and relationships are defined here.

## Migration History

As of July 2025, the application has been simplified to use a single schema file instead of migrations since:
- The application is in early development
- There are no production users
- The complete schema is available in `complete_database_schema.sql`

For future migrations, consider using a proper migration system like:
- [db-migrate](https://github.com/db-migrate/node-db-migrate)
- [Knex.js](https://knexjs.org/)
- [TypeORM](https://typeorm.io/)

## Backups

A backup of the old migration files is available in the `database_backup/` directory.
EOL

echo "\n✅ Cleanup complete!"
echo "The database is now managed using complete_database_schema.sql"
echo "A README.md has been added to the database directory"
