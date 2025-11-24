/**
 * NewSubscriptionService.test.ts
 * Test suite for subscription management service
 * Testing only PUBLIC static methods that actually exist
 */

import { NewSubscriptionService } from '../NewSubscriptionService';
import { supabase } from '../supabaseClient';

// Mock Supabase
jest.mock('../supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          maybeSingle: jest.fn(() => Promise.resolve({ data: null, error: null })),
        })),
      })),
      insert: jest.fn(() => Promise.resolve({ data: null, error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ data: null, error: null })),
      })),
      upsert: jest.fn(() => Promise.resolve({ data: null, error: null })),
    })),
  },
}));

describe('NewSubscriptionService', () => {
  const mockSupabase = supabase as any;
  const mockUserId = 'user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSubscription', () => {
    it('should fetch user subscription successfully', async () => {
      const mockSubscription = {
        user_id: mockUserId,
        tier: 'transformation',
        status: 'active',
        subscription_display_name: 'Transformation',
        trial_end_date: null,
        subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
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

      expect(result).toEqual(mockSubscription);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_subscriptions');
    });

    it('should handle user with no subscription', async () => {
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

      // Should return default seeker subscription
      expect(result.tier).toBe('seeker');
    });

    it('should handle database errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'DB_ERROR', message: 'Database error' },
            }),
          }),
        }),
      });

      await expect(
        NewSubscriptionService.getUserSubscription(mockUserId)
      ).rejects.toThrow();
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription successfully', async () => {
      const upgradeOptions = {
        target_tier: 'growth' as const,
        platform: 'apple' as const,
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { user_id: mockUserId, tier: 'growth', status: 'active' },
              error: null,
            }),
          }),
        }),
      });

      const result = await NewSubscriptionService.upgradeSubscription(mockUserId, upgradeOptions);

      expect(result).toBeDefined();
      expect(result.tier).toBe('growth');
    });

    it('should handle upgrade errors', async () => {
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Upgrade failed', code: 'UPGRADE_ERROR' },
            }),
          }),
        }),
      });

      await expect(
        NewSubscriptionService.upgradeSubscription(mockUserId, { target_tier: 'spark', platform: 'apple' })
      ).rejects.toThrow();
    });
  });

  describe('getTierLimits', () => {
    it('should get transformation tier limits', () => {
      const limits = NewSubscriptionService.getTierLimits('transformation');
      expect(limits).toBeDefined();
      expect(limits.playbooks_limit).toBeGreaterThan(0);
      expect(limits.devotionals_limit).toBeGreaterThan(0);
    });

    it('should get growth tier limits', () => {
      const limits = NewSubscriptionService.getTierLimits('growth');
      expect(limits).toBeDefined();
      expect(limits.playbooks_limit).toBe(20);
    });

    it('should get spark tier limits', () => {
      const limits = NewSubscriptionService.getTierLimits('spark');
      expect(limits).toBeDefined();
      expect(limits.playbooks_limit).toBe(8);
    });

    it('should get seeker tier limits', () => {
      const limits = NewSubscriptionService.getTierLimits('seeker');
      expect(limits).toBeDefined();
      expect(limits.playbooks_limit).toBe(0);
    });
  });

  describe('trial management', () => {
    it('should check if user is in trial', async () => {
      const trialSubscription = {
        user_id: mockUserId,
        tier: 'transformation',
        status: 'trial',
        trial_end_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: trialSubscription,
              error: null,
            }),
          }),
        }),
      });

      const subscription = await NewSubscriptionService.getUserSubscription(mockUserId);
      expect(subscription.status).toBe('trial');
      expect(subscription.trial_end_date).toBeDefined();
    });

    it('should check if trial has expired', async () => {
      const expiredTrial = {
        user_id: mockUserId,
        tier: 'transformation',
        status: 'trial',
        trial_end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: expiredTrial,
              error: null,
            }),
          }),
        }),
      });

      const subscription = await NewSubscriptionService.getUserSubscription(mockUserId);
      const isExpired = new Date(subscription.trial_end_date!) < new Date();
      expect(isExpired).toBe(true);
    });
  });

  describe('subscription status', () => {
    it('should handle active subscription', async () => {
      const activeSubscription = {
        user_id: mockUserId,
        tier: 'growth',
        status: 'active',
        subscription_end_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: activeSubscription,
              error: null,
            }),
          }),
        }),
      });

      const subscription = await NewSubscriptionService.getUserSubscription(mockUserId);
      expect(subscription.status).toBe('active');
    });

    it('should handle expired subscription', async () => {
      const expiredSubscription = {
        user_id: mockUserId,
        tier: 'spark',
        status: 'expired',
        subscription_end_date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: expiredSubscription,
              error: null,
            }),
          }),
        }),
      });

      const subscription = await NewSubscriptionService.getUserSubscription(mockUserId);
      expect(subscription.status).toBe('expired');
    });

    it('should handle cancelled subscription', async () => {
      const cancelledSubscription = {
        user_id: mockUserId,
        tier: 'growth',
        status: 'cancelled',
        subscription_end_date: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000).toISOString(),
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: cancelledSubscription,
              error: null,
            }),
          }),
        }),
      });

      const subscription = await NewSubscriptionService.getUserSubscription(mockUserId);
      expect(subscription.status).toBe('cancelled');
    });
  });

  describe('edge cases', () => {
    it('should handle empty user ID', async () => {
      await expect(
        NewSubscriptionService.getUserSubscription('')
      ).rejects.toThrow();
    });

    it('should handle null user ID', async () => {
      await expect(
        NewSubscriptionService.getUserSubscription(null as any)
      ).rejects.toThrow();
    });

    it('should handle concurrent subscription updates', async () => {
      mockSupabase.from.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: { user_id: mockUserId, tier: 'transformation' },
          error: null,
        }),
      });

      const promises = Array(5).fill(null).map(() =>
        NewSubscriptionService.upgradeSubscription(mockUserId, { target_tier: 'transformation', platform: 'apple' })
      );

      const results = await Promise.all(promises);
      results.forEach((result: any) => {
        expect(result).toBeDefined();
      });
    });
  });
});
