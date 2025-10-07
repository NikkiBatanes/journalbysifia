
import { loadDiscountState, saveDiscountState, mergeGuestToUser, type DiscountState } from './discountStorage';

export interface PricingTier {
  id: string;
  name: string;
  duration: string;
  description: string;
  features: string[];
  monthlyPrice: number;
  annualPrice: number;
  monthlyOriginal?: number;
  annualOriginal?: number;
  isPopular?: boolean;
}

export interface LocationPricing {
  currency: string;
  symbol: string;
  multiplier: number;
}

export interface DynamicDiscount {
  percentage: number;
  reason: string;
  expiresInMinutes: number;
}

class PricingService {
  private baseUSDPricing: PricingTier[] = [
    {
      id: 'spark',
      name: 'Spark',
      duration: '12 months',
      description: 'For consistent encouragement',
      features: [
        '8 playbooks & 8 devotionals each month',
        'Gentle reminders to keep you on track',
        'Track your progress week by week',
        'Journaling tools to capture your reflections',
        'Calendar Sync to stay on track',
        'Copy To-Dos to other dates for flexibility',
      ],
      monthlyPrice: 7.99,
      annualOriginal: 95.88,
      annualPrice: 79.99,
    },
    {
      id: 'growth',
      name: 'Growth',
      duration: '12 months',
      description: 'For deeper transformation',
      features: [
        '20 playbooks & 20 devotionals each month',
        'Advanced reflection prompts',
        'Seasonal challenges for breakthrough',
        'Journaling tools to capture your reflections',
        'Calendar Sync to stay on track',
        'Copy To-Dos to other dates for flexibility',
      ],
      monthlyPrice: 14.99,
      annualOriginal: 179.88,
      annualPrice: 149.99,
      isPopular: true,
    },
    {
      id: 'transformation',
      name: 'Transformation',
      duration: '12 months',
      description: 'For a life transformed in spirit and purpose',
      features: [
        'Unlimited playbooks & devotionals',
        'Personal spiritual mentor access',
        'Priority support & guidance',
        'Journaling tools to capture your reflections',
        'Calendar Sync to stay on track',
        'Copy To-Dos to other dates for flexibility',
        'Smart Journaling for personalized reflection',
      ],
      monthlyPrice: 24.99,
      annualOriginal: 299.88,
      annualPrice: 249.99,
    },
    {
      id: 'family',
      name: 'Family',
      duration: '12 months',
      description: 'For the whole family\'s growth',
      features: [
        'Everything in Transformation',
        'Up to 5 family member accounts',
      ],
      monthlyPrice: 44.99,
      annualOriginal: 539.88,
      annualPrice: 449.99,
    },
  ];

  private locationPricing: { [key: string]: LocationPricing } = {
    'US': { currency: 'USD', symbol: '$', multiplier: 1.0 },
    // Note: PH uses explicit override pricing below; multiplier is ignored when override is applied
    'PH': { currency: 'PHP', symbol: '₱', multiplier: 56.0 },
    'CA': { currency: 'USD', symbol: '$', multiplier: 1.0 },
    'GB': { currency: 'USD', symbol: '$', multiplier: 1.0 },
    'AU': { currency: 'USD', symbol: '$', multiplier: 1.0 },
    'DEFAULT': { currency: 'USD', symbol: '$', multiplier: 1.0 },
  };

  // Explicit Philippines pricing override (PHP)
  private phOverridePricing: PricingTier[] = [
    {
      id: 'spark',
      name: 'Spark',
      duration: '12 months',
      description: 'For consistent encouragement',
      features: [
        '8 playbooks & 8 devotionals each month',
        'Gentle reminders to keep you on track',
        'Track your progress week by week',
        'Journaling tools to capture your reflections',
        'Calendar Sync to stay on track',
        'Copy To-Dos to other dates for flexibility',
      ],
      // PHP prices
      monthlyPrice: 199,
      annualOriginal: 199 * 12, // 2388
      annualPrice: 1990,
    },
    {
      id: 'growth',
      name: 'Growth',
      duration: '12 months',
      description: 'For deeper transformation',
      features: [
        '20 playbooks & 20 devotionals each month',
        'Advanced reflection prompts',
        'Seasonal challenges for breakthrough',
        'Journaling tools to capture your reflections',
        'Calendar Sync to stay on track',
        'Copy To-Dos to other dates for flexibility',
      ],
      monthlyPrice: 399,
      annualOriginal: 399 * 12, // 4788
      annualPrice: 3990,
      isPopular: true,
    },
    {
      id: 'transformation',
      name: 'Transformation',
      duration: '12 months',
      description: 'For complete spiritual renewal',
      features: [
        'Unlimited playbooks & devotionals',
        'Personal spiritual mentor access',
        'Custom prayer & meditation guides',
        'Priority support & guidance',
        'Journaling tools to capture your reflections',
        'Calendar Sync to stay on track',
        'Copy To-Dos to other dates for flexibility',
      ],
      monthlyPrice: 599,
      annualOriginal: 599 * 12, // 7188
      annualPrice: 5990,
    },
    {
      id: 'family',
      name: 'Family',
      duration: '12 months',
      description: 'For the whole family\'s growth',
      features: [
        'Everything in Transformation',
        'Up to 6 family member accounts',
        'Family devotionals & activities',
        'Parental guidance resources',
        'Journaling tools to capture your reflections',
        'Calendar Sync to stay on track',
        'Copy To-Dos to other dates for flexibility',
      ],
      monthlyPrice: 1290,
      annualOriginal: 1290 * 12, // 15480
      annualPrice: 11990,
    },
  ];

  private userOptOutCount = 0; // legacy in-memory (guest fallback)
  private lastOptOutTime: Date | null = null; // legacy in-memory (guest fallback)

  /**
   * Get user's location-based pricing
   */
  async getUserLocation(): Promise<string> {
    try {
      // In a real app, you would use a location service or IP geolocation
      // For now, we'll simulate this

      return 'US'; // Default to US, change to 'PH' for Philippines testing
    // eslint-disable-next-line no-unreachable
    } catch (error) {
      console.error('Error getting user location:', error);
      return 'DEFAULT';
    }
  }

  /**
   * Get pricing tiers adjusted for user's location
   */
  async getLocationAdjustedPricing(): Promise<PricingTier[]> {
    const location = await this.getUserLocation();
    const locationData = this.locationPricing[location] || this.locationPricing.DEFAULT;
    // Use explicit PH pricing when market is Philippines
    if (location === 'PH') {
      return this.phOverridePricing;
    }

    return this.baseUSDPricing.map(tier => ({
      ...tier,
      monthlyPrice: Math.round(tier.monthlyPrice * locationData.multiplier * 100) / 100,
      annualPrice: Math.round(tier.annualPrice * locationData.multiplier * 100) / 100,
      monthlyOriginal: tier.monthlyOriginal ? Math.round(tier.monthlyOriginal * locationData.multiplier * 100) / 100 : undefined,
      annualOriginal: tier.annualOriginal ? Math.round(tier.annualOriginal * locationData.multiplier * 100) / 100 : undefined,
    }));
  }

  /**
   * Get currency info for user's location
   */
  async getCurrencyInfo(): Promise<LocationPricing> {
    const location = await this.getUserLocation();
    return this.locationPricing[location] || this.locationPricing.DEFAULT;
  }

  /**
   * Track user opt-out and determine if dynamic discount should be offered
   */
  async trackUserOptOut(userId?: string | null, _tierId?: string | null): Promise<boolean> {
    // Persist opt-out per user (or per device for guests)
    const current: DiscountState = (await loadDiscountState(userId)) || {
      discountPolicyVersion: 1,
      optOutCount: 0,
      lastShownAt: null,
      lastDiscountPct: null,
      redeemed: false,
      blockedUntil: null,
    };

    current.optOutCount += 1;
    await saveDiscountState(current, userId);

    // Show dynamic discount after 1st opt-out
    return current.optOutCount >= 1 && !current.redeemed;
  }

  /**
   * Get dynamic discount based on user behavior
   * DISABLED FOR LAUNCH: Focus on free trial only, no promotional discounts
   * TODO: Re-enable after launch when promotional offers are set up in App Store Connect
   */
  async getDynamicDiscount(
    userId?: string | null,
    tierId?: string | null,
    billing?: 'monthly' | 'annual'
  ): Promise<DynamicDiscount | null> {
    // DISABLED FOR LAUNCH - Return null to skip dynamic discount flow
    console.log('[PricingService] ⚠️ Dynamic discount disabled for launch');
    return null;

    /* COMMENTED OUT FOR LAUNCH - Uncomment when ready to enable promotional offers
    console.log('[PricingService] getDynamicDiscount called:', { userId, tierId, billing });

    const current = (await loadDiscountState(userId)) || null;
    const optOuts = current?.optOutCount ?? this.userOptOutCount;
    const redeemed = current?.redeemed ?? false;

    console.log('[PricingService] Discount state loaded:', {
      current,
      optOuts,
      redeemed,
      userOptOutCount: this.userOptOutCount,
    });

    // Enable discount starting on the first opt-out
    if (optOuts < 1 || redeemed) {
      console.log('[PricingService] ❌ Discount not eligible:', {
        optOuts,
        redeemed,
        reason: optOuts < 1 ? 'Not enough opt-outs (need >= 1)' : 'Already redeemed',
      });
      return null;
    }

    const period = billing || 'any';
    const key = tierId ? `${tierId}-${period}` : `default-${period}`;

    console.log('[PricingService] Checking tier/billing combination:', {
      key,
      shownByTier: current?.shownByTier,
      alreadyShown: !!(current?.shownByTier && current.shownByTier[key]),
    });

    // If this exact combo was already shown, do not show again
    if (current?.shownByTier && current.shownByTier[key]) {
      console.log('[PricingService] ❌ Discount already shown for this tier/billing:', key);
      return null;
    }

    // SIMPLIFIED: Always use Tier 1 discount (one step down pricing)
    const percentage = 10; // Fixed at 10% - maps to discount_tier_1

    // Update last shown metadata and also mark this tier/billing as shown
    const next: DiscountState = {
      discountPolicyVersion: 1,
      optOutCount: optOuts,
      lastShownAt: new Date().toISOString(),
      lastDiscountPct: percentage,
      redeemed: redeemed,
      blockedUntil: current?.blockedUntil ?? null,
      shownByTier: { ...(current?.shownByTier || {}), [key]: new Date().toISOString() },
    };
    await saveDiscountState(next, userId);

    return {
      percentage,
      reason: 'Special offer for returning users',
      expiresInMinutes: 15,
    };
    */
  }

  async markDiscountRedeemed(userId?: string | null, percentage?: number): Promise<void> {
    const current = (await loadDiscountState(userId)) || {
      discountPolicyVersion: 1,
      optOutCount: 0,
      lastShownAt: null,
      lastDiscountPct: null,
      redeemed: false,
      blockedUntil: null,
    };
    current.redeemed = true;
    current.lastDiscountPct = percentage;
    await saveDiscountState(current, userId);
  }

  /**
   * Track user opt-out for dynamic discount eligibility
   */
  async trackOptOut(userId?: string | null): Promise<void> {
    const current = (await loadDiscountState(userId)) || {
      discountPolicyVersion: 1,
      optOutCount: 0,
      lastShownAt: null,
      lastDiscountPct: null,
      redeemed: false,
      blockedUntil: null,
    };
    current.optOutCount = (current.optOutCount || 0) + 1;
    await saveDiscountState(current, userId);
  }

  async mergeGuestDiscountStateToUser(userId: string): Promise<void> {
    await mergeGuestToUser(userId);
  }

  /**
   * Apply discount to a price
   */
  applyDiscount(originalPrice: number, discountPercentage: number): number {
    return Math.round(originalPrice * (1 - discountPercentage / 100) * 100) / 100;
  }

  /**
   * Map discount percentage to Apple promotional offer identifier
   * SIMPLIFIED: Always returns tier_1 since we only use one discount level
   */
  getPromotionalOfferIdentifier(discountPercentage: number): string | undefined {
    // Always return tier_1 for any discount (simplified to one tier)
    if (discountPercentage > 0) {
      return 'discount_tier_1';
    }
    return undefined;
  }

  /**
   * Get recommended tier based on user behavior
   */
  getRecommendedTier(): string {
    // Always recommend Growth tier as it's marked as popular
    return 'growth';
  }

  /**
   * Get tier hierarchy for upgrade filtering
   */
  getTierHierarchy(): string[] {
    return ['seeker', 'free_trial', 'spark', 'growth', 'transformation', 'family'];
  }

  /**
   * Get available upgrade tiers based on current user tier
   */
  getUpgradeTiers(currentTier: string): PricingTier[] {
    const hierarchy = this.getTierHierarchy();
    const currentIndex = hierarchy.indexOf(currentTier);

    if (currentIndex === -1) {
      // If current tier not found, show all tiers
      return this.baseUSDPricing;
    }

    // Filter to only show higher tiers
    const availableTierIds = hierarchy.slice(currentIndex + 1);
    return this.baseUSDPricing.filter(tier => availableTierIds.includes(tier.id));
  }

  /**
   * Get location-adjusted upgrade tiers for current user tier
   */
  async getLocationAdjustedUpgradeTiers(currentTier: string): Promise<PricingTier[]> {
    const location = await this.getUserLocation();
    const locationData = this.locationPricing[location] || this.locationPricing.DEFAULT;
    const upgradeTiers = this.getUpgradeTiers(currentTier);
    if (location === 'PH') {
      // Filter PH overrides to only include tiers above currentTier
      const ids = upgradeTiers.map(t => t.id);
      return this.phOverridePricing.filter(t => ids.includes(t.id));
    }

    return upgradeTiers.map(tier => ({
      ...tier,
      monthlyPrice: Math.round(tier.monthlyPrice * locationData.multiplier * 100) / 100,
      annualPrice: Math.round(tier.annualPrice * locationData.multiplier * 100) / 100,
      monthlyOriginal: tier.monthlyOriginal ? Math.round(tier.monthlyOriginal * locationData.multiplier * 100) / 100 : undefined,
      annualOriginal: tier.annualOriginal ? Math.round(tier.annualOriginal * locationData.multiplier * 100) / 100 : undefined,
    }));
  }

  /**
   * Reset opt-out tracking (for testing or new sessions)
   */
  resetOptOutTracking(): void {
    this.userOptOutCount = 0;
    this.lastOptOutTime = null;
  }

  /**
   * Force increment opt-out count for testing dynamic discounts
   */
  async forceIncrementOptOut(userId?: string | null): Promise<void> {
    console.log('[PricingService] 🧪 Force incrementing opt-out count for testing');
    await this.trackOptOut(userId);
    const current = await loadDiscountState(userId);
    console.log('[PricingService] 🧪 New opt-out count:', current?.optOutCount);
  }

  /**
   * Clear discount state for testing
   */
  async clearDiscountState(userId?: string | null): Promise<void> {
    console.log('[PricingService] 🧪 Clearing discount state for testing');
    try {
      const { saveDiscountState } = await import('./discountStorage');
      // Reset to initial state
      const initialState = {
        discountPolicyVersion: 1,
        optOutCount: 0,
        lastShownAt: null,
        lastDiscountPct: null,
        redeemed: false,
        blockedUntil: null,
      };
      await saveDiscountState(initialState, userId);
      console.log('[PricingService] 🧪 Discount state cleared and reset');
    } catch (error) {
      console.error('[PricingService] 🧪 Failed to clear discount state:', error);
    }
  }

  /**
   * Get trial configuration
   */
  getTrialConfig() {
    return {
      durationDays: 3,
      tier: 'growth', // Trial always uses Growth tier
      price: 0,
    };
  }

  /**
   * Format price with currency symbol
   */
  async formatPrice(price: number): Promise<string> {
    const currencyInfo = await this.getCurrencyInfo();
    return `${currencyInfo.symbol}${price.toFixed(2)}`;
  }

  /**
   * Get monthly equivalent price for annual billing
   */
  getMonthlyEquivalent(annualPrice: number): number {
    return Math.round((annualPrice / 12) * 100) / 100;
  }
}

export const pricingService = new PricingService();
export default pricingService;
