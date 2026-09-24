import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  createLocalJournalEntry,
  saveLocalJournalSingleton,
} from '../journalStorage';
import {
  queueGratitudeSavedImpact,
  queueWinSavedImpact,
} from '../../services/journalImpactQueue';

jest.mock('../../services/journalImpactQueue', () => ({
  queueGratitudeSavedImpact: jest.fn().mockResolvedValue(undefined),
  queueWinSavedImpact: jest.fn().mockResolvedValue(undefined),
}));

const values = new Map<string, string>();

beforeEach(() => {
  jest.clearAllMocks();
  values.clear();
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key => values.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    values.set(key, value);
  });
});

it('queues gratitude analytics only when a canonical gratitude entry is created', async () => {
  const gratitude = await createLocalJournalEntry({
    content_type: 'gratitude',
    selected_date: '2026-09-24',
    content: JSON.stringify({items: ['Grace', 'Family']}),
  });
  await createLocalJournalEntry({
    content_type: 'todo',
    selected_date: '2026-09-24',
    content: JSON.stringify({text: 'Call Mom'}),
  });

  expect(queueGratitudeSavedImpact).toHaveBeenCalledTimes(1);
  expect(queueGratitudeSavedImpact).toHaveBeenCalledWith(gratitude);
});

it('does not count edits to the same gratitude singleton again', async () => {
  const first = await saveLocalJournalSingleton(
    'gratitude',
    '2026-09-24',
    JSON.stringify({items: ['Grace']}),
  );
  const edited = await saveLocalJournalSingleton(
    'gratitude',
    '2026-09-24',
    JSON.stringify({items: ['Grace', 'Rest']}),
  );

  expect(edited.id).toBe(first.id);
  expect(queueGratitudeSavedImpact).toHaveBeenCalledTimes(1);
});

it('counts Today’s Win once and does not count later edits again', async () => {
  const first = await saveLocalJournalSingleton(
    'today_win',
    '2026-09-24',
    JSON.stringify({winTypeName: 'Courage', quietWin: 'I spoke honestly.'}),
  );
  const edited = await saveLocalJournalSingleton(
    'today_win',
    '2026-09-24',
    JSON.stringify({winTypeName: 'Courage', quietWin: 'I spoke honestly and kindly.'}),
  );

  expect(edited.id).toBe(first.id);
  expect(queueWinSavedImpact).toHaveBeenCalledTimes(1);
  expect(queueWinSavedImpact).toHaveBeenCalledWith(first);
});
