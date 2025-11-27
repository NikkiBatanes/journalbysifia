import { Platform } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
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
  private cachedProducts: UnifiedProduct[] | null = null;
  private lastCacheTime: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
   * Clear the product cache to force fresh data fetch
   */
  clearProductCache(): void {
    this.cachedProducts = null;
    this.lastCacheTime = 0;

  }

  /**
   * Preload products in background for faster subsequent loads
   */
  async preloadProducts(): Promise<void> {
    try {

      await this.getAvailableProducts();

    } catch (error) {
      Logger.warn('[PlatformPayment] Failed to preload products', {
      component: 'PlatformPaymentService',
      errorMessage: error instanceof Error ? error.message : String(error),
    });
      // Don't throw - this is just optimization
    }
  }

  /**
   * Initialize payment services for the current platform
   */
  async initialize(): Promise<boolean> {
    try {
      Logger.info('[PlatformPayment] 🔧 Starting platform payment initialization', {
        component: 'PlatformPaymentService',
        platform: Platform.OS,
        timestamp: new Date().toISOString(),
      });
      
      if (Platform.OS === 'ios') {
        Logger.info('[PlatformPayment] 🔌 Calling AppleStoreKitService.initialize()', {
          component: 'PlatformPaymentService',
          timestamp: new Date().toISOString(),
        });
        
        const result = await this.appleService.initialize();
        
        Logger.info('[PlatformPayment] ✅ AppleStoreKitService.initialize() completed', {
          component: 'PlatformPaymentService',
          result,
          timestamp: new Date().toISOString(),
        });
        
        return result;
      } else if (Platform.OS === 'android') {
        Logger.info('[PlatformPayment] 🔌 Calling GooglePlayBillingService.initialize()', {
          component: 'PlatformPaymentService',
          timestamp: new Date().toISOString(),
        });
        
        const result = await this.googleService.initialize();
        
        Logger.info('[PlatformPayment] ✅ GooglePlayBillingService.initialize() completed', {
          component: 'PlatformPaymentService',
          result,
          timestamp: new Date().toISOString(),
        });
        
        return result;
      }

      Logger.warn('[PlatformPayment] Unsupported platform', {
        component: 'PlatformPaymentService',
        details: Platform.OS,
      });
      return false;
    } catch (error) {
      Logger.error('[PlatformPayment] Initialization failed', error as Error, {
      component: 'PlatformPaymentService',
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString(),
    });
      return false;
    }
  }

  /**
   * Get available subscription products for the current platform
   */
  async getAvailableProducts(): Promise<UnifiedProduct[]> {
    try {
      // Check if we have valid cached products
      const now = Date.now();
      if (this.cachedProducts && (now - this.lastCacheTime) < this.CACHE_DURATION) {

        return this.cachedProducts;
      }

      // Initialize services first (only if not already initialized)
      await this.initialize();

      let products: (StoreProduct | GooglePlayProduct)[] = [];

      if (Platform.OS === 'ios') {
        products = await this.appleService.getAvailableProducts();
      } else if (Platform.OS === 'android') {
        products = await this.googleService.getAvailableProducts();
      }

      // Convert platform-specific products to unified format
      const unifiedProducts = products.map(product => ({
        ...product,
        tier: this.getTierFromProductId(product.productId),
      })).filter(product => product.tier !== null) as UnifiedProduct[];

      // Cache the results
      this.cachedProducts = unifiedProducts;
      this.lastCacheTime = now;

      return unifiedProducts;
    } catch (error) {
      Logger.error('[PlatformPayment] Failed to get products', error as Error, {
      component: 'PlatformPaymentService',
    });

      // If we have cached products, return them as fallback
      if (this.cachedProducts) {
        Logger.warn('[PlatformPayment] Using stale cached products due to error', {
      component: 'PlatformPaymentService',
    });
        return this.cachedProducts;
      }

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
      Logger.error('[PlatformPayment] Purchase failed', error as Error, {
      component: 'PlatformPaymentService',
    });
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
      Logger.error('[PlatformPayment] Failed to get promotional offers', error as Error, {
      component: 'PlatformPaymentService',
    });
      return [];
    }
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(userId: string): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const result = await this.appleService.restorePurchases(userId);
        return result.success;
      } else if (Platform.OS === 'android') {
        return await this.googleService.restorePurchases(userId);
      }

      return false;
    } catch (error) {
      Logger.error('[PlatformPayment] Failed to restore purchases', error as Error, {
      component: 'PlatformPaymentService',
    });
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
      if (subscription.platform === 'apple' && Platform.OS === 'ios') {
        await this.appleService.getCurrentSubscriptionStatus(userId);
      } else if (subscription.platform === 'google' && Platform.OS === 'android') {
        await this.googleService.getCurrentSubscriptionStatus(userId);
      }

      return {
        isActive: subscription.status === 'active',
        tier: subscription.tier,
        expiryDate: subscription.subscription_end_date,
        platform: subscription.platform as 'apple' | 'google' | null,
      };
    } catch (error) {
      Logger.error('[PlatformPayment] Failed to get subscription status', error as Error, {
      component: 'PlatformPaymentService',
    });
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

      } else if (Platform.OS === 'android') {
        // Android users cancel through Google Play Store
        await this.googleService.cancelSubscription();
      }

      return true;
    } catch (error) {
      Logger.error('[PlatformPayment] Failed to cancel subscription', error as Error, {
      component: 'PlatformPaymentService',
    });
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
      Logger.error('[PlatformPayment] Failed to get pricing', error as Error, {
      component: 'PlatformPaymentService',
    });
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
      Logger.error('[PlatformPayment] Payment availability check failed', error as Error, {
      component: 'PlatformPaymentService',
    });
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

    } catch (error) {
      Logger.error('[PlatformPayment] Cleanup error', error as Error, {
      component: 'PlatformPaymentService',
    });
    }
  }
}

export default PlatformPaymentService;
