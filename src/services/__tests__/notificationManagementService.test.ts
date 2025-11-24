/**
 * notificationManagementService.test.ts
 * Test suite for notification management service
 */

import { notificationManagementService } from '../notificationManagementService';
import { supabase } from '../supabaseClient';

// Mock Supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => Promise.resolve({ data: [], error: null })),
          })),
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
        gte: jest.fn(() => ({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      delete: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null })),
      })),
    })),
  },
}));

describe('notificationManagementService', () => {
  const mockSupabase = supabase as any;
  const mockUserId = 'user-123';
  const mockNotificationId = 'notif-456';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getNotificationPreferences', () => {
    it('should fetch user notification preferences successfully', async () => {
      const mockPreferences = {
        user_id: mockUserId,
        playbook_steps: true,
        devotional_reminders: true,
        journal_prompts: false,
        prayer_reminders: true,
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockPreferences,
              error: null,
            }),
          }),
        }),
      });

      const result = await notificationManagementService.getNotificationPreferences(mockUserId);

      expect(result).toEqual(mockPreferences);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_preferences');
    });

    it('should return null when preferences do not exist', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      });

      const result = await notificationManagementService.getNotificationPreferences(mockUserId);

      expect(result).toBeNull();
    });
  });

  describe('markNotificationAsRead', () => {
    it('should mark notification as read successfully', async () => {
      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: { id: mockNotificationId, read: true },
            error: null,
          }),
        }),
      });

      await expect(
        notificationManagementService.markNotificationAsRead(mockNotificationId, mockUserId)
      ).resolves.not.toThrow();

      expect(mockSupabase.from).toHaveBeenCalledWith('notification_queue');
    });

    it('should handle errors when marking as read', async () => {
      const mockError = { message: 'Update failed', code: 'UPDATE_ERROR' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: mockError,
          }),
        }),
      });

      const result = await notificationManagementService.markNotificationAsRead(mockNotificationId, mockUserId);
      expect(result).toBe(false);
    });
  });

  describe('getUnreadNotificationCount', () => {
    it('should return correct unread count', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              data: null,
              count: 5,
              error: null,
            }),
          }),
        }),
      });

      const count = await notificationManagementService.getUnreadNotificationCount(mockUserId);

      expect(count).toBe(5);
    });

    it('should return 0 when no unread notifications', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            in: jest.fn().mockResolvedValue({
              count: 0,
              error: null,
            }),
          }),
        }),
      });

      const count = await notificationManagementService.getUnreadNotificationCount(mockUserId);

      expect(count).toBe(0);
    });
  });

  describe('scheduleNotification', () => {
    it('should schedule notification successfully', async () => {
      const mockNotification = {
        user_id: mockUserId,
        type: 'prayer_reminder',
        title: 'Prayer Time',
        message: 'Time for prayer',
        priority: 'normal' as const,
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: null,
        }),
      });

      const result = await notificationManagementService.scheduleNotification(mockNotification);

      expect(result).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_queue');
    });

    it('should handle scheduling errors', async () => {
      const mockNotification = {
        user_id: mockUserId,
        type: 'prayer_reminder',
        title: 'Prayer Time',
        message: 'Time for prayer',
        priority: 'normal' as const,
      };

      const mockError = { message: 'Insert failed', code: 'INSERT_ERROR' };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockResolvedValue({
          error: mockError,
        }),
      });

      const result = await notificationManagementService.scheduleNotification(mockNotification);

      expect(result).toBe(false);
    });
  });
});
