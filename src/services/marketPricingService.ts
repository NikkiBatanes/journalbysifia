/**
 * Market-Specific Pricing Service
 * Handles US and Philippines pricing with PPP adjustments
 */

/// <reference lib="dom" />

// Extend only the specific properties we need from Navigator
interface CustomNavigator {
  language: string;
  languages?: readonly string[];
  // Add other Navigator properties as needed
  userAgent?: string;
  platform?: string;
}

declare const window: Window & typeof globalThis & {
  navigator?: CustomNavigator;
};

declare const navigator: CustomNavigator;

import { SubscriptionTier, PRICING_US, PRICING_PH } from '../interfaces/subscription';

export type Market = 'US' | 'PH';

export interface MarketPricing {
  amount: number;
  currency: string;
  interval: 'month' | 'year';
  displayPrice: string;
  usdEquivalent?: number;
}

export class MarketPricingService {
  /**
   * Detect user's market based on various factors
   */
  async detectUserMarket(userId?: string): Promise<Market> {
    try {
      // Method 1: Check user's stored country preference
      if (userId) {
        // TODO: Query user's country from database
        // const user = await getUserProfile(userId);
        // if (user.country === 'PH') return 'PH';
        // if (user.country === 'US') return 'US';
      }

      // Method 2: IP-based geolocation (client-side)
      if (typeof window !== 'undefined') {
        try {
          const response = await fetch('https://ipapi.co/json/');
          const data = await response.json();
          if (data.country_code === 'PH') {return 'PH';}
          if (data.country_code === 'US') {return 'US';}
        } catch (error) {
          console.warn('[MarketPricing] IP detection failed:', error);
        }
      }

      // Method 3: Browser locale detection
      if (typeof navigator !== 'undefined') {
        const locale = navigator.language || navigator.languages?.[0];
        if (locale?.startsWith('fil') || locale?.includes('PH')) {return 'PH';}
        if (locale?.startsWith('en-US')) {return 'US';}
      }

      // Default to US market
      return 'US';
    } catch (error) {
      console.error('[MarketPricing] Market detection failed:', error);
      return 'US'; // Safe default
    }
  }

  /**
   * Get pricing for specific market and tier
   */
  getPricing(market: Market, tier: SubscriptionTier): MarketPricing {
    const pricing = market === 'PH' ? PRICING_PH : PRICING_US;
    const tierPricing = pricing[tier];

    if (!tierPricing) {
      throw new Error(`Invalid tier: ${tier}`);
    }

    const displayPrice = this.formatPrice(tierPricing.amount, tierPricing.currency);
    const usdEquivalent = market === 'PH' ? this.convertToUSD(tierPricing.amount) : undefined;

    return {
      amount: tierPricing.amount,
      currency: tierPricing.currency,
      interval: tierPricing.interval,
      displayPrice,
      usdEquivalent,
    };
  }

  /**
   * Get all pricing for a market
   */
  getAllPricing(market: Market): Record<SubscriptionTier, MarketPricing> {
    const tiers: SubscriptionTier[] = [
      'free_trial', 'starter', 'growth', 'transformation', 'family',
      'starter_annual', 'growth_annual', 'transformation_annual', 'family_annual',
    ];

    const result = {} as Record<SubscriptionTier, MarketPricing>;

    tiers.forEach(tier => {
      result[tier] = this.getPricing(market, tier);
    });

    return result;
  }

  /**
   * Format price for display
   */
  private formatPrice(amount: number, currency: string): string {
    const value = amount / 100; // Convert from cents

    if (currency === 'usd') {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
      }).format(value);
    }

    if (currency === 'php') {
      return new Intl.NumberFormat('en-PH', {
        style: 'currency',
        currency: 'PHP',
      }).format(value);
    }

    return `${value} ${currency.toUpperCase()}`;
  }

  /**
   * Convert PHP to USD (approximate)
   */
  private convertToUSD(phpCents: number): number {
    const phpAmount = phpCents / 100;
    const exchangeRate = 0.018; // Approximate PHP to USD rate
    return Math.round(phpAmount * exchangeRate * 100) / 100;
  }

  /**
   * Get market-specific payment methods
   */
  getPaymentMethods(market: Market): string[] {
    if (market === 'PH') {
      return [
        'card', // Credit/Debit cards
        'gcash', // Most popular e-wallet
        'paymaya', // Second most popular e-wallet
        'bank_transfer',
        'cash', // 7-Eleven cash payments
      ];
    }

    return [
      'card', // Credit/Debit cards
      'paypal',
      'apple_pay',
      'google_pay',
      'bank_transfer',
    ];
  }

  /**
   * Get market-specific messaging
   */
  getMarketMessaging(market: Market): {
    currency: string;
    pricePoint: string;
    valueProposition: string;
  } {
    if (market === 'PH') {
      return {
        currency: '₱',
        pricePoint: 'Affordable spiritual growth',
        valueProposition: 'Transform your faith journey for less than a coffee per day',
      };
    }

    return {
      currency: '$',
      pricePoint: 'Premium spiritual coaching',
      valueProposition: 'Accelerate your spiritual growth with AI-powered guidance',
    };
  }

  /**
   * A/B Testing: Get pricing variant for user
   */
  async getPricingVariant(userId: string, _market: Market): Promise<'control' | 'variant'> {
    // Simple hash-based assignment for consistent user experience
    const hash = this.simpleHash(userId);
    return hash % 2 === 0 ? 'control' : 'variant';
  }

  /**
   * Get A/B test pricing (for testing $4.99 vs $6.99 starter)
   */
  getABTestPricing(_market: Market, _variant: 'control' | 'variant'): Record<SubscriptionTier, MarketPricing> {
    const basePricing = this.getAllPricing(_market);

    if (_variant === 'control') {
      // Control: Original $4.99 starter pricing
      if (_market === 'US') {
        basePricing.starter = {
          amount: 499, // $4.99
          currency: 'usd',
          interval: 'month',
          displayPrice: '$4.99',
        };
        basePricing.starter_annual = {
          amount: 4199, // $41.99 (17% off)
          currency: 'usd',
          interval: 'year',
          displayPrice: '$41.99',
        };
      } else {
        basePricing.starter = {
          amount: 19900, // ₱199
          currency: 'php',
          interval: 'month',
          displayPrice: '₱199',
          usdEquivalent: 3.58,
        };
        basePricing.growth = {
          amount: 34900, // ₱349
          currency: 'php',
          interval: 'month',
          displayPrice: '₱349',
          usdEquivalent: 6.28,
        };
        basePricing.transformation = {
          amount: 54900, // ₱549
          currency: 'php',
          interval: 'month',
          displayPrice: '₱549',
          usdEquivalent: 9.88,
        };
        basePricing.family = {
          amount: 69900, // ₱699
          currency: 'php',
          interval: 'month',
          displayPrice: '₱699',
          usdEquivalent: 12.58,
        };
      }
    }
    // Variant uses current $6.99 pricing (already set)

    return basePricing;
  }

  /**
   * Simple hash function for consistent A/B assignment
   */
  private simpleHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      // Replace bitwise operations with arithmetic operations
      hash = ((hash * 31) + char) % 1000000; // Using a large prime number for distribution
    }
    return Math.abs(hash);
  }
}

// Export singleton instance
export const marketPricingService = new MarketPricingService();

// Helper hooks for React components
export const useMarketPricing = () => {
  return marketPricingService;
};

/**
 * Example usage:
 *
 * const market = await marketPricingService.detectUserMarket(userId);
 * const pricing = marketPricingService.getAllPricing(market);
 * const variant = await marketPricingService.getPricingVariant(userId, market);
 * const testPricing = marketPricingService.getABTestPricing(market, variant);
 */
