import { JournalApi } from '../../services/api/journalApi';
import { createLocalJournalEntry, findLocalPlanEntry, saveLocalJournalSingleton, updateLocalJournalEntry, deleteLocalJournalEntry } from '../journalStorage';
import { supabase } from '../../services/supabaseClient';

jest.mock('../../services/supabaseClient', () => ({ supabase: { from: jest.fn() } }));
jest.mock('../journalStorage', () => ({
  createLocalJournalEntry: jest.fn(),
  findLocalPlanEntry: jest.fn(),
  getLocalJournalEntries: jest.fn(),
  getLocalJournalSingleton: jest.fn(),
  saveLocalJournalSingleton: jest.fn(),
  updateLocalJournalEntry: jest.fn(),
  deleteLocalJournalEntry: jest.fn(),
  deleteLocalJournalSingleton: jest.fn(),
}));

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

it('toggles a priority through the canonical focus singleton without changing its stable id', async () => {
  const entry = {
    id: 'focus-stable-id',
    content_type: 'todays_focus',
    selected_date: '2026-09-17',
    content: JSON.stringify({
      focus: 'Faithfulness',
      priorities: [{ id: 'priority-stable-id', text: 'New', completed: false }],
    }),
  };
  const completedContent = JSON.stringify({
    focus: 'Faithfulness',
    priorities: [{ id: 'priority-stable-id', text: 'New', completed: true }],
  });
  (findLocalPlanEntry as jest.Mock).mockResolvedValue(entry);
  (saveLocalJournalSingleton as jest.Mock).mockResolvedValue({ ...entry, content: completedContent });

  const saved = await JournalApi.updateJournalEntry(entry.id, { content: completedContent });

  expect(saveLocalJournalSingleton).toHaveBeenCalledWith('todays_focus', entry.selected_date, completedContent);
  expect(saved.id).toBe('focus-stable-id');
  expect(JSON.parse(saved.content).priorities[0]).toEqual({ id: 'priority-stable-id', text: 'New', completed: true });
  expect(supabase.from).not.toHaveBeenCalled();

  const incompleteContent = JSON.stringify({
    focus: 'Faithfulness',
    priorities: [{ id: 'priority-stable-id', text: 'New', completed: false }],
  });
  (saveLocalJournalSingleton as jest.Mock).mockResolvedValue({ ...entry, content: incompleteContent });
  const toggledBack = await JournalApi.updateJournalEntry(entry.id, { content: incompleteContent });
  expect(toggledBack.id).toBe('focus-stable-id');
  expect(JSON.parse(toggledBack.content).priorities[0].completed).toBe(false);
});

it('toggles a todo through its canonical record and preserves the stable todo id', async () => {
  const entry = {
    id: 'todo-stable-id',
    content_type: 'todo',
    selected_date: '2026-09-17',
    content: JSON.stringify({ text: 'New', completed: false, priority: false }),
    completed: false,
  };
  const completedContent = JSON.stringify({ text: 'New', completed: true, priority: false });
  (findLocalPlanEntry as jest.Mock).mockResolvedValue(entry);
  (updateLocalJournalEntry as jest.Mock).mockImplementation(async value => value);

  const saved = await JournalApi.updateJournalEntry(entry.id, { content: completedContent, completed: true });

  expect(saved.id).toBe('todo-stable-id');
  expect(saved.completed).toBe(true);
  expect(JSON.parse(saved.content).completed).toBe(true);
  expect(supabase.from).not.toHaveBeenCalled();
});

it('creates todos locally for an empty target date so Copy Todos never requires cloud auth', async () => {
  const copied = {
    id: 'copied-stable-id',
    content_type: 'todo',
    selected_date: '2026-09-18',
    content: JSON.stringify({ text: 'New', completed: false, priority: true }),
    completed: false,
  };
  (createLocalJournalEntry as jest.Mock).mockResolvedValue(copied);

  const saved = await JournalApi.createJournalEntry({
    user_id: '',
    content_type: 'todo',
    selected_date: copied.selected_date,
    content: copied.content,
    completed: false,
  });

  expect(createLocalJournalEntry).toHaveBeenCalledWith({
    content_type: 'todo',
    selected_date: copied.selected_date,
    content: copied.content,
    completed: false,
  });
  expect(saved.id).toBe('copied-stable-id');
  expect(supabase.from).not.toHaveBeenCalled();
});
