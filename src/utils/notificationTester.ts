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

    const strip = (v: string) => v.replace(/\*\*|__|\*/g, '').replace(/<[^>]*>/g, '').trim();
    const safeStr = (v: unknown): string =>
      typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';

    const [playbooks, devotionalsResult, prayersResult, subResult] = await Promise.all([
      getPlaybooks(userId).catch(() => [] as any[]),
      supabase.from('devotionals').select('id, title, total_days, days').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
      supabase.from('prayers').select('id, person_name').eq('user_id', userId).eq('is_prayer_request', true).or('prayed.is.null,prayed.eq.false').limit(5),
      supabase.from('user_subscriptions_new').select('playbooks_used, playbooks_limit, devotionals_used, devotionals_limit, subscription_start_date').eq('user_id', userId).maybeSingle(),
    ]);

    const devotionals: any[] = devotionalsResult.data || [];
    const prayers: any[] = prayersResult.data || [];
    const sub = subResult.data;

    // Extract wordToSpeak from Playbook object (wordToSpeak field or directChallenge JSONB)
    const getWords = (pb: any): string[] => {
      if (pb.wordToSpeak) {
        const lines = String(pb.wordToSpeak).split(/\n+/).map((l: string) => strip(l.replace(/^[-*]\s*/, '').trim())).filter(Boolean);
        if (lines.length) return lines.slice(0, 5);
      }
      const dc = pb.directChallenge;
      if (dc && typeof dc === 'object' && dc.wordToSpeak) {
        const lines = String(dc.wordToSpeak).split(/\n+/).map((l: string) => strip(l.replace(/^[-*]\s*/, '').trim())).filter(Boolean);
        if (lines.length) return lines.slice(0, 5);
      }
      return (pb.affirmations || []).map((a: any) => strip(safeStr(a.text))).filter(Boolean).slice(0, 5);
    };

    const getPrayer = (pb: any): string => {
      if (pb.prayer) return strip(String(pb.prayer));
      const dc = pb.directChallenge;
      if (dc && typeof dc === 'object' && dc.prayer) return strip(String(dc.prayer));
      return '';
    };

    const getVerse = (pb: any): { reference: string; text: string } => {
      const bv = pb.bibleVerse || pb.bible_verse;
      if (bv && typeof bv === 'object') return { reference: strip(safeStr(bv.reference)), text: strip(safeStr(bv.text)) };
      return { reference: '', text: '' };
    };

    const pbWithWords = playbooks.find((pb: any) => pb.status !== 'completed' && !pb.completedAt && getWords(pb).length > 0)
      || playbooks.find((pb: any) => getWords(pb).length > 0);
    const pbWithVerse = playbooks.find((pb: any) => getVerse(pb).text);

    // Action steps live in a separate table — fetch them using playbook IDs
    let actionText = '';
    if (playbooks.length > 0) {
      const ids = playbooks.map((pb: any) => pb.id);
      const { data: stepsData } = await supabase
        .from('playbook_action_steps')
        .select('text, order_index')
        .in('playbook_id', ids)
        .order('order_index', { ascending: true })
        .limit(10);
      const firstStep = (stepsData || []).find((s: any) => s.text?.trim());
      if (firstStep) actionText = strip(String(firstStep.text));
    }

    const activeDevotional = devotionals.find((d: any) => {
      const days: any[] = Array.isArray(d.days) ? d.days : [];
      return days.some((day: any) => day?.completed !== true);
    }) || devotionals[0];

    const ctx: Record<string, any> = {};

    if (activeDevotional) {
      const days: any[] = Array.isArray(activeDevotional.days) ? activeDevotional.days : [];
      const dayObj = days.find((d: any) => d?.completed !== true) || days[days.length - 1] || days[0];
      if (dayObj) {
        ctx.dayNumber = typeof dayObj.dayNumber === 'number' ? dayObj.dayNumber : days.indexOf(dayObj) + 1;
        ctx.totalDays = activeDevotional.total_days || days.length;
        ctx.title = ctx.totalDays === 1 ? activeDevotional.title : dayObj.title;
        const bv = dayObj.scripture;
        if (bv) { ctx.verseReference = strip(safeStr(bv.reference)); ctx.verseText = strip(safeStr(bv.text)); }
        const q = (dayObj.reflectionQuestions || []).find((q: any) => safeStr(q?.text));
        if (q) ctx.questionText = strip(safeStr(q.text));
      }
    }

    if (pbWithWords) {
      const words = getWords(pbWithWords);
      ctx.wordToSpeak = words[new Date().getDate() % words.length];
    }

    if (actionText) ctx.actionText = actionText;

    // Store playbook verse separately so it isn't overwritten by devotional verse
    if (pbWithVerse) {
      const bv = getVerse(pbWithVerse);
      ctx._playbookVerseReference = bv.reference;
      ctx._playbookVerseText = bv.text;
    }

    // devotional verse is already in ctx.verseText / ctx.verseReference from the devotional block above

    if (prayers.length > 0) ctx.personName = safeStr(prayers[0].person_name) || undefined;

    if (sub) {
      const pbRem = (sub.playbooks_limit ?? 0) < 0 ? 99 : Math.max(0, (sub.playbooks_limit ?? 0) - (sub.playbooks_used ?? 0));
      const devRem = (sub.devotionals_limit ?? 0) < 0 ? 99 : Math.max(0, (sub.devotionals_limit ?? 0) - (sub.devotionals_used ?? 0));
      ctx.remainingCount = Math.min(pbRem, devRem);
      const anchor = new Date(sub.subscription_start_date || new Date());
      const next = new Date(anchor);
      while (next <= new Date()) next.setMonth(next.getMonth() + 1);
      ctx.refreshDate = next.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    if (playbooks[0]?.title) ctx.heartJournalTitle = `How is God meeting you in "${playbooks[0].title}"?`;

    const debug = [
      `uid:${userId.slice(0, 8)}`,
      `pbs:${playbooks.length}`,
      `words:${ctx.wordToSpeak ? String(ctx.wordToSpeak).slice(0, 25) : 'none'}`,
      `action:${ctx.actionText ? String(ctx.actionText).slice(0, 25) : 'none'}`,
      `verse:${ctx.verseText ? String(ctx.verseText).slice(0, 25) : 'none'}`,
      `devs:${devotionals.length}`,
    ].join(' | ');

    return { ctx, debug };
  }

  /**
   * Send a single notification type using real user data. No gating conditions —
   * fetches actual playbook/devotional/prayer content directly.
   * Returns null if no relevant real data exists for that type.
   */
  static async sendSingleTypeTest(
    type: SmartNotificationType,
    userId?: string,
  ): Promise<{ title: string; message: string; debug?: string } | null> {
    let ctx: Record<string, any> = {};
    let debugInfo = '';

    if (userId) {
      try {
        const result = await NotificationTester.buildRealContext(userId);
        ctx = result.ctx;
        debugInfo = result.debug;
      } catch (e) {
        Logger.warn('[NotificationTester] Failed to fetch real context', { component: 'NotificationTester', error: e });
        debugInfo = `fetch error: ${(e as any)?.message ?? e}`;
      }
    }

    // For playbook verse types, use playbook verse (not devotional verse)
    const resolvedCtx = { ...ctx };
    if (type === 'playbook_verse_revisit') {
      resolvedCtx.verseText = ctx._playbookVerseText;
      resolvedCtx.verseReference = ctx._playbookVerseReference;
    }

    // Check if this type has real data to show
    const dataRequired: Partial<Record<SmartNotificationType, string>> = {
      playbook_word_to_speak: 'wordToSpeak',
      playbook_faithful_action: 'actionText',
      playbook_verse_revisit: '_playbookVerseText',
      devotional_day_ready: 'dayNumber',
      devotional_reflection_prompt: 'questionText',
      devotional_verse_revisit: 'verseText',
      prayer_request_care: 'personName',
    };

    const requiredKey = dataRequired[type];
    if (requiredKey && !ctx[requiredKey]) {
      return { title: '', message: '', debug: `missing:${requiredKey} | ${debugInfo}` };
    }

    const copy = buildSmartNotificationCopy(type, resolvedCtx);

    await pushNotificationService.scheduleLocalNotification({
      title: copy.title,
      message: copy.message,
      data: { deep_link: 'sifia://dashboard', test: true, notification_type: type },
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
}
