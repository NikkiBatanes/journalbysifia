import type {RestoreDatabase} from '../journalRestoreDatabase';

const {DatabaseSync} = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

export function connect(file: string) {
  const db = new DatabaseSync(file);
  const execute: RestoreDatabase['execute'] = async (sql, params = []) => ({
    rows: db.prepare(sql).all(...params),
  });
  return {
    execute,
    async transaction(work: Parameters<RestoreDatabase['transaction']>[0]) {
      db.exec('BEGIN');
      try {
        await work({execute});
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
    },
    close: () => db.close(),
  };
}
