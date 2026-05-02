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
    reflection?: string;
  } | null;
  bible_verse_reflection?: string | null;
  word_to_speak?: string | null;
  direct_challenge?: unknown;
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

type UnansweredPrayer = {
  id: string;
  content?: string | null;
  metadata?: Record<string, unknown> | null;
  person_name?: string | null;
  is_prayer_request?: boolean | null;
  prayed?: boolean | null;
  prayer_type?: string | null;
  journal_category?: string | null;
  created_at: string;
  selected_date?: string | null;
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
    playbook_verse_reflection: 'playbook',
    playbook_prayer_revisit: 'playbook',
    playbook_to_devotional: 'playbook',
    journal_todays_focus: 'journal',
    journal_todo: 'journal',
    journal_gratitude: 'journal',
    journal_todays_win: 'journal',
    journal_looking_forward: 'journal',
    heart_journal_prompt: 'journal',
    prayer_request_care: 'prayer',
    prayer_answered_check: 'prayer',
    prayer_today: 'prayer',
    create_devotional: 'creation',
    create_playbook: 'creation',
    create_first_devotional: 'creation',
    usage_room_devotional: 'subscription',
    usage_room_playbook: 'subscription',
    content_refresh_wait: 'subscription',
    upgrade_room: 'subscription',
  };

  const sensitiveTypes: SmartNotificationType[] = [
    'prayer_request_care',
    'prayer_answered_check',
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

const getPendingPrayerRequestState = async (userId: string): Promise<{ count: number; first?: PendingPrayerRequest; all: PendingPrayerRequest[] }> => {
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
    return { count: 0, all: [] };
  }

  const requests = (data || []) as PendingPrayerRequest[];
  return {
    count: requests.length,
    first: requests[0],
    all: requests,
  };
};

const getUnansweredPrayersForCheck = async (userId: string): Promise<UnansweredPrayer[]> => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('prayers')
    .select('id, content, metadata, person_name, is_prayer_request, prayed, prayer_type, journal_category, created_at, selected_date')
    .eq('user_id', userId)
    .in('prayer_type', ['journal', 'people'])
    .or('status.is.null,status.neq.answered')
    .lte('created_at', sevenDaysAgo)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    Logger.warn('[SmartNotifications] Unable to read unanswered prayer state', {
      component: 'notificationCandidateResolver',
      userId,
      error,
    });
    return [];
  }

  // Filter in JS to avoid complex chained PostgREST OR conditions:
  // - only prayers the user explicitly asked to track for answered-prayer follow-up.
  // - journal type: supplication (CAST S) or open prayer. Exclude adoration/confession/thanksgiving.
  // - prayer requests (is_prayer_request=true) are never in the answered check — the pray-for-someone
  //   entry created when the user actually prays (via PrayerEditorScreen) carries track_answered.
  const filtered = (data || []).filter((prayer: any) => {
    if (prayer.metadata?.track_answered !== true) {return false;}
    if (prayer.is_prayer_request === true) {return false;}
    if (
      prayer.prayer_type === 'journal' &&
      !['supplication', 'personal_prayer'].includes(prayer.journal_category)
    ) {return false;}
    return true;
  }).slice(0, 10);

  return filtered as UnansweredPrayer[];
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
      direct_challenge,
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

const getWordsToSpeak = (playbook: PlaybookRowLike): string[] => {
  // Primary: dedicated word_to_speak column (old schema)
  const directWords = safeText(playbook.word_to_speak)
    .split(/\n+/)
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  if (directWords.length > 0) {
    return directWords.slice(0, 5);
  }

  // Secondary: wordToSpeak piggybacked inside direct_challenge JSONB (new schema)
  const dc = parseMaybeJson(playbook.direct_challenge);
  if (dc && typeof dc === 'object' && !Array.isArray(dc)) {
    const piggybacked = safeText((dc as Record<string, unknown>).wordToSpeak)
      .split(/\n+/)
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean);
    if (piggybacked.length > 0) {
      return piggybacked.slice(0, 5);
    }
  }

  // Fallback: playbook_affirmations rows
  return sortByOrder(playbook.playbook_affirmations || [])
    .map(item => safeText(item.text))
    .filter(Boolean)
    .slice(0, 5);
};

const getReflectionLines = (playbook: PlaybookRowLike): string[] => {
  // NOTE: do NOT run safeText on the full string — it collapses \n to spaces before split.
  // Split on newlines first, then sanitize each line individually.
  const splitRaw = (raw: unknown): string[] => {
    if (typeof raw !== 'string' || !raw.trim()) {return [];}
    return raw.split(/\n+/).map(l => safeText(l)).filter(Boolean);
  };

  // Primary: dedicated column (normalized schema)
  const fromColumn = splitRaw(playbook.bible_verse_reflection);
  if (fromColumn.length > 0) {return fromColumn;}

  // Fallback: piggybacked inside bible_verse JSONB (legacy modernPlaybookApi storage)
  return splitRaw(playbook.bible_verse?.reflection);
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

const getRotatingReflectionQuestion = (
  day: DevotionalDayLike,
  dayNumber: number,
  devotionalId: string,
  userId: string,
  subscription: SubscriptionWithReset | null,
  notifiedQuestions: string[]
): string => {
  const questions = (day.reflectionQuestions || [])
    .map(question => notificationText(question.text))
    .filter(Boolean);

  if (questions.length === 0) {return '';}

  // For free users, filter to only unlocked questions from guided prompt service
  const isFreeUser = subscription?.tier === 'seeker' || subscription?.tier === 'free_trial';
  let availableQuestions = questions;

  if (isFreeUser) {
    const tier = subscription?.tier || 'seeker';
    const allocation = guidedPromptGatingService.getDailyPrompts(userId, tier);
    // Filter questions to only include those in free prompts
    availableQuestions = questions.filter(q => allocation.freePrompts.includes(q));
  }

  // If no unlocked questions available, return empty
  if (availableQuestions.length === 0) {return '';}

  const maxQuestions = isFreeUser ? Math.min(2, availableQuestions.length) : availableQuestions.length;

  // Create a unique key for this day's questions
  const dayKey = `${devotionalId}-${dayNumber}`;

  // Check which questions for this day have already been notified
  const notifiedForDay = notifiedQuestions.filter(q => q.startsWith(`${dayKey}-`));

  if (notifiedForDay.length >= maxQuestions) {
    // All allowed questions for this day have been notified, start over
    return availableQuestions[0];
  }

  // Get the next question that hasn't been notified for this day
  const nextIndex = notifiedForDay.length;
  return availableQuestions[nextIndex];
};

// Simplified function to get the literal "question to ponder" (first question only)
const getQuestionToPonder = (day: DevotionalDayLike): string => {
  const questions = (day.reflectionQuestions || [])
    .map(question => notificationText(question.text))
    .filter(Boolean);

  if (questions.length === 0) {return '';}

  // Return the first question (question to ponder) without rotation
  return questions[0];
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

  const [devotionals, journalEntries, prayerRequestState, unansweredPrayers, playbooks, subscriptionResult] = await Promise.all([
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
    getUnansweredPrayersForCheck(userId),
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

  // Get tracking data for notified reflection questions
  const { data: userData } = await supabase
    .from('user_profiles')
    .select('metadata')
    .eq('user_id', userId)
    .single();

  const userMetadata = userData?.metadata as Record<string, unknown> || {};
  const notifiedQuestions = (userMetadata.notified_reflection_questions as string[]) || [];

  // Support multiple incomplete devotionals
  const incompleteDevotionals = devotionals.filter(devotional => devotional.completed !== true);

  for (const activeDevotional of incompleteDevotionals) {
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
          title: activeDevotional.total_days === 1 ? activeDevotional.title : incompleteDay.title,
        },
        metadata: {
          devotional_title: activeDevotional.title,
          day_title: incompleteDay.title,
          verse_reference: verseReference,
          verse_text: verseText,
        },
      }));

    }

    const completedDaysWithIndex = [...days]
      .map((day, index) => ({ day, index }))
      .filter(({ day }) => day.completed === true)
      .reverse();

    // Check all completed days for missing reflections
    for (const { day, index } of completedDaysWithIndex) {
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

      const questionText = getQuestionToPonder(day);
      if (questionText) {
        const hasReflection = await findDevotionalReflection(userId, activeDevotional.id, dayNumber);
        if (!hasReflection) {
          const questionKey = `${activeDevotional.id}-${dayNumber}-${questionText.substring(0, 20)}`;
          candidates.push(createCandidate({
            type: 'devotional_reflection_prompt',
            timeWindow: 'evening',
            score: 88,
            dedupeKey: buildDedupeKey('devotional_reflection_prompt', activeDevotional.id, dayNumber, questionKey, currentDate),
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
              question_key: questionKey,
            },
          }));
        }
      }
    }

    // Special case: Day 1 should notify for reflection even if not completed
    const day1 = days[0];
    if (day1 && day1.dayNumber !== 1) {
      // If dayNumber is not set, assume it's day 1
      const day1Number = 1;
      const questionText = getQuestionToPonder(day1);
      if (questionText) {
        const hasReflection = await findDevotionalReflection(userId, activeDevotional.id, day1Number);
        if (!hasReflection) {
          const questionKey = `${activeDevotional.id}-${day1Number}-${questionText.substring(0, 20)}`;
          candidates.push(createCandidate({
            type: 'devotional_reflection_prompt',
            timeWindow: 'evening',
            score: 90, // Higher priority for day 1
            dedupeKey: buildDedupeKey('devotional_reflection_prompt', activeDevotional.id, day1Number, questionKey, currentDate),
            deepLink: `sifia://devotionals/${activeDevotional.id}/day/${day1Number}/reflect`,
            sourceType: 'devotional_day',
            sourceId: activeDevotional.id,
            sourceSubId: String(day1Number),
            copyContext: {
              questionText,
            },
            metadata: {
              devotional_title: activeDevotional.title,
              day_title: day1.title,
              question_text: questionText,
              question_key: questionKey,
            },
          }));
        }
      }
    }

    const verseDayWithIndex = completedDaysWithIndex[0] || (incompleteDay ? { day: incompleteDay, index: incompleteIndex } : null);
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
  }

  // If no incomplete devotionals, check for completed ones
  if (incompleteDevotionals.length === 0) {
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
    const steps = sortByOrder(ongoingPlaybook.playbook_action_steps || []);

    // Calculate action completion
    let completedActions = 0;
    let totalActions = 0;
    for (const step of steps) {
      totalActions++;
      if (step.completed === true) {
        completedActions++;
      }
    }

    // Check for all actions complete notification
    if (completedActions === totalActions && totalActions > 0) {
      const completeKey = `${ongoingPlaybook.id}-actions-complete`;
      const notifiedComplete = (userMetadata.notified_action_completions as string[]) || [];
      if (!notifiedComplete.includes(completeKey)) {
        candidates.push(createCandidate({
          type: 'playbook_actions_complete',
          timeWindow: 'evening',
          score: 95,
          dedupeKey: buildDedupeKey('playbook_actions_complete', ongoingPlaybook.id, completeKey),
          deepLink: `sifia://playbooks/${ongoingPlaybook.id}`,
          sourceType: 'playbook',
          sourceId: ongoingPlaybook.id,
          copyContext: {
            title: ongoingPlaybook.title,
          },
          metadata: {
            playbook_title: ongoingPlaybook.title,
            completion_key: completeKey,
          },
        }));
      }
    }
    // Check for milestone notification (at least 4 completed but not all)
    else if (completedActions >= 4 && completedActions < totalActions && totalActions > 4) {
      const milestoneKey = `${ongoingPlaybook.id}-actions-${completedActions}`;
      const notifiedMilestones = (userMetadata.notified_action_milestones as string[]) || [];
      if (!notifiedMilestones.includes(milestoneKey)) {
        candidates.push(createCandidate({
          type: 'playbook_actions_milestone',
          timeWindow: 'evening',
          score: 80,
          dedupeKey: buildDedupeKey('playbook_actions_milestone', ongoingPlaybook.id, milestoneKey),
          deepLink: `sifia://playbooks/${ongoingPlaybook.id}`,
          sourceType: 'playbook',
          sourceId: ongoingPlaybook.id,
          copyContext: {
            title: ongoingPlaybook.title,
            completedCount: completedActions,
            totalCount: totalActions,
          },
          metadata: {
            playbook_title: ongoingPlaybook.title,
            completed_count: completedActions,
            total_count: totalActions,
            milestone_key: milestoneKey,
          },
        }));
      }
    }

    // Collect all incomplete actions for faithful action reminder
    const incompleteActions: Array<{ action: any; actionIndex: number }> = [];
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (step.completed === true) { continue; }
      const subTasks = step.playbook_sub_tasks || [];
      if (subTasks.length === 0 || subTasks.some(subTask => subTask.completed !== true)) {
        incompleteActions.push({ action: step, actionIndex: i });
      }
    }

    // Pick one at random so a different action step is notified each time
    if (incompleteActions.length > 0) {
      const randomIndex = Math.floor(Math.random() * incompleteActions.length);
      const { action, actionIndex } = incompleteActions[randomIndex];
      const actionText = notificationText(action.text);
      candidates.push(createCandidate({
        type: 'playbook_faithful_action',
        timeWindow: 'midday',
        score: 84,
        dedupeKey: buildDedupeKey('playbook_faithful_action', ongoingPlaybook.id, currentDate),
        deepLink: `sifia://playbooks/${ongoingPlaybook.id}/walkthrough/actions/${actionIndex}`,
        sourceType: 'action_step',
        sourceId: ongoingPlaybook.id,
        sourceSubId: action.id,
        copyContext: { actionText },
        metadata: {
          playbook_title: ongoingPlaybook.title,
          action_text: actionText,
          action_index: actionIndex,
        },
      }));
    }

  }

  // playbook_verse_revisit: rotate through all playbooks with verses, track notified ones
  const allPlaybooksWithVerses = playbooks.filter(pb => notificationText(pb.bible_verse?.text));

  if (allPlaybooksWithVerses.length > 0) {
    // Reuse existing userData and userMetadata from upper scope
    const notifiedVerses = (userMetadata.notified_verses as string[]) || [];
    const lastVerseReset = userMetadata.last_verse_reset as string | undefined;

    // Check if we need to reset tracking (new devotional/playbook created)
    // We'll reset if it's been more than 30 days or if the count of playbooks with verses changed significantly
    const shouldResetTracking = !lastVerseReset ||
      (new Date().getTime() - new Date(lastVerseReset).getTime() > 30 * 24 * 60 * 60 * 1000) ||
      (notifiedVerses.length > allPlaybooksWithVerses.length);

    if (shouldResetTracking) {
      // Reset tracking
      await supabase
        .from('user_profiles')
        .update({
          metadata: {
            ...userMetadata,
            notified_verses: [],
            last_verse_reset: new Date().toISOString(),
          },
        })
        .eq('user_id', userId);
    }

    // Find a verse that hasn't been notified yet
    const availableVerses = allPlaybooksWithVerses.filter(pb => !notifiedVerses.includes(pb.id));

    if (availableVerses.length > 0) {
      // Select the first available verse (prioritize in-progress)
      const verseSource = availableVerses.find(pb => pb.status !== 'completed' && !pb.completed_at) || availableVerses[0];
      const playbookVerseReference = notificationText(verseSource.bible_verse?.reference);
      const playbookVerseText = notificationText(verseSource.bible_verse?.text);

      candidates.push(createCandidate({
        type: 'playbook_verse_revisit',
        timeWindow: 'evening',
        score: 58,
        dedupeKey: buildDedupeKey('playbook_verse_revisit', verseSource.id, currentDate),
        deepLink: `sifia://playbooks/${verseSource.id}/walkthrough/verse`,
        sourceType: 'playbook',
        sourceId: verseSource.id,
        copyContext: { verseReference: playbookVerseReference, verseText: playbookVerseText },
        metadata: { playbook_title: verseSource.title, verse_reference: playbookVerseReference, verse_text: playbookVerseText },
      }));

      // Mark this verse as notified
      const updatedNotifiedVerses = [...notifiedVerses, verseSource.id];
      await supabase
        .from('user_profiles')
        .update({
          metadata: {
            ...userMetadata,
            notified_verses: updatedNotifiedVerses,
            last_verse_reset: new Date().toISOString(),
          },
        })
        .eq('user_id', userId);
    }
    // If all verses have been notified, don't send any more until reset
  }

  // playbook_verse_reflection: send 2 reflection lines per day (morning + afternoon)
  // from all playbooks (in-progress or completed), rotating through every line.
  {
    const allPlaybooksWithReflection = playbooks.filter(pb => getReflectionLines(pb).length > 0);

    if (allPlaybooksWithReflection.length > 0) {
      // Build a flat list of all {playbookId, lineIndex, line} across all playbooks
      const allLines: Array<{ playbookId: string; lineIndex: number; line: string; playbookTitle: string | null | undefined; verseRef: string }> = [];
      for (const pb of allPlaybooksWithReflection) {
        const lines = getReflectionLines(pb);
        const verseRef = notificationText(pb.bible_verse?.reference);
        lines.forEach((line, idx) => {
          allLines.push({ playbookId: pb.id, lineIndex: idx, line, playbookTitle: pb.title, verseRef });
        });
      }

      const notifiedLines = (userMetadata.notified_reflection_lines as string[]) || [];
      const lastReflectionReset = userMetadata.last_reflection_line_reset as string | undefined;

      const shouldResetReflectionTracking =
        !lastReflectionReset ||
        (new Date().getTime() - new Date(lastReflectionReset).getTime() > 30 * 24 * 60 * 60 * 1000) ||
        notifiedLines.length >= allLines.length;

      const effectiveNotified: string[] = shouldResetReflectionTracking ? [] : notifiedLines;

      // Pick up to 2 unnotified lines for today
      const availableLines = allLines.filter(l => !effectiveNotified.includes(`${l.playbookId}:${l.lineIndex}`));
      const todayLines = availableLines.slice(0, 2);
      const timeWindows: SmartNotificationTimeWindow[] = ['morning', 'afternoon'];

      const newlyNotified: string[] = [];

      for (let i = 0; i < todayLines.length; i++) {
        const { playbookId, lineIndex, line, verseRef } = todayLines[i];
        const lineKey = `${playbookId}:${lineIndex}`;
        const window = timeWindows[i];

        candidates.push(createCandidate({
          type: 'playbook_verse_reflection',
          timeWindow: window,
          score: 62 - i * 4,
          dedupeKey: buildDedupeKey('playbook_verse_reflection', lineKey, currentDate),
          deepLink: `sifia://playbooks/${playbookId}/walkthrough/verse`,
          sourceType: 'playbook',
          sourceId: playbookId,
          sourceSubId: String(lineIndex),
          copyContext: { reflectionLine: line, verseReference: verseRef },
          metadata: {
            reflection_line: line,
            verse_reference: verseRef,
            line_index: lineIndex,
          },
        }));

        newlyNotified.push(lineKey);
      }

      if (newlyNotified.length > 0 || shouldResetReflectionTracking) {
        const updatedNotified = [...new Set([...effectiveNotified, ...newlyNotified])];
        await supabase
          .from('user_profiles')
          .update({
            metadata: {
              ...userMetadata,
              notified_reflection_lines: updatedNotified,
              last_reflection_line_reset: shouldResetReflectionTracking
                ? new Date().toISOString()
                : (lastReflectionReset || new Date().toISOString()),
            },
          })
          .eq('user_id', userId);
      }
    }
  }

  if (ongoingPlaybook) {

    const playbookPrayer = notificationText(ongoingPlaybook.prayer) ||
      (() => {
        const dc = parseMaybeJson(ongoingPlaybook.direct_challenge);
        return dc && typeof dc === 'object' && !Array.isArray(dc)
          ? notificationText((dc as Record<string, unknown>).prayer)
          : '';
      })();
    if (playbookPrayer.length > 0) {
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

  // playbook_word_to_speak: generate multiple notifications throughout the day from both in-progress and completed playbooks
  const allPlaybooksWithWords = playbooks.filter(pb => getWordsToSpeak(pb).length > 0);

  if (allPlaybooksWithWords.length > 0) {
    const timeWindows: SmartNotificationTimeWindow[] = ['morning', 'midday', 'afternoon', 'evening', 'night'];
    let wordIndex = 0;

    // Generate up to 5 notifications (one per time window) from different playbooks
    for (const timeWindow of timeWindows) {
      if (wordIndex >= allPlaybooksWithWords.length) {
        break;
      }

      // Rotate through playbooks, prioritizing in-progress ones
      const playbookSource = allPlaybooksWithWords[wordIndex];
      const wordsToSpeak = getWordsToSpeak(playbookSource);

      // Use different word based on time window to get variety
      const wordOffset = timeWindows.indexOf(timeWindow);
      const selectedWordIndex = (new Date().getDate() + wordOffset) % wordsToSpeak.length;
      const wordToSpeak = notificationText(wordsToSpeak[selectedWordIndex]);

      candidates.push(createCandidate({
        type: 'playbook_word_to_speak',
        timeWindow,
        score: 76 - wordIndex * 3, // Decrease score slightly for later notifications
        dedupeKey: buildDedupeKey('playbook_word_to_speak', playbookSource.id, selectedWordIndex, timeWindow, currentDate),
        deepLink: `sifia://playbooks/${playbookSource.id}/walkthrough/words`,
        sourceType: 'playbook',
        sourceId: playbookSource.id,
        sourceSubId: String(selectedWordIndex),
        copyContext: { wordToSpeak },
        metadata: {
          playbook_title: playbookSource.title,
          word_to_speak: wordToSpeak,
        },
      }));

      wordIndex++;
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
    const dayOfYear = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
    const useGroup = prayerRequestState.count >= 2 && dayOfYear % 2 === 0;

    if (useGroup) {
      const personNames = prayerRequestState.all
        .map(r => notificationText(r.person_name))
        .filter(Boolean)
        .slice(0, 5);
      candidates.push(createCandidate({
        type: 'prayer_request_care',
        timeWindow: 'midday',
        score: 86,
        dedupeKey: buildDedupeKey('prayer_request_care', 'group', currentDate),
        deepLink: 'sifia://journal/prayer?tab=requests',
        sourceType: 'prayer',
        copyContext: { personNames },
        metadata: { pending_count: prayerRequestState.count, person_names: personNames, is_group: true },
      }));
    } else {
      const index = dayOfYear % prayerRequestState.all.length;
      const person = prayerRequestState.all[index];
      const personName = notificationText(person?.person_name);
      candidates.push(createCandidate({
        type: 'prayer_request_care',
        timeWindow: 'midday',
        score: 86,
        dedupeKey: buildDedupeKey('prayer_request_care', person?.id || 'pending', currentDate),
        deepLink: 'sifia://journal/prayer?tab=requests',
        sourceType: 'prayer',
        sourceId: person?.id,
        copyContext: { personName },
        metadata: { pending_count: prayerRequestState.count, person_name: personName, is_group: false },
      }));
    }
  }

  for (const prayer of unansweredPrayers) {
    const daysSince = Math.floor((Date.now() - new Date(prayer.created_at).getTime()) / (1000 * 60 * 60 * 24));
    const weekNumber = Math.floor(daysSince / 7);
    const personName = notificationText(prayer.person_name);
    const prayerText = notificationText(prayer.content);
    candidates.push(createCandidate({
      type: 'prayer_answered_check',
      timeWindow: 'midday',
      score: 82,
      dedupeKey: buildDedupeKey('prayer_answered_check', prayer.id, `week:${weekNumber}`),
      deepLink: `sifia://journal/prayer?id=${prayer.id}${prayer.selected_date ? `&selectedDate=${encodeURIComponent(prayer.selected_date)}` : ''}`,
      sourceType: 'prayer',
      sourceId: prayer.id,
      copyContext: {
        personName: personName || undefined,
        prayerText: prayerText || undefined,
        isPrayerRequest: prayer.is_prayer_request ?? false,
      },
      metadata: {
        person_name: personName,
        prayer_text: prayerText,
        is_prayer_request: prayer.is_prayer_request,
        days_since_creation: daysSince,
        week_number: weekNumber,
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

  // Heart journal prompt: only notify if no devotionals or all reflection questions are journaled
  const shouldNotifyHeartJournal = incompleteDevotionals.length === 0;

  if (shouldNotifyHeartJournal) {
    // Check if all reflection questions for completed devotionals are already journaled
    let allReflectionsJournaled = true;

    for (const devotional of devotionals) {
      if (devotional.completed !== true) {continue;}

      const days = Array.isArray(devotional.days) ? devotional.days as DevotionalDayLike[] : [];
      for (const day of days) {
        if (!day.completed) {continue;}

        const dayNumber = typeof day.dayNumber === 'number' ? day.dayNumber : days.indexOf(day) + 1;
        const questionText = getRotatingReflectionQuestion(day, dayNumber, devotional.id, userId, subscription, notifiedQuestions);
        if (questionText) {
          const hasReflection = await findDevotionalReflection(userId, devotional.id, dayNumber);
          if (!hasReflection) {
            allReflectionsJournaled = false;
            break;
          }
        }
      }

      if (!allReflectionsJournaled) {break;}
    }

    // Only notify if no devotionals OR all reflections are journaled
    if (incompleteDevotionals.length === 0 || allReflectionsJournaled) {
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
            is_free_user: subscription?.tier === 'seeker' || subscription?.tier === 'free_trial',
          },
        }));
      }
    }
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
    } else if (incompleteDevotionals.length === 0 && remaining.devotionals > 0) {
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

    if (remaining.devotionals > 0 && remaining.devotionals <= 5 && incompleteDevotionals.length === 0) {
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

  // Mark reflection questions as notified
  const reflectionQuestionKeys = candidates
    .filter(c => c.type === 'devotional_reflection_prompt' && c.metadata?.question_key)
    .map(c => c.metadata?.question_key as string);

  // Mark playbook action completions as notified
  const actionCompletionKeys = candidates
    .filter(c => c.type === 'playbook_actions_complete' && c.metadata?.completion_key)
    .map(c => c.metadata?.completion_key as string);

  // Mark playbook action milestones as notified
  const actionMilestoneKeys = candidates
    .filter(c => c.type === 'playbook_actions_milestone' && c.metadata?.milestone_key)
    .map(c => c.metadata?.milestone_key as string);

  if (reflectionQuestionKeys.length > 0 || actionCompletionKeys.length > 0 || actionMilestoneKeys.length > 0) {
    const updatedNotifiedQuestions = [...new Set([...notifiedQuestions, ...reflectionQuestionKeys])];
    const updatedNotifiedCompletions = [...new Set([...((userMetadata.notified_action_completions as string[]) || []), ...actionCompletionKeys])];
    const updatedNotifiedMilestones = [...new Set([...((userMetadata.notified_action_milestones as string[]) || []), ...actionMilestoneKeys])];
    await supabase
      .from('user_profiles')
      .update({
        metadata: {
          ...userMetadata,
          notified_reflection_questions: updatedNotifiedQuestions,
          notified_action_completions: updatedNotifiedCompletions,
          notified_action_milestones: updatedNotifiedMilestones,
        },
      })
      .eq('user_id', userId);
  }

  return candidates;
}
