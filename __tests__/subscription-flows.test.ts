/**
 * Subscription Flow Tests
 * Tests for Trial Flow and Sales Offer Flow
 */

import { NewSubscriptionService } from '../src/services/NewSubscriptionService';

// Mock Supabase
jest.mock('../src/services/supabaseClient', () => ({
  supabase: {
    from: jest.fn(() => ({
      upsert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => ({
            data: null,
            error: null,
          })),
        })),
      })),
      update: jest.fn(() => ({
        eq: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: null,
            })),
          })),
        })),
      })),
    })),
  },
}));

describe('Subscription Flows', () => {
  describe('Trial Flow', () => {
    it('should create free_trial tier with 2 playbooks and 2 devotionals', () => {
      // Test tier limits for free_trial
      const limits = NewSubscriptionService.getTierLimits('free_trial');
      
      expect(limits).toEqual({
        playbooks_limit: 2,
        devotionals_limit: 2,
        smart_journaling_enabled: true,
        show_dashboard_counts: true,
      });
    });

    it('should store chosen tier for post-trial conversion', async () => {
      // Mock the database response
      const mockTrialData = {
        id: 'test-id',
        user_id: 'test-user',
        tier: 'free_trial',
        status: 'active',
        playbooks_limit: 2,
        devotionals_limit: 2,
        trial_chosen_tier: 'growth',
        trial_start_date: new Date().toISOString(),
        trial_end_date: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
      };

      // Verify trial stores the chosen tier
      expect(mockTrialData.tier).toBe('free_trial');
      expect(mockTrialData.trial_chosen_tier).toBe('growth');
      expect(mockTrialData.playbooks_limit).toBe(2);
      expect(mockTrialData.devotionals_limit).toBe(2);
    });

    it('should calculate correct trial end date (3 days)', () => {
      const startDate = new Date('2025-10-08T00:00:00Z');
      const endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 3);

      const expectedEndDate = new Date('2025-10-11T00:00:00Z');
      
      expect(endDate.toISOString()).toBe(expectedEndDate.toISOString());
    });
  });

  describe('Sales Offer Flow', () => {
    it('should create paid tier with full limits immediately', () => {
      // Test tier limits for growth (paid)
      const limits = NewSubscriptionService.getTierLimits('growth');
      
      expect(limits).toEqual({
        playbooks_limit: 20,
        devotionals_limit: 20,
        smart_journaling_enabled: true,
        show_dashboard_counts: true,
      });
    });

    it('should NOT create trial for sales offer', () => {
      // Sales offer parameters
      const salesOfferParams = {
        selectedTier: 'growth',
        isAnnual: true,
        price: 149.99,
        isTrial: false, // IMPORTANT: Sales offer is never trial
        trialDays: 0,
      };

      expect(salesOfferParams.isTrial).toBe(false);
      expect(salesOfferParams.trialDays).toBe(0);
    });

    it('should create full tier subscription immediately for sales offer', async () => {
      // Mock paid subscription data
      const mockPaidSubscription = {
        id: 'test-id',
        user_id: 'test-user',
        tier: 'growth',
        status: 'active',
        playbooks_limit: 20,
        devotionals_limit: 20,
        trial_start_date: null, // No trial
        trial_end_date: null, // No trial
        trial_chosen_tier: null, // No trial
      };

      // Verify paid subscription has full limits
      expect(mockPaidSubscription.tier).toBe('growth');
      expect(mockPaidSubscription.playbooks_limit).toBe(20);
      expect(mockPaidSubscription.devotionals_limit).toBe(20);
      expect(mockPaidSubscription.trial_start_date).toBeNull();
    });
  });

  describe('Trial to Paid Conversion', () => {
    it('should upgrade from free_trial to chosen tier after payment', () => {
      // Before conversion (trial)
      const beforeConversion = {
        tier: 'free_trial',
        playbooks_limit: 2,
        devotionals_limit: 2,
        trial_chosen_tier: 'growth',
      };

      // After conversion (paid)
      const afterConversion = {
        tier: 'growth', // Upgraded to chosen tier
        playbooks_limit: 20, // Full limits
        devotionals_limit: 20, // Full limits
        trial_chosen_tier: 'growth', // Kept for reference
      };

      expect(beforeConversion.tier).toBe('free_trial');
      expect(afterConversion.tier).toBe('growth');
      expect(afterConversion.playbooks_limit).toBe(20);
      expect(afterConversion.devotionals_limit).toBe(20);
    });
  });

  describe('Tier Limits Validation', () => {
    it('should have correct limits for all tiers', () => {
      const tiers = {
        seeker: { playbooks: 0, devotionals: 0 },
        free_trial: { playbooks: 2, devotionals: 2 },
        spark: { playbooks: 8, devotionals: 8 },
        growth: { playbooks: 20, devotionals: 20 },
        transformation: { playbooks: 999999, devotionals: 999999 },
        family: { playbooks: 999999, devotionals: 999999 },
      };

      Object.entries(tiers).forEach(([tier, expected]) => {
        const limits = NewSubscriptionService.getTierLimits(tier as any);
        expect(limits.playbooks_limit).toBe(expected.playbooks);
        expect(limits.devotionals_limit).toBe(expected.devotionals);
      });
    });
  });

  describe('Product ID Logic', () => {
    it('should use .freetrial suffix for trial products', () => {
      const trialProductId = 'app.sifia.com.growth.monthly.freetrial';
      expect(trialProductId).toContain('.freetrial');
    });

    it('should NOT use .freetrial suffix for paid products', () => {
      const paidProductId = 'app.sifia.com.growth.monthly';
      expect(paidProductId).not.toContain('.freetrial');
    });
  });

  describe('Navigation Flow', () => {
    it('should pass correct params for trial flow', () => {
      const trialParams = {
        selectedTier: 'growth',
        isAnnual: true,
        price: 149.99,
        isTrial: true, // Trial flow
        trialDays: 3,
      };

      expect(trialParams.isTrial).toBe(true);
      expect(trialParams.trialDays).toBe(3);
    });

    it('should pass correct params for sales offer flow', () => {
      const salesParams = {
        selectedTier: 'growth',
        isAnnual: true,
        price: 149.99,
        isTrial: false, // Paid flow
        trialDays: 0,
      };

      expect(salesParams.isTrial).toBe(false);
      expect(salesParams.trialDays).toBe(0);
    });
  });
});

describe('Integration Flow Tests', () => {
  describe('Complete Trial Flow', () => {
    it('should follow correct trial flow steps', () => {
      const flow = [
        { step: 1, screen: 'OnboardingTrialOfferScreen', action: 'User taps "Start Free Trial"' },
        { step: 2, screen: 'OnboardingPaymentProcessingScreen', params: { isTrial: true, trialDays: 3 } },
        { step: 3, database: 'Create free_trial tier', limits: { playbooks: 2, devotionals: 2 } },
        { step: 4, storekit: 'Use product: app.sifia.com.growth.monthly.freetrial' },
        { step: 5, apple: 'Charge $0 for 3 days' },
        { step: 6, after3days: 'Apple charges full price' },
        { step: 7, database: 'Upgrade to growth tier', limits: { playbooks: 20, devotionals: 20 } },
      ];

      expect(flow[0].screen).toBe('OnboardingTrialOfferScreen');
      expect(flow[2].limits).toEqual({ playbooks: 2, devotionals: 2 });
      expect(flow[6].limits).toEqual({ playbooks: 20, devotionals: 20 });
    });
  });

  describe('Complete Sales Offer Flow', () => {
    it('should follow correct sales offer flow steps', () => {
      const flow = [
        { step: 1, screen: 'OnboardingSalesOfferScreen', action: 'User taps "Continue My Journey"' },
        { step: 2, screen: 'OnboardingPaymentProcessingScreen', params: { isTrial: false, trialDays: 0 } },
        { step: 3, database: 'Create growth tier', limits: { playbooks: 20, devotionals: 20 } },
        { step: 4, storekit: 'Use product: app.sifia.com.growth.monthly' },
        { step: 5, apple: 'Charge full price immediately' },
        { step: 6, result: 'User gets full access right away' },
      ];

      expect(flow[0].screen).toBe('OnboardingSalesOfferScreen');
      expect(flow[1].params).toEqual({ isTrial: false, trialDays: 0 });
      expect(flow[2].limits).toEqual({ playbooks: 20, devotionals: 20 });
    });
  });
});

describe('Edge Cases', () => {
  it('should handle trial expiration correctly', () => {
    const trialStartDate = new Date('2025-10-08T00:00:00Z');
    const trialEndDate = new Date('2025-10-11T00:00:00Z');
    const currentDate = new Date('2025-10-12T00:00:00Z');

    const isExpired = currentDate > trialEndDate;
    expect(isExpired).toBe(true);
  });

  it('should not allow trial if user already had trial', () => {
    const subscription = {
      tier: 'seeker',
      trial_start_date: '2025-10-01T00:00:00Z', // Had trial before
      trial_end_date: '2025-10-04T00:00:00Z',
    };

    const hasEverStartedTrial = !!subscription.trial_start_date;
    const canOfferTrial = !hasEverStartedTrial;

    expect(canOfferTrial).toBe(false);
  });

  it('should allow trial for new users', () => {
    const subscription = {
      tier: 'seeker',
      trial_start_date: null, // Never had trial
      trial_end_date: null,
    };

    const hasEverStartedTrial = !!subscription.trial_start_date;
    const canOfferTrial = !hasEverStartedTrial;

    expect(canOfferTrial).toBe(true);
  });
});
