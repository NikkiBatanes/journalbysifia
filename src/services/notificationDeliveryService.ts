import { supabase } from '../services/supabaseClient';
import { pushNotificationService } from '../services/pushNotificationService';
import { notificationAnalyticsService } from '../services/notificationAnalyticsService';
import { Logger } from '../utils/ProductionLogger';

/**
 * Notification Delivery Service
 * Processes pending notifications from the queue and delivers them
 */

class NotificationDeliveryService {
  private static instance: NotificationDeliveryService;
  private processingInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private readonly PROCESSING_INTERVAL = 30000; // 30 seconds

  static getInstance(): NotificationDeliveryService {
    if (!NotificationDeliveryService.instance) {
      NotificationDeliveryService.instance = new NotificationDeliveryService();
    }
    return NotificationDeliveryService.instance;
  }

  /**
   * Start the delivery service
   */
  start(): void {
    if (this.processingInterval) {
      Logger.info('Notification delivery service already running', {
        component: 'NotificationDeliveryService',
      });
      return;
    }

    Logger.info('Starting notification delivery service', {
      component: 'NotificationDeliveryService',
    });

    // Process immediately
    this.processPendingNotifications();

    // Set up interval for continuous processing
    this.processingInterval = setInterval(() => {
      this.processPendingNotifications();
    }, this.PROCESSING_INTERVAL);
  }

  /**
   * Stop the delivery service
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
      Logger.info('Notification delivery service stopped', {
        component: 'NotificationDeliveryService',
      });
    }
  }

  /**
   * Process all pending notifications (public for testing)
   */
  async processPendingNotifications(): Promise<void> {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;

    try {
      Logger.info('Processing pending notifications', {
        component: 'NotificationDeliveryService',
      });

      // Get all pending notifications that are due
      const now = new Date().toISOString();
      const { data: pendingNotifications, error } = await supabase
        .from('notification_queue')
        .select('*')
        .eq('status', 'pending')
        .lte('scheduled_for', now)
        .order('scheduled_for', { ascending: true })
        .limit(50);

      if (error) {
        Logger.error('Error fetching pending notifications', new Error(error.message || JSON.stringify(error)), {
          component: 'NotificationDeliveryService',
        });
        return;
      }

      if (!pendingNotifications || pendingNotifications.length === 0) {
        Logger.info('No pending notifications to process', {
          component: 'NotificationDeliveryService',
        });
        return;
      }

      Logger.info(`Found ${pendingNotifications.length} pending notifications`, {
        component: 'NotificationDeliveryService',
      });

      // Process each notification
      const processingPromises = pendingNotifications.map(notification =>
        this.deliverNotification(notification).catch(deliveryError => {
          Logger.error(`Failed to deliver notification ${notification.id}`, new Error(deliveryError instanceof Error ? deliveryError.message : JSON.stringify(deliveryError)), {
            component: 'NotificationDeliveryService',
            notificationId: notification.id,
          });
        })
      );

      await Promise.allSettled(processingPromises);

      Logger.info('Completed processing pending notifications', {
        component: 'NotificationDeliveryService',
        count: pendingNotifications.length,
      });

    } catch (error) {
      Logger.error('Error in processPendingNotifications', new Error(error instanceof Error ? error.message : JSON.stringify(error)), {
        component: 'NotificationDeliveryService',
      });
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Deliver individual notification
   */
  private async deliverNotification(notification: any): Promise<void> {
    try {
      const cancellationReason = await this.getCancellationReason(notification);
      if (cancellationReason) {
        await supabase
          .from('notification_queue')
          .update({
            status: 'cancelled',
            error_message: cancellationReason,
            updated_at: new Date().toISOString(),
          })
          .eq('id', notification.id);

        Logger.info(`Cancelled stale notification ${notification.id}`, {
          component: 'NotificationDeliveryService',
          notificationId: notification.id,
          type: notification.type,
          reason: cancellationReason,
        });
        return;
      }

      Logger.info(`Delivering notification ${notification.id}`, {
        component: 'NotificationDeliveryService',
        notificationId: notification.id,
        type: notification.type,
      });

      // Mark as processing
      await supabase
        .from('notification_queue')
        .update({ status: 'processing' })
        .eq('id', notification.id);

      // Check if this is a local notification or push notification
      const isLocalNotification = notification.data?.local ||
                                notification.type?.includes('test') ||
                                !notification.user_id;

      if (isLocalNotification) {
        // Deliver as local notification
        await this.deliverLocalNotification(notification);
      } else {
        // Deliver as push notification
        await this.deliverPushNotification(notification);
      }

      // Mark as sent
      await supabase
        .from('notification_queue')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .eq('id', notification.id);

      // Track analytics
      await notificationAnalyticsService.trackSent(
        notification.user_id,
        notification.id,
        notification.type
      );

      Logger.info(`Successfully delivered notification ${notification.id}`, {
        component: 'NotificationDeliveryService',
        notificationId: notification.id,
        type: notification.type,
      });

    } catch (error) {
      Logger.error(`Failed to deliver notification ${notification.id}`, new Error(error instanceof Error ? error.message : JSON.stringify(error)), {
        component: 'NotificationDeliveryService',
        notificationId: notification.id,
      });

      // Mark as failed
      await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          error_message: (error as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id);
    }
  }

  private async getCancellationReason(notification: any): Promise<string | null> {
    if (notification.type !== 'prayer_answered_check') {
      return null;
    }

    const prayerId = notification.data?.source_id;
    if (typeof prayerId !== 'string' || prayerId.length === 0) {
      return null;
    }

    const { data: prayer, error } = await supabase
      .from('prayers')
      .select('id, status, prayed, is_prayer_request, metadata')
      .eq('id', prayerId)
      .eq('user_id', notification.user_id)
      .maybeSingle();

    if (error) {
      Logger.warn('Unable to validate prayer before notification delivery', {
        component: 'NotificationDeliveryService',
        notificationId: notification.id,
        prayerId,
        error: {
          message: error.message || JSON.stringify(error),
          name: 'SupabaseError',
        },
      });
      return null;
    }

    if (!prayer) {
      return 'prayer_not_found';
    }

    if (prayer.status === 'answered') {
      return 'prayer_already_answered';
    }

    if (prayer.is_prayer_request === true) {
      return 'prayer_request_not_tracked';
    }

    if (prayer.metadata?.track_answered !== true) {
      return 'answered_tracking_disabled';
    }

    return null;
  }

  /**
   * Deliver local notification
   */
  private async deliverLocalNotification(notification: any): Promise<void> {
    await pushNotificationService.scheduleLocalNotification({
      id: notification.id,
      title: notification.title,
      message: notification.message,
      badge: notification.badge,
      sound: notification.sound || 'default',
      data: {
        ...(notification.data || {}),
        notification_id: notification.id,
        queue_notification_id: notification.id,
        user_id: notification.user_id,
        type: notification.type,
      },
    }, new Date());
  }

  /**
   * Deliver push notification
   */
  private async deliverPushNotification(notification: any): Promise<void> {
    try {
      // Get the user's device token from the database
      const { data: deviceToken, error: tokenError } = await supabase
        .from('device_tokens')
        .select('token')
        .eq('user_id', notification.user_id)
        .eq('is_active', true)
        .single();

      if (tokenError || !deviceToken?.token) {
        throw new Error(`No device token found for user ${notification.user_id}`);
      }

      // Since PushNotificationService only supports local notifications,
      // we'll deliver as local notification but with push-like behavior
      // In a real implementation, this would integrate with FCM/APNS
      await pushNotificationService.scheduleLocalNotification({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        badge: notification.badge,
        sound: notification.sound || 'default',
        data: {
          ...notification.data,
          notification_id: notification.id,
          queue_notification_id: notification.id,
          user_id: notification.user_id,
          type: notification.type,
          push_notification: true,
          device_token: deviceToken.token,
        },
      }, new Date());

      Logger.info('Push notification delivered (via local service)', {
        component: 'NotificationDeliveryService',
        userId: notification.user_id,
        notificationId: notification.id,
        type: notification.type,
        deviceToken: deviceToken.token.substring(0, 10) + '...',
      });

    } catch (error) {
      Logger.error('Failed to send push notification', new Error(error instanceof Error ? error.message : JSON.stringify(error)), {
        component: 'NotificationDeliveryService',
        userId: notification.user_id,
        notificationId: notification.id,
      });

      // Fallback to local notification if push fails
      Logger.info('Falling back to local notification', {
        component: 'NotificationDeliveryService',
        userId: notification.user_id,
      });
      await this.deliverLocalNotification(notification);
    }
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(): Promise<{
    pending: number;
    processing: number;
    sent: number;
    failed: number;
    total: number;
  }> {
    try {
      const { data: stats } = await supabase
        .from('notification_queue')
        .select('status', { count: 'exact', head: true });

      const pending = stats?.filter(item => item.status === 'pending').length || 0;
      const processing = stats?.filter(item => item.status === 'processing').length || 0;
      const sent = stats?.filter(item => item.status === 'sent').length || 0;
      const failed = stats?.filter(item => item.status === 'failed').length || 0;
      const total = pending + processing + sent + failed;

      return {
        pending,
        processing,
        sent,
        failed,
        total,
      };
    } catch (error) {
      Logger.error('Error getting delivery stats', new Error(error instanceof Error ? error.message : JSON.stringify(error)), {
        component: 'NotificationDeliveryService',
      });
      return {
        pending: 0,
        processing: 0,
        sent: 0,
        failed: 0,
        total: 0,
      };
    }
  }
}

export const notificationDeliveryService = NotificationDeliveryService.getInstance();
