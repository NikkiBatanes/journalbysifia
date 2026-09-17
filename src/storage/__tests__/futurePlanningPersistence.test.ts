import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createLocalJournalEntry,
  copyLocalIncompleteTodos,
  deleteLocalJournalEntry,
  getLocalJournalEntries,
  getLocalJournalSingleton,
  getLocalTodosForDate,
  saveLocalJournalSingleton,
  updateLocalJournalEntry,
} from '../journalStorage';
import { getRoutineState } from '../routineStateStorage';

const storage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

describe('future planning canonical persistence', () => {
  const values = new Map<string, string>();

  beforeEach(() => {
    values.clear();
    jest.clearAllMocks();
    storage.getItem.mockImplementation(async key => values.get(key) ?? null);
    storage.setItem.mockImplementation(async (key, value) => { values.set(key, value); });
  });

  it('reuses the dated focus singleton ID without creating routine state', async () => {
    const first = await saveLocalJournalSingleton(
      'todays_focus',
      '2026-09-18',
      JSON.stringify({ focus: 'Finish proposal', focusCategory: 'work' }),
    );
    const edited = await saveLocalJournalSingleton(
      'todays_focus',
      '2026-09-18',
      JSON.stringify({ focus: 'Finish final proposal', focusCategory: 'work' }),
    );

    expect(edited.id).toBe(first.id);
    expect((await getLocalJournalSingleton('todays_focus', '2026-09-18'))?.id).toBe(first.id);
    expect(await getRoutineState('morning', '2026-09-18')).toBeNull();
    expect(await getRoutineState('evening', '2026-09-18')).toBeNull();
  });

  it('preserves retained todo IDs and isolates plans by selected date', async () => {
    const first = await createLocalJournalEntry({
      server_id: null,
      content_type: 'todo',
      selected_date: '2026-09-20',
      content: JSON.stringify({ text: 'Send deck', completed: false, priority: false }),
      completed: false,
    });
    const retained = await updateLocalJournalEntry({
      ...first,
      content: JSON.stringify({ text: 'Send final deck', completed: false, priority: false }),
    });
    const removed = await createLocalJournalEntry({
      server_id: null,
      content_type: 'todo',
      selected_date: '2026-09-20',
      content: JSON.stringify({ text: 'Remove me', completed: false, priority: false }),
      completed: false,
    });
    await deleteLocalJournalEntry(removed.id, 'todo', '2026-09-20');
    await createLocalJournalEntry({
      server_id: null,
      content_type: 'todo',
      selected_date: '2026-09-21',
      content: JSON.stringify({ text: 'Different day', completed: false, priority: false }),
      completed: false,
    });

    expect(retained.id).toBe(first.id);
    expect((await getLocalJournalEntries('todo', '2026-09-20')).map(entry => entry.id)).toEqual([first.id]);
    expect(await getLocalJournalEntries('todo', '2026-09-21')).toHaveLength(1);
    expect(await getRoutineState('morning', '2026-09-20')).toBeNull();
  });

  it('does not create canonical records when an empty plan is exited', async () => {
    expect(await getLocalJournalSingleton('todays_focus', '2026-09-22')).toBeNull();
    expect(await getLocalJournalEntries('todo', '2026-09-22')).toEqual([]);
    expect(await getRoutineState('morning', '2026-09-22')).toBeNull();
  });

  it('makes copied Todos available to the shared Future Planning and Morning loader after relaunch', async () => {
    const sourceDate = '2026-09-17';
    const destinationDate = '2026-09-18';
    const sourceOpen = await createLocalJournalEntry({
      server_id: null,
      content_type: 'todo',
      selected_date: sourceDate,
      content: JSON.stringify({ text: 'Todo A', completed: false, priority: true }),
      completed: false,
    });
    await createLocalJournalEntry({
      server_id: null,
      content_type: 'todo',
      selected_date: sourceDate,
      content: JSON.stringify({ text: 'Already done', completed: true, priority: false }),
      completed: true,
    });
    const destinationExisting = await createLocalJournalEntry({
      server_id: null,
      content_type: 'todo',
      selected_date: destinationDate,
      content: JSON.stringify({ text: 'Existing destination task', completed: false, priority: false }),
      completed: false,
    });
    const focus = await saveLocalJournalSingleton(
      'todays_focus',
      destinationDate,
      JSON.stringify({ focus: 'Prepare', priorities: [{ id: 'priority-existing', text: 'Focus priority', completed: false }] }),
    );

    const copied = await copyLocalIncompleteTodos(sourceDate, destinationDate);
    const futurePlanningTodos = await getLocalTodosForDate(destinationDate);
    // Simulate a relaunch: the Morning screen invokes the same canonical loader.
    const morningTodos = await getLocalTodosForDate(destinationDate);

    expect(copied).toHaveLength(1);
    expect(copied[0].selected_date).toBe(destinationDate);
    expect(copied[0].id).not.toBe(sourceOpen.id);
    expect(JSON.parse(copied[0].content)).toEqual({ text: 'Todo A', completed: false, priority: true });
    expect(futurePlanningTodos.map(item => item.id)).toEqual(morningTodos.map(item => item.id));
    expect(futurePlanningTodos.map(item => item.id)).toEqual(expect.arrayContaining([destinationExisting.id, copied[0].id]));
    expect(futurePlanningTodos).toHaveLength(2);
    expect(await getLocalJournalSingleton('todays_focus', destinationDate)).toMatchObject({ id: focus.id });
    expect(await getLocalTodosForDate(sourceDate)).toHaveLength(2);
    expect((await getLocalTodosForDate(sourceDate)).map(item => item.id)).toContain(sourceOpen.id);
  });

  it('copies to an empty future date without creating an unrelated focus record', async () => {
    await createLocalJournalEntry({
      server_id: null,
      content_type: 'todo',
      selected_date: '2026-09-17',
      content: JSON.stringify({ text: 'Prepare notes', completed: false, priority: false }),
      completed: false,
    });

    await copyLocalIncompleteTodos('2026-09-17', '2026-09-19');

    expect(await getLocalJournalSingleton('todays_focus', '2026-09-19')).toBeNull();
    expect((await getLocalTodosForDate('2026-09-19')).map(entry => JSON.parse(entry.content).text)).toEqual(['Prepare notes']);
  });
});
