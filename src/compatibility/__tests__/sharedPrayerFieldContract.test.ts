import type { LocalPrayerEntry } from '../../storage/prayerStorage';
import { simpleSharedPrayer, sharedPeopleRequest, trackedJournalPrayer } from '../__fixtures__/sharedDailyAndPrayerRecords';
import { projectLocalPrayerForSharing, prepareSharedPrayerTextPatch, toLocalPrayerMergePreview } from '../sharedPrayerFieldContract';

const context = { accountId: 'account-a', remoteId: 'remote', expectedLocalVersion: 1, appliedAt: '2026-11-03T01:00:00.000Z' };
const linked = (): LocalPrayerEntry => ({ ...simpleSharedPrayer, linked_account_id: 'account-a', server_id: 'remote', sync_status: 'synced' });

describe('shared prayer field boundary', () => {
  it.each(['journal', 'people', 'devotional', 'guided_playbook'] as const)('supports %s base writing without private note blocks', prayer_type => {
    const result = projectLocalPrayerForSharing({ ...simpleSharedPrayer, prayer_type });
    expect(result).toMatchObject({ status: 'supported', base: { prayer_type, content: simpleSharedPrayer.content }, hasJournalOnlyMetadata: true });
    expect(JSON.stringify(result)).not.toMatch(/Private block|journalBlocks|linked_account_id/);
  });

  it('preserves false request/prayed flags rather than dropping them', () => {
    expect(projectLocalPrayerForSharing(sharedPeopleRequest)).toMatchObject({ status: 'supported',
      base: { person_name: 'A friend', requested_by: 'A friend', is_prayer_request: true, prayed: false } });
  });

  it('retains proven origin context while excluding private and orchestration metadata', () => {
    const result = projectLocalPrayerForSharing({ ...simpleSharedPrayer, prayer_type: 'guided_playbook',
      metadata: { playbook_id: 'book', step_id: 'step', source: 'playbook', bibleStudySessionId: 'private-ref', journalBlocks: [{ uri: 'private' }] } });
    expect(result).toMatchObject({ status: 'supported', base: { metadata: { playbook_id: 'book', step_id: 'step', source: 'playbook' } } });
    expect(JSON.stringify(result)).not.toMatch(/private-ref|journalBlocks|uri/);
  });

  it.each(['2026-11-03', '2026-11-03T00:00:00.000Z', null])('preserves a supported legacy answered-date representation: %s', answered_date => {
    expect(projectLocalPrayerForSharing({ ...simpleSharedPrayer, status: 'answered', answered_date } as LocalPrayerEntry))
      .toMatchObject({ status: 'supported', base: { status: 'answered', answered_date } });
  });

  it.each(['prayer_needs', 'answer_history', 'prayer_updates', 'lifecycle_history', 'tracking_status', 'track_answered', 'is_active'])(
    'holds rich lifecycle field %s instead of replacing it with a lossy status', key => {
      const entry = { ...simpleSharedPrayer, metadata: { [key]: [] } };
      expect(projectLocalPrayerForSharing(entry)).toEqual({ status: 'review_required', reason: 'lifecycle_requires_mapping' });
      expect(toLocalPrayerMergePreview(entry).capabilityId).toBeNull();
    });

  it('does not claim that a multi-need prayer is fully synchronized as a simple answered flag', () => {
    const before = JSON.stringify(trackedJournalPrayer);
    expect(projectLocalPrayerForSharing(trackedJournalPrayer)).toEqual({ status: 'review_required', reason: 'lifecycle_requires_mapping' });
    expect(JSON.stringify(trackedJournalPrayer)).toBe(before);
    expect(projectLocalPrayerForSharing({ ...simpleSharedPrayer, status: 'pending', answered_date: '2026-11-03' }))
      .toEqual({ status: 'review_required', reason: 'lifecycle_requires_mapping' });
  });

  it.each([
    [{ content: '{"notes":[{"uri":"private"}]}' }, 'structured_content_requires_mapping'],
    [{ notes: '{"private":"block"}' }, 'structured_content_requires_mapping'],
    [{ answered_date: 'not-a-date' }, 'invalid_record'], [{ status: 'closed' }, 'invalid_record'],
    [{ answered_date: '2026-02-30' }, 'invalid_record'], [{ answered_date: '2026-02-30T00:00:00.000Z' }, 'invalid_record'],
    [{ metadata: { playbook_id: { private: 'block' } } }, 'invalid_record'],
    [{ prayer_type: 'unknown' }, 'unknown_variant'], [{ user_id: 'account-b' }, 'ambiguous_ownership'],
    [{ deleted: true }, 'deleted_record_requires_reconciliation'],
  ])('holds invalid/unmapped prayer data: %s', (changes, reason) => {
    expect(projectLocalPrayerForSharing({ ...simpleSharedPrayer, ...changes } as LocalPrayerEntry))
      .toEqual({ status: 'review_required', reason });
  });

  it('prepares a text edit while preserving private notes and existing prayer state', () => {
    const entry = linked();
    const result = prepareSharedPrayerTextPatch(entry, { content: 'Edited prayer.', title: '' }, context);
    if (result.status !== 'prepared') { throw new Error('Expected prepared edit'); }
    expect(result.nextEntry).toMatchObject({ content: 'Edited prayer.', title: '', status: 'pending', version: 2, id: entry.id });
    expect(result.nextEntry.metadata).toBe(entry.metadata);
    expect(entry.content).toBe(simpleSharedPrayer.content);
  });

  it.each(['status', 'answered_date', 'metadata', 'prayer_type', 'journal_category', 'prayer_count', 'is_prayer_request', 'linked_account_id'])(
    'rejects generic text-patch changes to protected field %s', field => {
      expect(prepareSharedPrayerTextPatch(linked(), { [field]: 'override' }, context))
        .toEqual({ status: 'rejected', reason: 'unsupported_patch_fields' });
    });

  it('holds pending edits and rejects cross-account application', () => {
    expect(prepareSharedPrayerTextPatch({ ...linked(), sync_status: 'pending' }, { content: 'Remote' }, context))
      .toEqual({ status: 'rejected', reason: 'pending_local_changes' });
    expect(prepareSharedPrayerTextPatch(linked(), { content: 'Remote' }, { ...context, accountId: 'account-b' }))
      .toEqual({ status: 'rejected', reason: 'account_mismatch' });
  });
});
