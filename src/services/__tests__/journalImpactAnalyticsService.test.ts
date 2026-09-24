import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

import {supabase} from '../supabaseClient';
import {
  backfillContentImpactHistory,
  backfillGospelImpactHistory,
  backfillSelfGospelAcceptance,
  backfillJournalImpactHistory,
  flushJournalImpactEvents,
  queueGospelImpactForShare,
  queueGospelImpactRetraction,
  queueSelfGospelAcceptanceImpact,
  queueBibleStudyCompletedImpact,
  queueBibleStudyCreatedImpact,
  queueGratitudeSavedImpact,
  queueWinSavedImpact,
  queuePrayerAnsweredImpact,
  queuePrayerCreatedImpact,
  queueRoutineCompletedImpact,
} from '../journalImpactAnalyticsService';

jest.mock('@react-native-community/netinfo', () => ({
  fetch: jest.fn(),
  addEventListener: jest.fn(() => jest.fn()),
}));
jest.mock('../supabaseClient', () => ({
  supabase: {functions: {invoke: jest.fn()}},
}));

let mockUuidCounter = 0;
jest.mock('uuid', () => ({
  v4: jest.fn(() => `uuid-${++mockUuidCounter}`),
}));

const OUTBOX_KEY = 'journal:impact-outbox:v1';
const BACKFILL_KEY = 'journal:impact-backfill:gospel:v1';
const SELF_BACKFILL_KEY = 'journal:impact-backfill:gospel-self:v1';
const store = new Map<string, string>();

const setNetwork = (connected: boolean) => {
  jest.mocked(NetInfo.fetch).mockResolvedValue({
    isConnected: connected,
    isInternetReachable: connected,
  } as any);
};

beforeEach(() => {
  jest.clearAllMocks();
  store.clear();
  mockUuidCounter = 0;
  jest.mocked(AsyncStorage.getItem).mockImplementation(async key => store.get(key) ?? null);
  jest.mocked(AsyncStorage.setItem).mockImplementation(async (key, value) => {
    store.set(key, value);
  });
  setNetwork(false);
});

it('keeps an offline Gospel share and acceptance queued with the original time', async () => {
  await queueGospelImpactForShare({
    id: 'share-1',
    sharedAt: '2026-09-03T08:15:00.000Z',
    method: 'together',
    response: 'trusted_jesus_today',
  });
  await flushJournalImpactEvents();

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands).toHaveLength(2);
  expect(commands.map((command: any) => command.event)).toEqual([
    expect.objectContaining({
      clientEventId: 'share-1:shared',
      eventType: 'gospel_shared',
      occurredAt: '2026-09-03T08:15:00.000Z',
      method: 'together',
    }),
    expect.objectContaining({
      clientEventId: 'share-1:accepted',
      eventType: 'accepted_jesus',
      occurredAt: '2026-09-03T08:15:00.000Z',
      method: 'together',
    }),
  ]);
  expect(supabase.functions.invoke).not.toHaveBeenCalled();
});

it('queues one stable accepted-Jesus event for the self Gospel flow', async () => {
  await queueSelfGospelAcceptanceImpact('2026-09-24T08:15:00.000Z');

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands).toHaveLength(1);
  expect(commands[0].event).toEqual(expect.objectContaining({
    clientEventId: 'gospel:self:accepted',
    eventType: 'accepted_jesus',
    occurredAt: '2026-09-24T08:15:00.000Z',
    method: 'self',
  }));
});

it('drains every batch when an offline device reconnects', async () => {
  const commands = Array.from({length: 101}, (_, index) => ({
    id: `command-${index}`,
    action: 'upsert',
    event: {
      clientEventId: `share-${index}:shared`,
      eventType: 'gospel_shared',
      occurredAt: '2026-09-03T08:15:00.000Z',
      method: 'link',
      platform: 'ios',
    },
  }));
  store.set(OUTBOX_KEY, JSON.stringify(commands));
  setNetwork(true);
  jest.mocked(supabase.functions.invoke).mockImplementation(async (_name, options: any) => ({
    data: {processedCommandIds: options.body.commands.map((command: any) => command.id)},
    error: null,
  }) as any);

  await flushJournalImpactEvents();

  expect(supabase.functions.invoke).toHaveBeenCalledTimes(2);
  expect((jest.mocked(supabase.functions.invoke).mock.calls[0][1] as any).body.commands).toHaveLength(100);
  expect((jest.mocked(supabase.functions.invoke).mock.calls[1][1] as any).body.commands).toHaveLength(1);
  expect(JSON.parse(store.get(OUTBOX_KEY) || '[]')).toEqual([]);
});

it('queues a matching deletion when a saved share is undone', async () => {
  const event = {
    id: 'share-2',
    sharedAt: '2026-09-04T09:30:00.000Z',
    method: 'together',
    response: 'trusted_jesus_today',
  };
  await queueGospelImpactForShare(event);
  await flushJournalImpactEvents();
  await queueGospelImpactRetraction(event);
  await flushJournalImpactEvents();

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands.at(-1)).toEqual(expect.objectContaining({
    action: 'delete',
    clientEventIds: ['share-2:shared', 'share-2:accepted'],
  }));
});

it('backfills existing local history only once', async () => {
  const history = [{
    id: 'legacy-share',
    sharedAt: '2025-12-10T04:00:00.000Z',
    method: 'link',
  }];

  await backfillGospelImpactHistory(history);
  await flushJournalImpactEvents();
  await backfillGospelImpactHistory(history);

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands).toHaveLength(1);
  expect(commands[0].event).toEqual(expect.objectContaining({
    clientEventId: 'legacy-share:shared',
    occurredAt: '2025-12-10T04:00:00.000Z',
  }));
  expect(store.get(BACKFILL_KEY)).toBeTruthy();
});

it('backfills an existing self acceptance only once', async () => {
  const response = {
    response: 'trusted_jesus_today',
    respondedAt: '2026-09-10T04:00:00.000Z',
  };

  await backfillSelfGospelAcceptance(response);
  await backfillSelfGospelAcceptance(response);

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands).toHaveLength(1);
  expect(commands[0].event).toEqual(expect.objectContaining({
    clientEventId: 'gospel:self:accepted',
    eventType: 'accepted_jesus',
    occurredAt: '2026-09-10T04:00:00.000Z',
    method: 'self',
  }));
  expect(store.get(SELF_BACKFILL_KEY)).toBeTruthy();
});

it('queues account-free morning, evening, prayer, and answer activity', async () => {
  await queueRoutineCompletedImpact({
    id: 'morning-state',
    routine: 'morning',
    completed: true,
    completed_at: '2026-09-24T00:30:00.000Z',
  });
  await queueRoutineCompletedImpact({
    id: 'evening-state',
    routine: 'evening',
    completed: true,
    completed_at: '2026-09-24T12:30:00.000Z',
  });
  const prayer = {
    id: 'prayer-1',
    prayer_type: 'journal',
    created_at: '2026-09-24T01:00:00.000Z',
    updated_at: '2026-09-24T02:00:00.000Z',
    status: 'pending',
  };
  await queuePrayerCreatedImpact(prayer);
  await queuePrayerAnsweredImpact({
    ...prayer,
    status: 'answered',
    answered_date: '2026-09-24T02:00:00.000Z',
  });
  await flushJournalImpactEvents();

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands.map((command: any) => [command.event.clientEventId, command.event.eventType]))
    .toEqual([
      ['routine:morning-state:completed', 'morning_completed'],
      ['routine:evening-state:completed', 'evening_completed'],
      ['prayer:prayer-1:created', 'prayer_created'],
      ['prayer:prayer-1:answered', 'prayer_answered'],
    ]);
});

it('backfills completed routines and prayers only once', async () => {
  const routines = [{
    id: 'routine-old',
    routine: 'morning' as const,
    completed: true,
    completed_at: '2026-08-03T01:00:00.000Z',
  }];
  const prayers = [{
    id: 'prayer-old',
    prayer_type: 'people',
    created_at: '2026-08-03T02:00:00.000Z',
    updated_at: '2026-08-05T03:00:00.000Z',
    status: 'answered',
    answered_date: '2026-08-05T03:00:00.000Z',
  }];

  await backfillJournalImpactHistory(routines, prayers);
  await flushJournalImpactEvents();
  await backfillJournalImpactHistory(routines, prayers);

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands.map((command: any) => command.event.eventType)).toEqual([
    'morning_completed',
    'prayer_created',
    'prayer_answered',
  ]);
});

it('queues Bible Study creation, completion, and one gratitude event per local day', async () => {
  const study = {
    id: 'study-1',
    started_at: '2026-09-24T03:00:00.000Z',
    updated_at: '2026-09-24T04:00:00.000Z',
    completed: false,
  };
  await queueBibleStudyCreatedImpact(study);
  await queueBibleStudyCompletedImpact({
    ...study,
    completed: true,
    completed_at: '2026-09-24T04:00:00.000Z',
  });
  await queueGratitudeSavedImpact({
    selected_date: '2026-09-24',
    created_at: '2026-09-24T12:00:00.000Z',
  });
  await queueGratitudeSavedImpact({
    selected_date: '2026-09-24',
    created_at: '2026-09-24T13:00:00.000Z',
  });
  await queueWinSavedImpact({
    selected_date: '2026-09-24',
    created_at: '2026-09-24T14:00:00.000Z',
  });
  await flushJournalImpactEvents();

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands.map((command: any) => [command.event.clientEventId, command.event.eventType]))
    .toEqual([
      ['bible-study:study-1:created', 'bible_study_created'],
      ['bible-study:study-1:completed', 'bible_study_completed'],
      ['gratitude:2026-09-24', 'gratitude_saved'],
      ['gratitude:2026-09-24', 'gratitude_saved'],
      ['win:2026-09-24', 'win_saved'],
    ]);
});

it('backfills Bible Study and gratitude history only once', async () => {
  const studies = [{
    id: 'study-old',
    started_at: '2026-07-02T01:00:00.000Z',
    updated_at: '2026-07-02T02:00:00.000Z',
    completed: true,
    completed_at: '2026-07-02T02:00:00.000Z',
  }];
  const gratitude = [{
    selected_date: '2026-07-02',
    created_at: '2026-07-02T12:00:00.000Z',
  }];
  const wins = [{
    selected_date: '2026-07-02',
    created_at: '2026-07-02T13:00:00.000Z',
  }];

  await backfillContentImpactHistory(studies, gratitude, wins);
  await flushJournalImpactEvents();
  await backfillContentImpactHistory(studies, gratitude, wins);

  const commands = JSON.parse(store.get(OUTBOX_KEY) || '[]');
  expect(commands.map((command: any) => command.event.eventType)).toEqual([
    'bible_study_created',
    'bible_study_completed',
    'gratitude_saved',
    'win_saved',
  ]);
});
