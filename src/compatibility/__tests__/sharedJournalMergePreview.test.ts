import { buildSharedJournalMergePreview, type JournalMergePreviewRecord } from '../sharedJournalMergePreview';
import { heartJournalPreviewRecord, heartJournalWithExtensions, makeThreeHundredGuestRecords } from '../__fixtures__/sharedJournalMergeRecords';

const guest = (id: string, extra: Partial<JournalMergePreviewRecord> = {}): JournalMergePreviewRecord => ({
  id, capabilityId: 'reflection', accountId: null, ...extra,
});
const remote = (id: string, extra: Partial<JournalMergePreviewRecord> = {}): JournalMergePreviewRecord => ({
  id, capabilityId: 'reflection', accountId: 'account-a', ...extra,
});
const preview = (localRecords: JournalMergePreviewRecord[], remoteRecords: JournalMergePreviewRecord[] = []) =>
  buildSharedJournalMergePreview({ targetAccountId: 'account-a', remoteSnapshotComplete: true, localRecords, remoteRecords });

describe('initial shared journal merge preview', () => {
  it('previews 300 guest records: all 80 Heart Journals plus 40 prayers sync free', () => {
    const result = preview(makeThreeHundredGuestRecords(), Array.from({ length: 20 }, (_, index) => remote(`existing-${index}`)));
    expect(result.status).toBe('ready_for_confirmation');
    expect(result.requiresConfirmation).toBe(true);
    expect(result.counts).toEqual({
      localRecords: 300, uploadSharedBase: 120, keepInJournal: 180,
      alreadyLinked: 0, reviewRequired: 0, downloadShared: 20, remoteReviewRequired: 0,
    });
    expect(result.entries.filter(entry => entry.capabilityId === 'reflection' && entry.action === 'upload_shared_base')).toHaveLength(80);
  });

  it('keeps extension/media children in Journal and excludes all payload bytes from the result', () => {
    const before = JSON.stringify(heartJournalWithExtensions);
    const result = preview([
      heartJournalPreviewRecord,
      guest('extension-1', { capabilityId: 'journal_extension' }),
      guest('photo-1', { capabilityId: 'journal_media' }),
    ]);
    expect(result.counts).toMatchObject({ uploadSharedBase: 1, keepInJournal: 2 });
    expect(JSON.stringify(heartJournalWithExtensions)).toBe(before);
    expect(JSON.stringify(result)).not.toMatch(/file:\/\/|Private structured|This main text|custom/);
  });

  it('matches a verified server mapping without scheduling a second download', () => {
    const result = preview([guest('local-id', { serverId: 'cloud-id', baseDigest: 'base-a' })], [remote('cloud-id', { baseDigest: 'base-a' })]);
    expect(result.entries[0]).toMatchObject({ action: 'already_linked', remoteId: 'cloud-id' });
    expect(result.downloads).toEqual([]);
  });

  it.each([undefined, 'changed-base'])('preserves conflicts when matching identity has unproven/different base %s', baseDigest => {
    const result = preview([guest('same-id', { baseDigest: 'base-a' })], [remote('same-id', { baseDigest })]);
    expect(result.entries[0]).toMatchObject({ action: 'review_required', reason: 'base_conflict' });
    expect(result.counts.uploadSharedBase).toBe(0);
  });

  it('holds similar but distinct records for review instead of deleting or automatically linking them', () => {
    const result = preview([guest('local-a', { duplicateCandidateKey: 'similar' }), guest('local-b', { duplicateCandidateKey: 'similar' })], [remote('cloud-c', { duplicateCandidateKey: 'similar' })]);
    expect(result.entries.map(entry => entry.reason)).toEqual(['possible_duplicate', 'possible_duplicate']);
    expect(result.counts.uploadSharedBase).toBe(0);
    expect(result.downloads).toEqual([{ remoteId: 'cloud-c', capabilityId: 'reflection' }]);
  });

  it('does not use a digest alone to claim two distinct records have the same identity', () => {
    const result = preview([guest('local-a', { baseDigest: 'same-text' })], [remote('remote-b', { baseDigest: 'same-text' })]);
    expect(result.entries[0].action).toBe('upload_shared_base');
    expect(result.counts.alreadyLinked).toBe(0);
  });

  it.each([
    [guest('deleted', { deleted: true }), []],
    [guest('deleted'), [remote('deleted', { deleted: true })]],
  ] as Array<[JournalMergePreviewRecord, JournalMergePreviewRecord[]]>)('holds tombstones instead of silently resurrecting entries', (local, cloud) => {
    expect(preview([local], cloud).entries[0].reason).toBe('tombstone_requires_reconciliation');
  });

  it('holds missing prior mappings instead of re-uploading possibly deleted account records', () => {
    const result = preview([guest('one', { serverId: 'missing' }), guest('two', { accountId: 'account-a' })]);
    expect(result.entries.map(entry => entry.reason)).toEqual(['missing_remote_mapping', 'missing_remote_mapping']);
  });

  it('flags both local records when two IDs claim one server record', () => {
    const result = preview([
      guest('a', { serverId: 'remote', baseDigest: 'base' }),
      guest('b', { serverId: 'remote', baseDigest: 'base' }),
    ], [remote('remote', { baseDigest: 'base' })]);
    expect(result.entries.map(entry => entry.reason)).toEqual(['identity_collision', 'identity_collision']);
    expect(result.counts.alreadyLinked).toBe(0);
    expect(result.counts.reviewRequired).toBe(2);
  });

  it.each([
    [[guest('a', { accountId: 'account-b' })], []],
    [[], [remote('a', { accountId: 'account-b' })]],
    [[], [remote('a', { accountId: null })]],
  ] as Array<[JournalMergePreviewRecord[], JournalMergePreviewRecord[]]>)('blocks the entire plan on account mismatch', (local, cloud) => {
    expect(preview(local, cloud)).toMatchObject({ status: 'blocked', issues: ['account_mismatch'], entries: [], downloads: [] });
  });

  it('requires complete remote pagination before declaring new uploads safe', () => {
    expect(buildSharedJournalMergePreview({ targetAccountId: 'account-a', remoteSnapshotComplete: false, localRecords: [guest('a')], remoteRecords: [] }))
      .toMatchObject({ status: 'blocked', issues: ['incomplete_remote_snapshot'], entries: [] });
  });

  it('requires an account before preparing a combination', () => {
    expect(buildSharedJournalMergePreview({ targetAccountId: '', remoteSnapshotComplete: true, localRecords: [], remoteRecords: [] }).issues).toContain('missing_account');
  });

  it('blocks invalid and duplicate input identities', () => {
    expect(preview([guest('')]).issues).toContain('invalid_identity');
    expect(preview([guest('a'), guest('a')]).issues).toContain('duplicate_identity');
    expect(preview([], [remote('a'), remote('a')]).issues).toContain('duplicate_identity');
  });

  it('scopes identity to the record family instead of joining a prayer to a reflection', () => {
    const result = preview([guest('same')], [remote('same', { capabilityId: 'prayer' })]);
    expect(result.counts).toMatchObject({ uploadSharedBase: 1, downloadShared: 1, alreadyLinked: 0 });
  });

  it('surfaces unknown local/remote variants instead of guessing compatibility or discarding them', () => {
    const result = preview([guest('local', { capabilityId: 'future-type' })], [remote('remote', { capabilityId: 'future-type' })]);
    expect(result.entries[0].reason).toBe('unknown_capability');
    expect(result.remoteReview).toEqual([{ remoteId: 'remote', reason: 'unknown_capability' }]);
  });

  it('never uploads a saved display-only artifact and never downloads paid content through free sync', () => {
    const result = preview([guest('devo', { capabilityId: 'saved_devotional' })], [remote('study', { capabilityId: 'bible_study' })]);
    expect(result.entries[0].reason).toBe('read_only_artifact');
    expect(result.remoteReview[0].reason).toBe('unexpected_journal_cloud_record');
    expect(result.counts.uploadSharedBase).toBe(0);
    expect(result.downloads).toEqual([]);
  });

  it('is deterministic and does not mutate inputs while preparing repeated previews', () => {
    const local = Object.freeze([Object.freeze(guest('local', { baseDigest: 'private-digest' }))]);
    const cloud = Object.freeze([Object.freeze(remote('remote'))]);
    const input = { targetAccountId: 'account-a', remoteSnapshotComplete: true, localRecords: local, remoteRecords: cloud };
    expect(buildSharedJournalMergePreview(input)).toEqual(buildSharedJournalMergePreview(input));
    expect(JSON.stringify(buildSharedJournalMergePreview(input))).not.toContain('private-digest');
  });
});
