import { JournalApi } from '../../services/api/journalApi';
import { findLocalPlanEntry, saveLocalJournalSingleton, updateLocalJournalEntry, deleteLocalJournalEntry } from '../journalStorage';
import { supabase } from '../../services/supabaseClient';

jest.mock('../../services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../journalStorage', () => ({ findLocalPlanEntry: jest.fn(), saveLocalJournalSingleton: jest.fn(), updateLocalJournalEntry: jest.fn(), deleteLocalJournalEntry: jest.fn() }));

beforeEach(() => jest.clearAllMocks());

it('updates the local focus rather than an absent cloud row', async () => {
  const entry = { id: 'focus', content_type: 'todays_focus', selected_date: '2026-09-15', content: '{}' };
  (findLocalPlanEntry as jest.Mock).mockResolvedValue(entry);
  (saveLocalJournalSingleton as jest.Mock).mockResolvedValue({ ...entry, content: '{"focus":"Family"}' });
  await JournalApi.updateJournalEntry('focus', { content: '{"focus":"Family"}' });
  expect(saveLocalJournalSingleton).toHaveBeenCalledWith('todays_focus', entry.selected_date, '{"focus":"Family"}');
  expect(supabase.from).not.toHaveBeenCalled();
});

it('persists local todo checkmarks and routes deletion to the local tombstone', async () => {
  const entry = { id: 'todo', content_type: 'todo', selected_date: '2026-09-15', content: '{}', completed: false };
  (findLocalPlanEntry as jest.Mock).mockResolvedValue(entry);
  (updateLocalJournalEntry as jest.Mock).mockImplementation(async value => value);
  await JournalApi.updateJournalEntry('todo', { completed: true });
  expect(updateLocalJournalEntry).toHaveBeenCalledWith({ ...entry, completed: true });
  await JournalApi.deleteJournalEntry('todo');
  expect(deleteLocalJournalEntry).toHaveBeenCalledWith('todo', 'todo', entry.selected_date);
  expect(supabase.from).not.toHaveBeenCalled();
});
