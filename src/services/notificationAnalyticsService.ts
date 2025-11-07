import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';

export interface NotificationAnalytics {
  id?: string;
  user_id: string;
  notification_id?: string;
  type: string;
  sent_at?: string;
  opened_at?: string;
  tapped_at?: string;
  deep_link?: string;
  metadata?: Record<string, any>;
  created_at?: string;
}

export interface NotificationMetrics {
  total_sent: number;
  total_opened: number;
  total_tapped: number;
  open_rate: number;
  tap_rate: number;
  by_type: Record<string, {
    sent: number;
    opened: number;
    tapped: number;
    open_rate: number;
    tap_rate: number;
  }>;
}

/**
 * Notification Analytics Service
 * Tracks notification delivery, opens, and taps for performance monitoring
 */
class NotificationAnalyticsService {
  /**
   * Track notification sent
   */
  async trackSent(
    userId: string,
    notificationId: string,
    type: string,
    deepLink?: string,
    metadata?: Record<string, any>
  ): Promise<boolean> {
    try {
      const analytics: NotificationAnalytics = {
        user_id: userId,
        notification_id: notificationId,
        type,
        sent_at: new Date().toISOString(),
        deep_link: deepLink,
        metadata,
        created_at: new Date().toISOString(),
      };

      const { error } = await supabase
        .from('notification_analytics')
        .insert(analytics);

      if (error) {
        // Gracefully handle missing table (not critical for app functionality)
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          Logger.warn('notification_analytics table not found - skipping analytics', {
            component: 'notificationAnalyticsService',
          });
          return true;
        }
        
        Logger.error('Failed to track notification sent', error as Error, {
          component: 'notificationAnalyticsService',
          type,
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error tracking notification sent', error as Error, {
        component: 'notificationAnalyticsService',
        type,
      });
      return false;
    }
  }

  /**
   * Track notification opened (user saw it in notification center)
   */
  async trackOpened(notificationId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('notification_analytics')
        .update({ opened_at: new Date().toISOString() })
        .eq('notification_id', notificationId)
        .is('opened_at', null); // Only update if not already opened

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          return true;
        }
        
        Logger.error('Failed to track notification opened', error as Error, {
          component: 'notificationAnalyticsService',
          notificationId,
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error tracking notification opened', error as Error, {
        component: 'notificationAnalyticsService',
        notificationId,
      });
      return false;
    }
  }

  /**
   * Track notification tapped (user clicked on it)
   */
  async trackTapped(notificationId: string): Promise<boolean> {
    try {
      const now = new Date().toISOString();
      
      const { error } = await supabase
        .from('notification_analytics')
        .update({ 
          tapped_at: now,
          // Also mark as opened if not already
          opened_at: now,
        })
        .eq('notification_id', notificationId)
        .is('tapped_at', null); // Only update if not already tapped

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          return true;
        }
        
        Logger.error('Failed to track notification tapped', error as Error, {
          component: 'notificationAnalyticsService',
          notificationId,
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error tracking notification tapped', error as Error, {
        component: 'notificationAnalyticsService',
        notificationId,
      });
      return false;
    }
  }

  /**
   * Get notification metrics for a user
   */
  async getUserMetrics(userId: string, days: number = 30): Promise<NotificationMetrics | null> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('notification_analytics')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', since.toISOString());

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          return null;
        }
        
        Logger.error('Failed to get user metrics', error as Error, {
          component: 'notificationAnalyticsService',
          userId,
        });
        return null;
      }

      if (!data || data.length === 0) {
        return {
          total_sent: 0,
          total_opened: 0,
          total_tapped: 0,
          open_rate: 0,
          tap_rate: 0,
          by_type: {},
        };
      }

      // Calculate overall metrics
      const totalSent = data.length;
      const totalOpened = data.filter(n => n.opened_at).length;
      const totalTapped = data.filter(n => n.tapped_at).length;

      // Calculate metrics by type
      const byType: Record<string, any> = {};
      data.forEach(notification => {
        const type = notification.type;
        if (!byType[type]) {
          byType[type] = {
            sent: 0,
            opened: 0,
            tapped: 0,
            open_rate: 0,
            tap_rate: 0,
          };
        }

        byType[type].sent++;
        if (notification.opened_at) {
          byType[type].opened++;
        }
        if (notification.tapped_at) {
          byType[type].tapped++;
        }
      });

      // Calculate rates for each type
      Object.keys(byType).forEach(type => {
        const metrics = byType[type];
        metrics.open_rate = metrics.sent > 0 ? (metrics.opened / metrics.sent) * 100 : 0;
        metrics.tap_rate = metrics.sent > 0 ? (metrics.tapped / metrics.sent) * 100 : 0;
      });

      return {
        total_sent: totalSent,
        total_opened: totalOpened,
        total_tapped: totalTapped,
        open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        tap_rate: totalSent > 0 ? (totalTapped / totalSent) * 100 : 0,
        by_type: byType,
      };
    } catch (error) {
      Logger.error('Error getting user metrics', error as Error, {
        component: 'notificationAnalyticsService',
        userId,
      });
      return null;
    }
  }

  /**
   * Get global notification metrics (admin only)
   */
  async getGlobalMetrics(days: number = 30): Promise<NotificationMetrics | null> {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data, error } = await supabase
        .from('notification_analytics')
        .select('*')
        .gte('created_at', since.toISOString());

      if (error) {
        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          return null;
        }
        
        Logger.error('Failed to get global metrics', error as Error, {
          component: 'notificationAnalyticsService',
        });
        return null;
      }

      if (!data || data.length === 0) {
        return {
          total_sent: 0,
          total_opened: 0,
          total_tapped: 0,
          open_rate: 0,
          tap_rate: 0,
          by_type: {},
        };
      }

      const totalSent = data.length;
      const totalOpened = data.filter(n => n.opened_at).length;
      const totalTapped = data.filter(n => n.tapped_at).length;

      const byType: Record<string, any> = {};
      data.forEach(notification => {
        const type = notification.type;
        if (!byType[type]) {
          byType[type] = {
            sent: 0,
            opened: 0,
            tapped: 0,
            open_rate: 0,
            tap_rate: 0,
          };
        }

        byType[type].sent++;
        if (notification.opened_at) {
          byType[type].opened++;
        }
        if (notification.tapped_at) {
          byType[type].tapped++;
        }
      });

      Object.keys(byType).forEach(type => {
        const metrics = byType[type];
        metrics.open_rate = metrics.sent > 0 ? (metrics.opened / metrics.sent) * 100 : 0;
        metrics.tap_rate = metrics.sent > 0 ? (metrics.tapped / metrics.sent) * 100 : 0;
      });

      return {
        total_sent: totalSent,
        total_opened: totalOpened,
        total_tapped: totalTapped,
        open_rate: totalSent > 0 ? (totalOpened / totalSent) * 100 : 0,
        tap_rate: totalSent > 0 ? (totalTapped / totalSent) * 100 : 0,
        by_type: byType,
      };
    } catch (error) {
      Logger.error('Error getting global metrics', error as Error, {
        component: 'notificationAnalyticsService',
      });
      return null;
    }
  }

  /**
   * Check if user is experiencing notification fatigue
   * Returns true if user has low engagement (< 10% open rate over last 7 days)
   */
  async checkNotificationFatigue(userId: string): Promise<boolean> {
    try {
      const metrics = await this.getUserMetrics(userId, 7);
      
      if (!metrics || metrics.total_sent < 5) {
        // Not enough data to determine fatigue
        return false;
      }

      // User is fatigued if open rate is below 10%
      return metrics.open_rate < 10;
    } catch (error) {
      Logger.error('Error checking notification fatigue', error as Error, {
        component: 'notificationAnalyticsService',
        userId,
      });
      return false;
    }
  }
}

export const notificationAnalyticsService = new NotificationAnalyticsService();
