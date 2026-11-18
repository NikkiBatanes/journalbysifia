import {mkdtempSync, rmdirSync, unlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';

import {openRestoreSession, type RestoreDatabase} from '../journalRestoreDatabase';
import {verifyRestoreReopen} from '../journalRestoreReopenProbe';
import {JOURNAL_RESTORE_RECOVERY_MARKER_KEY} from '../../services/journalBackupRestoreExecutor';

const {DatabaseSync} = process.getBuiltinModule('node:sqlite') as typeof import('node:sqlite');

function connect(file: string) {
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

it('recovers the original value on a fresh connection to the same file', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'journal-restore-test-'));
  const file = join(dir, 'probe.sqlite');
  try {
    await verifyRestoreReopen(() => connect(file));
  } finally {
    unlinkSync(file);
    rmdirSync(dir);
  }
});

it('refuses to open a session when existing recovery evidence is invalid', async () => {
  const db = connect(':memory:');
  try {
    await openRestoreSession(db);
    await db.execute('INSERT INTO restore_kv (k,v) VALUES (?,?)', [JOURNAL_RESTORE_RECOVERY_MARKER_KEY, 'invalid']);
    await expect(openRestoreSession(db)).rejects.toMatchObject({recoveryRequired: true});
    expect((await db.execute('SELECT v FROM restore_kv')).rows).toEqual([{v: 'invalid'}]);
  } finally {
    db.close();
  }
});
