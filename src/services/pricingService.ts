import { Platform, NativeModules } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
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
      // PHP prices (in pesos, not cents)
      monthlyPrice: 199.00,
      annualOriginal: 2388.00,
      annualPrice: 1990.00,
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
      monthlyPrice: 399.00,
      annualOriginal: 4788.00,
      annualPrice: 3990.00,
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
      monthlyPrice: 599.00,
      annualOriginal: 7188.00,
      annualPrice: 5990.00,
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
      monthlyPrice: 1290.00,
      annualOriginal: 15480.00,
      annualPrice: 11990.00,
    },
  ];

  private userOptOutCount = 0; // legacy in-memory (guest fallback)
  private lastOptOutTime: Date | null = null; // legacy in-memory (guest fallback)

  /**
   * Get user's location-based pricing
   */
  async getUserLocation(): Promise<string> {
    try {
      let locale = '';

      if (Platform.OS === 'ios') {
        // iOS: Get locale from settings
        locale = NativeModules.SettingsManager?.settings?.AppleLocale ||
                 NativeModules.SettingsManager?.settings?.AppleLanguages?.[0] || '';
      } else if (Platform.OS === 'android') {
        // Android: Get locale from I18nManager
        locale = NativeModules.I18nManager?.localeIdentifier || '';
      }

      // Extract country code from locale (e.g., "en_PH" -> "PH", "en-PH" -> "PH")
      const countryMatch = locale.match(/[-_]([A-Z]{2})$/i);
      const countryCode = countryMatch ? countryMatch[1].toUpperCase() : '';

      // Return country code if we have pricing for it, otherwise default to US
      if (countryCode && this.locationPricing[countryCode]) {

        return countryCode;
      }

      return 'US';
    } catch (error) {
      Logger.error('[PricingService] Error getting user location', error as Error, { component: 'pricingService' });
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

    // FORCE Philippine pricing for development/testing
    if (__DEV__) {

      return this.phOverridePricing;
    }

    // DEFAULT to Philippine pricing (this is a Philippines-focused app)
    // Only use USD pricing if explicitly in a USD market
    if (location === 'US' || location === 'CA' || location === 'GB' || location === 'AU') {
      return this.baseUSDPricing.map(tier => ({
        ...tier,
        monthlyPrice: Math.round(tier.monthlyPrice * locationData.multiplier * 100) / 100,
        annualPrice: Math.round(tier.annualPrice * locationData.multiplier * 100) / 100,
        monthlyOriginal: tier.monthlyOriginal ? Math.round(tier.monthlyOriginal * locationData.multiplier * 100) / 100 : undefined,
        annualOriginal: tier.annualOriginal ? Math.round(tier.annualOriginal * locationData.multiplier * 100) / 100 : undefined,
      }));
    }

    // Default to PHP pricing for all other markets
    return this.phOverridePricing;
  }

  /**
   * Get currency info for user's location
   */
  async getCurrencyInfo(): Promise<LocationPricing> {
    const location = await this.getUserLocation();

    // FORCE Philippine currency for development/testing (matches pricing override)
    if (__DEV__) {
      return this.locationPricing.PH;
    }

    // DEFAULT to Philippine currency (this is a Philippines-focused app)
    // Only use USD currency if explicitly in a USD market
    if (location === 'US' || location === 'CA' || location === 'GB' || location === 'AU') {
      return this.locationPricing[location] || this.locationPricing.DEFAULT;
    }

    // Default to PHP currency for all other markets
    return this.locationPricing.PH;
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
  async getDynamicDiscount(): Promise<DynamicDiscount | null> {
    // DISABLED FOR LAUNCH - Return null to skip dynamic discount flow

    return null;

    /* COMMENTED OUT FOR LAUNCH - Uncomment when ready to enable promotional offers

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

    // Get tier hierarchy to filter upgrade tiers
    const hierarchy = this.getTierHierarchy();
    const currentIndex = hierarchy.indexOf(currentTier);
    const availableTierIds = currentIndex === -1
      ? hierarchy
      : hierarchy.slice(currentIndex + 1);

    // Use explicit PH pricing when market is Philippines
    if (location === 'PH') {
      return this.phOverridePricing.filter(t => availableTierIds.includes(t.id));
    }

    // FORCE Philippine pricing for development/testing
    if (__DEV__) {
      return this.phOverridePricing.filter(t => availableTierIds.includes(t.id));
    }

    // DEFAULT to Philippine pricing (this is a Philippines-focused app)
    // Only use USD pricing if explicitly in a USD market
    if (location === 'US' || location === 'CA' || location === 'GB' || location === 'AU') {
      const upgradeTiers = this.getUpgradeTiers(currentTier);
      return upgradeTiers.map(tier => ({
        ...tier,
        monthlyPrice: Math.round(tier.monthlyPrice * locationData.multiplier * 100) / 100,
        annualPrice: Math.round(tier.annualPrice * locationData.multiplier * 100) / 100,
        monthlyOriginal: tier.monthlyOriginal ? Math.round(tier.monthlyOriginal * locationData.multiplier * 100) / 100 : undefined,
        annualOriginal: tier.annualOriginal ? Math.round(tier.annualOriginal * locationData.multiplier * 100) / 100 : undefined,
      }));
    }

    // Default to PHP pricing for all other markets
    return this.phOverridePricing.filter(t => availableTierIds.includes(t.id));
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

    await this.trackOptOut(userId);

  }

  /**
   * Clear discount state for testing
   */
  async clearDiscountState(userId?: string | null): Promise<void> {

    try {
      const { saveDiscountState: saveDiscountStateFn } = await import('./discountStorage');
      // Reset to initial state
      const initialState = {
        discountPolicyVersion: 1,
        optOutCount: 0,
        lastShownAt: null,
        lastDiscountPct: null,
        redeemed: false,
        redeemedAt: null,
      };
      await saveDiscountStateFn(initialState, userId);

    } catch (error) {
      Logger.error('[PricingService] 🧪 Failed to clear discount state', error as Error, { component: 'pricingService' });
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
   * Format price with currency symbol (removes .00 for whole numbers in PHP)
   */
  async formatPrice(price: number): Promise<string> {
    const currencyInfo = await this.getCurrencyInfo();

    // For PHP, remove .00 for whole numbers
    if (currencyInfo.currency === 'PHP' && price % 1 === 0) {
      return `${currencyInfo.symbol}${Math.floor(price)}`;
    }

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
