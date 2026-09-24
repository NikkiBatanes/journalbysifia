import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import {Platform} from 'react-native';
import {v4 as uuidv4} from 'uuid';

import {supabase} from './supabaseClient';

const OUTBOX_KEY = 'journal:impact-outbox:v1';
const INSTALL_ID_KEY = 'journal:impact-install-id:v1';
const GOSPEL_BACKFILL_KEY = 'journal:impact-backfill:gospel:v1';
const SELF_GOSPEL_ACCEPTANCE_BACKFILL_KEY = 'journal:impact-backfill:gospel-self:v1';
const JOURNAL_BACKFILL_KEY = 'journal:activity-impact-backfill:v1';
const CONTENT_BACKFILL_KEY = 'journal:content-impact-backfill:v2';
const MAX_BATCH_SIZE = 100;

export type JournalImpactEventType =
  | 'gospel_shared'
  | 'accepted_jesus'
  | 'morning_completed'
  | 'evening_completed'
  | 'prayer_created'
  | 'prayer_answered'
  | 'bible_study_created'
  | 'bible_study_completed'
  | 'gratitude_saved'
  | 'win_saved';

type GospelImpactSourceEvent = {
  id: string;
  sharedAt: string;
  method: string;
  response?: string;
};

type SelfGospelResponse = {
  response: string;
  respondedAt: string;
};

type JournalImpactEvent = {
  clientEventId: string;
  eventType: JournalImpactEventType;
  occurredAt: string;
  method: string;
  platform: string;
};

type RoutineImpactSource = {
  id: string;
  routine: 'morning' | 'evening';
  completed: boolean;
  completed_at?: string;
};

type PrayerImpactSource = {
  id: string;
  prayer_type: string;
  created_at: string;
  updated_at: string;
  status?: string;
  answered_date?: string | null;
};

type BibleStudyImpactSource = {
  id: string;
  started_at: string;
  updated_at: string;
  completed: boolean;
  completed_at?: string;
};

type GratitudeImpactSource = {
  selected_date: string;
  created_at: string;
};

type WinImpactSource = {
  selected_date: string;
  created_at: string;
};

type JournalImpactCommand =
  | {id: string; action: 'upsert'; event: JournalImpactEvent}
  | {id: string; action: 'delete'; clientEventIds: string[]};

let outboxChain: Promise<unknown> = Promise.resolve();
let flushInFlight: Promise<void> | null = null;

const impactEventIds = (event: GospelImpactSourceEvent): string[] => [
  `${event.id}:shared`,
  ...(event.response === 'trusted_jesus_today' ? [`${event.id}:accepted`] : []),
];

const parseOutbox = (raw: string | null): JournalImpactCommand[] => {
  if (!raw) {return [];}
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const updateOutbox = <T>(
  update: (commands: JournalImpactCommand[]) => Promise<{commands: JournalImpactCommand[]; result: T}> | {commands: JournalImpactCommand[]; result: T},
): Promise<T> => {
  const operation = outboxChain.then(async () => {
    const commands = parseOutbox(await AsyncStorage.getItem(OUTBOX_KEY));
    const next = await update(commands);
    await AsyncStorage.setItem(OUTBOX_KEY, JSON.stringify(next.commands));
    return next.result;
  });
  outboxChain = operation.then(() => undefined, () => undefined);
  return operation;
};

const getInstallId = async (): Promise<string> => {
  const saved = await AsyncStorage.getItem(INSTALL_ID_KEY);
  if (saved) {return saved;}
  const installId = uuidv4();
  await AsyncStorage.setItem(INSTALL_ID_KEY, installId);
  return installId;
};

const shareCommands = (event: GospelImpactSourceEvent): JournalImpactCommand[] => {
  const common = {
    occurredAt: event.sharedAt,
    method: event.method,
    platform: Platform.OS,
  };
  return [
    {
      id: uuidv4(),
      action: 'upsert' as const,
      event: {
        ...common,
        clientEventId: `${event.id}:shared`,
        eventType: 'gospel_shared' as const,
      },
    },
    ...(event.response === 'trusted_jesus_today' ? [{
      id: uuidv4(),
      action: 'upsert' as const,
      event: {
        ...common,
        clientEventId: `${event.id}:accepted`,
        eventType: 'accepted_jesus' as const,
      },
    }] : []),
  ];
};

const impactCommand = (
  clientEventId: string,
  eventType: JournalImpactEventType,
  occurredAt: string,
  method: string,
): JournalImpactCommand => ({
  id: uuidv4(),
  action: 'upsert',
  event: {
    clientEventId,
    eventType,
    occurredAt,
    method,
    platform: Platform.OS,
  },
});

const routineCommands = (state: RoutineImpactSource): JournalImpactCommand[] => {
  if (!state.completed || !state.completed_at) {return [];}
  const eventType = state.routine === 'morning' ? 'morning_completed' : 'evening_completed';
  return [impactCommand(`routine:${state.id}:completed`, eventType, state.completed_at, state.routine)];
};

const prayerCommands = (prayer: PrayerImpactSource): JournalImpactCommand[] => [
  impactCommand(`prayer:${prayer.id}:created`, 'prayer_created', prayer.created_at, prayer.prayer_type),
  ...(prayer.status === 'answered' ? [impactCommand(
    `prayer:${prayer.id}:answered`,
    'prayer_answered',
    prayer.answered_date || prayer.updated_at,
    prayer.prayer_type,
  )] : []),
];

const bibleStudyCommands = (session: BibleStudyImpactSource): JournalImpactCommand[] => [
  impactCommand(
    `bible-study:${session.id}:created`,
    'bible_study_created',
    session.started_at,
    'bible_study',
  ),
  ...(session.completed && session.completed_at ? [impactCommand(
    `bible-study:${session.id}:completed`,
    'bible_study_completed',
    session.completed_at,
    'bible_study',
  )] : []),
];

const gratitudeCommands = (entry: GratitudeImpactSource): JournalImpactCommand[] => [
  impactCommand(
    `gratitude:${entry.selected_date}`,
    'gratitude_saved',
    entry.created_at,
    'gratitude',
  ),
];

const winCommands = (entry: WinImpactSource): JournalImpactCommand[] => [
  impactCommand(
    `win:${entry.selected_date}`,
    'win_saved',
    entry.created_at,
    'today_win',
  ),
];

export const flushJournalImpactEvents = (): Promise<void> => {
  if (flushInFlight) {return flushInFlight;}
  flushInFlight = (async () => {
    await outboxChain;
    const network = await NetInfo.fetch();
    if (network.isConnected === false || network.isInternetReachable === false) {return;}

    const installId = await getInstallId();
    while (true) {
      const commands = parseOutbox(await AsyncStorage.getItem(OUTBOX_KEY)).slice(0, MAX_BATCH_SIZE);
      if (!commands.length) {return;}
      const {data, error} = await supabase.functions.invoke('journal-impact', {
        body: {action: 'sync', installId, commands},
      });
      if (error || !Array.isArray(data?.processedCommandIds)) {
        throw error || new Error('Unable to sync Journal impact');
      }
      const processed = new Set<string>(data.processedCommandIds);
      if (!processed.size) {return;}
      await updateOutbox(current => ({
        commands: current.filter(command => !processed.has(command.id)),
        result: undefined,
      }));
    }
  })().finally(() => {
    flushInFlight = null;
  });
  return flushInFlight;
};

export const queueGospelImpactForShare = async (
  event: GospelImpactSourceEvent,
): Promise<void> => {
  await updateOutbox(commands => ({
    commands: [...commands, ...shareCommands(event)],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const queueSelfGospelAcceptanceImpact = async (
  occurredAt: string,
): Promise<void> => {
  await updateOutbox(commands => ({
    commands: [...commands, impactCommand(
      'gospel:self:accepted',
      'accepted_jesus',
      occurredAt,
      'self',
    )],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const queueGospelImpactRetraction = async (
  event: GospelImpactSourceEvent,
): Promise<void> => {
  await updateOutbox(commands => ({
    commands: [...commands, {
      id: uuidv4(),
      action: 'delete',
      clientEventIds: impactEventIds(event),
    }],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const queueRoutineCompletedImpact = async (
  state: RoutineImpactSource,
): Promise<void> => {
  const additions = routineCommands(state);
  if (!additions.length) {return;}
  await updateOutbox(commands => ({commands: [...commands, ...additions], result: undefined}));
  flushJournalImpactEvents().catch(() => {});
};

export const queuePrayerCreatedImpact = async (
  prayer: PrayerImpactSource,
): Promise<void> => {
  await updateOutbox(commands => ({commands: [...commands, ...prayerCommands(prayer)], result: undefined}));
  flushJournalImpactEvents().catch(() => {});
};

export const queuePrayerAnsweredImpact = async (
  prayer: PrayerImpactSource,
): Promise<void> => {
  if (prayer.status !== 'answered') {return;}
  await updateOutbox(commands => ({
    commands: [...commands, impactCommand(
      `prayer:${prayer.id}:answered`,
      'prayer_answered',
      prayer.answered_date || prayer.updated_at,
      prayer.prayer_type,
    )],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const queuePrayerImpactRetraction = async (prayerId: string): Promise<void> => {
  await updateOutbox(commands => ({
    commands: [...commands, {
      id: uuidv4(),
      action: 'delete',
      clientEventIds: [`prayer:${prayerId}:created`, `prayer:${prayerId}:answered`],
    }],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const queueBibleStudyCreatedImpact = async (
  session: BibleStudyImpactSource,
): Promise<void> => {
  await updateOutbox(commands => ({
    commands: [...commands, bibleStudyCommands(session)[0]],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const queueBibleStudyCompletedImpact = async (
  session: BibleStudyImpactSource,
): Promise<void> => {
  if (!session.completed || !session.completed_at) {return;}
  const completed = bibleStudyCommands(session).find(
    command => command.action === 'upsert' && command.event.eventType === 'bible_study_completed',
  );
  if (!completed) {return;}
  await updateOutbox(commands => ({commands: [...commands, completed], result: undefined}));
  flushJournalImpactEvents().catch(() => {});
};

export const queueBibleStudyImpactRetraction = async (sessionId: string): Promise<void> => {
  await updateOutbox(commands => ({
    commands: [...commands, {
      id: uuidv4(),
      action: 'delete',
      clientEventIds: [
        `bible-study:${sessionId}:created`,
        `bible-study:${sessionId}:completed`,
      ],
    }],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const queueGratitudeSavedImpact = async (
  entry: GratitudeImpactSource,
): Promise<void> => {
  await updateOutbox(commands => ({
    commands: [...commands, ...gratitudeCommands(entry)],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const queueWinSavedImpact = async (
  entry: WinImpactSource,
): Promise<void> => {
  await updateOutbox(commands => ({
    commands: [...commands, ...winCommands(entry)],
    result: undefined,
  }));
  flushJournalImpactEvents().catch(() => {});
};

export const backfillGospelImpactHistory = async (
  events: GospelImpactSourceEvent[],
): Promise<void> => {
  if (await AsyncStorage.getItem(GOSPEL_BACKFILL_KEY)) {return;}
  await updateOutbox(commands => ({
    commands: [...commands, ...events.flatMap(shareCommands)],
    result: undefined,
  }));
  await AsyncStorage.setItem(GOSPEL_BACKFILL_KEY, new Date().toISOString());
  flushJournalImpactEvents().catch(() => {});
};

export const backfillSelfGospelAcceptance = async (
  response: SelfGospelResponse | null,
): Promise<void> => {
  if (await AsyncStorage.getItem(SELF_GOSPEL_ACCEPTANCE_BACKFILL_KEY)) {return;}
  if (response?.response === 'trusted_jesus_today') {
    await updateOutbox(commands => ({
      commands: [...commands, impactCommand(
        'gospel:self:accepted',
        'accepted_jesus',
        response.respondedAt,
        'self',
      )],
      result: undefined,
    }));
  }
  await AsyncStorage.setItem(SELF_GOSPEL_ACCEPTANCE_BACKFILL_KEY, new Date().toISOString());
  flushJournalImpactEvents().catch(() => {});
};

export const backfillJournalImpactHistory = async (
  routines: RoutineImpactSource[],
  prayers: PrayerImpactSource[],
): Promise<void> => {
  if (await AsyncStorage.getItem(JOURNAL_BACKFILL_KEY)) {return;}
  await updateOutbox(commands => ({
    commands: [
      ...commands,
      ...routines.flatMap(routineCommands),
      ...prayers.flatMap(prayerCommands),
    ],
    result: undefined,
  }));
  await AsyncStorage.setItem(JOURNAL_BACKFILL_KEY, new Date().toISOString());
  flushJournalImpactEvents().catch(() => {});
};

export const backfillContentImpactHistory = async (
  bibleStudies: BibleStudyImpactSource[],
  gratitudeEntries: GratitudeImpactSource[],
  winEntries: WinImpactSource[],
): Promise<void> => {
  if (await AsyncStorage.getItem(CONTENT_BACKFILL_KEY)) {return;}
  await updateOutbox(commands => ({
    commands: [
      ...commands,
      ...bibleStudies.flatMap(bibleStudyCommands),
      ...gratitudeEntries.flatMap(gratitudeCommands),
      ...winEntries.flatMap(winCommands),
    ],
    result: undefined,
  }));
  await AsyncStorage.setItem(CONTENT_BACKFILL_KEY, new Date().toISOString());
  flushJournalImpactEvents().catch(() => {});
};

export const startJournalImpactSync = (): (() => void) => {
  flushJournalImpactEvents().catch(() => {});
  return NetInfo.addEventListener(state => {
    if (state.isConnected && state.isInternetReachable !== false) {
      flushJournalImpactEvents().catch(() => {});
    }
  });
};
