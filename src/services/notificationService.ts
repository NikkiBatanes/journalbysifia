/**
 * NotificationService.ts
 * Service for managing app-wide notifications including points and badge notifications
 */

import { Badge } from './faithPointsService';

type NotificationCallback = (points: number, activityType: string, position?: 'top' | 'center' | 'bottom') => void;
type BadgeNotificationCallback = (badge: Badge) => void;

class NotificationService {
  private pointsNotificationCallback: NotificationCallback | null = null;
  private badgeNotificationCallback: BadgeNotificationCallback | null = null;

  /**
   * Register the points notification callback from the context
   */
  setPointsNotificationCallback(callback: NotificationCallback) {
    this.pointsNotificationCallback = callback;
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

    if (this.pointsNotificationCallback) {

      this.pointsNotificationCallback(points, activityType, position);
    } else {

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
