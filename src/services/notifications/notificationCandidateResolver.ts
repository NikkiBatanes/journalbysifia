import { supabase } from '../supabaseClient';
import { Logger } from '../../utils/ProductionLogger';
import { toLocalDateString } from '../../utils/date';
import { DevotionalApi } from '../api/devotionalApi';
import { ReflectionApi } from '../api/reflectionApi';
import { NewSubscriptionService } from '../NewSubscriptionService';
import { guidedPromptGatingService } from '../guidedPromptGatingService';
import { Subscription } from '../../types/subscription';
import { buildSmartNotificationCopy } from './notificationCopyBank';
import {
  SmartNotificationCandidate,
  SmartNotificationTimeWindow,
  SmartNotificationType,
} from './notificationTypes';

type JournalEntryLike = {
  id: string;
  content_type: string;
  content?: string | Record<string, unknown> | null;
  completed?: boolean | null;
  metadata?: Record<string, unknown> | null;
};

type DevotionalDayLike = {
  id?: string;
  dayNumber?: number;
  title?: string;
  prayer?: string;
  completed?: boolean;
  scripture?: {
    reference?: string;
    text?: string;
  };
  reflectionQuestions?: Array<{ id?: string; text?: string }>;
};

type PlaybookRowLike = {
  id: string;
  title?: string | null;
  status?: string | null;
  completed_at?: string | null;
  bible_verse?: {
    reference?: string;
    text?: string;
  } | null;
  word_to_speak?: string | null;
  prayer?: string | null;
  playbook_action_steps?: Array<{
    id: string;
    text?: string | null;
    completed?: boolean | null;
    order_index?: number | null;
    playbook_sub_tasks?: Array<{
      id: string;
      text?: string | null;
      completed?: boolean | null;
      order_index?: number | null;
    }>;
  }>;
  playbook_affirmations?: Array<{
    id: string;
    text?: string | null;
    completed?: boolean | null;
    order_index?: number | null;
  }>;
};

type SubscriptionWithReset = Subscription & {
  billing_cycle?: 'monthly' | 'annual';
  last_usage_reset?: string;
};

type PendingPrayerRequest = {
  id: string;
  person_name?: string | null;
};

const today = (): string => toLocalDateString(new Date());

const safeText = (value: unknown): string => {
  if (typeof value !== 'string') {
    return '';
  }

  return value.replace(/\s+/g, ' ').trim();
};

const notificationText = (value: unknown): string => {
  return safeText(value)
    .replace(/\*\*|__|\*/g, '')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]*>/g, '')
    .trim();
};

const buildDedupeKey = (...parts: Array<string | number | undefined | null>): string => {
  return parts.filter(part => part !== undefined && part !== null && `${part}`.length > 0).join(':');
};

const createCandidate = ({
  type,
  timeWindow,
  score,
  dedupeKey,
  deepLink,
  sourceType,
  sourceId,
  sourceSubId,
  copyContext,
  metadata,
}: {
  type: SmartNotificationType;
  timeWindow: SmartNotificationTimeWindow;
  score: number;
  dedupeKey: string;
  deepLink: string;
  sourceType: SmartNotificationCandidate['source']['sourceType'];
  sourceId?: string;
  sourceSubId?: string;
  copyContext?: Parameters<typeof buildSmartNotificationCopy>[1];
  metadata?: Record<string, unknown>;
}): SmartNotificationCandidate => {
  const categoryMap: Record<SmartNotificationType, SmartNotificationCandidate['category']> = {
    devotional_day_ready: 'devotional',
    devotional_prayer_prompt: 'devotional',
    devotional_reflection_prompt: 'devotional',
    devotional_verse_revisit: 'devotional',
    devotional_completed_reflection: 'devotional',
    playbook_word_to_speak: 'playbook',
    playbook_faithful_action: 'playbook',
    playbook_verse_revisit: 'playbook',
    playbook_prayer_revisit: 'playbook',
    playbook_to_devotional: 'playbook',
    journal_todays_focus: 'journal',
    journal_todo: 'journal',
    journal_gratitude: 'journal',
    journal_todays_win: 'journal',
    journal_looking_forward: 'journal',
    heart_journal_prompt: 'journal',
    prayer_request_care: 'prayer',
    prayer_today: 'prayer',
    create_devotional: 'creation',
    create_playbook: 'creation',
    create_first_devotional: 'creation',
    usage_room_devotional: 'subscription',
    usage_room_playbook: 'subscription',
    content_refresh_wait: 'subscription',
    upgrade_room: 'subscription',
    recovery_prayer: 'recovery',
  };

  const sensitiveTypes: SmartNotificationType[] = [
    'prayer_request_care',
    'heart_journal_prompt',
  ];

  return {
    type,
    category: categoryMap[type],
    timeWindow,
    priority: score >= 90 ? 'high' : score <= 45 ? 'low' : 'normal',
    score,
    dedupeKey,
    copy: buildSmartNotificationCopy(type, copyContext),
    deepLink,
    privacyLevel: sensitiveTypes.includes(type) ? 'sensitive' : 'public',
    source: {
      sourceType,
      sourceId,
      sourceSubId,
    },
    metadata,
  };
};

const parseMaybeJson = (value: unknown): unknown => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
};

const hasMeaningfulJournalContent = (entry: JournalEntryLike): boolean => {
  const parsed = parseMaybeJson(entry.content);

  if (typeof parsed === 'string') {
    return parsed.trim().length > 0;
  }

  if (!parsed || typeof parsed !== 'object') {
    return false;
  }

  if (Array.isArray(parsed)) {
    return parsed.some(item => safeText((item as Record<string, unknown>)?.text).length > 0);
  }

  const objectValue = parsed as Record<string, unknown>;
  if (safeText(objectValue.text).length > 0 || safeText(objectValue.focus).length > 0) {
    return true;
  }

  return Object.values(objectValue).some(value => {
    if (typeof value === 'string') {
      return value.trim().length > 0;
    }
    if (Array.isArray(value)) {
      return value.length > 0;
    }
    return false;
  });
};

const isTodoComplete = (entry: JournalEntryLike): boolean => {
  if (entry.completed === true) {
    return true;
  }

  const parsed = parseMaybeJson(entry.content);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    const parsedCompleted = (parsed as Record<string, unknown>).completed;
    return parsedCompleted === true;
  }

  return false;
};

const hasEntryForType = (entries: JournalEntryLike[], type: string): boolean => {
  return entries.some(entry => entry.content_type === type && hasMeaningfulJournalContent(entry));
};

const getFirstIncompleteDevotionalDay = (days: DevotionalDayLike[]): DevotionalDayLike | null => {
  return days.find(day => day && day.completed !== true) || null;
};

const getDayNumber = (day: DevotionalDayLike, index: number): number => {
  return typeof day.dayNumber === 'number' ? day.dayNumber : index + 1;
};

const findDevotionalPrayer = async (
  userId: string,
  devotionalTitle: string,
  dayNumber: number
): Promise<boolean> => {
  const { data, error } = await supabase
    .from('prayers')
    .select('id')
    .eq('user_id', userId)
    .eq('prayer_type', 'devotional')
    .eq('day_number', dayNumber)
    .eq('devotional_title', devotionalTitle)
    .limit(1);

  if (error) {
    Logger.warn('[SmartNotifications] Unable to check devotional prayer state', {
      component: 'notificationCandidateResolver',
      userId,
      error: error as Error,
    });
    return false;
  }

  return (data || []).length > 0;
};

const findDevotionalReflection = async (
  userId: string,
  devotionalId: string,
  dayNumber: number
): Promise<boolean> => {
  try {
    const reflections = await ReflectionApi.searchReflections({
      userId,
      devotionalId,
      dayNumber,
      limit: 1,
    });
    return reflections.length > 0;
  } catch (error) {
    Logger.warn('[SmartNotifications] Unable to check devotional reflection state', {
      component: 'notificationCandidateResolver',
      userId,
      error: error as Error,
    });
    return false;
  }
};

const getJournalEntriesForToday = async (userId: string): Promise<JournalEntryLike[]> => {
  const { data, error } = await supabase
    .from('journal_entries')
    .select('id, content_type, content, completed, metadata')
    .eq('user_id', userId)
    .eq('selected_date', today());

  if (error) {
    Logger.warn('[SmartNotifications] Unable to read journal state', {
      component: 'notificationCandidateResolver',
      userId,
      error,
    });
    return [];
  }

  return (data || []) as JournalEntryLike[];
};

const getPendingPrayerRequestState = async (userId: string): Promise<{ count: number; first?: PendingPrayerRequest }> => {
  const { data, error } = await supabase
    .from('prayers')
    .select('id, person_name')
    .eq('user_id', userId)
    .eq('is_prayer_request', true)
    .or('prayed.is.null,prayed.eq.false')
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    Logger.warn('[SmartNotifications] Unable to read prayer request state', {
      component: 'notificationCandidateResolver',
      userId,
      error,
    });
    return { count: 0 };
  }

  const requests = (data || []) as PendingPrayerRequest[];
  return {
    count: requests.length,
    first: requests[0],
  };
};

const getPlaybooks = async (userId: string): Promise<PlaybookRowLike[]> => {
  const { data, error } = await supabase
    .from('playbooks')
    .select(`
      id,
      title,
      status,
      completed_at,
      bible_verse,
      word_to_speak,
      prayer,
      playbook_action_steps (
        id,
        text,
        completed,
        order_index,
        playbook_sub_tasks (
          id,
          text,
          completed,
          order_index
        )
      ),
      playbook_affirmations (
        id,
        text,
        completed,
        order_index
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    Logger.warn('[SmartNotifications] Unable to read playbook state', {
      component: 'notificationCandidateResolver',
      userId,
      error,
    });
    return [];
  }

  return (data || []) as PlaybookRowLike[];
};

const sortByOrder = <T extends { order_index?: number | null }>(items: T[] = []): T[] => {
  return [...items].sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
};

const getFirstIncompleteAction = (playbook: PlaybookRowLike) => {
  const steps = sortByOrder(playbook.playbook_action_steps || []);

  const stepIndex = steps.findIndex(step => {
    if (step.completed === true) {
      return false;
    }

    const subTasks = step.playbook_sub_tasks || [];
    if (subTasks.length === 0) {
      return true;
    }

    return subTasks.some(subTask => subTask.completed !== true);
  });

  if (stepIndex < 0) {
    return null;
  }

  return {
    action: steps[stepIndex],
    actionIndex: stepIndex,
  };
};

const getWordsToSpeak = (playbook: PlaybookRowLike): string[] => {
  const directWords = safeText(playbook.word_to_speak)
    .split(/\n+/)
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  if (directWords.length > 0) {
    return directWords.slice(0, 5);
  }

  return sortByOrder(playbook.playbook_affirmations || [])
    .map(item => safeText(item.text))
    .filter(Boolean)
    .slice(0, 5);
};

const getRemainingUsage = (subscription: Subscription): { playbooks: number; devotionals: number } => {
  const playbookLimit = subscription.playbooks_limit ?? 0;
  const devotionalLimit = subscription.devotionals_limit ?? 0;

  return {
    playbooks: playbookLimit < 0 ? Number.MAX_SAFE_INTEGER : Math.max(0, playbookLimit - (subscription.playbooks_used ?? 0)),
    devotionals: devotionalLimit < 0 ? Number.MAX_SAFE_INTEGER : Math.max(0, devotionalLimit - (subscription.devotionals_used ?? 0)),
  };
};

const addMonthsClamped = (date: Date, months: number): Date => {
  const targetMonth = date.getMonth() + months;
  const targetYear = date.getFullYear() + Math.floor(targetMonth / 12);
  const normalizedMonth = ((targetMonth % 12) + 12) % 12;
  const lastDay = new Date(targetYear, normalizedMonth + 1, 0).getDate();
  return new Date(targetYear, normalizedMonth, Math.min(date.getDate(), lastDay), 9, 0, 0, 0);
};

const getNextUsageResetDate = (subscription: SubscriptionWithReset): Date | null => {
  if (subscription.tier === 'free_trial' && subscription.trial_end_date) {
    return new Date(subscription.trial_end_date);
  }

  const anchor = new Date(subscription.subscription_start_date || subscription.created_at);
  if (Number.isNaN(anchor.getTime())) {
    return null;
  }

  if (subscription.tier === 'seeker') {
    const now = new Date();
    const daysSinceAnchor = (now.getTime() - anchor.getTime()) / (1000 * 60 * 60 * 24);
    const nextPeriod = Math.floor(Math.max(daysSinceAnchor, 0) / 30) + 1;
    return new Date(anchor.getTime() + nextPeriod * 30 * 24 * 60 * 60 * 1000);
  }

  const now = new Date();
  let reset = new Date(anchor);
  reset.setHours(9, 0, 0, 0);

  while (reset <= now) {
    reset = addMonthsClamped(reset, 1);
  }

  return reset;
};

const formatShortDate = (date: Date | null): string | undefined => {
  if (!date || Number.isNaN(date.getTime())) {
    return undefined;
  }

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};

const getFirstReflectionQuestion = (day: DevotionalDayLike): string => {
  return (day.reflectionQuestions || [])
    .map(question => notificationText(question.text))
    .find(Boolean) || '';
};

const getHeartJournalPrompt = async (
  userId: string,
  subscription: SubscriptionWithReset | null
): Promise<string> => {
  try {
    const tier = subscription?.tier || 'seeker';
    const allocation = guidedPromptGatingService.getDailyPrompts(userId, tier);
    const completedPrompts = await guidedPromptGatingService.getCompletedPrompts();
    const availablePrompts = allocation.freePrompts.filter(prompt => !completedPrompts.includes(prompt));

    return availablePrompts[0] || '';
  } catch (error) {
    Logger.warn('[SmartNotifications] Unable to choose heart journal prompt', {
      component: 'notificationCandidateResolver',
      userId,
      error: error as Error,
    });
    return '';
  }
};

export async function buildSmartNotificationCandidates(userId: string): Promise<SmartNotificationCandidate[]> {
  const candidates: SmartNotificationCandidate[] = [];
  const currentDate = today();

  const [devotionals, journalEntries, prayerRequestState, playbooks, subscriptionResult] = await Promise.all([
    DevotionalApi.getDevotionals(userId).catch(error => {
      Logger.warn('[SmartNotifications] Unable to read devotional state', {
        component: 'notificationCandidateResolver',
        userId,
        error,
      });
      return [];
    }),
    getJournalEntriesForToday(userId),
    getPendingPrayerRequestState(userId),
    getPlaybooks(userId),
    NewSubscriptionService.getUserSubscription(userId).catch(error => {
      Logger.warn('[SmartNotifications] Unable to read subscription state', {
        component: 'notificationCandidateResolver',
        userId,
        error,
      });
      return null;
    }),
  ]);

  const subscription = subscriptionResult ? subscriptionResult as SubscriptionWithReset : null;
  const activeDevotional = devotionals.find(devotional => devotional.completed !== true);
  if (activeDevotional) {
    const days = Array.isArray(activeDevotional.days) ? activeDevotional.days as DevotionalDayLike[] : [];
    const incompleteDay = getFirstIncompleteDevotionalDay(days);
    const incompleteIndex = incompleteDay ? days.indexOf(incompleteDay) : -1;

    if (incompleteDay) {
      const dayNumber = getDayNumber(incompleteDay, incompleteIndex);
      const verseReference = notificationText(incompleteDay.scripture?.reference);
      const verseText = notificationText(incompleteDay.scripture?.text);

      candidates.push(createCandidate({
        type: 'devotional_day_ready',
        timeWindow: 'morning',
        score: 100,
        dedupeKey: buildDedupeKey('devotional_day_ready', activeDevotional.id, dayNumber, currentDate),
        deepLink: `sifia://devotionals/${activeDevotional.id}/day/${dayNumber}`,
        sourceType: 'devotional_day',
        sourceId: activeDevotional.id,
        sourceSubId: String(dayNumber),
        copyContext: {
          dayNumber,
          totalDays: activeDevotional.total_days,
        },
        metadata: {
          devotional_title: activeDevotional.title,
          day_title: incompleteDay.title,
          verse_reference: verseReference,
          verse_text: verseText,
        },
      }));

    }

    const completedDayWithIndex = [...days]
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => day.completed === true)
      .reverse()[0];

    if (completedDayWithIndex) {
      const { day, index } = completedDayWithIndex;
      const dayNumber = getDayNumber(day, index);

      if (safeText(day.prayer).length > 0) {
        const hasPrayer = await findDevotionalPrayer(userId, activeDevotional.title, dayNumber);
        if (!hasPrayer) {
          candidates.push(createCandidate({
            type: 'devotional_prayer_prompt',
            timeWindow: 'evening',
            score: 92,
            dedupeKey: buildDedupeKey('devotional_prayer_prompt', activeDevotional.id, dayNumber, currentDate),
            deepLink: `sifia://devotionals/${activeDevotional.id}/day/${dayNumber}`,
            sourceType: 'devotional_day',
            sourceId: activeDevotional.id,
            sourceSubId: String(dayNumber),
            metadata: {
              devotional_title: activeDevotional.title,
              day_title: day.title,
            },
          }));
        }
      }

      const questionText = getFirstReflectionQuestion(day);
      if (questionText) {
        const hasReflection = await findDevotionalReflection(userId, activeDevotional.id, dayNumber);
        if (!hasReflection) {
          candidates.push(createCandidate({
            type: 'devotional_reflection_prompt',
            timeWindow: 'evening',
            score: 88,
            dedupeKey: buildDedupeKey('devotional_reflection_prompt', activeDevotional.id, dayNumber, currentDate),
            deepLink: `sifia://devotionals/${activeDevotional.id}/day/${dayNumber}/reflect`,
            sourceType: 'devotional_day',
            sourceId: activeDevotional.id,
            sourceSubId: String(dayNumber),
            copyContext: {
              questionText,
            },
            metadata: {
              devotional_title: activeDevotional.title,
              day_title: day.title,
              question_text: questionText,
            },
          }));
        }
      }
    }

    const verseDayWithIndex = completedDayWithIndex || (incompleteDay ? { day: incompleteDay, index: incompleteIndex } : null);
    const devotionalVerseReference = notificationText(verseDayWithIndex?.day.scripture?.reference);
    const devotionalVerseText = notificationText(verseDayWithIndex?.day.scripture?.text);
    if (verseDayWithIndex && devotionalVerseText) {
      const verseDayNumber = getDayNumber(verseDayWithIndex.day, verseDayWithIndex.index);
      candidates.push(createCandidate({
        type: 'devotional_verse_revisit',
        timeWindow: 'evening',
        score: 57,
        dedupeKey: buildDedupeKey('devotional_verse_revisit', activeDevotional.id, verseDayNumber, currentDate),
        deepLink: `sifia://devotionals/${activeDevotional.id}/day/${verseDayNumber}`,
        sourceType: 'devotional_day',
        sourceId: activeDevotional.id,
        sourceSubId: String(verseDayNumber),
        copyContext: {
          verseReference: devotionalVerseReference,
          verseText: devotionalVerseText,
        },
        metadata: {
          devotional_title: activeDevotional.title,
          verse_reference: devotionalVerseReference,
          verse_text: devotionalVerseText,
        },
      }));
    }
  } else {
    const completedDevotional = devotionals.find(devotional => devotional.completed === true);
    if (completedDevotional) {
      candidates.push(createCandidate({
        type: 'devotional_completed_reflection',
        timeWindow: 'evening',
        score: 62,
        dedupeKey: buildDedupeKey('devotional_completed_reflection', completedDevotional.id, currentDate),
        deepLink: `sifia://devotionals/${completedDevotional.id}`,
        sourceType: 'devotional',
        sourceId: completedDevotional.id,
        metadata: {
          devotional_title: completedDevotional.title,
        },
      }));
    }
  }

  const ongoingPlaybook = playbooks.find(playbook => playbook.status !== 'completed' && !playbook.completed_at);
  if (ongoingPlaybook) {
    const incompleteAction = getFirstIncompleteAction(ongoingPlaybook);
    if (incompleteAction) {
      const { action, actionIndex } = incompleteAction;
      const actionText = notificationText(action.text);
      candidates.push(createCandidate({
        type: 'playbook_faithful_action',
        timeWindow: 'midday',
        score: 84,
        dedupeKey: buildDedupeKey('playbook_faithful_action', ongoingPlaybook.id, action.id, currentDate),
        deepLink: `sifia://playbooks/${ongoingPlaybook.id}/walkthrough/actions/${actionIndex}`,
        sourceType: 'action_step',
        sourceId: ongoingPlaybook.id,
        sourceSubId: action.id,
        copyContext: {
          actionText,
        },
        metadata: {
          playbook_title: ongoingPlaybook.title,
          action_text: actionText,
          action_index: actionIndex,
        },
      }));
    }

    const wordsToSpeak = getWordsToSpeak(ongoingPlaybook);
    if (wordsToSpeak.length > 0) {
      const wordIndex = new Date().getDate() % wordsToSpeak.length;
      const wordToSpeak = notificationText(wordsToSpeak[wordIndex]);
      candidates.push(createCandidate({
        type: 'playbook_word_to_speak',
        timeWindow: 'afternoon',
        score: 76,
        dedupeKey: buildDedupeKey('playbook_word_to_speak', ongoingPlaybook.id, wordIndex, currentDate),
        deepLink: `sifia://playbooks/${ongoingPlaybook.id}/walkthrough/words`,
        sourceType: 'playbook',
        sourceId: ongoingPlaybook.id,
        sourceSubId: String(wordIndex),
        copyContext: {
          wordToSpeak,
        },
        metadata: {
          playbook_title: ongoingPlaybook.title,
          word_to_speak: wordToSpeak,
        },
      }));
    }

    const playbookVerseReference = notificationText(ongoingPlaybook.bible_verse?.reference);
    const playbookVerseText = notificationText(ongoingPlaybook.bible_verse?.text);
    if (playbookVerseText) {
      candidates.push(createCandidate({
        type: 'playbook_verse_revisit',
        timeWindow: 'evening',
        score: 58,
        dedupeKey: buildDedupeKey('playbook_verse_revisit', ongoingPlaybook.id, currentDate),
        deepLink: `sifia://playbooks/${ongoingPlaybook.id}/walkthrough/verse`,
        sourceType: 'playbook',
        sourceId: ongoingPlaybook.id,
        copyContext: {
          verseReference: playbookVerseReference,
          verseText: playbookVerseText,
        },
        metadata: {
          playbook_title: ongoingPlaybook.title,
          verse_reference: playbookVerseReference,
          verse_text: playbookVerseText,
        },
      }));
    }

    if (notificationText(ongoingPlaybook.prayer).length > 0) {
      candidates.push(createCandidate({
        type: 'playbook_prayer_revisit',
        timeWindow: 'night',
        score: 54,
        dedupeKey: buildDedupeKey('playbook_prayer_revisit', ongoingPlaybook.id, currentDate),
        deepLink: `sifia://playbooks/${ongoingPlaybook.id}/walkthrough/prayer`,
        sourceType: 'playbook',
        sourceId: ongoingPlaybook.id,
        metadata: {
          playbook_title: ongoingPlaybook.title,
        },
      }));
    }
  }

  const completedPlaybookWithoutDevotional = playbooks.find(playbook => (
    playbook.status === 'completed' || !!playbook.completed_at
  ) && !devotionals.some(devotional => devotional.playbook_id === playbook.id));

  if (completedPlaybookWithoutDevotional) {
    candidates.push(createCandidate({
      type: 'playbook_to_devotional',
      timeWindow: 'afternoon',
      score: 64,
      dedupeKey: buildDedupeKey('playbook_to_devotional', completedPlaybookWithoutDevotional.id, currentDate),
      deepLink: `sifia://playbooks/${completedPlaybookWithoutDevotional.id}/devotional`,
      sourceType: 'playbook',
      sourceId: completedPlaybookWithoutDevotional.id,
      metadata: {
        playbook_title: completedPlaybookWithoutDevotional.title,
      },
    }));
  }

  if (prayerRequestState.count > 0) {
    const personName = notificationText(prayerRequestState.first?.person_name);
    candidates.push(createCandidate({
      type: 'prayer_request_care',
      timeWindow: 'midday',
      score: 86,
      dedupeKey: buildDedupeKey('prayer_request_care', prayerRequestState.first?.id || 'pending', currentDate),
      deepLink: 'sifia://journal/prayer?tab=requests',
      sourceType: 'prayer',
      sourceId: prayerRequestState.first?.id,
      copyContext: {
        personName,
      },
      metadata: {
        pending_count: prayerRequestState.count,
        person_name: personName,
      },
    }));
  }

  if (!hasEntryForType(journalEntries, 'todays_focus')) {
    candidates.push(createCandidate({
      type: 'journal_todays_focus',
      timeWindow: 'morning',
      score: 70,
      dedupeKey: buildDedupeKey('journal_todays_focus', currentDate),
      deepLink: 'sifia://journal/focus',
      sourceType: 'journal',
    }));
  }

  const todos = journalEntries.filter(entry => entry.content_type === 'todo');
  if (todos.length === 0 || todos.some(entry => !isTodoComplete(entry))) {
    candidates.push(createCandidate({
      type: 'journal_todo',
      timeWindow: 'midday',
      score: 66,
      dedupeKey: buildDedupeKey('journal_todo', currentDate),
      deepLink: 'sifia://journal/todos',
      sourceType: 'journal',
    }));
  }

  if (!hasEntryForType(journalEntries, 'gratitude')) {
    candidates.push(createCandidate({
      type: 'journal_gratitude',
      timeWindow: 'evening',
      score: 60,
      dedupeKey: buildDedupeKey('journal_gratitude', currentDate),
      deepLink: 'sifia://journal/gratitude',
      sourceType: 'journal',
    }));
  }

  if (!hasEntryForType(journalEntries, 'today_win')) {
    candidates.push(createCandidate({
      type: 'journal_todays_win',
      timeWindow: 'evening',
      score: 59,
      dedupeKey: buildDedupeKey('journal_todays_win', currentDate),
      deepLink: 'sifia://journal/win',
      sourceType: 'journal',
    }));
  }

  if (!hasEntryForType(journalEntries, 'looking_forward')) {
    candidates.push(createCandidate({
      type: 'journal_looking_forward',
      timeWindow: 'night',
      score: 72,
      dedupeKey: buildDedupeKey('journal_looking_forward', currentDate),
      deepLink: 'sifia://journal/looking-forward',
      sourceType: 'journal',
    }));
  }

  const heartJournalTitle = await getHeartJournalPrompt(userId, subscription);
  if (heartJournalTitle) {
    candidates.push(createCandidate({
      type: 'heart_journal_prompt',
      timeWindow: 'night',
      score: 45,
      dedupeKey: buildDedupeKey('heart_journal_prompt', heartJournalTitle, currentDate),
      deepLink: `sifia://journal/heart?title=${encodeURIComponent(heartJournalTitle)}`,
      sourceType: 'journal',
      copyContext: {
        heartJournalTitle,
      },
      metadata: {
        heart_journal_title: heartJournalTitle,
      },
    }));
  }

  if (subscription) {
    const remaining = getRemainingUsage(subscription);
    const resetDate = getNextUsageResetDate(subscription);
    const refreshDate = formatShortDate(resetDate);

    if (devotionals.length === 0 && (subscription.devotionals_used ?? 0) === 0 && remaining.devotionals > 0) {
      candidates.push(createCandidate({
        type: 'create_first_devotional',
        timeWindow: 'afternoon',
        score: 68,
        dedupeKey: buildDedupeKey('create_first_devotional', currentDate),
        deepLink: 'sifia://devotionals/new',
        sourceType: 'subscription',
        metadata: {
          remaining_devotionals: remaining.devotionals,
        },
      }));
    } else if (!activeDevotional && remaining.devotionals > 0) {
      candidates.push(createCandidate({
        type: 'create_devotional',
        timeWindow: 'afternoon',
        score: 52,
        dedupeKey: buildDedupeKey('create_devotional', currentDate),
        deepLink: 'sifia://devotionals/new',
        sourceType: 'subscription',
      }));
    }

    if (!ongoingPlaybook && remaining.playbooks > 0) {
      candidates.push(createCandidate({
        type: 'create_playbook',
        timeWindow: 'afternoon',
        score: 50,
        dedupeKey: buildDedupeKey('create_playbook', currentDate),
        deepLink: 'sifia://playbooks/new',
        sourceType: 'subscription',
      }));
    }

    if (remaining.devotionals > 0 && remaining.devotionals <= 5 && !activeDevotional) {
      candidates.push(createCandidate({
        type: 'usage_room_devotional',
        timeWindow: 'afternoon',
        score: 40,
        dedupeKey: buildDedupeKey('usage_room_devotional', remaining.devotionals, currentDate),
        deepLink: 'sifia://devotionals/new',
        sourceType: 'subscription',
        copyContext: {
          remainingCount: remaining.devotionals,
        },
      }));
    }

    if (remaining.playbooks > 0 && remaining.playbooks <= 5 && !ongoingPlaybook) {
      candidates.push(createCandidate({
        type: 'usage_room_playbook',
        timeWindow: 'afternoon',
        score: 39,
        dedupeKey: buildDedupeKey('usage_room_playbook', remaining.playbooks, currentDate),
        deepLink: 'sifia://playbooks/new',
        sourceType: 'subscription',
        copyContext: {
          remainingCount: remaining.playbooks,
        },
      }));
    }

    if (remaining.devotionals === 0 && remaining.playbooks === 0) {
      candidates.push(createCandidate({
        type: 'content_refresh_wait',
        timeWindow: 'afternoon',
        score: 48,
        dedupeKey: buildDedupeKey('content_refresh_wait', refreshDate || 'unknown', currentDate),
        deepLink: 'sifia://journal',
        sourceType: 'subscription',
        copyContext: {
          refreshDate,
        },
        metadata: {
          refresh_date: resetDate?.toISOString(),
        },
      }));

      if (subscription.tier === 'seeker' || subscription.tier === 'spark') {
        candidates.push(createCandidate({
          type: 'upgrade_room',
          timeWindow: 'evening',
          score: 34,
          dedupeKey: buildDedupeKey('upgrade_room', currentDate),
          deepLink: 'sifia://subscription/upgrade',
          sourceType: 'subscription',
        }));
      }
    }
  }

  candidates.push(createCandidate({
    type: 'prayer_today',
    timeWindow: 'morning',
    score: 44,
    dedupeKey: buildDedupeKey('prayer_today', currentDate),
    deepLink: 'sifia://journal/prayer',
    sourceType: 'fallback',
  }));

  candidates.push(createCandidate({
    type: 'recovery_prayer',
    timeWindow: 'night',
    score: 38,
    dedupeKey: buildDedupeKey('recovery_prayer', currentDate),
    deepLink: 'sifia://journal/prayer',
    sourceType: 'fallback',
  }));

  return candidates;
}
