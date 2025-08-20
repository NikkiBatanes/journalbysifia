import { DiscountCodeService } from '../../services/DiscountCodeService';
import { NewSubscriptionService } from '../../services/NewSubscriptionService';
import { supabase } from '../../services/supabaseClient';

// Mock dependencies
jest.mock('../../services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(),
  },
}));

jest.mock('../../services/NewSubscriptionService');

const mockSupabase = supabase as jest.Mocked<typeof supabase>;
const mockNewSubscriptionService = NewSubscriptionService as jest.Mocked<typeof NewSubscriptionService>;

describe('DiscountCodeService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('generatePostCancellationDiscount', () => {
    it('should generate discount for spark tier cancellation', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'seeker',
        status: 'active',
      };

      const mockDiscountCode = {
        id: 'discount-123',
        code: 'COMEBACK123',
        discount_percentage: 25,
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        max_uses: 1,
        current_uses: 0,
        applicable_tiers: ['spark', 'growth', 'transformation', 'family'],
      };

      mockNewSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription as any);

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.generatePostCancellationDiscount('user-123', 'spark');

      expect(result.discount_percentage).toBe(25);
      expect(result.code).toContain('COMEBACK');
      expect(result.applicable_tiers).toContain('spark');
    });

    it('should generate higher discount for premium tier cancellation', async () => {
      const mockSubscription = {
        id: 'sub-123',
        tier: 'seeker',
        status: 'active',
      };

      const mockDiscountCode = {
        id: 'discount-123',
        code: 'COMEBACK456',
        discount_percentage: 35,
        valid_from: new Date().toISOString(),
        valid_until: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString(),
        max_uses: 1,
        current_uses: 0,
        applicable_tiers: ['spark', 'growth', 'transformation', 'family'],
      };

      mockNewSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription as any);

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.generatePostCancellationDiscount('user-123', 'transformation');

      expect(result.discount_percentage).toBe(35);
    });
  });

  describe('validateDiscountCode', () => {
    it('should validate active discount code successfully', async () => {
      const mockDiscountCode = {
        id: 'discount-123',
        code: 'TESTCODE',
        discount_percentage: 20,
        valid_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 1 day from now
        max_uses: 10,
        current_uses: 5,
        applicable_tiers: ['spark', 'growth'],
      };

      // Mock discount code lookup
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      // Mock user usage check
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: null,
                error: { code: 'PGRST116' },
              }),
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.validateDiscountCode('TESTCODE', 'user-123', 'spark');

      expect(result.isValid).toBe(true);
      expect(result.discount).toEqual(expect.objectContaining({
        code: 'TESTCODE',
        discount_percentage: 20,
      }));
    });

    it('should reject expired discount code', async () => {
      const mockDiscountCode = {
        id: 'discount-123',
        code: 'EXPIRED',
        discount_percentage: 20,
        valid_from: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(), // 2 days ago
        valid_until: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 1 day ago
        max_uses: 10,
        current_uses: 5,
        applicable_tiers: ['spark', 'growth'],
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.validateDiscountCode('EXPIRED', 'user-123', 'spark');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Discount code has expired');
    });

    it('should reject code at usage limit', async () => {
      const mockDiscountCode = {
        id: 'discount-123',
        code: 'MAXED',
        discount_percentage: 20,
        valid_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        max_uses: 10,
        current_uses: 10, // At limit
        applicable_tiers: ['spark', 'growth'],
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.validateDiscountCode('MAXED', 'user-123', 'spark');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Discount code has reached maximum usage');
    });

    it('should reject code not applicable to tier', async () => {
      const mockDiscountCode = {
        id: 'discount-123',
        code: 'SPARKONLY',
        discount_percentage: 20,
        valid_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        max_uses: 10,
        current_uses: 5,
        applicable_tiers: ['spark'], // Only for spark
      };

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.validateDiscountCode('SPARKONLY', 'user-123', 'growth');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('Discount code is not applicable to growth tier');
    });

    it('should reject already used code', async () => {
      const mockDiscountCode = {
        id: 'discount-123',
        code: 'USED',
        discount_percentage: 20,
        valid_from: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        valid_until: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        max_uses: 10,
        current_uses: 5,
        applicable_tiers: ['spark', 'growth'],
      };

      // Mock discount code lookup
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      // Mock user usage check - user has already used this code
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              single: jest.fn().mockResolvedValue({
                data: { discount_code: 'USED' },
                error: null,
              }),
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.validateDiscountCode('USED', 'user-123', 'spark');

      expect(result.isValid).toBe(false);
      expect(result.error).toBe('You have already used this discount code');
    });
  });

  describe('applyDiscountCode', () => {
    it('should apply valid discount code successfully', async () => {
      const mockValidation = {
        isValid: true,
        discount: {
          id: 'discount-123',
          code: 'VALID',
          discount_percentage: 20,
          current_uses: 5,
        },
        discountAmount: 2.00,
      };

      // Mock validation
      jest.spyOn(DiscountCodeService, 'validateDiscountCode').mockResolvedValue(mockValidation as any);

      // Mock subscription update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      // Mock usage count update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ error: null }),
        }),
      } as any);

      const result = await DiscountCodeService.applyDiscountCode('user-123', 'VALID', 'spark');

      expect(result).toBe(true);
    });

    it('should reject invalid discount code', async () => {
      const mockValidation = {
        isValid: false,
        discount: null,
        error: 'Invalid discount code',
      };

      jest.spyOn(DiscountCodeService, 'validateDiscountCode').mockResolvedValue(mockValidation);

      await expect(
        DiscountCodeService.applyDiscountCode('user-123', 'INVALID', 'spark')
      ).rejects.toThrow('Invalid discount code');
    });
  });

  describe('generatePersonalizedDiscount', () => {
    it('should generate trial extension discount', async () => {
      const mockSubscription = {
        tier: 'seeker',
        status: 'trial',
      };

      const mockDiscountCode = {
        id: 'discount-123',
        code: 'EXTEND123',
        discount_percentage: 15,
        applicable_tiers: ['spark', 'growth'],
      };

      mockNewSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription as any);

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.generatePersonalizedDiscount('user-123', 'trial_extension');

      expect(result.discount_percentage).toBe(15);
      expect(result.code).toContain('EXTEND');
      expect(result.applicable_tiers).toEqual(['spark', 'growth']);
    });

    it('should generate upgrade incentive discount', async () => {
      const mockSubscription = {
        tier: 'spark',
        status: 'active',
      };

      const mockDiscountCode = {
        id: 'discount-123',
        code: 'UPGRADE123',
        discount_percentage: 20,
        applicable_tiers: ['growth', 'transformation'],
      };

      mockNewSubscriptionService.getUserSubscription.mockResolvedValue(mockSubscription as any);

      mockSupabase.from.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: mockDiscountCode,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.generatePersonalizedDiscount('user-123', 'upgrade_incentive');

      expect(result.discount_percentage).toBe(20);
      expect(result.code).toContain('UPGRADE');
      expect(result.applicable_tiers).toEqual(['growth', 'transformation']);
    });
  });

  describe('cleanupExpiredDiscountCodes', () => {
    it('should mark expired codes as inactive', async () => {
      const mockExpiredCodes = [
        { id: 'discount-1' },
        { id: 'discount-2' },
        { id: 'discount-3' },
      ];

      mockSupabase.from.mockReturnValue({
        update: jest.fn().mockReturnValue({
          lt: jest.fn().mockReturnValue({
            select: jest.fn().mockResolvedValue({
              data: mockExpiredCodes,
              error: null,
            }),
          }),
        }),
      } as any);

      const result = await DiscountCodeService.cleanupExpiredDiscountCodes();

      expect(result).toBe(3);
    });
  });
});
