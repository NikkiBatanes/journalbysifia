import { NewSubscriptionService } from '../../services/NewSubscriptionService';
import { supabase } from '../../services/supabaseClient';

// Mock Supabase client
jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

const mockSupabase = supabase as jest.Mocked<typeof supabase>;

describe('NewSubscriptionService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserSubscription', () => {
    it('should return existing subscription', async () => {
      const mockSubscription = {
        id: 'sub-123',
        user_id: 'user-123',
        tier: 'spark',
        status: 'active',
        playbooks_limit: 8,
        devotionals_limit: 8,
        playbooks_used: 2,
        devotionals_used: 1,
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
      } as any);

      const result = await NewSubscriptionService.getUserSubscription('user-123');

      expect(result).toEqual(expect.objectContaining({
        id: 'sub-123',
        tier: 'spark',
        status: 'active',
      }));
    });

    it('should create default seeker subscription if none exists', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116' },
            }),
          }),
        }),
      } as any);

      // Mock the createDefaultSeekerSubscription call
      const mockNewSubscription = {
        id: 'sub-new',
        user_id: 'user-123',
        tier: 'seeker',
        status: 'active',
        playbooks_limit: 0,
        devotionals_limit: 0,
        playbooks_used: 0,
        devotionals_used: 0,
      };

      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockNewSubscription,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await NewSubscriptionService.getUserSubscription('user-123');

      expect(result.tier).toBe('seeker');
      expect(result.playbooks_limit).toBe(0);
    });
  });

  describe('upgradeSubscription', () => {
    it('should upgrade subscription tier successfully', async () => {
      const mockCurrentSubscription = {
        id: 'sub-123',
        user_id: 'user-123',
        tier: 'seeker',
        status: 'active',
      };

      // Mock getUserSubscription
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCurrentSubscription,
              error: null,
            }),
          }),
        }),
      } as any);

      // Mock update subscription
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { ...mockCurrentSubscription, tier: 'spark' },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const result = await NewSubscriptionService.upgradeSubscription('user-123', {
        target_tier: 'spark',
        platform: 'local_test',
      });

      expect(result.tier).toBe('spark');
    });

    it('should reset usage counters when upgrading from seeker', async () => {
      const mockCurrentSubscription = {
        id: 'sub-123',
        user_id: 'user-123',
        tier: 'seeker',
        status: 'active',
        playbooks_used: 5, // Should be reset
        devotionals_used: 3, // Should be reset
      };

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockCurrentSubscription,
              error: null,
            }),
          }),
        }),
      } as any);

      const mockUpdate = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockCurrentSubscription, tier: 'spark', playbooks_used: 0, devotionals_used: 0 },
              error: null,
            }),
          }),
        }),
      });

      mockSupabase.from.mockReturnValueOnce({
        update: mockUpdate,
      } as any);

      await NewSubscriptionService.upgradeSubscription('user-123', {
        target_tier: 'spark',
        platform: 'local_test',
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        playbooks_used: 0,
        devotionals_used: 0,
      }));
    });
  });

  describe('checkUsageLimit', () => {
    it('should allow generation when under limit', async () => {
      const mockSubscription = {
        tier: 'spark',
        playbooks_limit: 8,
        playbooks_used: 5,
        devotionals_limit: 8,
        devotionals_used: 3,
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
      } as any);

      const result = await NewSubscriptionService.checkUsageLimit('user-123', 'playbook');

      expect(result.can_generate_playbook).toBe(true);
      expect(result.playbooks_remaining).toBe(3);
    });

    it('should deny generation when at limit', async () => {
      const mockSubscription = {
        tier: 'spark',
        playbooks_limit: 8,
        playbooks_used: 8,
        devotionals_limit: 8,
        devotionals_used: 8,
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
      } as any);

      const result = await NewSubscriptionService.checkUsageLimit('user-123', 'playbook');

      expect(result.can_generate_playbook).toBe(false);
      expect(result.playbooks_remaining).toBe(0);
    });

    it('should allow unlimited generation for transformation tier', async () => {
      const mockSubscription = {
        tier: 'transformation',
        playbooks_limit: 999999,
        playbooks_used: 100,
        devotionals_limit: 999999,
        devotionals_used: 50,
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
      } as any);

      const result = await NewSubscriptionService.checkUsageLimit('user-123', 'playbook');

      expect(result.can_generate_playbook).toBe(true);
      expect(result.playbooks_remaining).toBe(-1); // Unlimited
    });
  });

  describe('incrementUsage', () => {
    it('should increment usage counter', async () => {
      const mockSubscription = {
        tier: 'spark',
        playbooks_limit: 8,
        playbooks_used: 5,
      };

      // Mock checkUsageLimit
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSubscription,
              error: null,
            }),
          }),
        }),
      } as any);

      // Mock getUserSubscription
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSubscription,
              error: null,
            }),
          }),
        }),
      } as any);

      // Mock increment update
      const mockUpdate = jest.fn().mockResolvedValue({ error: null });
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: mockUpdate,
        }),
      } as any);

      // Mock usage tracking insert
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn().mockResolvedValue({ error: null }),
      } as any);

      await NewSubscriptionService.incrementUsage('user-123', 'playbook');

      expect(mockUpdate).toHaveBeenCalledWith('user_id', 'user-123');
    });

    it('should skip increment for onboarding seeker playbook', async () => {
      const mockSubscription = {
        tier: 'seeker',
        playbooks_limit: 0,
        playbooks_used: 0,
      };

      // Mock checkUsageLimit
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSubscription,
              error: null,
            }),
          }),
        }),
      } as any);

      // Mock getUserSubscription
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockSubscription,
              error: null,
            }),
          }),
        }),
      } as any);

      // Set onboarding flag
      (global as any).isOnboarding = true;

      await NewSubscriptionService.incrementUsage('user-123', 'playbook');

      // Should not call update or insert for onboarding seeker playbook
      expect(mockSupabase.from).toHaveBeenCalledTimes(2); // Only checkUsageLimit and getUserSubscription

      // Clean up
      delete (global as any).isOnboarding;
    });
  });

  describe('getTierLimits', () => {
    it('should return correct limits for each tier', () => {
      expect(NewSubscriptionService.getTierLimits('seeker')).toEqual({
        playbooks: 0,
        devotionals: 0,
        smart_journaling: false,
      });

      expect(NewSubscriptionService.getTierLimits('spark')).toEqual({
        playbooks: 8,
        devotionals: 8,
        smart_journaling: true,
      });

      expect(NewSubscriptionService.getTierLimits('growth')).toEqual({
        playbooks: 20,
        devotionals: 20,
        smart_journaling: true,
      });

      expect(NewSubscriptionService.getTierLimits('transformation')).toEqual({
        playbooks: -1, // Unlimited
        devotionals: -1, // Unlimited
        smart_journaling: true,
      });

      expect(NewSubscriptionService.getTierLimits('family')).toEqual({
        playbooks: -1, // Unlimited
        devotionals: -1, // Unlimited
        smart_journaling: true,
      });
    });
  });
});
