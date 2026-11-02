import type { LocalReflectionEntry } from '../../storage/reflectionStorage';
import { heartJournalWithExtensions } from '../__fixtures__/sharedJournalMergeRecords';
import { buildSharedJournalMergePreview } from '../sharedJournalMergePreview';
import {
  prepareSharedReflectionPatch,
  projectLocalReflectionForSharing,
  toLocalReflectionMergePreview,
} from '../sharedReflectionFieldContract';

const local = (changes: Partial<LocalReflectionEntry> = {}): LocalReflectionEntry => ({
  ...heartJournalWithExtensions, ...changes,
});
const linked = (changes: Partial<LocalReflectionEntry> = {}): LocalReflectionEntry => local({
  linked_account_id: 'account-a', server_id: 'remote-heart', sync_status: 'synced', ...changes,
});
const context = {
  accountId: 'account-a', remoteId: 'remote-heart', expectedLocalVersion: 1,
  appliedAt: '2026-11-03T01:00:00.000Z',
};

describe('shared reflection field boundary', () => {
  it('projects only the shared base of a Heart Journal with photos and private note blocks', () => {
    const result = projectLocalReflectionForSharing(local());
    expect(result).toEqual({
      status: 'supported', hasJournalOnlyMetadata: true,
      base: { title: 'A quiet morning', content: 'This main text is shared.',
        type: 'free', source: 'freeform', selected_date: '2026-11-03' },
    });
    expect(JSON.stringify(result)).not.toMatch(/file:\/\/|Private structured|unknown_future_block|journalBlocks|user_id/);
  });

  it('preserves supported historical context without flattening unknown metadata', () => {
    const result = projectLocalReflectionForSharing(local({
      type: 'playbook', source: 'playbook', tags: ['courage'],
      metadata: { playbook_id: 'book-a', playbook_title: 'Courage', subtask_id: 'step-a',
        prompt: 'What comes next?', day_number: 1, total_days: 3, question_number: 0,
        privateBlock: { text: 'Never share this field.' } },
    }));
    expect(result).toMatchObject({ status: 'supported', hasJournalOnlyMetadata: true,
      base: { playbook_id: 'book-a', subtask_id: 'step-a', prompt: 'What comes next?', question_number: 0 } });
    expect(JSON.stringify(result)).not.toContain('Never share');
  });

  it('excludes legacy top-level blocks and never forwards local bookkeeping as shared fields', () => {
    const entry = { ...linked(), journal_blocks: [{ kind: 'photo', uri: 'file:///private.jpg' }],
      local_device_key: 'synthetic-sensitive-value' };
    const result = projectLocalReflectionForSharing(entry);
    expect(result.status).toBe('supported');
    expect(JSON.stringify(result)).not.toMatch(/journal_blocks|file:\/\/|local_device_key|synthetic-sensitive-value|linked_account_id|server_id|sync_status/);
  });

  it('keeps a plain legacy guided prompt readable and shared without changing its discriminator', () => {
    expect(projectLocalReflectionForSharing(local({ type: 'guided', source: 'guided_prompt', metadata: { prompt: 'What are you carrying?' } })))
      .toMatchObject({ status: 'supported', base: { type: 'guided', source: 'guided_prompt', prompt: 'What are you carrying?' } });
  });

  it.each([
    { content: '{"format":"guided_reflection_v1","answers":[{"notes":[{"uri":"file:///private.jpg"}]}]}' },
    { metadata: { guidedJourney: { answers: [] } } },
    { metadata: { guided_journey: { answers: [] } } },
    { content: '{"format":"unknown_v9","private":"payload"}' },
    { content: '[{"photo":"private"}]' },
    { content: JSON.stringify('{"format":"guided_reflection_v1","notes":["private"]}') },
    { content: JSON.stringify(JSON.stringify('{"format":"unknown_v9","notes":["private"]}')) },
    { content: '{"truncated":' },
  ])('holds structured or unknown containers instead of sharing serialized blocks: %s', changes => {
    expect(projectLocalReflectionForSharing(local(changes))).toEqual({ status: 'review_required', reason: 'structured_content_requires_mapping' });
  });

  it('preserves an ordinary quoted sentence without changing it into decoded text', () => {
    expect(projectLocalReflectionForSharing(local({ content: '"Be still."' })))
      .toMatchObject({ status: 'supported', base: { content: '"Be still."' } });
  });

  it.each([
    [{ type: 'scripture', source: 'bible_study', content: '{"format":"bible_study_v1"}' }, 'bible_study'],
    [{ type: 'scripture', source: 'scripture_note' }, 'scripture_note'],
    [{ type: 'sermon', source: 'sermon_notes' }, 'session_note'],
    [{ metadata: { sessionNoteType: 'meeting' } }, 'session_note'],
  ] as const)('keeps dedicated Journal documents local: %s', (changes, capabilityId) => {
    expect(projectLocalReflectionForSharing(local(changes))).toEqual({ status: 'journal_only', capabilityId });
  });

  it.each([
    { type: 'future_reflection_type' }, { source: 'unknown_source' }, { type: 'scripture', source: 'unknown_scripture' },
  ])('does not assume an unknown discriminator can be shared: %s', changes => {
    expect(projectLocalReflectionForSharing(local(changes))).toEqual({ status: 'review_required', reason: 'unknown_variant' });
  });

  it.each([
    { selected_date: '2026-02-30' }, { created_at: 'invalid' },
    { metadata: { prompt: { photo: 'private' } } }, { metadata: { day_number: 1.5 } },
    { tags: [123] }, { linked_account_id: '' }, { deleted: 'yes' },
  ])('holds invalid stored fields for review: %s', changes => {
    expect(projectLocalReflectionForSharing(local(changes as unknown as Partial<LocalReflectionEntry>)))
      .toEqual({ status: 'review_required', reason: 'invalid_record' });
  });

  it('does not treat unexplained legacy ownership or remote mapping as guest data', () => {
    expect(projectLocalReflectionForSharing({ ...local(), user_id: 'account-b' } as LocalReflectionEntry))
      .toEqual({ status: 'review_required', reason: 'ambiguous_ownership' });
    expect(projectLocalReflectionForSharing(local({ server_id: 'cloud-id' })))
      .toEqual({ status: 'review_required', reason: 'ambiguous_ownership' });
    expect(projectLocalReflectionForSharing({ ...local(), user_id: 123 } as LocalReflectionEntry))
      .toEqual({ status: 'review_required', reason: 'ambiguous_ownership' });
  });

  it('does not prepare deleted records as fresh shared text', () => {
    expect(projectLocalReflectionForSharing(local({ deleted: true })))
      .toEqual({ status: 'review_required', reason: 'deleted_record_requires_reconciliation' });
  });

  it('adapts 80 actual local Heart Journals to the merge preview without exposing their extensions', () => {
    const entries = [
      ...Array.from({ length: 80 }, (_, index) => local({ id: `heart-${index}` })),
      local({ id: 'study', type: 'scripture', source: 'bible_study' }),
      local({ id: 'scripture', type: 'scripture', source: 'scripture_note' }),
      local({ id: 'session', type: 'sermon', source: 'sermon_notes' }),
    ];
    const records = entries.map(toLocalReflectionMergePreview);
    expect(JSON.stringify(records)).not.toMatch(/This main text|Private structured|file:\/\/|journalBlocks/);
    const result = buildSharedJournalMergePreview({ targetAccountId: 'account-a', remoteSnapshotComplete: true,
      localRecords: records, remoteRecords: [] });
    expect(result.counts).toMatchObject({ uploadSharedBase: 80, keepInJournal: 3, reviewRequired: 0 });
  });

  it('turns structured reflections into review entries rather than scheduled uploads', () => {
    const record = toLocalReflectionMergePreview(local({ metadata: { guidedJourney: { answers: [] } } }));
    expect(record.capabilityId).toBeNull();
    expect(buildSharedJournalMergePreview({ targetAccountId: 'account-a', remoteSnapshotComplete: true,
      localRecords: [record], remoteRecords: [] }).counts).toMatchObject({ uploadSharedBase: 0, reviewRequired: 1 });
  });
});

describe('incoming shared text patch preparation', () => {
  it('updates supported text and preserves all private blocks, unknown fields, and source context', () => {
    const entry = { ...linked(), future_local_field: { preserve: true } };
    const before = JSON.stringify(entry);
    const result = prepareSharedReflectionPatch(entry, { title: '', content: 'Edited in siFia.', tags: [] }, context);
    expect(result.status).toBe('prepared');
    if (result.status !== 'prepared') { throw new Error('Expected prepared patch'); }
    expect(result.nextEntry).toMatchObject({ title: '', content: 'Edited in siFia.', tags: [], version: 2,
      updated_at: context.appliedAt, future_local_field: { preserve: true } });
    expect(result.nextEntry.metadata).toBe(entry.metadata);
    expect(result.nextEntry.metadata?.journalBlocks).toEqual(heartJournalWithExtensions.metadata?.journalBlocks);
    expect(result.nextEntry.created_at).toBe(entry.created_at);
    expect(result.nextEntry.source).toBe(entry.source);
    expect(JSON.stringify(entry)).toBe(before);
  });

  it.each(['metadata', 'journal_blocks', 'guided_journey', 'id', 'server_id', 'linked_account_id', 'type', 'source', 'prompt', 'version', 'sync_status'])(
    'rejects the complete patch when it tries to change protected field %s', field => {
      expect(prepareSharedReflectionPatch(linked(), { content: 'Valid text', [field]: 'override' }, context))
        .toEqual({ status: 'rejected', reason: 'unsupported_patch_fields' });
    });

  it.each(['local', 'pending', 'error', undefined] as const)('holds unsynced state (%s) instead of overwriting pending edits', sync_status => {
    expect(prepareSharedReflectionPatch(linked({ sync_status }), { content: 'Remote' }, context))
      .toEqual({ status: 'rejected', reason: 'pending_local_changes' });
  });

  it.each([
    [{ linked_account_id: 'account-b' }, 'account_mismatch'],
    [{ server_id: 'different' }, 'identity_mismatch'],
    [{ version: 2 }, 'revision_conflict'],
    [{ version: undefined }, 'revision_conflict'],
    [{ deleted: true }, 'unsupported_record'],
  ] as const)('rejects stale or incompatible targets: %s', (changes, reason) => {
    expect(prepareSharedReflectionPatch(linked(changes), { content: 'Remote' }, context))
      .toEqual({ status: 'rejected', reason });
  });

  it.each([{}, null, { content: null }, { content: '{"notes":["private"]}' }, { selected_date: '2026-02-30' }, { tags: ['ok', 1] }])(
    'rejects malformed patches before any state changes: %s', patch => {
      expect(prepareSharedReflectionPatch(linked(), patch, context)).toEqual({ status: 'rejected', reason: 'invalid_patch' });
    });

  it('does not alias the caller tag array into a prepared entry', () => {
    const patch = { tags: ['shared-tag'] };
    const result = prepareSharedReflectionPatch(linked(), patch, context);
    patch.tags.push('later-change');
    if (result.status !== 'prepared') { throw new Error('Expected prepared patch'); }
    expect(result.nextEntry.tags).toEqual(['shared-tag']);
  });

  it('rejects inherited-prototype manipulation from a parsed patch', () => {
    expect(prepareSharedReflectionPatch(linked(), JSON.parse('{"__proto__":{"admin":true},"content":"text"}'), context))
      .toEqual({ status: 'rejected', reason: 'unsupported_patch_fields' });
  });

  it('requires valid application context rather than allowing unchecked local revisions', () => {
    expect(prepareSharedReflectionPatch(linked(), { content: 'Remote' }, { ...context, expectedLocalVersion: 0 }))
      .toEqual({ status: 'rejected', reason: 'invalid_context' });
  });
});
