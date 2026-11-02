import type { LocalJournalEntry } from '../../storage/journalStorage';
import { sharedDailyFixtures } from '../__fixtures__/sharedDailyAndPrayerRecords';
import { projectLocalDailyJournalForSharing, prepareSharedDailyJournalPatch, toLocalDailyJournalMergePreview } from '../sharedDailyJournalFieldContract';
import { getJournalPersistencePolicy } from '../sharedJournalCapabilityContract';

const context = { accountId: 'account-a', remoteId: 'remote', expectedLocalVersion: 1, appliedAt: '2026-11-03T01:00:00.000Z' };
const linked = (entry = sharedDailyFixtures[0]): LocalJournalEntry => ({ ...entry, linked_account_id: 'account-a', server_id: 'remote', sync_status: 'synced' });

describe('daily journal field mappings', () => {
  it.each(sharedDailyFixtures)('preserves the supported %s payload while excluding private blocks', entry => {
    const before = JSON.stringify(entry);
    const result = projectLocalDailyJournalForSharing(entry);
    expect(result).toMatchObject({ status: 'supported', hasJournalOnlyMetadata: true,
      base: { content_type: entry.content_type, content: entry.content, metadata: { playbook_id: 'synthetic-playbook', subtask_id: 'synthetic-step' } } });
    expect(JSON.stringify(result)).not.toMatch(/journalBlocks|file:\/\/|linked_account_id|sync_status/);
    expect(JSON.stringify(entry)).toBe(before);
  });

  it.each([
    ['gratitude', { items: [{ id: 'a', text: 'Thankful.' }] }],
    ['today_win', { win: 'A good conversation.' }],
    ['today_win', { wins: [{ id: 'a', text: 'A good conversation.' }] }],
    ['looking_forward', { entry: 'Tomorrow.' }],
  ])('supports the documented legacy payload for %s', (content_type, content) => {
    expect(projectLocalDailyJournalForSharing({ ...sharedDailyFixtures[0], content_type, content: JSON.stringify(content) } as LocalJournalEntry).status).toBe('supported');
  });

  it.each(['morning_check_in', 'weekly_gratitude', 'weekly_looking_forward'] as const)('keeps %s out of unsupported siFia daily types', content_type => {
    const entry = { ...sharedDailyFixtures[0], content_type };
    expect(projectLocalDailyJournalForSharing(entry)).toEqual({ status: 'journal_only', capabilityId: 'journal_only_moment' });
    expect(toLocalDailyJournalMergePreview(entry).capabilityId).toBe('journal_only_moment');
    expect(getJournalPersistencePolicy('journal_only_moment', { accountId: 'account-a', sharedSyncConnected: true, journalCloudEntitled: false }))
      .toMatchObject({ freeSharedSync: false, journalCloudSync: false, manualExport: true });
  });

  it('holds Time Blocks for the dedicated recurrence/time-zone adapter', () => {
    expect(projectLocalDailyJournalForSharing({ ...sharedDailyFixtures[0], content_type: 'time_block' }))
      .toEqual({ status: 'review_required', reason: 'requires_time_block_adapter' });
  });

  it.each([
    ['gratitude', { items: ['Thanks'], journalBlocks: [{ uri: 'private' }] }],
    ['gratitude', { items: [{ id: 'a', text: 'Thanks', uri: 'private' }] }],
    ['looking_forward', { entry: { id: 'a', text: 'Tomorrow', date: '2026-11-03', blocks: [] } }],
    ['looking_forward', { entry: { id: 'a', text: 'Tomorrow', date: '2026-02-30' } }],
    ['todays_focus', { focus: 'Rest', priorities: [{ id: 'a', text: 'Rest', completed: false, private: 'notes' }] }],
    ['gratitude', { items: [{ id: 'duplicate', text: 'One' }, { id: 'duplicate', text: 'Two' }] }],
  ])('holds unrecognized nested fields instead of forwarding or stripping them: %s', (content_type, content) => {
    expect(projectLocalDailyJournalForSharing({ ...sharedDailyFixtures[0], content_type, content: JSON.stringify(content) } as LocalJournalEntry))
      .toEqual({ status: 'review_required', reason: 'unmapped_content_fields' });
  });

  it('holds conflicting Todo completion representations', () => {
    expect(projectLocalDailyJournalForSharing({ ...sharedDailyFixtures[1], completed: true }))
      .toEqual({ status: 'review_required', reason: 'conflicting_base_fields' });
  });

  it.each([
    [{ content: 'broken JSON' }, 'invalid_content'], [{ selected_date: '2026-02-30' }, 'invalid_record'],
    [{ linked_account_id: 'account-a', user_id: 'account-b' }, 'ambiguous_ownership'],
    [{ content_type: 'unknown_daily_type' }, 'unknown_variant'], [{ deleted: true }, 'deleted_record_requires_reconciliation'],
  ])('holds invalid stored data without scheduling an upload: %s', (changes, reason) => {
    const entry = { ...sharedDailyFixtures[0], ...changes } as LocalJournalEntry;
    expect(projectLocalDailyJournalForSharing(entry)).toEqual({ status: 'review_required', reason });
    expect(toLocalDailyJournalMergePreview(entry).capabilityId).toBeNull();
  });

  it('prepares a shared content edit without touching metadata or source identity', () => {
    const entry = linked();
    const result = prepareSharedDailyJournalPatch(entry, { content: '{"items":["Updated gratitude"]}' }, context);
    if (result.status !== 'prepared') { throw new Error('Expected prepared edit'); }
    expect(result.nextEntry.metadata).toBe(entry.metadata);
    expect(result.nextEntry).toMatchObject({ id: entry.id, server_id: entry.server_id, version: 2, created_at: entry.created_at });
    expect(entry.content).toBe(sharedDailyFixtures[0].content);
  });

  it('requires coupled Todo state to update together rather than silently disagree', () => {
    const entry = linked(sharedDailyFixtures[1]);
    expect(prepareSharedDailyJournalPatch(entry, { completed: true }, context)).toEqual({ status: 'rejected', reason: 'invalid_patch' });
    expect(prepareSharedDailyJournalPatch(entry, { completed: true, content: '{"text":"Make a call.","completed":true,"priority":true}' }, context).status).toBe('prepared');
  });

  it.each(['metadata', 'id', 'content_type', 'linked_account_id', 'version', 'deleted'])('rejects protected field %s', field => {
    expect(prepareSharedDailyJournalPatch(linked(), { [field]: 'override' }, context)).toEqual({ status: 'rejected', reason: 'unsupported_patch_fields' });
  });

  it('holds pending edits and rejects attempts to insert private blocks into shared JSON', () => {
    expect(prepareSharedDailyJournalPatch({ ...linked(), sync_status: 'pending' }, { completed: false }, context))
      .toEqual({ status: 'rejected', reason: 'pending_local_changes' });
    expect(prepareSharedDailyJournalPatch(linked(), { content: '{"items":[],"journalBlocks":[{"uri":"private"}]}' }, context))
      .toEqual({ status: 'rejected', reason: 'invalid_patch' });
  });
});
