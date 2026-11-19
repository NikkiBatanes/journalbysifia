/**
 * Storage-agnostic V1 restore executor.
 *
 * This module deliberately imports no AsyncStorage or database implementation.
 * A caller must provide an adapter after the customer-data surface has been
 * reviewed. Every mutation is preceded by a persisted rollback snapshot and
 * recovery marker, and every successful restore is read back before those
 * recovery artifacts are removed.
 */
import type {
  JournalBackupRestoreOperation,
  JournalBackupRestorePlan,
} from './journalBackupRestorePlan';
import { JOURNAL_BACKUP_RESTORE_POLICY } from './journalBackupContract';

export const JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY =
  'journal:restore-internal:rollback-snapshot:v1';
export const JOURNAL_RESTORE_RECOVERY_MARKER_KEY =
  'journal:restore-internal:recovery-marker:v1';

const RESTORE_EXECUTOR_VERSION = 1 as const;
const MAXIMUM_RESTORE_OPERATIONS = 10_000;
const MAXIMUM_ROLLBACK_KEYS = 12_000;
const MAXIMUM_ROLLBACK_SNAPSHOT_BYTES = 64 * 1024 * 1024;
const MAXIMUM_RECOVERY_MARKER_BYTES = 4 * 1024;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const OWNED_RULES = JOURNAL_BACKUP_RESTORE_POLICY.ownedPrefixes;

type RestoreStage = 'prepared' | 'applying' | 'verified';

type RollbackEntry = {
  key: string;
  value: string | null;
};

type RollbackSnapshotV1 = {
  version: typeof RESTORE_EXECUTOR_VERSION;
  transactionId: string;
  entries: RollbackEntry[];
};

type RecoveryMarkerV1 = {
  version: typeof RESTORE_EXECUTOR_VERSION;
  transactionId: string;
  stage: RestoreStage;
  operationCount: number;
};

export interface JournalBackupRestoreStorage {
  getAllKeys(): Promise<readonly string[]>;
  multiGet(keys: readonly string[]): Promise<readonly (readonly [string, string | null])[]>;
  multiSet(entries: readonly (readonly [string, string])[]): Promise<void>;
  multiRemove(keys: readonly string[]): Promise<void>;
}

/**
 * The production adapter must share this lease with every Journal-owned
 * mutation path. A private lock used only by restore would not prevent races.
 */
export interface JournalBackupRestoreMutationCoordinator {
  runExclusive<T>(work: () => Promise<T>): Promise<T>;
}

export type JournalBackupRestoreExecutionResult = {
  transactionId: string;
  restoredOperations: number;
  removedOwnedKeys: number;
  verified: true;
  recoveryArtifactsRemoved: true;
};

export type JournalBackupRestoreRecoveryResult = {
  transactionId: string;
  restoredEntries: number;
  recoveryArtifactsRemoved: true;
};

export class JournalBackupRestoreExecutionError extends Error {
  readonly code: string;
  readonly recoveryRequired: boolean;

  constructor(code: string, message: string, recoveryRequired = false) {
    super(message);
    this.name = 'JournalBackupRestoreExecutionError';
    this.code = code;
    this.recoveryRequired = recoveryRequired;
  }
}

const fail = (
  code: string,
  message: string,
  recoveryRequired = false,
): JournalBackupRestoreExecutionError =>
  new JournalBackupRestoreExecutionError(code, message, recoveryRequired);

const uniqueSorted = (values: readonly string[]): string[] =>
  [...new Set(values)].sort((left, right) => left.localeCompare(right));

const isOwnedKey = (key: string, rules: readonly string[]): boolean =>
  rules.some(rule => (rule.endsWith(':') ? key.startsWith(rule) : key === rule));

const assertSafeTransactionId = (transactionId: string): void => {
  if (!UUID.test(transactionId)) {
    throw fail(
      'invalid_transaction_id',
      'Restore transaction ID must be a lowercase RFC 4122 UUID.',
    );
  }
};

const assertPlanIsExecutable = (plan: JournalBackupRestorePlan): void => {
  if (!plan.valid || plan.fatal.length > 0 || !plan.requiresRollbackSnapshot) {
    throw fail('invalid_restore_plan', 'Restore plan is not executable.');
  }
  if (
    plan.operations.length === 0 ||
    plan.operations.length > MAXIMUM_RESTORE_OPERATIONS
  ) {
    throw fail(
      'invalid_operation_count',
      'Restore plan operation count is outside the executor limit.',
    );
  }
  if (
    JSON.stringify(plan.clearOwnedKeysMatching) !== JSON.stringify(OWNED_RULES)
  ) {
    throw fail(
      'owned_namespace_policy_mismatch',
      'Restore plan does not use the canonical Journal-owned key policy.',
    );
  }
  const keys = new Set<string>();
  plan.operations.forEach(operation => {
    if (
      !operation.key ||
      typeof operation.value !== 'string' ||
      !isOwnedKey(operation.key, OWNED_RULES) ||
      operation.key === JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY ||
      operation.key === JOURNAL_RESTORE_RECOVERY_MARKER_KEY
    ) {
      throw fail(
        'operation_outside_owned_namespace',
        'Restore operation is outside the exact Journal-owned namespace.',
      );
    }
    if (keys.has(operation.key)) {
      throw fail(
        'duplicate_restore_operation',
        'Restore plan contains a duplicate output key.',
      );
    }
    keys.add(operation.key);
  });
};

const strictRows = (
  keys: readonly string[],
  rows: readonly (readonly [string, string | null])[],
): Map<string, string | null> => {
  const expected = new Set(keys);
  const observed = new Map<string, string | null>();
  rows.forEach(row => {
    if (
      !Array.isArray(row) ||
      row.length !== 2 ||
      !expected.has(row[0]) ||
      observed.has(row[0]) ||
      (row[1] !== null && typeof row[1] !== 'string')
    ) {
      throw fail('storage_read_mismatch', 'Storage returned an invalid key/value row.');
    }
    observed.set(row[0], row[1]);
  });
  if (observed.size !== expected.size) {
    throw fail('storage_read_incomplete', 'Storage did not return every requested key.');
  }
  return observed;
};

const readExact = async (
  storage: JournalBackupRestoreStorage,
  keys: readonly string[],
): Promise<Map<string, string | null>> => {
  if (keys.length === 0) {
    return new Map();
  }
  return strictRows(keys, await storage.multiGet(keys));
};

const utf8ByteLength = (value: string): number => {
  let bytes = 0;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code < 0x80) {
      bytes += 1;
    } else if (code < 0x800) {
      bytes += 2;
    } else if (
      code >= 0xd800 &&
      code <= 0xdbff &&
      index + 1 < value.length &&
      value.charCodeAt(index + 1) >= 0xdc00 &&
      value.charCodeAt(index + 1) <= 0xdfff
    ) {
      bytes += 4;
      index += 1;
    } else {
      bytes += 3;
    }
    if (bytes > MAXIMUM_ROLLBACK_SNAPSHOT_BYTES) {
      return bytes;
    }
  }
  return bytes;
};

const serializeSnapshot = (snapshot: RollbackSnapshotV1): string => {
  const serialized = JSON.stringify(snapshot);
  if (utf8ByteLength(serialized) > MAXIMUM_ROLLBACK_SNAPSHOT_BYTES) {
    throw fail(
      'rollback_snapshot_too_large',
      'Rollback snapshot exceeds the executor byte limit.',
    );
  }
  return serialized;
};

const parseSnapshot = (raw: string | null): RollbackSnapshotV1 => {
  if (
    raw === null ||
    utf8ByteLength(raw) > MAXIMUM_ROLLBACK_SNAPSHOT_BYTES
  ) {
    throw fail(
      'invalid_rollback_snapshot',
      'A valid rollback snapshot is required for recovery.',
      true,
    );
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    throw fail(
      'invalid_rollback_snapshot',
      'Rollback snapshot is not valid JSON.',
      true,
    );
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw fail('invalid_rollback_snapshot', 'Rollback snapshot has an invalid shape.', true);
  }
  const snapshot = candidate as Partial<RollbackSnapshotV1>;
  if (
    snapshot.version !== RESTORE_EXECUTOR_VERSION ||
    typeof snapshot.transactionId !== 'string' ||
    !UUID.test(snapshot.transactionId) ||
    !Array.isArray(snapshot.entries) ||
    snapshot.entries.length === 0 ||
    snapshot.entries.length > MAXIMUM_ROLLBACK_KEYS
  ) {
    throw fail('invalid_rollback_snapshot', 'Rollback snapshot metadata is invalid.', true);
  }
  const keys = new Set<string>();
  const entries: RollbackEntry[] = snapshot.entries.map(entry => {
    if (
      !entry ||
      typeof entry !== 'object' ||
      Array.isArray(entry) ||
      typeof (entry as RollbackEntry).key !== 'string' ||
      ((entry as RollbackEntry).value !== null &&
        typeof (entry as RollbackEntry).value !== 'string') ||
      keys.has((entry as RollbackEntry).key)
    ) {
      throw fail('invalid_rollback_snapshot', 'Rollback snapshot entries are invalid.', true);
    }
    keys.add((entry as RollbackEntry).key);
    return {
      key: (entry as RollbackEntry).key,
      value: (entry as RollbackEntry).value,
    };
  });
  return {
    version: RESTORE_EXECUTOR_VERSION,
    transactionId: snapshot.transactionId,
    entries,
  };
};

const parseMarker = (raw: string | null): RecoveryMarkerV1 | null => {
  if (raw === null) {
    return null;
  }
  if (utf8ByteLength(raw) > MAXIMUM_RECOVERY_MARKER_BYTES) {
    throw fail(
      'invalid_recovery_marker',
      'Recovery marker exceeds the executor byte limit.',
      true,
    );
  }
  let candidate: unknown;
  try {
    candidate = JSON.parse(raw);
  } catch {
    throw fail('invalid_recovery_marker', 'Recovery marker is not valid JSON.', true);
  }
  if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) {
    throw fail('invalid_recovery_marker', 'Recovery marker has an invalid shape.', true);
  }
  const marker = candidate as Partial<RecoveryMarkerV1>;
  if (
    marker.version !== RESTORE_EXECUTOR_VERSION ||
    typeof marker.transactionId !== 'string' ||
    !UUID.test(marker.transactionId) ||
    !['prepared', 'applying', 'verified'].includes(marker.stage ?? '') ||
    typeof marker.operationCount !== 'number' ||
    !Number.isSafeInteger(marker.operationCount) ||
    marker.operationCount < 0 ||
    marker.operationCount > MAXIMUM_RESTORE_OPERATIONS
  ) {
    throw fail('invalid_recovery_marker', 'Recovery marker metadata is invalid.', true);
  }
  return marker as RecoveryMarkerV1;
};

const markerValue = (
  transactionId: string,
  stage: RestoreStage,
  operationCount: number,
): string =>
  JSON.stringify({
    version: RESTORE_EXECUTOR_VERSION,
    transactionId,
    stage,
    operationCount,
  } satisfies RecoveryMarkerV1);

const verifyOperations = async (
  storage: JournalBackupRestoreStorage,
  operations: readonly JournalBackupRestoreOperation[],
): Promise<void> => {
  const values = await readExact(
    storage,
    operations.map(operation => operation.key),
  );
  for (const operation of operations) {
    if (values.get(operation.key) !== operation.value) {
      throw fail('restore_verification_failed', 'Restored value did not match its plan.');
    }
  }
  const observedOwnedKeys = uniqueSorted(
    (await storage.getAllKeys()).filter(key => isOwnedKey(key, OWNED_RULES)),
  );
  const expectedOwnedKeys = uniqueSorted(operations.map(operation => operation.key));
  if (JSON.stringify(observedOwnedKeys) !== JSON.stringify(expectedOwnedKeys)) {
    throw fail(
      'restore_keyset_verification_failed',
      'Restored Journal-owned key set did not match its plan.',
    );
  }
};

const rollbackSnapshot = async (
  storage: JournalBackupRestoreStorage,
  snapshot: RollbackSnapshotV1,
  ownedRules: readonly string[],
): Promise<JournalBackupRestoreRecoveryResult> => {
  const currentKeys = await storage.getAllKeys();
  const ownedNow = currentKeys.filter(key => isOwnedKey(key, ownedRules));
  const snapshotKeys = snapshot.entries.map(entry => entry.key);
  const keysToRemove = uniqueSorted([...ownedNow, ...snapshotKeys]);
  if (keysToRemove.length > 0) {
    await storage.multiRemove(keysToRemove);
  }
  const entriesToRestore = snapshot.entries.flatMap(entry =>
    entry.value === null ? [] : [[entry.key, entry.value] as const],
  );
  if (entriesToRestore.length > 0) {
    await storage.multiSet(entriesToRestore);
  }

  const values = await readExact(storage, snapshotKeys);
  for (const entry of snapshot.entries) {
    if (values.get(entry.key) !== entry.value) {
      throw fail('rollback_verification_failed', 'Rollback value verification failed.', true);
    }
  }
  const finalOwnedKeys = uniqueSorted(
    (await storage.getAllKeys()).filter(key => isOwnedKey(key, ownedRules)),
  );
  const expectedOwnedKeys = uniqueSorted(
    snapshot.entries
      .filter(entry => entry.value !== null && isOwnedKey(entry.key, ownedRules))
      .map(entry => entry.key),
  );
  if (JSON.stringify(finalOwnedKeys) !== JSON.stringify(expectedOwnedKeys)) {
    throw fail('rollback_keyset_mismatch', 'Rollback key-set verification failed.', true);
  }

  await storage.multiRemove([
    JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
    JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY,
  ]);
  return {
    transactionId: snapshot.transactionId,
    restoredEntries: entriesToRestore.length,
    recoveryArtifactsRemoved: true,
  };
};

const recoverInterruptedJournalBackupRestoreExclusive = async (
  storage: JournalBackupRestoreStorage,
): Promise<JournalBackupRestoreRecoveryResult | null> => {
  const artifacts = await readExact(storage, [
    JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY,
    JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
  ]);
  const snapshotRaw = artifacts.get(JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY) ?? null;
  const marker = parseMarker(
    artifacts.get(JOURNAL_RESTORE_RECOVERY_MARKER_KEY) ?? null,
  );
  if (snapshotRaw === null && marker === null) {
    return null;
  }
  const snapshot = parseSnapshot(snapshotRaw);
  if (snapshot.entries.some(entry => !isOwnedKey(entry.key, OWNED_RULES))) {
    throw fail(
      'rollback_snapshot_namespace_violation',
      'Rollback snapshot contains a key outside the canonical Journal namespace.',
      true,
    );
  }
  if (marker !== null && marker.transactionId !== snapshot.transactionId) {
    throw fail(
      'recovery_transaction_mismatch',
      'Recovery marker does not match the rollback snapshot.',
      true,
    );
  }
  try {
    return await rollbackSnapshot(storage, snapshot, OWNED_RULES);
  } catch (error) {
    if (
      error instanceof JournalBackupRestoreExecutionError &&
      error.recoveryRequired
    ) {
      throw error;
    }
    throw fail(
      'interrupted_restore_recovery_failed',
      'Interrupted restore could not be rolled back safely.',
      true,
    );
  }
};

async function inspectRestoreDestination(
  storage: JournalBackupRestoreStorage,
  plan: JournalBackupRestorePlan,
) {
  assertPlanIsExecutable(plan);

  const existingArtifacts = await readExact(storage, [
    JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY,
    JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
  ]);
  if (
    existingArtifacts.get(JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY) !== null ||
    existingArtifacts.get(JOURNAL_RESTORE_RECOVERY_MARKER_KEY) !== null
  ) {
    throw fail(
      'unfinished_restore_present',
      'An unfinished restore must be recovered before starting another.',
      true,
    );
  }

  const allKeys = await storage.getAllKeys();
  const ownedKeys = uniqueSorted(
    allKeys.filter(key => isOwnedKey(key, OWNED_RULES)),
  );
  const operationKeys = plan.operations.map(operation => operation.key);
  const snapshotKeys = uniqueSorted([...ownedKeys, ...operationKeys]);
  if (snapshotKeys.length > MAXIMUM_ROLLBACK_KEYS) {
    throw fail(
      'rollback_key_limit_exceeded',
      'Restore touches more keys than the rollback executor permits.',
    );
  }
  const before = await readExact(storage, snapshotKeys);
  return {ownedKeys, snapshotKeys, before};
}

/** Count the effects of full replacement under the same lease used for writes.
 * Counts refer to stored keys (including preferences and rebuilt indexes).
 * A preview describes the current snapshot only and authorizes no writes.
 */
export const previewJournalBackupRestore = (
  storage: JournalBackupRestoreStorage,
  coordinator: JournalBackupRestoreMutationCoordinator,
  plan: JournalBackupRestorePlan,
) => coordinator.runExclusive(async () => {
  const {before, ownedKeys} = await inspectRestoreDestination(storage, plan);
  let newKeys = 0;
  let matchingKeys = 0;
  let changedKeys = 0;
  for (const {key, value} of plan.operations) {
    const current = before.get(key);
    if (current === null) {
      newKeys++;
    } else if (current === value) {
      matchingKeys++;
    } else {
      changedKeys++;
    }
  }
  const targets = new Set(plan.operations.map(operation => operation.key));
  const localOnlyKeys = ownedKeys.filter(key => !targets.has(key)).length;
  return {newKeys, matchingKeys, changedKeys, localOnlyKeys};
});

const executeJournalBackupRestoreExclusive = async (
  storage: JournalBackupRestoreStorage,
  plan: JournalBackupRestorePlan,
  transactionId: string,
): Promise<JournalBackupRestoreExecutionResult> => {
  assertSafeTransactionId(transactionId);
  const {ownedKeys, snapshotKeys, before} = await inspectRestoreDestination(storage, plan);
  const snapshot: RollbackSnapshotV1 = {
    version: RESTORE_EXECUTOR_VERSION,
    transactionId,
    entries: snapshotKeys.map(key => ({ key, value: before.get(key) ?? null })),
  };
  const serializedSnapshot = serializeSnapshot(snapshot);
  let snapshotPersisted = false;

  try {
    await storage.multiSet([
      [JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY, serializedSnapshot],
    ]);
    snapshotPersisted = true;
    await storage.multiSet([
      [
        JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
        markerValue(transactionId, 'prepared', plan.operations.length),
      ],
    ]);
    if (ownedKeys.length > 0) {
      await storage.multiRemove(ownedKeys);
    }
    await storage.multiSet([
      [
        JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
        markerValue(transactionId, 'applying', plan.operations.length),
      ],
    ]);
    await storage.multiSet(
      plan.operations.map(operation => [operation.key, operation.value] as const),
    );
    await verifyOperations(storage, plan.operations);
    await storage.multiSet([
      [
        JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
        markerValue(transactionId, 'verified', plan.operations.length),
      ],
    ]);
    await storage.multiRemove([
      JOURNAL_RESTORE_RECOVERY_MARKER_KEY,
      JOURNAL_RESTORE_ROLLBACK_SNAPSHOT_KEY,
    ]);
    return {
      transactionId,
      restoredOperations: plan.operations.length,
      removedOwnedKeys: ownedKeys.length,
      verified: true,
      recoveryArtifactsRemoved: true,
    };
  } catch (error) {
    if (!snapshotPersisted) {
      throw fail(
        'restore_snapshot_stage_failed',
        'Restore stopped before any Journal-owned data was changed.',
      );
    }
    try {
      await rollbackSnapshot(storage, snapshot, OWNED_RULES);
    } catch {
      throw fail(
        'restore_rollback_failed',
        'Restore failed and automatic rollback could not be verified.',
        true,
      );
    }
    throw fail(
      'restore_apply_failed_rolled_back',
      'Restore failed; the original Journal-owned data was restored.',
    );
  }
};

/**
 * Recover a restore interrupted after its rollback snapshot was persisted.
 * Recovery uses only the canonical reviewed Journal-owned namespace policy.
 */
export const recoverInterruptedJournalBackupRestore = (
  storage: JournalBackupRestoreStorage,
  coordinator: JournalBackupRestoreMutationCoordinator,
): Promise<JournalBackupRestoreRecoveryResult | null> =>
  coordinator.runExclusive(() =>
    recoverInterruptedJournalBackupRestoreExclusive(storage),
  );

/** Execute a previously validated plan with rollback and read-back verification. */
export const executeJournalBackupRestore = (
  storage: JournalBackupRestoreStorage,
  coordinator: JournalBackupRestoreMutationCoordinator,
  plan: JournalBackupRestorePlan,
  transactionId: string,
): Promise<JournalBackupRestoreExecutionResult> =>
  coordinator.runExclusive(() =>
    executeJournalBackupRestoreExclusive(storage, plan, transactionId),
  );
