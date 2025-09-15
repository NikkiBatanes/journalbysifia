
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
      description: 'For complete spiritual renewal',
      features: [
        'Unlimited playbooks & devotionals',
        'Personal spiritual mentor access',
        'Custom prayer & meditation guides',
        'Priority support & guidance',
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
        'Up to 6 family member accounts',
        'Family devotionals & activities',
        'Parental guidance resources',
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
   */
  async getDynamicDiscount(
    userId?: string | null,
    tierId?: string | null,
    billing?: 'monthly' | 'annual'
  ): Promise<DynamicDiscount | null> {
    const current = (await loadDiscountState(userId)) || null;
    const optOuts = current?.optOutCount ?? this.userOptOutCount;
    const redeemed = current?.redeemed ?? false;
    // Enable discount starting on the first opt-out
    if (optOuts < 1 || redeemed) {
      return null;
    }

    const period = billing || 'any';
    const key = tierId ? `${tierId}-${period}` : `default-${period}`;

    // If this exact combo was already shown, do not show again
    if (current?.shownByTier && current.shownByTier[key]) {
      return null;
    }

    // Determine base percentage from opt-outs
    const baseFromOptOut = optOuts >= 4 ? 30 : optOuts >= 3 ? 20 : 10;

    // Cooldown logic: if a discount was offered recently, reuse that percent (no escalation)
    const cooldownMinutes = 60; // avoid escalation within 60 minutes across plan/billing switches
    let reuseLast = false;
    if (current?.lastShownAt) {
      const last = new Date(current.lastShownAt);
      const now = new Date();
      const diffMin = (now.getTime() - last.getTime()) / 60000;
      if (diffMin <= cooldownMinutes && (current.lastDiscountPct ?? 0) > 0) {
        reuseLast = true;
      }
    }

    const percentage = reuseLast
      ? (current?.lastDiscountPct as number)
      : baseFromOptOut;

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
      reason: reuseLast
        ? 'Limited time offer (reserved)'
        : 'Limited time offer for returning users',
      expiresInMinutes: 15,
    };
  }

  async markDiscountRedeemed(userId: string | null | undefined, percentage: number): Promise<void> {
    const current: DiscountState = (await loadDiscountState(userId)) || {
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
