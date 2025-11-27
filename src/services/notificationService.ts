/**
 * NotificationService.ts
 * Service for managing app-wide notifications including points and badge notifications
 */

import { Badge } from './faithPointsService';

type BadgeNotificationCallback = (badge: Badge) => void;

class NotificationService {
  private pointsNotificationCallback: ((points: number, activityType: string, position?: 'top' | 'center' | 'bottom') => void) | null = null;
  private _suppressPointsNotifications = false;
  private badgeNotificationCallback: BadgeNotificationCallback | null = null;

  /**
   * Register the points notification callback from the context
   */
  setPointsNotificationCallback(callback: (points: number, activityType: string, position?: 'top' | 'center' | 'bottom') => void) {
    this.pointsNotificationCallback = callback;
  }

  /**
   * Suppress points notifications (used during purchase success modal)
   */
  suppressPointsNotifications(suppress: boolean) {
    this._suppressPointsNotifications = suppress;
  }

  /**
   * Register the badge notification callback from the context
   */
  setBadgeNotificationCallback(callback: BadgeNotificationCallback) {
    this.badgeNotificationCallback = callback;
  }

  /**
   * Show animated points notification
   */
  showPointsNotification(points: number, activityType: string, position?: 'top' | 'center' | 'bottom') {
    // Don't show if notifications are suppressed (e.g., during purchase success modal)
    if (this._suppressPointsNotifications) {
      return;
    }

    if (this.pointsNotificationCallback) {
      this.pointsNotificationCallback(points, activityType, position);
    } else {
      // Fallback: could log or store for later
    }
  }

  /**
   * Show badge unlock notification
   */
  showBadgeNotification(badge: Badge) {
    if (this.badgeNotificationCallback) {
      this.badgeNotificationCallback(badge);
    }
  }

  /**
   * Clear the callback (cleanup)
   */
  clearPointsNotificationCallback() {
    this.pointsNotificationCallback = null;
  }

  /**
   * Clear the badge callback (cleanup)
   */
  clearBadgeNotificationCallback() {
    this.badgeNotificationCallback = null;
  }
}

export const notificationService = new NotificationService();
