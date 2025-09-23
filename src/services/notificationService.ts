/**
 * NotificationService.ts
 * Service for managing app-wide notifications including points notifications
 */

type NotificationCallback = (points: number, activityType: string, position?: 'top' | 'center' | 'bottom') => void;

class NotificationService {
  private pointsNotificationCallback: NotificationCallback | null = null;

  /**
   * Register the points notification callback from the context
   */
  setPointsNotificationCallback(callback: NotificationCallback) {
    this.pointsNotificationCallback = callback;
  }

  /**
   * Show animated points notification
   */
  showPointsNotification(points: number, activityType: string, position?: 'top' | 'center' | 'bottom') {
    console.log('[NotificationService] showPointsNotification called:', { points, activityType, position });
    console.log('[NotificationService] Has callback:', !!this.pointsNotificationCallback);
    
    if (this.pointsNotificationCallback) {
      console.log('[NotificationService] Calling callback...');
      this.pointsNotificationCallback(points, activityType, position);
    } else {
      console.log(`🎉 +${points} Faith Points for ${activityType}!`);
    }
  }

  /**
   * Clear the callback (cleanup)
   */
  clearPointsNotificationCallback() {
    this.pointsNotificationCallback = null;
  }
}

export const notificationService = new NotificationService();
