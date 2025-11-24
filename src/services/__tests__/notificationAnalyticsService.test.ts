/**
 * notificationAnalyticsService.test.ts
 * Test suite for notification analytics service
 */

import { notificationAnalyticsService } from '../notificationAnalyticsService';

// Mock analytics modules
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

// Mock Supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      insert: jest.fn(() => Promise.resolve({ error: null })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => Promise.resolve({ data: [], error: null })),
            })),
          })),
        })),
        sum: jest.fn(() => ({
          eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
    })),
  },
}));

describe('notificationAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('notification tracking', () => {
    it('should track notification sent', async () => {
      const notificationData = {
        userId: 'user-123',
        type: 'prayer_reminder',
        title: 'Prayer Time',
        timestamp: new Date().toISOString(),
      };

      await expect(notificationAnalyticsService.trackNotificationSent(notificationData)).resolves.not.toThrow();
    });

    it('should track notification opened', async () => {
      const notificationData = {
        userId: 'user-123',
        notificationId: 'notif-123',
        openedAt: new Date().toISOString(),
      };

      await expect(notificationAnalyticsService.trackNotificationOpened(notificationData)).resolves.not.toThrow();
    });

    it('should track notification dismissed', async () => {
      const notificationData = {
        userId: 'user-123',
        notificationId: 'notif-123',
        dismissedAt: new Date().toISOString(),
      };

      await expect(notificationAnalyticsService.trackNotificationDismissed(notificationData)).resolves.not.toThrow();
    });

    it('should handle tracking errors gracefully', async () => {
      const invalidData = {
        userId: null,
        type: 'invalid',
      };

      await expect(notificationAnalyticsService.trackNotificationSent(invalidData)).resolves.not.toThrow();
    });
  });

  describe('analytics data retrieval', () => {
    it('should get notification stats for user', async () => {
      const userId = 'user-123';
      const stats = await notificationAnalyticsService.getUserNotificationStats(userId);

      expect(typeof stats).toBe('object');
      expect(typeof stats.totalSent).toBe('number');
      expect(typeof stats.totalOpened).toBe('number');
      expect(typeof stats.openRate).toBe('number');
    });

    it('should get notification stats for date range', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const stats = await notificationAnalyticsService.getNotificationStatsByDateRange(startDate, endDate);

      expect(typeof stats).toBe('object');
      expect(Array.isArray(stats.dailyStats)).toBe(true);
    });

    it('should get notification performance metrics', async () => {
      const metrics = await notificationAnalyticsService.getNotificationPerformanceMetrics();

      expect(typeof metrics).toBe('object');
      expect(typeof metrics.overallOpenRate).toBe('number');
      expect(typeof metrics.mostEngagedType).toBe('string');
    });

    it('should get user engagement trends', async () => {
      const userId = 'user-123';
      const trends = await notificationAnalyticsService.getUserEngagementTrends(userId);

      expect(Array.isArray(trends)).toBe(true);
    });
  });

  describe('notification type analytics', () => {
    it('should get analytics by notification type', async () => {
      const type = 'prayer_reminder';
      const analytics = await notificationAnalyticsService.getNotificationTypeAnalytics(type);

      expect(typeof analytics).toBe('object');
      expect(typeof analytics.totalSent).toBe('number');
      expect(typeof analytics.openRate).toBe('number');
    });

    it('should get all notification type performance', async () => {
      const performance = await notificationAnalyticsService.getAllNotificationTypePerformance();

      expect(Array.isArray(performance)).toBe(true);
    });

    it('should get optimal send times', async () => {
      const userId = 'user-123';
      const optimalTimes = await notificationAnalyticsService.getOptimalSendTimes(userId);

      expect(Array.isArray(optimalTimes)).toBe(true);
    });
  });

  describe('user segmentation', () => {
    it('should segment users by engagement', async () => {
      const segments = await notificationAnalyticsService.segmentUsersByEngagement();

      expect(typeof segments).toBe('object');
      expect(typeof segments.highEngagement).toBe('number');
      expect(typeof segments.mediumEngagement).toBe('number');
      expect(typeof segments.lowEngagement).toBe('number');
    });

    it('should get user engagement score', async () => {
      const userId = 'user-123';
      const score = await notificationAnalyticsService.getUserEngagementScore(userId);

      expect(typeof score).toBe('number');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });

    it('should identify at-risk users', async () => {
      const atRiskUsers = await notificationAnalyticsService.getAtRiskUsers();

      expect(Array.isArray(atRiskUsers)).toBe(true);
    });
  });

  describe('A/B testing analytics', () => {
    it('should track A/B test variant', async () => {
      const testData = {
        userId: 'user-123',
        testId: 'test-123',
        variant: 'A',
        notificationId: 'notif-123',
      };

      await expect(notificationAnalyticsService.trackABTestVariant(testData)).resolves.not.toThrow();
    });

    it('should get A/B test results', async () => {
      const testId = 'test-123';
      const results = await notificationAnalyticsService.getABTestResults(testId);

      expect(typeof results).toBe('object');
      expect(typeof results.variantA).toBe('object');
      expect(typeof results.variantB).toBe('object');
    });

    it('should calculate statistical significance', async () => {
      const testResults = {
        variantA: { opens: 100, sends: 200 },
        variantB: { opens: 120, sends: 200 },
      };

      const significance = await notificationAnalyticsService.calculateStatisticalSignificance(testResults);

      expect(typeof significance).toBe('object');
      expect(typeof significance.pValue).toBe('number');
      expect(typeof significance.isSignificant).toBe('boolean');
    });
  });

  describe('real-time analytics', () => {
    it('should get real-time notification status', async () => {
      const status = await notificationAnalyticsService.getRealTimeNotificationStatus();

      expect(typeof status).toBe('object');
      expect(typeof status.activeNotifications).toBe('number');
      expect(typeof status.recentlyOpened).toBe('number');
    });

    it('should track real-time events', async () => {
      const event = {
        type: 'notification_opened',
        userId: 'user-123',
        timestamp: new Date().toISOString(),
        data: { notificationId: 'notif-123' },
      };

      await expect(notificationAnalyticsService.trackRealTimeEvent(event)).resolves.not.toThrow();
    });
  });

  describe('data export', () => {
    it('should export user analytics data', async () => {
      const userId = 'user-123';
      const exportData = await notificationAnalyticsService.exportUserAnalytics(userId);

      expect(typeof exportData).toBe('object');
      expect(typeof exportData.notifications).toBe('object');
      expect(typeof exportData.engagement).toBe('object');
    });

    it('should export system analytics data', async () => {
      const exportData = await notificationAnalyticsService.exportSystemAnalytics();

      expect(typeof exportData).toBe('object');
      expect(Array.isArray(exportData.users)).toBe(true);
      expect(Array.isArray(exportData.notifications)).toBe(true);
    });

    it('should export data in CSV format', async () => {
      const userId = 'user-123';
      const csvData = await notificationAnalyticsService.exportAnalyticsCSV(userId);

      expect(typeof csvData).toBe('string');
      expect(csvData).toContain('userId');
      expect(csvData).toContain('timestamp');
    });
  });

  describe('error handling', () => {
    it('should handle database errors gracefully', async () => {
      const mockSupabase = require('../supabaseClient').supabase;
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockRejectedValue(new Error('Database error')),
      });

      await expect(notificationAnalyticsService.trackNotificationSent({
        userId: 'user-123',
        type: 'test',
        title: 'Test',
        timestamp: new Date().toISOString(),
      })).resolves.not.toThrow();
    });

    it('should handle invalid data gracefully', async () => {
      const invalidData = {
        userId: null,
        type: undefined,
        title: '',
      };

      await expect(notificationAnalyticsService.trackNotificationSent(invalidData)).resolves.not.toThrow();
    });

    it('should handle network timeouts', async () => {
      const mockSupabase = require('../supabaseClient').supabase;
      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockImplementation(() =>
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Network timeout')), 100)
          )
        ),
      });

      await expect(notificationAnalyticsService.trackNotificationSent({
        userId: 'user-123',
        type: 'test',
        title: 'Test',
        timestamp: new Date().toISOString(),
      })).resolves.not.toThrow();
    });
  });

  describe('cleanup', () => {
    it('should cleanup old analytics data', async () => {
      const daysToKeep = 30;
      await expect(notificationAnalyticsService.cleanupOldData(daysToKeep)).resolves.not.toThrow();
    });

    it('should handle cleanup errors gracefully', async () => {
      await expect(notificationAnalyticsService.cleanupOldData(30)).resolves.not.toThrow();
    });
  });
});
