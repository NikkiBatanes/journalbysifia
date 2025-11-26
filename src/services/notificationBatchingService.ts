import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';

/**
 * Notification Batching Service
 * Groups similar notifications to reduce notification fatigue
 * and improve user experience
 */

interface BatchableNotification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data?: any;
  scheduled_for: string;
  priority: string;
}

interface BatchedNotification {
  type: string;
  title: string;
  message: string;
  data: any;
  count: number;
  notification_ids: string[];
}

class NotificationBatchingService {
  // Notification types that can be batched together
  private readonly BATCHABLE_TYPES = [
    'prayer_reminder',
    'devotional_reminder',
    'journal_prompt',
    'playbook_step',
    'streak_alert',
    'reflection_question',
  ];

  // Time window for batching (in minutes)
  private readonly BATCH_WINDOW_MINUTES = 30;

  /**
   * Check if a notification type can be batched
   */
  canBatch(type: string): boolean {
    return this.BATCHABLE_TYPES.includes(type);
  }

  /**
   * Find pending notifications that can be batched together
   */
  async findBatchableNotifications(
    userId: string,
    notificationType: string
  ): Promise<BatchableNotification[]> {
    try {
      const now = new Date();
      const windowStart = new Date(now.getTime() - this.BATCH_WINDOW_MINUTES * 60 * 1000);
      const windowEnd = new Date(now.getTime() + this.BATCH_WINDOW_MINUTES * 60 * 1000);

      const { data, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('user_id', userId)
        .eq('type', notificationType)
        .eq('status', 'pending')
        .gte('scheduled_for', windowStart.toISOString())
        .lte('scheduled_for', windowEnd.toISOString())
        .order('scheduled_for', { ascending: true });

      if (error) {
        Logger.error('Failed to find batchable notifications', error as Error, {
          component: 'notificationBatchingService',
          userId,
          type: notificationType,
        });
        return [];
      }

      return (data || []) as BatchableNotification[];
    } catch (error) {
      Logger.error('Error finding batchable notifications', error as Error, {
        component: 'notificationBatchingService',
      });
      return [];
    }
  }

  /**
   * Create a batched notification from multiple notifications
   */
  createBatchedNotification(
    notifications: BatchableNotification[]
  ): BatchedNotification | null {
    if (notifications.length === 0) {
      return null;
    }

    if (notifications.length === 1) {
      // No batching needed for single notification
      return null;
    }

    const type = notifications[0].type;
    const count = notifications.length;
    const notificationIds = notifications.map(n => n.id);

    // Create batched message based on type
    const batched = this.generateBatchedMessage(type, count, notifications);

    return {
      ...batched,
      count,
      notification_ids: notificationIds,
    };
  }

  /**
   * Generate appropriate batched message based on notification type
   */
  private generateBatchedMessage(
    type: string,
    count: number,
    _notifications: BatchableNotification[]
  ): { type: string; title: string; message: string; data: any } {
    switch (type) {
      case 'prayer_reminder':
        return {
          type: 'batched_prayer_reminders',
          title: `${count} Prayer Reminders 🙏`,
          message: `You have ${count} prayer reminders waiting for you.`,
          data: {
            deep_link: 'sifia://journal/prayer',
            batched: true,
            original_count: count,
          },
        };

      case 'devotional_reminder':
        return {
          type: 'batched_devotional_reminders',
          title: `${count} Devotionals Ready 🤲🏼`,
          message: `${count} devotionals are waiting for you to explore.`,
          data: {
            deep_link: 'sifia://devotionals',
            batched: true,
            original_count: count,
          },
        };

      case 'journal_prompt':
        return {
          type: 'batched_journal_prompts',
          title: `${count} Journal Prompts ✍🏼`,
          message: `${count} reflection prompts are ready for you.`,
          data: {
            deep_link: 'sifia://journal',
            batched: true,
            original_count: count,
          },
        };

      case 'playbook_step':
        return {
          type: 'batched_playbook_steps',
          title: `${count} Playbook Updates 📋`,
          message: `You have ${count} new playbook steps to explore.`,
          data: {
            deep_link: 'sifia://playbooks',
            batched: true,
            original_count: count,
          },
        };

      case 'streak_alert':
        return {
          type: 'batched_streak_alerts',
          title: `${count} Streak Updates 🔥`,
          message: `Check your progress on ${count} different streaks.`,
          data: {
            deep_link: 'sifia://profile/streaks',
            batched: true,
            original_count: count,
          },
        };

      case 'reflection_question':
        return {
          type: 'batched_reflection_questions',
          title: `${count} Reflection Questions 💭`,
          message: `${count} questions to help deepen your faith journey.`,
          data: {
            deep_link: 'sifia://journal/reflections',
            batched: true,
            original_count: count,
          },
        };

      default:
        return {
          type: `batched_${type}`,
          title: `${count} Notifications`,
          message: `You have ${count} new notifications.`,
          data: {
            batched: true,
            original_count: count,
          },
        };
    }
  }

  /**
   * Batch similar notifications together
   */
  async batchNotifications(
    userId: string,
    notificationType: string
  ): Promise<boolean> {
    try {
      // Find notifications that can be batched
      const notifications = await this.findBatchableNotifications(userId, notificationType);

      if (notifications.length < 2) {
        // No batching needed
        return false;
      }

      // Create batched notification
      const batched = this.createBatchedNotification(notifications);

      if (!batched) {
        return false;
      }

      Logger.info('Batching notifications', {
        component: 'notificationBatchingService',
        userId,
        type: notificationType,
        count: batched.count,
        originalIds: batched.notification_ids,
      });

      // Mark original notifications as batched
      const { error: updateError } = await supabase
        .from('notification_queue')
        .update({
          status: 'batched',
          updated_at: new Date().toISOString(),
        })
        .in('id', batched.notification_ids);

      if (updateError) {
        Logger.error('Failed to mark notifications as batched', updateError as Error, {
          component: 'notificationBatchingService',
        });
        return false;
      }

      // Create new batched notification
      const { error: insertError } = await supabase
        .from('notification_queue')
        .insert({
          user_id: userId,
          type: batched.type,
          title: batched.title,
          message: batched.message,
          data: {
            ...batched.data,
            batched_notification_ids: batched.notification_ids,
          },
          scheduled_for: notifications[0].scheduled_for, // Use earliest scheduled time
          priority: 'normal',
          status: 'pending',
        });

      if (insertError) {
        Logger.error('Failed to create batched notification', insertError as Error, {
          component: 'notificationBatchingService',
        });
        return false;
      }

      Logger.info('Successfully batched notifications', {
        component: 'notificationBatchingService',
        userId,
        type: batched.type,
        count: batched.count,
      });

      return true;
    } catch (error) {
      Logger.error('Error batching notifications', error as Error, {
        component: 'notificationBatchingService',
        userId,
        type: notificationType,
      });
      return false;
    }
  }

  /**
   * Process all pending notifications for batching
   */
  async processBatchingQueue(userId: string): Promise<void> {
    try {
      Logger.info('Processing batching queue', {
        component: 'notificationBatchingService',
        userId,
      });

      // Process each batchable type
      for (const type of this.BATCHABLE_TYPES) {
        await this.batchNotifications(userId, type);
      }

      Logger.info('Completed batching queue processing', {
        component: 'notificationBatchingService',
        userId,
      });
    } catch (error) {
      Logger.error('Error processing batching queue', error as Error, {
        component: 'notificationBatchingService',
        userId,
      });
    }
  }

  /**
   * Get batching statistics for analytics
   */
  async getBatchingStats(userId: string, days: number = 7): Promise<{
    totalBatched: number;
    notificationsSaved: number;
    batchedByType: Record<string, number>;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const { data, error } = await supabase
        .from('notification_queue')
        .select('type, data')
        .eq('user_id', userId)
        .eq('status', 'batched')
        .gte('created_at', startDate.toISOString());

      if (error) {
        throw error;
      }

      const stats = {
        totalBatched: data?.length || 0,
        notificationsSaved: 0,
        batchedByType: {} as Record<string, number>,
      };

      data?.forEach((item: any) => {
        const originalCount = item.data?.original_count || 0;
        stats.notificationsSaved += Math.max(0, originalCount - 1);

        const type = item.type.replace('batched_', '');
        stats.batchedByType[type] = (stats.batchedByType[type] || 0) + 1;
      });

      return stats;
    } catch (error) {
      Logger.error('Error getting batching stats', error as Error, {
        component: 'notificationBatchingService',
        userId,
      });
      return {
        totalBatched: 0,
        notificationsSaved: 0,
        batchedByType: {},
      };
    }
  }
}

export const notificationBatchingService = new NotificationBatchingService();
