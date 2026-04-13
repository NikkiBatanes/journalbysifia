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
    // Server-side process-notification-queue handles push delivery via APNS.
    // This client service only handles in-app notification display.
    // Do not process the queue here to avoid duplicates.
    return;
  }

  /**
   * Deliver individual notification
   */
  private async deliverNotification(notification: any): Promise<void> {
    try {
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
      Logger.error(`Failed to deliver notification ${notification.id}`, error as Error, {
        component: 'NotificationDeliveryService',
        notificationId: notification.id,
      });

      // Mark as failed
      await supabase
        .from('notification_queue')
        .update({
          status: 'failed',
          error: (error as Error).message,
          updated_at: new Date().toISOString(),
        })
        .eq('id', notification.id);
    }
  }

  /**
   * Deliver local notification
   */
  private async deliverLocalNotification(notification: any): Promise<void> {
    await pushNotificationService.scheduleLocalNotification({
      title: notification.title,
      message: notification.message,
      badge: notification.badge,
      sound: notification.sound || 'default',
      data: notification.data || {},
    }, new Date());
  }

  /**
   * Deliver push notification
   */
  private async deliverPushNotification(notification: any): Promise<void> {
    // Push delivery is handled server-side via APNS.
    // This client only displays notifications in the in-app notification center.
    Logger.info('Push notification handled server-side', {
      component: 'NotificationDeliveryService',
      notificationId: notification.id,
    });
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
      Logger.error('Error getting delivery stats', error as Error, {
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
