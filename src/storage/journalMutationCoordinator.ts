import type {JournalBackupRestoreMutationCoordinator} from '../services/journalBackupRestoreExecutor';

// One queue per storage destination, shared by its readers and writers.
// Call only at the outer boundary of an operation. Nested acquisition would wait on itself.
export function createJournalMutationCoordinator(): JournalBackupRestoreMutationCoordinator {
  let tail = Promise.resolve();
  return {
    runExclusive<T>(work: () => Promise<T>): Promise<T> {
      const result = tail.then(work);
      tail = result.then(() => {}, () => {});
      return result;
    },
  };
}

export const localJournalMutations = createJournalMutationCoordinator();
