import type { LocalJournalEntry } from '../../storage/journalStorage';
import type { LocalPrayerEntry } from '../../storage/prayerStorage';

const stamp = '2026-11-03T00:00:00.000Z';
const common = { selected_date: '2026-11-03', created_at: stamp, updated_at: stamp, version: 1, sync_status: 'local' as const, linked_account_id: null };
const metadata = { source: 'smart_journaling', playbook_id: 'synthetic-playbook', subtask_id: 'synthetic-step',
  journalBlocks: [{ id: 'photo', kind: 'photo', uri: 'file:///synthetic-private.jpg' }] };

/** JSON shapes come from both apps' writers; all values are synthetic. */
export const sharedDailyFixtures: LocalJournalEntry[] = [
  { ...common, id: 'gratitude', content_type: 'gratitude', content: JSON.stringify({ items: ['A quiet morning.'] }), metadata },
  { ...common, id: 'todo', content_type: 'todo', content: JSON.stringify({ text: 'Make a call.', completed: false, priority: true }), completed: false, metadata },
  { ...common, id: 'focus', content_type: 'todays_focus', content: JSON.stringify({ focus: 'Be present.', focusCategory: 'other', customFocus: 'Presence', personalText: '', priorities: [{ id: 'priority_1', text: 'Listen.', completed: false }] }), metadata },
  { ...common, id: 'win', content_type: 'today_win', content: JSON.stringify({ winType: 'other', winTypeName: 'A small step', quietWin: 'Made time to rest.' }), metadata },
  { ...common, id: 'forward', content_type: 'looking_forward', content: JSON.stringify({ entry: { id: 'looking-forward-1', text: 'A new day.', date: stamp }, emotionId: 'hopeful', emotionName: 'Hopeful', customEmotion: '' }), metadata },
];

export const simpleSharedPrayer: LocalPrayerEntry = {
  ...common, id: 'prayer', title: 'For today', prayer_type: 'journal', journal_category: 'personal_prayer',
  content: 'Help me walk patiently.', status: 'pending',
  metadata: { journalBlocks: [{ id: 'private-note', kind: 'text', text: 'Private block text.' }] },
};
export const sharedPeopleRequest: LocalPrayerEntry = {
  ...simpleSharedPrayer, id: 'request', prayer_type: 'people', journal_category: undefined,
  person_name: 'A friend', is_prayer_request: true, requested_by: 'A friend', prayed: false,
};
export const trackedJournalPrayer: LocalPrayerEntry = {
  ...simpleSharedPrayer, id: 'tracked', metadata: { prayer_needs: [
    { id: 'need-1', text: 'Health', status: 'answered', answerHistory: [{ id: 'answer-1', date: stamp }] },
    { id: 'need-2', text: 'Work', status: 'pending', active: true },
  ], track_answered: true, is_active: true },
};
