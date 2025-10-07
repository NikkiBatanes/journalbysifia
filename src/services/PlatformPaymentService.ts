import { Platform } from 'react-native';
import { AppleStoreKitService, StoreProduct, PurchaseResult } from './AppleStoreKitService';
import { GooglePlayBillingService, GooglePlayProduct, GooglePlayPurchaseResult } from './GooglePlayBillingService';
import { NewSubscriptionService } from './NewSubscriptionService';

export interface UnifiedProduct {
  productId: string;
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
  tier: 'spark' | 'growth' | 'transformation' | 'family';
}

export interface UnifiedPurchaseResult {
  success: boolean;
  transactionId?: string;
  receipt?: string;
  error?: string;
}

export interface SubscriptionStatus {
  isActive: boolean;
  tier: string;
  expiryDate?: string;
  platform: 'apple' | 'google' | null;
}

/**
 * Unified service for handling payments across iOS and Android platforms
 * Abstracts platform-specific payment implementations
 */
export class PlatformPaymentService {
  private static instance: PlatformPaymentService;
  private appleService: AppleStoreKitService;
  private googleService: GooglePlayBillingService;

  private constructor() {
    this.appleService = AppleStoreKitService.getInstance();
    this.googleService = GooglePlayBillingService.getInstance();
  }

  static getInstance(): PlatformPaymentService {
    if (!PlatformPaymentService.instance) {
      PlatformPaymentService.instance = new PlatformPaymentService();
    }
    return PlatformPaymentService.instance;
  }

  /**
   * Initialize payment services for the current platform
   */
  async initialize(): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        return await this.appleService.initialize();
      } else if (Platform.OS === 'android') {
        return await this.googleService.initialize();
      }

      console.warn('[PlatformPayment] Unsupported platform:', Platform.OS);
      return false;
    } catch (error) {
      console.error('[PlatformPayment] Initialization failed:', error);
      return false;
    }
  }

  /**
   * Get available subscription products for the current platform
   */
  async getAvailableProducts(): Promise<UnifiedProduct[]> {
    try {
      let products: (StoreProduct | GooglePlayProduct)[] = [];

      if (Platform.OS === 'ios') {
        products = await this.appleService.getAvailableProducts();
      } else if (Platform.OS === 'android') {
        products = await this.googleService.getAvailableProducts();
      }

      // Convert platform-specific products to unified format
      return products.map(product => ({
        ...product,
        tier: this.getTierFromProductId(product.productId),
      })).filter(product => product.tier !== null) as UnifiedProduct[];
    } catch (error) {
      console.error('[PlatformPayment] Failed to get products:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription with optional promotional offer
   */
  async purchaseSubscription(
    productId: string,
    userId: string,
    offerIdentifier?: string
  ): Promise<UnifiedPurchaseResult> {
    try {
      let result: PurchaseResult | GooglePlayPurchaseResult;

      if (Platform.OS === 'ios') {
        result = await this.appleService.purchaseSubscription(productId, userId, offerIdentifier);
      } else if (Platform.OS === 'android') {
        result = await this.googleService.purchaseSubscription(productId, userId);
      } else {
        throw new Error('Unsupported platform for purchases');
      }

      return {
        success: result.success,
        transactionId: result.transactionId,
        receipt: result.receipt,
        error: result.error,
      };
    } catch (error) {
      console.error('[PlatformPayment] Purchase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get promotional offers for a product (iOS only)
   */
  async getPromotionalOffers(productId: string): Promise<any[]> {
    try {
      if (Platform.OS === 'ios') {
        return await this.appleService.getPromotionalOffers(productId);
      }
      return [];
    } catch (error) {
      console.error('[PlatformPayment] Failed to get promotional offers:', error);
      return [];
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(userId: string): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        return await this.appleService.restorePurchases(userId);
      } else if (Platform.OS === 'android') {
        return await this.googleService.restorePurchases(userId);
      }

      return false;
    } catch (error) {
      console.error('[PlatformPayment] Failed to restore purchases:', error);
      return false;
    }
  }

  /**
   * Get current subscription status
   */
  async getSubscriptionStatus(userId: string): Promise<SubscriptionStatus | null> {
    try {
      // First, get the subscription from our database
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (!subscription) {
        return null;
      }

      // Check platform-specific status if available
      let platformStatus = null;

      if (subscription.platform === 'apple' && Platform.OS === 'ios') {
        platformStatus = await this.appleService.getCurrentSubscriptionStatus(userId);
      } else if (subscription.platform === 'google' && Platform.OS === 'android') {
        platformStatus = await this.googleService.getCurrentSubscriptionStatus(userId);
      }

      return {
        isActive: subscription.status === 'active',
        tier: subscription.tier,
        expiryDate: subscription.subscription_end_date,
        platform: subscription.platform as 'apple' | 'google' | null,
      };
    } catch (error) {
      console.error('[PlatformPayment] Failed to get subscription status:', error);
      return null;
    }
  }

  /**
   * Cancel subscription (platform-specific handling)
   */
  async cancelSubscription(userId: string): Promise<boolean> {
    try {
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (!subscription) {
        throw new Error('No active subscription found');
      }

      // Update our database first
      await NewSubscriptionService.cancelSubscription(userId);

      // Platform-specific cancellation handling
      if (Platform.OS === 'ios') {
        // iOS users need to cancel through Settings app
        console.log('[PlatformPayment] iOS users must cancel through Settings > Apple ID > Subscriptions');
      } else if (Platform.OS === 'android') {
        // Android users cancel through Google Play Store
        await this.googleService.cancelSubscription();
      }

      return true;
    } catch (error) {
      console.error('[PlatformPayment] Failed to cancel subscription:', error);
      return false;
    }
  }

  /**
   * Map product ID to subscription tier
   */
  private getTierFromProductId(productId: string): 'spark' | 'growth' | 'transformation' | 'family' | null {
    if (productId.includes('spark')) {return 'spark';}
    if (productId.includes('growth')) {return 'growth';}
    if (productId.includes('transformation')) {return 'transformation';}
    if (productId.includes('family')) {return 'family';}
    return null;
  }

  /**
   * Get product pricing for display
   */
  async getProductPricing(): Promise<Record<string, string>> {
    try {
      const products = await this.getAvailableProducts();
      const pricing: Record<string, string> = {};

      products.forEach(product => {
        pricing[product.tier] = product.localizedPrice;
      });

      return pricing;
    } catch (error) {
      console.error('[PlatformPayment] Failed to get pricing:', error);
      return {};
    }
  }

  /**
   * Check if in-app purchases are available
   */
  async isPaymentAvailable(): Promise<boolean> {
    try {
      return await this.initialize();
    } catch (error) {
      console.error('[PlatformPayment] Payment availability check failed:', error);
      return false;
    }
  }

  /**
   * Clean up platform services
   */
  async cleanup(): Promise<void> {
    try {
      await Promise.all([
        this.appleService.cleanup(),
        this.googleService.cleanup(),
      ]);

      console.log('[PlatformPayment] Cleanup completed');
    } catch (error) {
      console.error('[PlatformPayment] Cleanup error:', error);
    }
  }
}

export default PlatformPaymentService;
