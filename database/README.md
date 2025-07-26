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

## Future Migrations

When the application is ready for production, consider implementing a proper migration system. The current approach is suitable for development and testing phases.
