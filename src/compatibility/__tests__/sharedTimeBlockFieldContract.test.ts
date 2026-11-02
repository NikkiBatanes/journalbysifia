import type { LocalJournalEntry } from '../../storage/journalStorage';
import { projectLocalTimeBlockForSharing, prepareSharedTimeBlockTextPatch } from '../sharedTimeBlockFieldContract';

const payload = {
  start_time: '2026-11-02T23:00:00.000Z', end_time: '2026-11-03T00:00:00.000Z',
  timezone: 'Asia/Manila', all_day: false, title: 'Quiet time', category: 'faith',
  location: '', description: 'Be present.', repeat_rule: { frequency: 'never' }, repeat_frequency: 'never',
  is_completed: false, calendar_event_id: 'native-calendar-private', alert: '5-min', alarm_minutes: 5,
  metadata: { journalBlocks: [{ id: 'photo', uri: 'file:///private-photo.jpg' }] },
};
const record = (changes: Record<string, unknown> = {}): LocalJournalEntry => ({
  id: 'time-block', content_type: 'time_block', content: JSON.stringify({ ...payload, ...changes }),
  selected_date: '2026-11-03', created_at: '2026-11-03T00:00:00.000Z', updated_at: '2026-11-03T00:00:00.000Z',
  version: 1, sync_status: 'local', linked_account_id: null,
});
const linked = (): LocalJournalEntry => ({ ...record(), linked_account_id: 'account-a', server_id: 'remote', sync_status: 'synced' });
const context = { accountId: 'account-a', remoteId: 'remote', expectedLocalVersion: 1, appliedAt: '2026-11-03T01:00:00.000Z' };

describe('Time Block field contract', () => {
  it('uses the persisted zone/calendar date while retaining the original aware instants', () => {
    const result = projectLocalTimeBlockForSharing(record());
    expect(result).toMatchObject({ status: 'supported', hasDeviceOnlyFields: true, hasJournalOnlyMetadata: true,
      base: { selected_date: '2026-11-03', start_time: payload.start_time, end_time: payload.end_time, timezone: 'Asia/Manila' } });
    expect(JSON.stringify(result)).not.toMatch(/calendar_event_id|native-calendar-private|alarm_minutes|journalBlocks|private-photo/);
  });

  it.each([
    ['2026-03-08', '2026-03-08T05:00:00.000Z', '2026-03-09T03:59:59.000Z'],
    ['2026-11-01', '2026-11-01T04:00:00.000Z', '2026-11-02T04:59:59.000Z'],
  ])('preserves an all-day record across DST on %s without forcing a 24-hour duration', (selected_date, start_time, end_time) => {
    const entry = { ...record({ timezone: 'America/New_York', all_day: true, start_time, end_time }), selected_date };
    expect(projectLocalTimeBlockForSharing(entry)).toMatchObject({ status: 'supported', base: { start_time, end_time, selected_date, all_day: true } });
  });

  it('preserves the two distinct instants during a repeated DST clock hour', () => {
    const entry = { ...record({ timezone: 'America/New_York', start_time: '2026-11-01T05:30:00.000Z', end_time: '2026-11-01T06:30:00.000Z' }), selected_date: '2026-11-01' };
    expect(projectLocalTimeBlockForSharing(entry).status).toBe('supported');
  });

  it('retains shared playbook relationships without forwarding private blocks', () => {
    const result = projectLocalTimeBlockForSharing(record({ metadata: {
      ...payload.metadata, playbookId: 'book', subtaskId: 'subtask', stepId: 'step',
      playbookTitle: 'Courage', source: 'smart_journaling', actionStepNumber: 2,
    } }));
    expect(result).toMatchObject({ status: 'supported', base: { metadata: {
      playbookId: 'book', subtaskId: 'subtask', stepId: 'step', actionStepNumber: 2,
    } } });
    expect(JSON.stringify(result)).not.toMatch(/journalBlocks|private-photo/);
  });

  it('holds conflicting parent context rather than silently reparenting a record', () => {
    const entry = { ...record({ metadata: { playbookId: 'inner-book' } }), metadata: { playbookId: 'other-book' } };
    expect(projectLocalTimeBlockForSharing(entry)).toEqual({ status: 'review_required', reason: 'conflicting_context' });
  });

  it.each([
    [{ start_time: '2026-11-03T07:00:00' }, 'invalid_time_range'],
    [{ end_time: '2026-11-02T22:00:00.000Z' }, 'invalid_time_range'],
    [{ start_time: '2026-02-30T00:00:00.000Z' }, 'invalid_time_range'],
    [{ timezone: undefined }, 'timezone_requires_mapping'],
    [{ timezone: 'Mars/Olympus' }, 'timezone_requires_mapping'],
    [{ timezone: 'America/New_York' }, 'selected_date_mismatch'],
    [{ completed_at: '2026-11-03T00:00:00.000Z', is_completed: false }, 'invalid_completion_state'],
    [{ description: '{"blocks":[{"uri":"private"}]}' }, 'structured_content_requires_mapping'],
    [{ future_blocks: [{ uri: 'private' }] }, 'unmapped_content_fields'],
  ])('holds ambiguous or unsafe payloads: %s', (changes, reason) => {
    expect(projectLocalTimeBlockForSharing(record(changes as Record<string, unknown>))).toEqual({ status: 'review_required', reason });
  });

  it.each([
    { repeat_rule: { frequency: 'daily' } }, { repeat_rule: { frequency: 'bi-weekly' } },
    { repeat_frequency: 'weekly' }, { repeat_rule: { frequency: 'custom', customDays: [1, 3] } },
    { repeat_until: '2026-12-01' }, { metadata: { exceptions: ['2026-11-04'] } },
    { metadata: { endDate: '2026-12-01' } }, { category: 'exception' },
  ])('requires a verified recurrence/exception mapping: %s', changes => {
    expect(projectLocalTimeBlockForSharing(record(changes))).toEqual({ status: 'review_required', reason: 'recurrence_requires_mapping' });
  });

  it.each(['_virtualInstance', '_originalDate', '_virtualDate'])('never treats a derived %s occurrence as a new parent', key => {
    expect(projectLocalTimeBlockForSharing(record({ metadata: { [key]: 'derived' } })))
      .toEqual({ status: 'review_required', reason: 'virtual_instance' });
  });

  it('prepares text edits while retaining private blocks and native calendar identifiers locally', () => {
    const entry = linked();
    const before = JSON.stringify(entry);
    const result = prepareSharedTimeBlockTextPatch(entry, { title: 'Updated', description: 'A new note.' }, context);
    if (result.status !== 'prepared') { throw new Error('Expected prepared patch'); }
    const content = JSON.parse(result.nextEntry.content);
    expect(content).toMatchObject({ title: 'Updated', description: 'A new note.', calendar_event_id: payload.calendar_event_id, alert: '5-min' });
    expect(content.metadata).toEqual(payload.metadata);
    expect(result.nextEntry).toMatchObject({ id: entry.id, selected_date: entry.selected_date, version: 2 });
    expect(JSON.stringify(entry)).toBe(before);
  });

  it.each(['start_time', 'end_time', 'selected_date', 'timezone', 'repeat_rule', 'metadata', 'calendar_event_id'])('keeps %s outside the text-edit operation', field => {
    expect(prepareSharedTimeBlockTextPatch(linked(), { [field]: 'override' }, context)).toEqual({ status: 'rejected', reason: 'unsupported_patch_fields' });
  });

  it('holds unsynced edits and prevents cross-account patch application', () => {
    expect(prepareSharedTimeBlockTextPatch({ ...linked(), sync_status: 'pending' }, { title: 'Remote' }, context)).toEqual({ status: 'rejected', reason: 'pending_local_changes' });
    expect(prepareSharedTimeBlockTextPatch(linked(), { title: 'Remote' }, { ...context, accountId: 'account-b' })).toEqual({ status: 'rejected', reason: 'account_mismatch' });
  });
});
