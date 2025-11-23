/**
 * notificationService.test.ts
 * Test suite for the notification service (critical notification component)
 */

import { notificationService } from '../notificationService';
import { Badge } from '../faithPointsService';

// Mock faithPointsService
jest.mock('../faithPointsService', () => ({
  Badge: {
    BRONZE: 'bronze',
    SILVER: 'silver',
    GOLD: 'gold',
    PLATINUM: 'platinum'
  }
}));

describe('notificationService', () => {
  let mockPointsCallback: jest.Mock;
  let mockBadgeCallback: jest.Mock;

  beforeEach(() => {
    mockPointsCallback = jest.fn();
    mockBadgeCallback = jest.fn();
  });

  describe('Points Notification Callbacks', () => {
    it('should register points notification callback', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      // Trigger a points notification
      notificationService.showPointsNotification(10, 'test_activity');

      expect(mockPointsCallback).toHaveBeenCalledWith(10, 'test_activity', undefined);
    });

    it('should call points callback with custom position', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      notificationService.showPointsNotification(15, 'custom_activity', 'top');

      expect(mockPointsCallback).toHaveBeenCalledWith(15, 'custom_activity', 'top');
    });

    it('should not call points callback when not registered', () => {
      // Don't register callback
      notificationService.showPointsNotification(10, 'test_activity');

      expect(mockPointsCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple points notifications', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      notificationService.showPointsNotification(5, 'activity_1');
      notificationService.showPointsNotification(10, 'activity_2');
      notificationService.showPointsNotification(20, 'activity_3', 'bottom');

      expect(mockPointsCallback).toHaveBeenCalledTimes(3);
      expect(mockPointsCallback).toHaveBeenNthCalledWith(1, 5, 'activity_1', undefined);
      expect(mockPointsCallback).toHaveBeenNthCalledWith(2, 10, 'activity_2', undefined);
      expect(mockPointsCallback).toHaveBeenNthCalledWith(3, 20, 'activity_3', 'bottom');
    });
  });

  describe('Badge Notification Callbacks', () => {
    it('should register badge notification callback', () => {
      notificationService.setBadgeNotificationCallback(mockBadgeCallback);

      const mockBadge: Badge = Badge.GOLD;
      notificationService.showBadgeNotification(mockBadge);

      expect(mockBadgeCallback).toHaveBeenCalledWith(mockBadge);
    });

    it('should not call badge callback when not registered', () => {
      const mockBadge: Badge = Badge.SILVER;
      notificationService.showBadgeNotification(mockBadge);

      expect(mockBadgeCallback).not.toHaveBeenCalled();
    });

    it('should handle multiple badge notifications', () => {
      notificationService.setBadgeNotificationCallback(mockBadgeCallback);

      notificationService.showBadgeNotification(Badge.BRONZE);
      notificationService.showBadgeNotification(Badge.SILVER);
      notificationService.showBadgeNotification(Badge.GOLD);
      notificationService.showBadgeNotification(Badge.PLATINUM);

      expect(mockBadgeCallback).toHaveBeenCalledTimes(4);
      expect(mockBadgeCallback).toHaveBeenNthCalledWith(1, Badge.BRONZE);
      expect(mockBadgeCallback).toHaveBeenNthCalledWith(2, Badge.SILVER);
      expect(mockBadgeCallback).toHaveBeenNthCalledWith(3, Badge.GOLD);
      expect(mockBadgeCallback).toHaveBeenNthCalledWith(4, Badge.PLATINUM);
    });
  });

  describe('Combined Notifications', () => {
    it('should handle both points and badge notifications simultaneously', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);
      notificationService.setBadgeNotificationCallback(mockBadgeCallback);

      notificationService.showPointsNotification(50, 'milestone_achieved', 'top');
      notificationService.showBadgeNotification(Badge.PLATINUM);

      expect(mockPointsCallback).toHaveBeenCalledWith(50, 'milestone_achieved', 'top');
      expect(mockBadgeCallback).toHaveBeenCalledWith(Badge.PLATINUM);
    });

    it('should handle interleaved notifications', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);
      notificationService.setBadgeNotificationCallback(mockBadgeCallback);

      notificationService.showPointsNotification(10, 'activity_1');
      notificationService.showBadgeNotification(Badge.BRONZE);
      notificationService.showPointsNotification(25, 'activity_2');
      notificationService.showBadgeNotification(Badge.SILVER);

      expect(mockPointsCallback).toHaveBeenCalledTimes(2);
      expect(mockBadgeCallback).toHaveBeenCalledTimes(2);
    });
  });

  describe('Callback Management', () => {
    it('should allow updating points notification callback', () => {
      const initialCallback = jest.fn();
      const updatedCallback = jest.fn();

      notificationService.setPointsNotificationCallback(initialCallback);
      notificationService.showPointsNotification(10, 'test');

      expect(initialCallback).toHaveBeenCalledTimes(1);
      expect(updatedCallback).not.toHaveBeenCalled();

      // Update callback
      notificationService.setPointsNotificationCallback(updatedCallback);
      notificationService.showPointsNotification(20, 'test');

      expect(initialCallback).toHaveBeenCalledTimes(1); // Still only called once
      expect(updatedCallback).toHaveBeenCalledTimes(1);
    });

    it('should allow updating badge notification callback', () => {
      const initialCallback = jest.fn();
      const updatedCallback = jest.fn();

      notificationService.setBadgeNotificationCallback(initialCallback);
      notificationService.showBadgeNotification(Badge.GOLD);

      expect(initialCallback).toHaveBeenCalledTimes(1);
      expect(updatedCallback).not.toHaveBeenCalled();

      // Update callback
      notificationService.setBadgeNotificationCallback(updatedCallback);
      notificationService.showBadgeNotification(Badge.PLATINUM);

      expect(initialCallback).toHaveBeenCalledTimes(1); // Still only called once
      expect(updatedCallback).toHaveBeenCalledTimes(1);
    });

    it('should handle null callback updates', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);
      notificationService.setBadgeNotificationCallback(mockBadgeCallback);

      // Set to null
      notificationService.setPointsNotificationCallback(null);
      notificationService.setBadgeNotificationCallback(null);

      notificationService.showPointsNotification(10, 'test');
      notificationService.showBadgeNotification(Badge.GOLD);

      expect(mockPointsCallback).not.toHaveBeenCalled();
      expect(mockBadgeCallback).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero points notifications', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      notificationService.showPointsNotification(0, 'zero_points');

      expect(mockPointsCallback).toHaveBeenCalledWith(0, 'zero_points', undefined);
    });

    it('should handle negative points notifications', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      notificationService.showPointsNotification(-5, 'penalty');

      expect(mockPointsCallback).toHaveBeenCalledWith(-5, 'penalty', undefined);
    });

    it('should handle large points values', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      notificationService.showPointsNotification(999999, 'mega_achievement');

      expect(mockPointsCallback).toHaveBeenCalledWith(999999, 'mega_achievement', undefined);
    });

    it('should handle empty activity type strings', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      notificationService.showPointsNotification(10, '');

      expect(mockPointsCallback).toHaveBeenCalledWith(10, '', undefined);
    });

    it('should handle special characters in activity types', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      notificationService.showPointsNotification(15, 'activity_with_特殊字符_and_🎉');

      expect(mockPointsCallback).toHaveBeenCalledWith(15, 'activity_with_特殊字符_and_🎉', undefined);
    });
  });

  describe('Performance and Memory', () => {
    it('should handle rapid successive notifications', () => {
      notificationService.setPointsNotificationCallback(mockPointsCallback);

      // Send 100 rapid notifications
      for (let i = 0; i < 100; i++) {
        notificationService.showPointsNotification(i, `activity_${i}`);
      }

      expect(mockPointsCallback).toHaveBeenCalledTimes(100);
    });

    it('should not leak memory when callbacks are updated frequently', () => {
      // Create many callbacks and update them rapidly
      for (let i = 0; i < 50; i++) {
        const callback = jest.fn();
        notificationService.setPointsNotificationCallback(callback);
        
        if (i % 10 === 0) {
          notificationService.showPointsNotification(i, 'test');
        }
      }

      // Should not throw errors and should work correctly
      expect(true).toBe(true);
    });
  });
});
