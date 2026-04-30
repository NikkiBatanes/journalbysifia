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
  private static async buildRealContext(userId: string): Promise<Record<string, any>> {
    const { supabase } = await import('../services/supabaseClient');

    const [playbooksResult, devotionalsResult, prayersResult, subscriptionResult] = await Promise.all([
      supabase
        .from('playbooks')
        .select('id, title, status, completed_at, bible_verse, word_to_speak, direct_challenge, playbook_action_steps(id, text, order_index), playbook_affirmations(id, text, order_index)')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('devotionals')
        .select('id, title, total_days, days')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('prayers')
        .select('id, person_name')
        .eq('user_id', userId)
        .eq('is_prayer_request', true)
        .or('prayed.is.null,prayed.eq.false')
        .limit(5),
      supabase
        .from('user_subscriptions_new')
        .select('tier, playbooks_used, playbooks_limit, devotionals_used, devotionals_limit, subscription_start_date')
        .eq('user_id', userId)
        .maybeSingle(),
    ]);

    const playbooks: any[] = playbooksResult.data || [];
    const devotionals: any[] = devotionalsResult.data || [];
    const prayers: any[] = prayersResult.data || [];
    const sub = subscriptionResult.data;

    const safeStr = (v: unknown): string =>
      typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '';

    const stripMarkdown = (v: string): string =>
      v.replace(/\*\*|__|\*/g, '').replace(/<[^>]*>/g, '').trim();

    const getWords = (pb: any): string[] => {
      // dedicated column first
      const direct = safeStr(pb.word_to_speak).split(/\n+/).map((l: string) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
      if (direct.length) return direct.slice(0, 5);
      // piggybacked in direct_challenge JSONB
      try {
        const dc = typeof pb.direct_challenge === 'string' ? JSON.parse(pb.direct_challenge) : pb.direct_challenge;
        if (dc && typeof dc === 'object' && dc.wordToSpeak) {
          const words = safeStr(dc.wordToSpeak).split(/\n+/).map((l: string) => l.replace(/^[-*]\s*/, '').trim()).filter(Boolean);
          if (words.length) return words.slice(0, 5);
        }
      } catch {}
      // affirmations fallback
      const aff = (pb.playbook_affirmations || [])
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((a: any) => safeStr(a.text)).filter(Boolean);
      return aff.slice(0, 5);
    };

    const getPrayer = (pb: any): string => {
      if (safeStr(pb.prayer)) return safeStr(pb.prayer);
      try {
        const dc = typeof pb.direct_challenge === 'string' ? JSON.parse(pb.direct_challenge) : pb.direct_challenge;
        if (dc && typeof dc === 'object' && dc.prayer) return safeStr(dc.prayer);
      } catch {}
      return '';
    };

    const getBibleVerse = (pb: any): { reference: string; text: string } => {
      try {
        const bv = typeof pb.bible_verse === 'string' ? JSON.parse(pb.bible_verse) : pb.bible_verse;
        if (bv && typeof bv === 'object') return { reference: safeStr(bv.reference), text: safeStr(bv.text) };
      } catch {}
      return { reference: '', text: '' };
    };

    // Pick the best playbook: in-progress first, then any
    const inProgressPlaybook = playbooks.find(pb => pb.status !== 'completed' && !pb.completed_at);
    const anyPlaybook = playbooks[0];

    // Playbook with words (in-progress first)
    const pbWithWords = playbooks.find(pb => pb.status !== 'completed' && !pb.completed_at && getWords(pb).length > 0)
      || playbooks.find(pb => getWords(pb).length > 0);

    // Playbook with action steps
    const pbWithActions = playbooks.find(pb => (pb.playbook_action_steps || []).length > 0);

    // Playbook with verse
    const pbWithVerse = playbooks.find(pb => getBibleVerse(pb).text);

    // Playbook with prayer
    const pbWithPrayer = playbooks.find(pb => getPrayer(pb));

    // Active devotional
    const activeDevotional = devotionals.find(d => {
      const days: any[] = Array.isArray(d.days) ? d.days : [];
      return days.some((day: any) => day?.completed !== true);
    }) || devotionals[0];

    const ctx: Record<string, any> = {};

    // Devotional context
    if (activeDevotional) {
      const days: any[] = Array.isArray(activeDevotional.days) ? activeDevotional.days : [];
      const incompleteDay = days.find((d: any) => d?.completed !== true) || days[days.length - 1];
      const completedDay = [...days].reverse().find((d: any) => d?.completed === true);
      const dayObj = incompleteDay || days[0];
      if (dayObj) {
        ctx.dayNumber = typeof dayObj.dayNumber === 'number' ? dayObj.dayNumber : days.indexOf(dayObj) + 1;
        ctx.totalDays = activeDevotional.total_days || days.length;
        const bv = dayObj.scripture;
        if (bv) {
          ctx.verseReference = stripMarkdown(safeStr(bv.reference));
          ctx.verseText = stripMarkdown(safeStr(bv.text));
        }
        const q = (dayObj.reflectionQuestions || []).find((q: any) => safeStr(q?.text));
        if (q) ctx.questionText = stripMarkdown(safeStr(q.text));
      }
      if (completedDay) {
        const bv = completedDay.scripture;
        if (bv && !ctx.verseText) {
          ctx.verseReference = stripMarkdown(safeStr(bv.reference));
          ctx.verseText = stripMarkdown(safeStr(bv.text));
        }
      }
    }

    // Playbook word to speak
    if (pbWithWords) {
      const words = getWords(pbWithWords);
      const word = words[new Date().getDate() % words.length];
      ctx.wordToSpeak = stripMarkdown(word);
    }

    // Playbook action
    if (pbWithActions) {
      const steps = (pbWithActions.playbook_action_steps || [])
        .sort((a: any, b: any) => (a.order_index ?? 0) - (b.order_index ?? 0));
      const step = steps[0];
      if (step) ctx.actionText = stripMarkdown(safeStr(step.text));
    }

    // Playbook verse (prefer devotional verse, then playbook verse)
    if (pbWithVerse && !ctx.verseText) {
      const bv = getBibleVerse(pbWithVerse);
      ctx.verseReference = bv.reference;
      ctx.verseText = bv.text;
    }

    // Prayer request
    if (prayers.length > 0) {
      ctx.personName = safeStr(prayers[0].person_name) || undefined;
    }

    // Subscription usage
    if (sub) {
      const pbRemaining = (sub.playbooks_limit ?? 0) < 0
        ? 99
        : Math.max(0, (sub.playbooks_limit ?? 0) - (sub.playbooks_used ?? 0));
      const devRemaining = (sub.devotionals_limit ?? 0) < 0
        ? 99
        : Math.max(0, (sub.devotionals_limit ?? 0) - (sub.devotionals_used ?? 0));
      ctx.remainingCount = Math.min(pbRemaining, devRemaining);

      const anchor = new Date(sub.subscription_start_date || new Date());
      const nextReset = new Date(anchor);
      while (nextReset <= new Date()) nextReset.setMonth(nextReset.getMonth() + 1);
      ctx.refreshDate = nextReset.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    }

    // Heart journal — pick a playbook title as the question theme
    if (anyPlaybook?.title) {
      ctx.heartJournalTitle = `How is God meeting you in "${anyPlaybook.title}"?`;
    }

    return ctx;
  }

  /**
   * Send a single notification type using real user data. No gating conditions —
   * fetches actual playbook/devotional/prayer content directly.
   * Returns null if no relevant real data exists for that type.
   */
  static async sendSingleTypeTest(
    type: SmartNotificationType,
    userId?: string,
  ): Promise<{ title: string; message: string } | null> {
    let ctx: Record<string, any> = {};

    if (userId) {
      try {
        ctx = await NotificationTester.buildRealContext(userId);
      } catch (e) {
        Logger.warn('[NotificationTester] Failed to fetch real context', { component: 'NotificationTester', error: e });
      }
    }

    // Check if this type has real data to show
    const dataRequired: Partial<Record<SmartNotificationType, keyof typeof ctx>> = {
      playbook_word_to_speak: 'wordToSpeak',
      playbook_faithful_action: 'actionText',
      playbook_verse_revisit: 'verseText',
      devotional_day_ready: 'dayNumber',
      devotional_reflection_prompt: 'questionText',
      devotional_verse_revisit: 'verseText',
      prayer_request_care: 'personName',
    };

    const requiredKey = dataRequired[type];
    if (requiredKey && !ctx[requiredKey]) {
      return null;
    }

    const copy = buildSmartNotificationCopy(type, ctx);

    await pushNotificationService.scheduleLocalNotification({
      title: copy.title,
      message: copy.message,
      data: { deep_link: 'sifia://dashboard', test: true, notification_type: type },
      priority: 'high',
    }, new Date(Date.now() + 2000));

    return { title: copy.title, message: copy.message };
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
