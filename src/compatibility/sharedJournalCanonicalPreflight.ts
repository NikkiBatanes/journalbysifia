/**
 * Compose field adapters with merge preflight for the three canonical stores.
 * Caller supplies a validated snapshot: this function does not read AsyncStorage
 * or certify its consistency. No auth, network, storage mutation, or upload DTOs.
 */
import type { JournalBackupInventory } from '../services/journalBackupInventory';
import { buildSharedJournalMergePreview, type JournalMergePreviewRecord } from './sharedJournalMergePreview';
import { toLocalDailyJournalMergePreview, projectLocalDailyJournalForSharing } from './sharedDailyJournalFieldContract';
import { toLocalReflectionMergePreview, projectLocalReflectionForSharing } from './sharedReflectionFieldContract';
import { toLocalPrayerMergePreview, projectLocalPrayerForSharing } from './sharedPrayerFieldContract';
import { isNonemptyString, type LocalSharedRecord } from './sharedJournalFieldValidation';
import { toLocalTimeBlockMergePreview, projectLocalTimeBlockForSharing } from './sharedTimeBlockFieldContract';

export const buildCanonicalJournalMergePreflight = (input: {
  targetAccountId: string;
  localSnapshotComplete: boolean;
  remoteSnapshotComplete: boolean;
  snapshot: Pick<JournalBackupInventory, 'journalRecords' | 'reflectionRecords' | 'prayerRecords'>;
  remoteRecords: readonly JournalMergePreviewRecord[];
}) => {
  // Do not inspect/partially adapt an inventory the caller has not finished
  // validating, or an account that has not been selected yet.
  if (input.localSnapshotComplete !== true || input.remoteSnapshotComplete !== true || !isNonemptyString(input.targetAccountId)) {
    return { preview: buildSharedJournalMergePreview({
      targetAccountId: input.targetAccountId,
      localSnapshotComplete: input.localSnapshotComplete === true,
      remoteSnapshotComplete: input.remoteSnapshotComplete,
      localRecords: [], remoteRecords: [],
    }), heldRecords: [] };
  }
  const records: JournalMergePreviewRecord[] = [];
  const heldRecords: Array<{ localId: string; family: 'journal' | 'reflection' | 'prayer'; reason: string }> = [];
  const append = <T extends LocalSharedRecord>(
    entries: readonly T[],
    family: 'journal' | 'reflection' | 'prayer',
    adapt: (entry: T) => JournalMergePreviewRecord,
    project: (entry: T) => { status: string; reason?: string },
  ) => {
    for (const entry of entries) {
      const record = adapt(entry);
      records.push(record);
      if (record.capabilityId === null) {
        const assessment = project(entry);
        heldRecords.push({ localId: record.id, family, reason: assessment.reason || 'unknown_variant' });
      }
    }
  };
  append(input.snapshot.journalRecords, 'journal',
    entry => entry.content_type === 'time_block' ? toLocalTimeBlockMergePreview(entry) : toLocalDailyJournalMergePreview(entry),
    entry => entry.content_type === 'time_block' ? projectLocalTimeBlockForSharing(entry) : projectLocalDailyJournalForSharing(entry));
  append(input.snapshot.reflectionRecords, 'reflection', toLocalReflectionMergePreview, projectLocalReflectionForSharing);
  append(input.snapshot.prayerRecords, 'prayer', toLocalPrayerMergePreview, projectLocalPrayerForSharing);
  const preview = buildSharedJournalMergePreview({
    targetAccountId: input.targetAccountId,
    localSnapshotComplete: input.localSnapshotComplete === true,
    remoteSnapshotComplete: input.remoteSnapshotComplete,
    localRecords: records, remoteRecords: input.remoteRecords,
  });
  return { preview, heldRecords: preview.status === 'blocked' ? [] : heldRecords };
};
