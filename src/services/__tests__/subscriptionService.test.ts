/**
 * subscriptionService.test.ts
 * Test suite for the subscription service (critical payment component)
 */

import { subscriptionService } from '../subscriptionService';
import { supabase } from '../../services/supabaseClient';

// Mock Supabase client
jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn()
            }))
          }))
        }))
      }))
    })),
    rpc: jest.fn()
  },
}));

// Mock NewSubscriptionService
jest.mock('../NewSubscriptionService', () => ({
  NewSubscriptionService: {
    getUserSubscription: jest.fn(),
    getTierLimits: jest.fn(),
    getOnboardingPlaybookLimit: jest.fn(),
    checkUsageLimit: jest.fn()
  }
}));

describe('subscriptionService', () => {
  const mockSupabase = supabase as any;
  const mockNSS = require('../NewSubscriptionService').NewSubscriptionService;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSubscription', () => {
    it('should return current subscription successfully', async () => {
      const mockSubscription = {
        id: 'sub_123',
        tier: 'growth',
        status: 'active',
        expires_at: '2024-12-31',
        limits: {
          playbooks: 20,
          devotionals: 8,
          exports: 10,
          intelligenceEnabled: true
        }
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);

      const result = await subscriptionService.getUserSubscription('user-123');

      expect(result).toEqual(mockSubscription);
      expect(mockNSS.getUserSubscription).toHaveBeenCalledWith('user-123');
    });

    it('should handle subscription fetch errors', async () => {
      mockNSS.getUserSubscription.mockRejectedValue(new Error('Subscription fetch failed'));

      await expect(subscriptionService.getUserSubscription('user-123')).rejects.toThrow('Subscription fetch failed');
    });

    it('should handle null user ID', async () => {
      await expect(subscriptionService.getUserSubscription(null as any)).rejects.toThrow();
    });
  });

  describe('getSubscriptionLimits', () => {
    it('should return subscription limits for growth tier', () => {
      const mockBaseLimits = {
        playbooks_limit: 20,
        devotionals_limit: 8,
        smart_journaling_enabled: true,
        show_dashboard_counts: true
      };

      mockNSS.getTierLimits.mockReturnValue(mockBaseLimits);

      const result = subscriptionService.getSubscriptionLimits('growth');

      expect(result).toHaveProperty('playbooks_limit');
      expect(result).toHaveProperty('devotionals_limit');
      expect(result).toHaveProperty('exports');
      expect(result).toHaveProperty('intelligenceEnabled');
      expect(result.exports).toBe(-1); // unlimited for paid tiers
      expect(result.intelligenceEnabled).toBe(true);
      expect(result.playbooks_limit).toBe(20);
      expect(result.devotionals_limit).toBe(8);
    });

    it('should return subscription limits for seeker tier', () => {
      const mockBaseLimits = {
        playbooks_limit: 0,
        devotionals_limit: 0,
        smart_journaling_enabled: false,
        show_dashboard_counts: true
      };

      mockNSS.getTierLimits.mockReturnValue(mockBaseLimits);

      const result = subscriptionService.getSubscriptionLimits('seeker');

      expect(result.exports).toBe(0); // no exports for seeker
      expect(result.intelligenceEnabled).toBe(false);
      expect(result.playbooks_limit).toBe(0);
      expect(result.devotionals_limit).toBe(0);
    });

    it('should handle unknown tier gracefully', () => {
      const mockBaseLimits = {
        playbooks_limit: 0,
        devotionals_limit: 0,
        smart_journaling_enabled: false,
        show_dashboard_counts: true
      };

      mockNSS.getTierLimits.mockReturnValue(mockBaseLimits);

      const result = subscriptionService.getSubscriptionLimits('unknown' as any);

      expect(result).toBeDefined();
      expect(result.exports).toBe(-1); // default to unlimited
    });
  });

  describe('canGenerate', () => {
    it('should allow playbook generation for premium users', async () => {
      const mockSubscription = {
        tier: 'growth',
        playbooks_used: 5
      };

      const mockUsageCheck = {
        can_generate_playbook: true,
        can_generate_devotional: true,
        can_use_smart_journaling: true,
        can_export: true,
        playbooks_remaining: 15,
        devotionals_remaining: 3,
        show_upgrade_prompt: false
      };

      const mockTierLimits = {
        playbooks_limit: 20,
        devotionals_limit: 8,
        smart_journaling_enabled: true,
        show_dashboard_counts: true
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockNSS.checkUsageLimit.mockResolvedValue(mockUsageCheck);
      mockNSS.getTierLimits.mockReturnValue(mockTierLimits);

      const result = await subscriptionService.canGenerate('user-123', 'playbook');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(15); // 20 - 5 = 15
      expect(result.limit).toBe(20);
    });

    it('should block playbook generation when limit exceeded', async () => {
      const mockSubscription = {
        tier: 'spark',
        playbooks_used: 8
      };

      const mockUsageCheck = {
        can_generate_playbook: false,
        can_generate_devotional: false,
        can_use_smart_journaling: true,
        can_export: false,
        playbooks_remaining: 0,
        devotionals_remaining: 0,
        show_upgrade_prompt: true,
        upgrade_message: 'Playbook limit exceeded'
      };

      const mockTierLimits = {
        playbooks_limit: 8,
        devotionals_limit: 8,
        smart_journaling_enabled: true,
        show_dashboard_counts: true
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockNSS.checkUsageLimit.mockResolvedValue(mockUsageCheck);
      mockNSS.getTierLimits.mockReturnValue(mockTierLimits);

      const result = await subscriptionService.canGenerate('user-123', 'playbook');

      expect(result.allowed).toBe(false);
      expect(result.upgradeRequired).toBe(true);
      expect(result.remaining).toBe(0); // 8 - 8 = 0
      expect(result.limit).toBe(8);
    });

    it('should handle onboarding playbook generation for seekers', async () => {
      const mockSubscription = {
        tier: 'seeker',
        playbooks_used: 0
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockNSS.getOnboardingPlaybookLimit.mockReturnValue(1);

      const result = await subscriptionService.canGenerate('user-123', 'playbook', true);

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
      expect(result.limit).toBe(1);
    });

    it('should handle export generation requests', async () => {
      const mockSubscription = {
        tier: 'growth'
      };

      const mockUsageCheck = {
        can_generate_playbook: true,
        can_generate_devotional: true,
        can_use_smart_journaling: true,
        can_export: true,
        playbooks_remaining: 15,
        devotionals_remaining: 5,
        show_upgrade_prompt: false
      };

      const mockTierLimits = {
        playbooks_limit: 20,
        devotionals_limit: 8,
        smart_journaling_enabled: true,
        show_dashboard_counts: true
      };

      const mockLegacyLimits = {
        playbooks_limit: 20,
        devotionals_limit: 8,
        smart_journaling_enabled: true,
        show_dashboard_counts: true,
        exports: -1,
        intelligenceEnabled: true
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockNSS.checkUsageLimit.mockResolvedValue(mockUsageCheck);
      mockNSS.getTierLimits.mockReturnValue(mockTierLimits);

      // Mock the getCurrentUsage call for exports
      jest.spyOn(subscriptionService, 'getCurrentUsage').mockResolvedValue({
        playbooks_used: 0,
        devotionals_used: 0,
        exports_used: 0,
        playbooks_generated: 0,
        devotionals_generated: 0,
        exports_generated: 0
      });

      const result = await subscriptionService.canGenerate('user-123', 'export');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe('Unlimited');
      expect(result.limit).toBe('Unlimited');

      jest.restoreAllMocks();
    });

    it('should handle smart journal generation requests', async () => {
      const mockSubscription = {
        tier: 'transformation'
      };

      const mockUsageCheck = {
        can_generate_playbook: true,
        can_generate_devotional: true,
        can_use_smart_journaling: true,
        can_export: true,
        playbooks_remaining: -1,
        devotionals_remaining: -1,
        show_upgrade_prompt: false
      };

      const mockTierLimits = {
        playbooks_limit: -1,
        devotionals_limit: -1,
        smart_journaling_enabled: true,
        show_dashboard_counts: false
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockNSS.checkUsageLimit.mockResolvedValue(mockUsageCheck);
      mockNSS.getTierLimits.mockReturnValue(mockTierLimits);

      const result = await subscriptionService.canGenerate('user-123', 'smart_journal');

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(-1); // smart journal returns -1 as any
      expect(result.limit).toBe(-1);
    });
  });

  describe('getCurrentUsage', () => {
    it('should return current usage statistics', async () => {
      const mockSubscription = {
        tier: 'growth',
        playbooks_used: 5,
        devotionals_used: 3
      };

      const mockTracking = {
        export_count: 2
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [mockTracking], // Return as array
                error: null
              })
            })
          })
        })
      });

      const result = await subscriptionService.getCurrentUsage('user-123');

      expect(result.playbooks_used).toBe(5);
      expect(result.devotionals_used).toBe(3);
      expect(result.exports_used).toBe(2);
      expect(result.playbooks_generated).toBe(5);
      expect(result.devotionals_generated).toBe(3);
      expect(result.exports_generated).toBe(2);
    });

    it('should handle missing usage tracking data', async () => {
      const mockSubscription = {
        tier: 'spark',
        playbooks_used: 2,
        devotionals_used: 1
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue({
                data: [], // Return empty array
                error: null
              })
            })
          })
        })
      });

      const result = await subscriptionService.getCurrentUsage('user-123');

      expect(result.playbooks_used).toBe(2);
      expect(result.devotionals_used).toBe(1);
      expect(result.exports_used).toBe(0); // default to 0
    });

    it('should handle usage tracking errors gracefully', async () => {
      const mockSubscription = {
        tier: 'growth',
        playbooks_used: 3,
        devotionals_used: 2
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              limit: jest.fn().mockRejectedValue(new Error('Usage tracking failed'))
            })
          })
        })
      });

      const result = await subscriptionService.getCurrentUsage('user-123');

      expect(result.playbooks_used).toBe(3);
      expect(result.devotionals_used).toBe(2);
      expect(result.exports_used).toBe(0); // default to 0 on error
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle malformed subscription data', async () => {
      const mockSubscription = {
        tier: null,
        status: undefined,
        playbooks_used: -1
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);

      const result = await subscriptionService.getUserSubscription('user-123');

      expect(result).toBeDefined();
      expect(result.tier).toBeNull();
    });

    it('should handle network timeouts', async () => {
      mockNSS.getUserSubscription.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Network timeout')), 100)
        )
      );

      await expect(subscriptionService.getUserSubscription('user-123')).rejects.toThrow('Network timeout');
    });

    it('should handle concurrent subscription checks', async () => {
      const mockSubscription = {
        tier: 'growth',
        playbooks_used: 5
      };

      const mockUsageCheck = {
        can_generate_playbook: true,
        can_generate_devotional: true,
        can_use_smart_journaling: true,
        can_export: true,
        playbooks_remaining: 15,
        devotionals_remaining: 3,
        show_upgrade_prompt: false
      };

      mockNSS.getUserSubscription.mockResolvedValue(mockSubscription);
      mockNSS.checkUsageLimit.mockResolvedValue(mockUsageCheck);

      // Run multiple concurrent checks
      const promises = Array.from({ length: 5 }, () => 
        subscriptionService.canGenerate('user-123', 'playbook')
      );

      const results = await Promise.all(promises);

      // All should succeed
      results.forEach(result => {
        expect(result.allowed).toBe(true);
      });

      expect(mockNSS.getUserSubscription).toHaveBeenCalledTimes(5);
    });
  });
});
