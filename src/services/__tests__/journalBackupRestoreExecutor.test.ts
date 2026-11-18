import {
  executeJournalBackupRestore,
  JournalBackupRestoreExecutionError,
  JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
  JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY,
  recoverInterruptedJournalBackupRestore,
  type JournalBackupRestoreMutationCoordinator,
  type JournalBackupRestoreStorage,
} from '../journalBackupRestoreExecutor';
import type { JournalBackupRestorePlan } from '../journalBackupRestorePlan';
import { JOURNAL_BACKUP_RESTORE_POLICY } from '../journalBackupContract';

const TRANSACTION_ID = '11111111-1111-4111-8111-111111111111';
const OWNED_RULES = JOURNAL_BACKUP_RESTORE_POLICY.ownedPrefixes;

class MemoryMutationCoordinator
  implements JournalBackupRestoreMutationCoordinator
{
  private active = false;

  async runExclusive<T>(work: () => Promise<T>): Promise<T> {
    if (this.active) {
      throw new Error('Synthetic concurrent mutation');
    }
    this.active = true;
    try {
      return await work();
    } finally {
      this.active = false;
    }
  }
}

const coordinator = new MemoryMutationCoordinator();

class MemoryRestoreStorage implements JournalBackupRestoreStorage {
  readonly values = new Map<string, string>();
  readonly failMutationCalls = new Set<number>();
  mutationCalls = 0;

  constructor(entries: readonly (readonly [string, string])[] = []) {
    entries.forEach(([key, value]) => this.values.set(key, value));
  }

  async getAllKeys(): Promise<readonly string[]> {
    return [...this.values.keys()];
  }

  async multiGet(
    keys: readonly string[],
  ): Promise<readonly (readonly [string, string | null])[]> {
    return keys.map(key => [key, this.values.get(key) ?? null] as const);
  }

  async multiSet(
    entries: readonly (readonly [string, string])[],
  ): Promise<void> {
    this.beforeMutation();
    entries.forEach(([key, value]) => this.values.set(key, value));
  }

  async multiRemove(keys: readonly string[]): Promise<void> {
    this.beforeMutation();
    keys.forEach(key => this.values.delete(key));
  }

  private beforeMutation(): void {
    this.mutationCalls += 1;
    if (this.failMutationCalls.has(this.mutationCalls)) {
      throw new Error(`Synthetic mutation failure ${this.mutationCalls}`);
    }
  }
}

const makePlan = (
  operations: JournalBackupRestorePlan['operations'] = [
    {
      key: 'journal_local:heart:2026-11-18:new',
      value: '{"body":"restored"}',
      section: 'journalRecords',
      kind: 'record',
    },
    {
      key: 'review_settings_v1',
      value: '{"weekEndsOn":0}',
      section: 'reviewSettings',
      kind: 'setting',
    },
  ],
): JournalBackupRestorePlan => ({
  valid: true,
  fatal: [],
  warnings: [],
  operations,
  operationCounts: { record: 1, setting: 1 },
  clearOwnedKeysMatching: OWNED_RULES,
  requiresRollbackSnapshot: true,
  interruptionHandling:
    'stage-rollback-snapshot-and-recovery-marker-before-any-owned-key-mutation',
});

const expectExecutionError = async (
  promise: Promise<unknown>,
  code: string,
  recoveryRequired: boolean,
) => {
  await expect(promise).rejects.toMatchObject({
    name: 'JournalBackupRestoreExecutionError',
    code,
    recoveryRequired,
  });
};

it('replaces only reviewed Journal-owned keys and verifies the committed values', async () => {
  const storage = new MemoryRestoreStorage([
    ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
    ['review_settings_v1', '{"weekEndsOn":1}'],
    ['review_settings_v1:unowned-suffix', 'must remain'],
    ['supabase.auth.token', 'must remain'],
  ]);

  const result = await executeJournalBackupRestore(
    storage,
    coordinator,
    makePlan(),
    TRANSACTION_ID,
  );

  expect(result).toEqual({
    transactionId: TRANSACTION_ID,
    restoredOperations: 2,
    removedOwnedKeys: 2,
    verified: true,
    recoveryArtifactsRemoved: true,
  });
  expect(storage.values.get('journal_local:heart:2026-11-17:old')).toBeUndefined();
  expect(storage.values.get('journal_local:heart:2026-11-18:new')).toBe(
    '{"body":"restored"}',
  );
  expect(storage.values.get('review_settings_v1')).toBe('{"weekEndsOn":0}');
  expect(storage.values.get('review_settings_v1:unowned-suffix')).toBe(
    'must remain',
  );
  expect(storage.values.get('supabase.auth.token')).toBe('must remain');
  expect(storage.values.has(JOURNAL_RESTORE_RECOVERY_MARKER_KEY)).toBe(false);
  expect(storage.values.has(JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY)).toBe(false);
});

it('restores the exact original key set when applying the plan fails', async () => {
  const storage = new MemoryRestoreStorage([
    ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
    ['supabase.auth.token', 'untouched'],
  ]);
  // Snapshot, prepared marker, owned-key removal, applying marker, then fail.
  storage.failMutationCalls.add(5);

  await expectExecutionError(
    executeJournalBackupRestore(storage, coordinator, makePlan(), TRANSACTION_ID),
    'restore_apply_failed_rolled_back',
    false,
  );

  expect([...storage.values.entries()].sort()).toEqual(
    [
      ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
      ['supabase.auth.token', 'untouched'],
    ].sort(),
  );
});

it('retains recovery artifacts if automatic rollback cannot complete', async () => {
  const storage = new MemoryRestoreStorage([
    ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
  ]);
  storage.failMutationCalls.add(5);
  storage.failMutationCalls.add(6);

  await expectExecutionError(
    executeJournalBackupRestore(storage, coordinator, makePlan(), TRANSACTION_ID),
    'restore_rollback_failed',
    true,
  );

  expect(storage.values.has(JOURNAL_RESTORE_RECOVERY_MARKER_KEY)).toBe(true);
  expect(storage.values.has(JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY)).toBe(true);
});

it('recovers an interrupted restore from its persisted rollback snapshot', async () => {
  const storage = new MemoryRestoreStorage([
    ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
  ]);
  storage.failMutationCalls.add(5);
  storage.failMutationCalls.add(6);
  await expect(
    executeJournalBackupRestore(storage, coordinator, makePlan(), TRANSACTION_ID),
  ).rejects.toBeInstanceOf(JournalBackupRestoreExecutionError);

  storage.failMutationCalls.clear();
  const result = await recoverInterruptedJournalBackupRestore(
    storage,
    coordinator,
  );

  expect(result).toEqual({
    transactionId: TRANSACTION_ID,
    restoredEntries: 1,
    recoveryArtifactsRemoved: true,
  });
  expect([...storage.values.entries()]).toEqual([
    ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
  ]);
});

it('rejects an operation outside the exact owned namespace before any mutation', async () => {
  const storage = new MemoryRestoreStorage([
    ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
  ]);
  const plan = makePlan([
    {
      key: 'supabase.auth.token',
      value: 'malicious',
      section: 'preferences',
      kind: 'setting',
    },
  ]);

  await expectExecutionError(
    executeJournalBackupRestore(storage, coordinator, plan, TRANSACTION_ID),
    'operation_outside_owned_namespace',
    false,
  );
  expect(storage.mutationCalls).toBe(0);
  expect(storage.values.get('journal_local:heart:2026-11-17:old')).toBe(
    '{"body":"old"}',
  );
});

it('refuses to overwrite unfinished recovery evidence', async () => {
  const storage = new MemoryRestoreStorage([
    [JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY, '{"preserve":"evidence"}'],
  ]);

  await expectExecutionError(
    executeJournalBackupRestore(storage, coordinator, makePlan(), TRANSACTION_ID),
    'unfinished_restore_present',
    true,
  );
  expect(storage.mutationCalls).toBe(0);
  expect(storage.values.get(JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY)).toBe(
    '{"preserve":"evidence"}',
  );
});

it('returns no recovery work when no restore artifacts exist', async () => {
  const storage = new MemoryRestoreStorage([
    ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
  ]);

  await expect(
    recoverInterruptedJournalBackupRestore(storage, coordinator),
  ).resolves.toBeNull();
  expect(storage.mutationCalls).toBe(0);
});

it('rejects a rollback snapshot that attempts to touch a non-Journal key', async () => {
  const storage = new MemoryRestoreStorage([
    [
      JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY,
      JSON.stringify({
        version: 1,
        transactionId: TRANSACTION_ID,
        entries: [{ key: 'supabase.auth.token', value: 'do not touch' }],
      }),
    ],
    ['supabase.auth.token', 'current token'],
  ]);

  await expectExecutionError(
    recoverInterruptedJournalBackupRestore(storage, coordinator),
    'rollback_snapshot_namespace_violation',
    true,
  );
  expect(storage.mutationCalls).toBe(0);
  expect(storage.values.get('supabase.auth.token')).toBe('current token');
});

it('rejects an empty rollback snapshot instead of clearing Journal data', async () => {
  const storage = new MemoryRestoreStorage([
    [
      JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY,
      JSON.stringify({
        version: 1,
        transactionId: TRANSACTION_ID,
        entries: [],
      }),
    ],
    ['journal_local:heart:2026-11-17:old', '{"body":"old"}'],
  ]);

  await expectExecutionError(
    recoverInterruptedJournalBackupRestore(storage, coordinator),
    'invalid_rollback_snapshot',
    true,
  );
  expect(storage.mutationCalls).toBe(0);
  expect(storage.values.get('journal_local:heart:2026-11-17:old')).toBe(
    '{"body":"old"}',
  );
});

it('rejects an oversized recovery marker before mutation', async () => {
  const storage = new MemoryRestoreStorage([
    [
      JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
      JSON.stringify({
        version: 1,
        transactionId: TRANSACTION_ID,
        stage: 'applying',
        operationCount: 1,
        padding: 'x'.repeat(5_000),
      }),
    ],
  ]);

  await expectExecutionError(
    recoverInterruptedJournalBackupRestore(storage, coordinator),
    'invalid_recovery_marker',
    true,
  );
  expect(storage.mutationCalls).toBe(0);
});

it('rejects a plan whose ownership policy differs from the canonical policy', async () => {
  const storage = new MemoryRestoreStorage();
  const plan = makePlan();
  plan.clearOwnedKeysMatching = ['journal_local:'];

  await expectExecutionError(
    executeJournalBackupRestore(storage, coordinator, plan, TRANSACTION_ID),
    'owned_namespace_policy_mismatch',
    false,
  );
  expect(storage.mutationCalls).toBe(0);
});
