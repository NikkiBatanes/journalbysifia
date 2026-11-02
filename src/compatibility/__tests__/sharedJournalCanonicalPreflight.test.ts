import { buildCanonicalJournalMergePreflight } from '../sharedJournalCanonicalPreflight';
import { heartJournalWithExtensions } from '../__fixtures__/sharedJournalMergeRecords';
import { sharedDailyFixtures, simpleSharedPrayer, trackedJournalPrayer } from '../__fixtures__/sharedDailyAndPrayerRecords';

const empty = { journalRecords: [], reflectionRecords: [], prayerRecords: [] };
const input = { targetAccountId: 'account-a', localSnapshotComplete: true, remoteSnapshotComplete: true, snapshot: empty, remoteRecords: [] };

describe('canonical journal preflight composition', () => {
  it('previews 300 persisted-shape records with 80 Heart Journals while preserving Journal-only documents', () => {
    const snapshot = {
      reflectionRecords: [
        ...Array.from({ length: 80 }, (_, i) => ({ ...heartJournalWithExtensions, id: `heart-${i}` })),
        ...Array.from({ length: 100 }, (_, i) => ({ ...heartJournalWithExtensions, id: `study-${i}`, type: 'scripture', source: 'bible_study' })),
        ...Array.from({ length: 80 }, (_, i) => ({ ...heartJournalWithExtensions, id: `session-${i}`, type: 'sermon', source: 'sermon_notes' })),
      ],
      journalRecords: Array.from({ length: 20 }, (_, i) => ({ ...sharedDailyFixtures[0], id: `gratitude-${i}` })),
      prayerRecords: Array.from({ length: 20 }, (_, i) => ({ ...simpleSharedPrayer, id: `prayer-${i}` })),
    };
    const before = JSON.stringify(snapshot);
    const result = buildCanonicalJournalMergePreflight({ ...input, snapshot, remoteRecords: [
      { id: 'existing-heart', capabilityId: 'reflection', accountId: 'account-a' },
    ] });
    expect(result.preview.status).toBe('ready_for_confirmation');
    expect(result.preview.requiresConfirmation).toBe(true);
    expect(result.preview.counts).toMatchObject({ localRecords: 300, uploadSharedBase: 120, keepInJournal: 180, downloadShared: 1, reviewRequired: 0 });
    expect(result.preview.entries.filter(entry => entry.capabilityId === 'reflection' && entry.action === 'upload_shared_base')).toHaveLength(80);
    expect(result.heldRecords).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/This main text|Private structured|Private block|file:\/\/|journalBlocks|Made time to rest/);
    expect(JSON.stringify(snapshot)).toBe(before);
  });

  it('explains held mapping cases using only IDs/family/reason, without a body preview', () => {
    const result = buildCanonicalJournalMergePreflight({ ...input, snapshot: { ...empty,
      prayerRecords: [trackedJournalPrayer],
      journalRecords: [{ ...sharedDailyFixtures[0], id: 'repeat-block', content_type: 'time_block', content: JSON.stringify({
        title: 'Repeat', category: 'faith', all_day: false,
        start_time: '2026-11-03T00:00:00.000Z', end_time: '2026-11-03T01:00:00.000Z',
        timezone: 'Asia/Manila', repeat_rule: { frequency: 'daily' },
      }) }],
    } });
    expect(result.preview.status).toBe('review_required');
    expect(result.heldRecords).toEqual([
      { localId: 'repeat-block', family: 'journal', reason: 'recurrence_requires_mapping' },
      { localId: 'tracked', family: 'prayer', reason: 'lifecycle_requires_mapping' },
    ]);
    expect(JSON.stringify(result)).not.toMatch(/Health|Work|answerHistory/);
  });

  it('routes a persisted one-off Time Block to its own shared family', () => {
    const result = buildCanonicalJournalMergePreflight({ ...input, snapshot: { ...empty, journalRecords: [
      { ...sharedDailyFixtures[0], id: 'block', content_type: 'time_block', content: JSON.stringify({
        title: 'Quiet time', category: 'faith', all_day: false,
        start_time: '2026-11-03T00:00:00.000Z', end_time: '2026-11-03T01:00:00.000Z',
        timezone: 'Asia/Manila', repeat_rule: { frequency: 'never' },
      }) },
    ] } });
    expect(result.preview.entries).toEqual([{ localId: 'block', capabilityId: 'time_block', action: 'upload_shared_base', reason: 'new_shared_record' }]);
  });

  it('blocks incomplete local snapshots before showing any proposed uploads', () => {
    expect(buildCanonicalJournalMergePreflight({ ...input, localSnapshotComplete: false,
      snapshot: { ...empty, prayerRecords: [simpleSharedPrayer] } }))
      .toMatchObject({ preview: { status: 'blocked', issues: ['incomplete_local_snapshot'], entries: [] }, heldRecords: [] });
  });

  it('does not return held record details after account switching invalidates the snapshot', () => {
    const result = buildCanonicalJournalMergePreflight({ ...input, snapshot: { ...empty, prayerRecords: [
      { ...trackedJournalPrayer, linked_account_id: 'account-b' },
    ] } });
    expect(result).toMatchObject({ preview: { status: 'blocked', issues: ['account_mismatch'], entries: [], downloads: [] }, heldRecords: [] });
  });

  it('does not inspect partial local records before snapshot validation is complete', () => {
    const snapshot = { reflectionRecords: [], prayerRecords: [],
      get journalRecords(): never { throw new Error('Partial inventory must not be inspected'); } };
    expect(buildCanonicalJournalMergePreflight({ ...input, localSnapshotComplete: false, snapshot }).preview.status).toBe('blocked');
  });

  it('keeps check-ins and weekly Moments in Journal without coercing their date/type into shared daily entries', () => {
    const result = buildCanonicalJournalMergePreflight({ ...input, snapshot: { ...empty, journalRecords: [
      { ...sharedDailyFixtures[0], id: 'weekly', content_type: 'weekly_gratitude' },
      { ...sharedDailyFixtures[0], id: 'check-in', content_type: 'morning_check_in' },
    ] } });
    expect(result.preview.counts).toMatchObject({ uploadSharedBase: 0, keepInJournal: 2 });
    expect(result.preview.entries.map(entry => entry.capabilityId)).toEqual(['journal_only_moment', 'journal_only_moment']);
  });
});
