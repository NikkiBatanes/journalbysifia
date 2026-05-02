import { Logger } from './ProductionLogger';
import { DailyNotificationScheduler } from './dailyNotificationScheduler';
import { pushNotificationService } from '../services/pushNotificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildSmartNotificationCopy } from '../services/notifications/notificationCopyBank';
import { SMART_NOTIFICATION_TYPES, SmartNotificationType } from '../services/notifications/notificationTypes';

/**
 * Notification Testing Utilities
 * Use these functions to test notification delivery
 */
export class NotificationTester {
  /**
   * Send every smart notification copy as staggered local notifications.
   * This is intentionally local-only so dev copy testing does not pollute the queue.
   */
  static async sendAllSmartNotificationCopyTests(): Promise<number> {
    try {
      Logger.info('🧪 Scheduling all smart notification copy tests', {
        component: 'NotificationTester',
        count: SMART_NOTIFICATION_TYPES.length,
      });

      const baseTime = Date.now() + 3000;

      await Promise.all(
        SMART_NOTIFICATION_TYPES.map(async (type, index) => {
          const copy = buildSmartNotificationCopy(type, {
            dayNumber: 2,
            totalDays: 7,
            title: 'Finding Peace in God\'s Presence',
            actionText: 'take one step toward community today',
            verseReference: 'Psalm 23:1',
            verseText: 'The Lord is my shepherd; I shall not want.',
            questionText: 'Where do you need to trust God with the next step today?',
            wordToSpeak: 'I am not alone. God is leading me one faithful step at a time.',
            heartJournalTitle: 'Am I trusting God with my work or financial concerns?',
            personName: 'Lisa',
            remainingCount: 3,
            refreshDate: 'May 15',
          });

          await pushNotificationService.scheduleLocalNotification({
            title: copy.title,
            message: copy.message,
            data: {
              deep_link: 'sifia://dashboard',
              test: true,
              notification_type: type,
            },
            priority: index < 5 ? 'high' : 'normal',
          }, new Date(baseTime + index * 2500));
        })
      );

      Logger.info('✅ All smart notification copy tests scheduled', {
        component: 'NotificationTester',
        count: SMART_NOTIFICATION_TYPES.length,
      });

      return SMART_NOTIFICATION_TYPES.length;
    } catch (error) {
      Logger.error('Failed to schedule all smart notification copy tests', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Fetch real user data from Supabase and build context for any notification type.
   * Bypasses all scheduling/gating conditions — purely for testing copy with real content.
   */
  private static async buildRealContext(userId: string): Promise<{ ctx: Record<string, any>; debug: string }> {
    const { getPlaybooks } = await import('../services/modernPlaybookApi');
    const { supabase } = await import('../services/supabaseClient');
    const { guidedPromptGatingService } = await import('../services/guidedPromptGatingService');

    const strip = (v: string) => v.replace(/\*\*|__|\*/g, '').replace(/<[^>]*>/g, '').trim();
    const safeStr = (v: unknown): string =>
      typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';

    const [playbooks, devotionalsResult, prayersResult, unansweredPrayersResult, subResult] = await Promise.all([
      getPlaybooks(userId).catch(() => [] as any[]),
      supabase.from('devotionals').select('id, title, total_days, days').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('prayers').select('id, person_name').eq('user_id', userId).eq('is_prayer_request', true).or('prayed.is.null,prayed.eq.false').order('created_at', { ascending: true }).limit(10),
      // Tester: no 7-day minimum. Fetch broad set, filter in JS (same logic as resolver). Include selected_date.
      supabase.from('prayers').select('id, content, person_name, is_prayer_request, prayer_type, journal_category, metadata, created_at, selected_date').eq('user_id', userId).in('prayer_type', ['journal', 'people']).or('status.is.null,status.neq.answered').order('created_at', { ascending: false }).limit(10),
      supabase.from('user_subscriptions_new').select('playbooks_used, playbooks_limit, devotionals_used, devotionals_limit, subscription_start_date, tier').eq('user_id', userId).maybeSingle(),
    ]);

    const devotionals: any[] = devotionalsResult.data || [];
    const prayers: any[] = prayersResult.data || [];
    const unansweredPrayers: any[] = (unansweredPrayersResult.data || []).filter((p: any) => {
      if (p.metadata?.track_answered !== true) {return false;}
      if (p.is_prayer_request === true) {return false;}
      if (p.prayer_type === 'journal' && !['supplication', 'personal_prayer'].includes(p.journal_category)) {return false;}
      return true;
    });
    const sub = subResult.data;

    // Extract wordToSpeak from Playbook object (wordToSpeak field or directChallenge JSONB)
    const getWords = (pb: any): string[] => {
      if (pb.wordToSpeak) {
        const lines = String(pb.wordToSpeak).split(/\n+/).map((l: string) => strip(l.replace(/^[-*]\s*/, '').trim())).filter(Boolean);
        if (lines.length) {return lines.slice(0, 5);}
      }
      const dc = pb.directChallenge;
      if (dc && typeof dc === 'object' && dc.wordToSpeak) {
        const lines = String(dc.wordToSpeak).split(/\n+/).map((l: string) => strip(l.replace(/^[-*]\s*/, '').trim())).filter(Boolean);
        if (lines.length) {return lines.slice(0, 5);}
      }
      return (pb.affirmations || []).map((a: any) => strip(safeStr(a.text))).filter(Boolean).slice(0, 5);
    };

    const getVerse = (pb: any): { reference: string; text: string } => {
      const bv = pb.bibleVerse || pb.bible_verse;
      if (bv && typeof bv === 'object') {return { reference: strip(safeStr(bv.reference)), text: strip(safeStr(bv.text)) };}
      return { reference: '', text: '' };
    };

    const pbWithWords = playbooks.find((pb: any) => pb.status !== 'completed' && !pb.completedAt && getWords(pb).length > 0)
      || playbooks.find((pb: any) => getWords(pb).length > 0);
    const pbWithVerse = playbooks.find((pb: any) => getVerse(pb).text);

    // Action steps live in a separate table — fetch them using playbook IDs
    let actionText = '';
    let actionStepPlaybookId: string | undefined;
    let actionStepIndex: number | undefined;
    if (playbooks.length > 0) {
      const ids = playbooks.map((pb: any) => pb.id);
      const { data: stepsData } = await supabase
        .from('playbook_action_steps')
        .select('id, text, order_index, playbook_id, playbook_sub_tasks(text, completed)')
        .in('playbook_id', ids)
        .order('order_index', { ascending: true })
        .limit(10);
      const firstStep = (stepsData || []).find((s: any) => s.text?.trim());
      if (firstStep) {
        actionText = strip(String(firstStep.text));
        actionStepPlaybookId = firstStep.playbook_id;
        actionStepIndex = firstStep.order_index;
      }
    }

    const activeDevotional = devotionals.find((d: any) => {
      const days: any[] = Array.isArray(d.days) ? d.days : [];
      return days.some((day: any) => day?.completed !== true);
    }) || devotionals[0];

    const ctx: Record<string, any> = {};

    if (activeDevotional) {
      ctx._devotionalId = activeDevotional.id;
      const days: any[] = Array.isArray(activeDevotional.days) ? activeDevotional.days : [];
      const dayObj = days.find((d: any) => d?.completed !== true) || days[days.length - 1] || days[0];
      if (dayObj) {
        ctx.dayNumber = typeof dayObj.dayNumber === 'number' ? dayObj.dayNumber : days.indexOf(dayObj) + 1;
        ctx.totalDays = activeDevotional.total_days || days.length;
        ctx.title = ctx.totalDays === 1 ? activeDevotional.title : dayObj.title;
        const bv = dayObj.scripture;
        if (bv) { ctx.verseReference = strip(safeStr(bv.reference)); ctx.verseText = strip(safeStr(bv.text)); }
        const q = (dayObj.reflectionQuestions || []).find((question: any) => safeStr(question?.text));
        if (q) {ctx.questionText = strip(safeStr(q.text));}
      }
    }

    if (pbWithWords) {
      const words = getWords(pbWithWords);
      ctx.wordToSpeak = words[new Date().getDate() % words.length];
      ctx._playbookId = pbWithWords.id;
    }

    if (actionText) {
      ctx.actionText = actionText;
      ctx._playbookId = actionStepPlaybookId;
      ctx._actionIndex = actionStepIndex;
    }

    // Store playbook verse separately so it isn't overwritten by devotional verse
    if (pbWithVerse) {
      const bv = getVerse(pbWithVerse);
      ctx._playbookVerseReference = bv.reference;
      ctx._playbookVerseText = bv.text;
      if (!ctx._playbookId) {
        ctx._playbookId = pbWithVerse.id;
      }
    }

    // Reflection lines from bibleVerseReflection (column or piggybacked into bible_verse.reflection)
    // NOTE: do NOT call safeStr on the full string before splitting — safeStr collapses \n to spaces.
    const splitReflection = (raw: unknown): string[] => {
      if (typeof raw !== 'string' || !raw.trim()) {return [];}
      return raw.split(/\n+/).map((l: string) => strip(l.replace(/\*\*|__|\*/g, '').trim())).filter(Boolean);
    };
    const getReflectionLines = (pb: any): string[] => {
      const fromColumn = splitReflection(pb.bibleVerseReflection || pb.bible_verse_reflection);
      if (fromColumn.length > 0) {return fromColumn;}
      const bv = pb.bibleVerse || pb.bible_verse;
      return splitReflection(bv && typeof bv === 'object' ? bv.reflection : undefined);
    };
    const pbWithReflection = playbooks.find((pb: any) => getReflectionLines(pb).length > 0);
    if (pbWithReflection) {
      const lines = getReflectionLines(pbWithReflection);
      ctx._playbookReflectionLine = strip(lines[new Date().getDate() % lines.length]);
      ctx._playbookReflectionVerseRef = strip(safeStr((pbWithReflection.bibleVerse || pbWithReflection.bible_verse)?.reference));
    }

    // devotional verse is already in ctx.verseText / ctx.verseReference from the devotional block above

    // Prayer request names (for prayer_request_care group/individual)
    if (prayers.length > 0) {
      ctx._prayerRequestNames = prayers.map((p: any) => safeStr(p.person_name)).filter(Boolean);
      ctx.personName = ctx._prayerRequestNames[0] || undefined;
    }

    // Unanswered prayers (for prayer_answered_check)
    if (unansweredPrayers.length > 0) {
      const up = unansweredPrayers[0];
      ctx._unansweredPrayerId = up.id;
      ctx._unansweredPrayerText = strip(safeStr(up.content));
      ctx._unansweredPrayerPersonName = safeStr(up.person_name) || undefined;
      ctx._unansweredPrayerIsRequest = up.is_prayer_request ?? false;
      ctx._unansweredPrayerSelectedDate = up.selected_date;
    }

    if (sub) {
      const pbRem = (sub.playbooks_limit ?? 0) < 0 ? 99 : Math.max(0, (sub.playbooks_limit ?? 0) - (sub.playbooks_used ?? 0));
      const devRem = (sub.devotionals_limit ?? 0) < 0 ? 99 : Math.max(0, (sub.devotionals_limit ?? 0) - (sub.devotionals_used ?? 0));
      ctx.remainingCount = Math.min(pbRem, devRem);
      const anchor = new Date(sub.subscription_start_date || new Date());
      const next = new Date(anchor);
      while (next <= new Date()) {next.setMonth(next.getMonth() + 1);}
      ctx.refreshDate = next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // Use guided prompt service for heart journal title
    try {
      const tier = sub?.tier || 'seeker';
      const allocation = guidedPromptGatingService.getDailyPrompts(userId, tier);
      const completedPrompts = await guidedPromptGatingService.getCompletedPrompts();
      const availablePrompts = allocation.freePrompts.filter(prompt => !completedPrompts.includes(prompt));
      if (availablePrompts.length > 0) {
        ctx.heartJournalTitle = availablePrompts[0];
      }
    } catch (e) {
      // Fallback to playbook title if guided prompt fails
      if (playbooks[0]?.title) {ctx.heartJournalTitle = `How is God meeting you in "${playbooks[0].title}"?`;}
    }

    const debug = [
      `uid:${userId.slice(0, 8)}`,
      `pbs:${playbooks.length}`,
      `words:${ctx.wordToSpeak ? String(ctx.wordToSpeak).slice(0, 25) : 'none'}`,
      `action:${ctx.actionText ? String(ctx.actionText).slice(0, 25) : 'none'}`,
      `verse:${ctx.verseText ? String(ctx.verseText).slice(0, 25) : 'none'}`,
      `devs:${devotionals.length}`,
      `heart:${ctx.heartJournalTitle ? String(ctx.heartJournalTitle).slice(0, 25) : 'none'}`,
      `unanswered:${unansweredPrayers.length}`,
      `requests:${prayers.length}`,
    ].join(' | ');

    return { ctx, debug };
  }

  /**
   * Generate the appropriate deep link for a notification type based on context.
   * Mirrors the deep link generation logic in notificationCandidateResolver.ts.
   */
  private static generateDeepLinkForType(
    type: SmartNotificationType,
    ctx: Record<string, any>,
  ): string {
    switch (type) {
      // Devotional deep links
      case 'devotional_day_ready':
      case 'devotional_prayer_prompt':
      case 'devotional_verse_revisit':
        if (ctx._devotionalId) {
          const dayNumber = ctx.dayNumber || 1;
          return `sifia://devotionals/${ctx._devotionalId}/day/${dayNumber}`;
        }
        return 'sifia://devotionals/new';

      case 'devotional_reflection_prompt':
        if (ctx._devotionalId) {
          const dayNumber = ctx.dayNumber || 1;
          return `sifia://devotionals/${ctx._devotionalId}/day/${dayNumber}/reflect`;
        }
        return 'sifia://devotionals/new';

      case 'devotional_completed_reflection':
        if (ctx._devotionalId) {
          return `sifia://devotionals/${ctx._devotionalId}`;
        }
        return 'sifia://devotionals/new';

      // Playbook deep links
      case 'playbook_faithful_action':
        if (ctx._playbookId && ctx._actionIndex !== undefined) {
          return `sifia://playbooks/${ctx._playbookId}/walkthrough/actions/${ctx._actionIndex}`;
        }
        return 'sifia://playboards/new';

      case 'playbook_actions_complete':
      case 'playbook_actions_milestone':
        if (ctx._playbookId) {
          return `sifia://playbooks/${ctx._playbookId}`;
        }
        return 'sifia://playbooks/new';

      case 'playbook_verse_revisit':
      case 'playbook_verse_reflection':
        if (ctx._playbookId) {
          return `sifia://playbooks/${ctx._playbookId}/walkthrough/verse`;
        }
        return 'sifia://playbooks/new';

      case 'playbook_prayer_revisit':
        if (ctx._playbookId) {
          return `sifia://playbooks/${ctx._playbookId}/walkthrough/prayer`;
        }
        return 'sifia://playbooks/new';

      case 'playbook_word_to_speak':
        if (ctx._playbookId) {
          return `sifia://playbooks/${ctx._playbookId}/walkthrough/words`;
        }
        return 'sifia://playbooks/new';

      case 'playbook_to_devotional':
        if (ctx._playbookId) {
          return `sifia://playbooks/${ctx._playbookId}/devotional`;
        }
        return 'sifia://devotionals/new';

      // Prayer deep links
      case 'prayer_request_care':
        return 'sifia://journal/prayer?tab=requests';

      case 'prayer_answered_check':
        if (ctx._unansweredPrayerId) {
          const selectedDate = ctx._unansweredPrayerSelectedDate
            ? `&selectedDate=${encodeURIComponent(ctx._unansweredPrayerSelectedDate)}`
            : '';
          return `sifia://journal/prayer?id=${ctx._unansweredPrayerId}${selectedDate}`;
        }
        return 'sifia://journal/prayer';

      case 'prayer_today':
        return 'sifia://journal/prayer';

      // Journal deep links
      case 'journal_todays_focus':
        return 'sifia://journal/focus';

      case 'journal_todo':
        return 'sifia://journal/todos';

      case 'journal_gratitude':
        return 'sifia://journal/gratitude';

      case 'journal_todays_win':
        return 'sifia://journal/win';

      case 'journal_looking_forward':
        return 'sifia://journal/looking-forward';

      case 'heart_journal_prompt':
        if (ctx.heartJournalTitle) {
          return `sifia://journal/heart?title=${encodeURIComponent(ctx.heartJournalTitle)}`;
        }
        return 'sifia://journal';

      // Subscription/upgrade deep links
      case 'create_first_devotional':
      case 'create_devotional':
      case 'usage_room_devotional':
        return 'sifia://devotionals/new';

      case 'create_playbook':
      case 'usage_room_playbook':
        return 'sifia://playbooks/new';

      case 'content_refresh_wait':
        return 'sifia://journal';

      case 'upgrade_room':
        return 'sifia://subscription/upgrade';

      default:
        return 'sifia://dashboard';
    }
  }

  /**
   * Send a single notification type using real user data. No gating conditions —
   * fetches actual playbook/devotional/prayer content directly.
   * Returns null if no relevant real data exists for that type.
   */
  static async sendSingleTypeTest(
    type: SmartNotificationType,
    userId?: string,
    simulatedDayOfWeek?: number,
  ): Promise<{ title: string; message: string; debug?: string } | null> {
    let ctx: Record<string, any> = {};
    let debugInfo = '';

    if (userId) {
      try {
        const result = await NotificationTester.buildRealContext(userId);
        ctx = result.ctx;
        debugInfo = result.debug;
      } catch (e) {
        Logger.warn('[NotificationTester] Failed to fetch real context', { component: 'NotificationTester', error: e as Error });
        debugInfo = `fetch error: ${(e as Error)?.message ?? e}`;
      }
    }

    const effectiveDay = simulatedDayOfWeek ?? new Date().getDay();
    const fakeDayOfYear = simulatedDayOfWeek !== undefined
      ? simulatedDayOfWeek + 1
      : Math.floor(Date.now() / (1000 * 60 * 60 * 24));

    const resolvedCtx: Record<string, any> = { ...ctx, _simulatedDayOfWeek: effectiveDay };

    if (type === 'playbook_verse_revisit') {
      resolvedCtx.verseText = ctx._playbookVerseText;
      resolvedCtx.verseReference = ctx._playbookVerseReference;
    }

    if (type === 'playbook_verse_reflection') {
      resolvedCtx.reflectionLine = ctx._playbookReflectionLine;
      resolvedCtx.verseReference = ctx._playbookReflectionVerseRef;
    }

    if (type === 'prayer_answered_check') {
      resolvedCtx.prayerText = ctx._unansweredPrayerText;
      resolvedCtx.personName = ctx._unansweredPrayerPersonName;
      resolvedCtx.isPrayerRequest = ctx._unansweredPrayerIsRequest;
    }

    if (type === 'prayer_request_care') {
      const names: string[] = ctx._prayerRequestNames || [];
      const useGroup = names.length >= 2 && fakeDayOfYear % 2 === 0;
      if (useGroup) {
        resolvedCtx.personNames = names.slice(0, 5);
        resolvedCtx.personName = undefined;
      } else {
        const index = names.length > 0 ? fakeDayOfYear % names.length : 0;
        resolvedCtx.personName = names[index];
        resolvedCtx.personNames = undefined;
      }
    }

    // Check if this type has real data to show
    const dataRequired: Partial<Record<SmartNotificationType, string>> = {
      playbook_word_to_speak: 'wordToSpeak',
      playbook_faithful_action: 'actionText',
      playbook_actions_complete: 'title',
      playbook_actions_milestone: 'title',
      playbook_verse_revisit: '_playbookVerseText',
      playbook_verse_reflection: '_playbookReflectionLine',
      devotional_day_ready: 'dayNumber',
      devotional_reflection_prompt: 'questionText',
      devotional_verse_revisit: 'verseText',
      prayer_request_care: '_prayerRequestNames',
      prayer_answered_check: '_unansweredPrayerId',
    };

    const requiredKey = dataRequired[type];
    if (requiredKey) {
      const val = ctx[requiredKey];
      const missing = Array.isArray(val) ? val.length === 0 : !val;
      if (missing) {
        return { title: '', message: '', debug: `missing:${requiredKey} | ${debugInfo}` };
      }
    }

    const copy = buildSmartNotificationCopy(type, resolvedCtx);
    const deepLink = NotificationTester.generateDeepLinkForType(type, resolvedCtx);

    await pushNotificationService.scheduleLocalNotification({
      title: copy.title,
      message: copy.message,
      data: { deep_link: deepLink, test: true, notification_type: type },
      priority: 'high',
    }, new Date(Date.now() + 2000));

    return { title: copy.title, message: copy.message, debug: debugInfo };
  }

  /**
   * Fetch the user's actual notification_queue rows from Supabase.
   */
  static async fetchMyQueue(userId: string): Promise<any[]> {
    const { supabase } = await import('../services/supabaseClient');
    const { data } = await supabase
      .from('notification_queue')
      .select('id, type, title, message, status, scheduled_for, created_at')
      .eq('user_id', userId)
      .order('scheduled_for', { ascending: false })
      .limit(50);
    return data || [];
  }

  /**
   * Fetch the user's notification history rows from the notifications table.
   */
  static async fetchMyHistory(userId: string): Promise<any[]> {
    const { supabase } = await import('../services/supabaseClient');
    const { data } = await supabase
      .from('notifications')
      .select('id, type, title, message, is_read, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);
    return data || [];
  }

  /**
   * Send a test notification immediately
   */
  static async sendTestNotification(userId: string, userName: string = 'Friend'): Promise<void> {
    try {
      Logger.info('🧪 Sending test notification', {
        component: 'NotificationTester',
        userId,
      });

      await pushNotificationService.scheduleLocalNotification({
        title: `Test Notification for ${userName}! 🔔`,
        message: 'If you see this, notifications are working! Tap to open siFia.',
        data: {
          deep_link: 'sifia://dashboard',
          test: true,
        },
        priority: 'high',
      }, new Date(Date.now() + 3000)); // 3 seconds from now

      Logger.info('✅ Test notification scheduled', {
        component: 'NotificationTester',
      });
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Force schedule all notifications for a user (bypass time checks)
   */
  static async forceScheduleAllNotifications(userId: string): Promise<void> {
    try {
      Logger.info('🔄 Force scheduling all notifications', {
        component: 'NotificationTester',
        userId,
      });

      // Clear last scheduled timestamp to allow re-scheduling
      await AsyncStorage.removeItem('notifications:lastScheduled');

      // Schedule all notifications
      await DailyNotificationScheduler.forceReschedule(userId);

      Logger.info('✅ All notifications force scheduled', {
        component: 'NotificationTester',
      });
    } catch (error) {
      Logger.error('Failed to force schedule notifications', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Check notification queue for a user
   */
  static async checkNotificationQueue(userId: string): Promise<any[]> {
    try {
      Logger.info('📋 Checking notification queue', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');

      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .order('scheduled_for', { ascending: true });

      if (error) {
        throw error;
      }

      Logger.info(`Found ${data?.length || 0} notifications in queue`, {
        component: 'NotificationTester',
        count: data?.length || 0,
      });

      return data || [];
    } catch (error) {
      Logger.error('Failed to check notification queue', error as Error, {
        component: 'NotificationTester',
      });
      return [];
    }
  }

  /**
   * Get notification delivery stats
   */
  static async getDeliveryStats(userId: string): Promise<any> {
    try {
      const { supabase } = await import('../services/supabaseClient');

      const { data, error } = await supabase
        .from('notification_queue')
        .select('status')
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      const stats = {
        total: data?.length || 0,
        pending: data?.filter(n => n.status === 'pending').length || 0,
        sent: data?.filter(n => n.status === 'sent').length || 0,
        failed: data?.filter(n => n.status === 'failed').length || 0,
      };

      Logger.info('📊 Notification delivery stats', {
        component: 'NotificationTester',
        stats,
      });

      return stats;
    } catch (error) {
      Logger.error('Failed to get delivery stats', error as Error, {
        component: 'NotificationTester',
      });
      return { total: 0, pending: 0, sent: 0, failed: 0 };
    }
  }

  /**
   * Clear all pending notifications for a user
   */
  static async clearPendingNotifications(userId: string): Promise<void> {
    try {
      Logger.info('🗑️ Clearing pending notifications', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');

      const { error } = await supabase
        .from('notification_queue')
        .delete()
        .eq('user_id', userId)
        .eq('status', 'pending');

      if (error) {
        throw error;
      }

      Logger.info('✅ Pending notifications cleared', {
        component: 'NotificationTester',
      });
    } catch (error) {
      Logger.error('Failed to clear pending notifications', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test notification permissions
   */
  static async checkPermissions(): Promise<any> {
    try {
      const permissions = await pushNotificationService.checkPermissions();

      Logger.info('🔐 Notification permissions', {
        component: 'NotificationTester',
        permissions,
      });

      return permissions;
    } catch (error) {
      Logger.error('Failed to check permissions', error as Error, {
        component: 'NotificationTester',
      });
      return null;
    }
  }

  /**
   * Get device token status
   */
  static async checkDeviceToken(): Promise<string | null> {
    try {
      const token = await pushNotificationService.getStoredToken();

      if (token) {
        Logger.info('📱 Device token found', {
          component: 'NotificationTester',
          tokenPreview: token.substring(0, 20) + '...',
        });
      } else {
        Logger.warn('⚠️ No device token found', {
          component: 'NotificationTester',
        });
      }

      return token;
    } catch (error) {
      Logger.error('Failed to check device token', error as Error, {
        component: 'NotificationTester',
      });
      return null;
    }
  }

  /**
   * Run full notification diagnostic
   */
  static async runDiagnostic(userId: string): Promise<any> {
    try {
      Logger.info('🔍 Running notification diagnostic', {
        component: 'NotificationTester',
        userId,
      });

      const results = {
        permissions: await this.checkPermissions(),
        deviceToken: await this.checkDeviceToken(),
        queueStats: await this.getDeliveryStats(userId),
        pendingNotifications: await this.checkNotificationQueue(userId),
      };

      Logger.info('✅ Diagnostic complete', {
        component: 'NotificationTester',
        results,
      });

      return results;
    } catch (error) {
      Logger.error('Diagnostic failed', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test multiple devotional notifications
   */
  static async testMultipleDevotionals(userId: string): Promise<number> {
    try {
      Logger.info('🧪 Testing multiple devotional notifications', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');
      const { data: devotionals } = await supabase
        .from('devotionals')
        .select('id, title, total_days, days')
        .eq('user_id', userId)
        .eq('completed', false);

      const incompleteDevotionals = devotionals || [];
      let count = 0;

      for (const devotional of incompleteDevotionals.slice(0, 3)) {
        const days = Array.isArray(devotional.days) ? devotional.days : [];
        const incompleteDay = days.find((d: any) => d?.completed !== true) || days[0];

        if (incompleteDay) {
          const dayNumber = typeof incompleteDay.dayNumber === 'number' ? incompleteDay.dayNumber : days.indexOf(incompleteDay) + 1;
          const copy = buildSmartNotificationCopy('devotional_day_ready', {
            dayNumber,
            totalDays: devotional.total_days || days.length,
            title: devotional.total_days === 1 ? devotional.title : incompleteDay.title,
          });

          await pushNotificationService.scheduleLocalNotification({
            title: copy.title,
            message: copy.message,
            data: { deep_link: 'sifia://dashboard', test: true, notification_type: 'devotional_day_ready' },
            priority: 'high',
          }, new Date(Date.now() + count * 3000));

          count++;
        }
      }

      Logger.info(`✅ Tested ${count} devotional notifications`, {
        component: 'NotificationTester',
      });

      return count;
    } catch (error) {
      Logger.error('Failed to test multiple devotionals', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test multiple faithful actions notifications
   */
  static async testMultipleFaithfulActions(userId: string): Promise<number> {
    try {
      Logger.info('🧪 Testing multiple faithful actions notifications', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');
      const { getPlaybooks } = await import('../services/modernPlaybookApi');

      const playbooks = await getPlaybooks(userId).catch(() => []);
      const ongoingPlaybook = playbooks.find((pb: any) => pb.status !== 'completed' && !pb.completedAt);

      if (!ongoingPlaybook) {
        Logger.warn('No ongoing playbook found', { component: 'NotificationTester' });
        return 0;
      }

      const ids = [ongoingPlaybook.id];
      const { data: stepsData } = await supabase
        .from('playbook_action_steps')
        .select('id, text, order_index, playbook_sub_tasks(text, completed)')
        .in('playbook_id', ids)
        .order('order_index', { ascending: true })
        .limit(10);

      const allSteps = stepsData || [];

      // Collect incomplete steps
      const incompleteSteps = allSteps.filter((step: any) => {
        if (step.completed === true) { return false; }
        const subTasks = step.playbook_sub_tasks || [];
        return subTasks.length === 0 || subTasks.some((st: any) => st.completed !== true);
      });

      if (incompleteSteps.length === 0) {
        Logger.warn('No incomplete steps found', { component: 'NotificationTester' });
        return 0;
      }

      // Pick one at random
      const randomStep = incompleteSteps[Math.floor(Math.random() * incompleteSteps.length)] as any;
      const actionText = randomStep.text?.replace(/\*\*|__|\*/g, '').replace(/<[^>]*>/g, '').trim() || '';
      const copy = buildSmartNotificationCopy('playbook_faithful_action', { actionText });

      await pushNotificationService.scheduleLocalNotification({
        title: copy.title,
        message: copy.message,
        data: { deep_link: 'sifia://dashboard', test: true, notification_type: 'playbook_faithful_action' },
        priority: 'high',
      }, new Date(Date.now() + 1000));

      const count = 1;

      Logger.info(`✅ Tested ${count} faithful action notifications`, {
        component: 'NotificationTester',
      });

      return count;
    } catch (error) {
      Logger.error('Failed to test multiple faithful actions', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test playbook actions complete notification
   */
  static async testPlaybookActionsComplete(userId: string): Promise<number> {
    try {
      Logger.info('🧪 Testing playbook actions complete notification', {
        component: 'NotificationTester',
        userId,
      });

      const { getPlaybooks } = await import('../services/modernPlaybookApi');

      const playbooks = await getPlaybooks(userId).catch(() => []);
      const ongoingPlaybook = playbooks.find((pb: any) => pb.status !== 'completed' && !pb.completedAt);

      if (!ongoingPlaybook) {
        Logger.warn('No ongoing playbook found', { component: 'NotificationTester' });
        return 0;
      }

      const copy = buildSmartNotificationCopy('playbook_actions_complete', { title: ongoingPlaybook.title });

      await pushNotificationService.scheduleLocalNotification({
        title: copy.title,
        message: copy.message,
        data: { deep_link: `sifia://playbooks/${ongoingPlaybook.id}`, test: true, notification_type: 'playbook_actions_complete' },
        priority: 'high',
      }, new Date(Date.now() + 1000));

      const count = 1;

      Logger.info(`✅ Tested ${count} playbook actions complete notifications`, {
        component: 'NotificationTester',
      });

      return count;
    } catch (error) {
      Logger.error('Failed to test playbook actions complete', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test playbook actions milestone notification
   */
  static async testPlaybookActionsMilestone(userId: string): Promise<number> {
    try {
      Logger.info('🧪 Testing playbook actions milestone notification', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');
      const { getPlaybooks } = await import('../services/modernPlaybookApi');

      const playbooks = await getPlaybooks(userId).catch(() => []);
      const ongoingPlaybook = playbooks.find((pb: any) => pb.status !== 'completed' && !pb.completedAt);

      if (!ongoingPlaybook) {
        Logger.warn('No ongoing playbook found', { component: 'NotificationTester' });
        return 0;
      }

      const ids = [ongoingPlaybook.id];
      const { data: stepsData } = await supabase
        .from('playbook_action_steps')
        .select('id, completed')
        .in('playbook_id', ids);

      const allSteps = stepsData || [];
      const completedCount = allSteps.filter((step: any) => step.completed === true).length;
      const totalCount = allSteps.length;

      if (totalCount === 0 || completedCount < 4) {
        Logger.warn('Not enough completed actions for milestone', { component: 'NotificationTester', completedCount, totalCount });
        return 0;
      }

      const copy = buildSmartNotificationCopy('playbook_actions_milestone', {
        title: ongoingPlaybook.title,
        completedCount,
        totalCount,
      });

      await pushNotificationService.scheduleLocalNotification({
        title: copy.title,
        message: copy.message,
        data: { deep_link: `sifia://playbooks/${ongoingPlaybook.id}`, test: true, notification_type: 'playbook_actions_milestone' },
        priority: 'high',
      }, new Date(Date.now() + 1000));

      const count = 1;

      Logger.info(`✅ Tested ${count} playbook actions milestone notifications`, {
        component: 'NotificationTester',
      });

      return count;
    } catch (error) {
      Logger.error('Failed to test playbook actions milestone', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test bible verse rotation with tracking
   */
  static async testBibleVerseRotation(userId: string): Promise<void> {
    try {
      Logger.info('🧪 Testing bible verse rotation', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');
      const { getPlaybooks } = await import('../services/modernPlaybookApi');

      const playbooks = await getPlaybooks(userId).catch(() => []);
      const playbooksWithVerses = playbooks.filter((pb: any) => pb.bible_verse?.text);

      if (playbooksWithVerses.length === 0) {
        Logger.warn('No playbooks with verses found', { component: 'NotificationTester' });
        return;
      }

      // Get tracking data
      const { data: userData } = await supabase
        .from('user_profiles')
        .select('metadata')
        .eq('user_id', userId)
        .single();

      const userMetadata = userData?.metadata as Record<string, unknown> || {};
      const notifiedVerses = (userMetadata.notified_verses as string[]) || [];

      // Find available verses
      const availableVerses = playbooksWithVerses.filter((pb: any) => !notifiedVerses.includes(pb.id));

      if (availableVerses.length === 0) {
        Logger.info('All verses have been notified - resetting tracking', {
          component: 'NotificationTester',
        });

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

        return;
      }

      // Select first available verse
      const verseSource = availableVerses[0];
      const verseReference = (verseSource as any).bible_verse?.reference?.replace(/\*\*|__|\*/g, '').trim() || '';
      const verseText = (verseSource as any).bible_verse?.text?.replace(/\*\*|__|\*/g, '').trim() || '';

      const copy = buildSmartNotificationCopy('playbook_verse_revisit', {
        verseReference,
        verseText,
      });

      await pushNotificationService.scheduleLocalNotification({
        title: copy.title,
        message: copy.message,
        data: { deep_link: 'sifia://dashboard', test: true, notification_type: 'playbook_verse_revisit' },
        priority: 'high',
      }, new Date(Date.now() + 3000));

      // Mark as notified
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

      Logger.info('✅ Bible verse rotation test complete', {
        component: 'NotificationTester',
        verseId: verseSource.id,
        totalNotified: updatedNotifiedVerses.length,
      });
    } catch (error) {
      Logger.error('Failed to test bible verse rotation', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test multiple words to speak notifications throughout the day
   */
  static async testMultipleWordsToSpeak(userId: string): Promise<number> {
    try {
      Logger.info('🧪 Testing multiple words to speak notifications', {
        component: 'NotificationTester',
        userId,
      });

      const { getPlaybooks } = await import('../services/modernPlaybookApi');

      const playbooks = await getPlaybooks(userId).catch(() => []);
      const playbooksWithWords = playbooks.filter((pb: any) => {
        const words = pb.wordToSpeak || pb.directChallenge?.wordToSpeak || pb.affirmations;
        return words && (Array.isArray(words) ? words.length > 0 : String(words).trim().length > 0);
      });

      if (playbooksWithWords.length === 0) {
        Logger.warn('No playbooks with words to speak found', { component: 'NotificationTester' });
        return 0;
      }

      const timeWindows = ['morning', 'midday', 'afternoon', 'evening', 'night'] as const;
      let count = 0;

      for (const timeWindow of timeWindows) {
        if (count >= playbooksWithWords.length) {break;}

        const playbook = playbooksWithWords[count];
        let words: string[] = [];

        if ((playbook as any).wordToSpeak) {
          words = String((playbook as any).wordToSpeak).split(/\n+/).map(w => w.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
        } else if ((playbook as any).directChallenge?.wordToSpeak) {
          words = String((playbook as any).directChallenge.wordToSpeak).split(/\n+/).map(w => w.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
        } else if ((playbook as any).affirmations) {
          words = (playbook as any).affirmations.map((a: any) => a.text?.trim()).filter(Boolean);
        }

        if (words.length === 0) {continue;}

        const wordIndex = (new Date().getDate() + count) % words.length;
        const wordToSpeak = words[wordIndex];

        const copy = buildSmartNotificationCopy('playbook_word_to_speak', { wordToSpeak });

        await pushNotificationService.scheduleLocalNotification({
          title: copy.title,
          message: copy.message,
          data: { deep_link: 'sifia://dashboard', test: true, notification_type: 'playbook_word_to_speak', time_window: timeWindow },
          priority: 'high',
        }, new Date(Date.now() + count * 3000));

        count++;
      }

      Logger.info(`✅ Tested ${count} words to speak notifications`, {
        component: 'NotificationTester',
      });

      return count;
    } catch (error) {
      Logger.error('Failed to test multiple words to speak', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Test smart notification engine with multiple candidates
   */
  static async testSmartNotificationEngine(userId: string): Promise<any> {
    try {
      Logger.info('🧪 Testing smart notification engine', {
        component: 'NotificationTester',
        userId,
      });

      const { smartNotificationEngine } = await import('../services/notifications/smartNotificationEngine');

      const decision = await smartNotificationEngine.scheduleForUser(userId);

      Logger.info('✅ Smart notification engine test complete', {
        component: 'NotificationTester',
        candidateCount: decision.candidates.length,
        selectedCount: decision.selected.length,
        cancelledCount: decision.cancelledStaleIds.length,
      });

      return decision;
    } catch (error) {
      Logger.error('Failed to test smart notification engine', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }

  /**
   * Reset bible verse tracking for testing
   */
  static async resetVerseTracking(userId: string): Promise<void> {
    try {
      Logger.info('🔄 Resetting bible verse tracking', {
        component: 'NotificationTester',
        userId,
      });

      const { supabase } = await import('../services/supabaseClient');

      const { data: userData } = await supabase
        .from('user_profiles')
        .select('metadata')
        .eq('user_id', userId)
        .single();

      const userMetadata = userData?.metadata as Record<string, unknown> || {};

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

      Logger.info('✅ Bible verse tracking reset', {
        component: 'NotificationTester',
      });
    } catch (error) {
      Logger.error('Failed to reset verse tracking', error as Error, {
        component: 'NotificationTester',
      });
      throw error;
    }
  }
}
