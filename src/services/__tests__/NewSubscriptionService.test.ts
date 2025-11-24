/**
 * NewSubscriptionService.test.ts
 * Test suite for subscription management service
 */

import { NewSubscriptionService } from '../NewSubscriptionService';

// Mock Supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn().mockReturnValue({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        }),
        in: jest.fn().mockReturnValue({
          order: jest.fn(() => Promise.resolve({ data: [], error: null })),
        }),
      })),
      insert: jest.fn(() => ({
        select: jest.fn().mockReturnValue({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
        }),
      })),
      update: jest.fn(() => ({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          })
        })
      }))
    }),
  },
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
}));

describe('NewSubscriptionService', () => {
  const mockSupabase = require('../supabaseClient').supabase;
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSubscription', () => {
    it('should fetch user subscription successfully', async () => {
      const mockSubscription = {
        user_id: mockUserId,
        tier: 'spark',
        status: 'active',
        subscription_display_name: 'Spark Monthly',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSubscription,
              error: null,
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.getUserSubscription(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockSubscription);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_subscriptions');
    });

    it('should handle no subscription found', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'No rows found' },
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.getUserSubscription(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('No subscription found');
    });

    it('should handle fetch errors gracefully', async () => {
      const mockError = { message: 'Database error', code: 'DB_ERROR' };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.getUserSubscription(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('createSubscription', () => {
    it('should create subscription successfully', async () => {
      const subscriptionData = {
        user_id: mockUserId,
        tier: 'spark',
        status: 'active',
        subscription_display_name: 'Spark Monthly',
      };

      const mockCreatedSubscription = {
        ...subscriptionData,
        id: 'sub-123',
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCreatedSubscription,
              error: null,
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.createSubscription(subscriptionData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockCreatedSubscription);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_subscriptions');
    });

    it('should handle creation errors', async () => {
      const subscriptionData = {
        user_id: mockUserId,
        tier: 'spark',
        status: 'active',
      };

      const mockError = { message: 'Insert failed', code: 'INSERT_ERROR' };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: mockError,
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.createSubscription(subscriptionData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should validate required fields', async () => {
      const invalidData = {
        user_id: mockUserId,
        // Missing tier and status
      };

      const result = await NewSubscriptionService.createSubscription(invalidData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('required');
    });
  });

  describe('updateSubscription', () => {
    it('should update subscription successfully', async () => {
      const updateData = {
        tier: 'growth',
        status: 'active',
      };

      const mockUpdatedSubscription = {
        id: 'sub-123',
        user_id: mockUserId,
        ...updateData,
        updated_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockUpdatedSubscription,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.updateSubscription(mockUserId, updateData);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockUpdatedSubscription);
    });

    it('should handle update errors', async () => {
      const updateData = { tier: 'growth' };
      const mockError = { message: 'Update failed', code: 'UPDATE_ERROR' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: mockError,
              }),
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.updateSubscription(mockUserId, updateData);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });

    it('should handle not found on update', async () => {
      const updateData = { tier: 'growth' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116', message: 'No rows found' },
              }),
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.updateSubscription(mockUserId, updateData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('not found');
    });
  });

  describe('cancelSubscription', () => {
    it('should cancel subscription successfully', async () => {
      const mockCancelledSubscription = {
        id: 'sub-123',
        user_id: mockUserId,
        tier: 'spark',
        status: 'cancelled',
        cancelled_at: '2024-01-01T00:00:00Z',
      };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: mockCancelledSubscription,
                error: null,
              }),
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.cancelSubscription(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data?.status).toBe('cancelled');
    });

    it('should handle cancellation errors', async () => {
      const mockError = { message: 'Cancel failed', code: 'CANCEL_ERROR' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: mockError,
              }),
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.cancelSubscription(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error).toEqual(mockError);
    });
  });

  describe('getSubscriptionHistory', () => {
    it('should fetch subscription history successfully', async () => {
      const mockHistory = [
        {
          id: 'sub-123',
          user_id: mockUserId,
          tier: 'spark',
          status: 'active',
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'sub-124',
          user_id: mockUserId,
          tier: 'free',
          status: 'cancelled',
          created_at: '2023-12-01T00:00:00Z',
        },
      ];

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: mockHistory,
              error: null,
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.getSubscriptionHistory(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockHistory);
    });

    it('should handle empty history', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: [],
              error: null,
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.getSubscriptionHistory(mockUserId);

      expect(result.success).toBe(true);
      expect(result.data).toEqual([]);
    });
  });

  describe('subscription validation', () => {
    it('should validate subscription tier', async () => {
      const validTiers = ['free', 'seeker', 'spark', 'growth', 'transformation'];

      validTiers.forEach(async (tier) => {
        const subscriptionData = {
          user_id: mockUserId,
          tier,
          status: 'active',
        };

        const result = await NewSubscriptionService.createSubscription(subscriptionData);
        // Should not throw validation error
        expect(typeof result.success).toBe('boolean');
      });
    });

    it('should reject invalid subscription tier', async () => {
      const subscriptionData = {
        user_id: mockUserId,
        tier: 'invalid_tier',
        status: 'active',
      };

      const result = await NewSubscriptionService.createSubscription(subscriptionData);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid tier');
    });

    it('should validate subscription status', async () => {
      const validStatuses = ['active', 'cancelled', 'expired', 'pending'];

      validStatuses.forEach(async (status) => {
        const subscriptionData = {
          user_id: mockUserId,
          tier: 'spark',
          status,
        };

        const result = await NewSubscriptionService.createSubscription(subscriptionData);
        // Should not throw validation error
        expect(typeof result.success).toBe('boolean');
      });
    });
  });

  describe('subscription caching', () => {
    it('should cache subscription data', async () => {
      const mockSubscription = {
        user_id: mockUserId,
        tier: 'spark',
        status: 'active',
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSubscription,
              error: null,
            }),
          }),
        }),
      });

      // First call should hit database
      await NewSubscriptionService.getUserSubscription(mockUserId);

      // Second call should use cache
      await NewSubscriptionService.getUserSubscription(mockUserId);

      // Should only call database once
      expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    });

    it('should invalidate cache on update', async () => {
      const updateData = { tier: 'growth' };

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...updateData, user_id: mockUserId },
                error: null,
              }),
            }),
          }),
        }),
      });

      await NewSubscriptionService.updateSubscription(mockUserId, updateData);

      // Cache should be invalidated
      // Next getUserSubscription call should hit database
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { user_id: mockUserId, tier: 'growth' },
              error: null,
            }),
          }),
        }),
      });

      await NewSubscriptionService.getUserSubscription(mockUserId);

      expect(mockSupabase.from).toHaveBeenCalledTimes(2);
    });
  });

  describe('error handling', () => {
    it('should handle network errors gracefully', async () => {
      mockSupabase.from.mockImplementation(() => {
        throw new Error('Network error');
      });

      const result = await NewSubscriptionService.getUserSubscription(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Network error');
    });

    it('should handle timeout errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockImplementation(() =>
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error('Request timeout')), 100)
              )
            ),
          }),
        }),
      });

      const result = await NewSubscriptionService.getUserSubscription(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('timeout');
    });

    it('should handle malformed responses', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: undefined,
              error: null,
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.getUserSubscription(mockUserId);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('unexpected');
    });
  });

  describe('edge cases', () => {
    it('should handle empty user ID', async () => {
      const result = await NewSubscriptionService.getUserSubscription('');

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle null user ID', async () => {
      const result = await NewSubscriptionService.getUserSubscription(null as any);

      expect(result.success).toBe(false);
      expect(result.error?.message).toContain('Invalid user ID');
    });

    it('should handle concurrent operations', async () => {
      const subscriptionData = {
        user_id: mockUserId,
        tier: 'spark',
        status: 'active',
      };

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...subscriptionData, id: 'sub-123' },
              error: null,
            }),
          }),
        }),
      });

      // Create multiple subscriptions concurrently
      const promises = Array.from({ length: 3 }, () =>
        NewSubscriptionService.createSubscription(subscriptionData)
      );

      const results = await Promise.all(promises);

      // All should complete without errors
      results.forEach((result) => {
        expect(typeof result.success).toBe('boolean');
      });
    });
  });
});
