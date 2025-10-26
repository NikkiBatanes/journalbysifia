import * as RNIap from 'react-native-iap';
import { Platform } from 'react-native';
import { SubscriptionTier } from '../types/subscription';

// Google Play replacement modes
export const GOOGLE_REPLACEMENT_MODES = {
  IMMEDIATE_WITH_TIME_PRORATION: 1,
  IMMEDIATE_WITHOUT_PRORATION: 2,
  DEFERRED: 3,
  CHARGE_PRORATED_PRICE: 5,
  CHARGE_FULL_PRICE: 6,
} as const;

// Replacement mode strategy based on upgrade/downgrade
export const getReplacementMode = (currentTier: SubscriptionTier, targetTier: SubscriptionTier): number => {
  const hierarchy = ['spark', 'growth', 'transformation', 'family'];
  const currentIndex = hierarchy.indexOf(currentTier);
  const targetIndex = hierarchy.indexOf(targetTier);

  if (targetIndex > currentIndex) {
    // Upgrade: Immediate with proration
    return GOOGLE_REPLACEMENT_MODES.IMMEDIATE_WITH_TIME_PRORATION;
  } else if (targetIndex < currentIndex) {
    // Downgrade: Deferred to next billing cycle
    return GOOGLE_REPLACEMENT_MODES.DEFERRED;
  } else {
    // Crossgrade: Same level, no proration
    return GOOGLE_REPLACEMENT_MODES.IMMEDIATE_WITHOUT_PRORATION;
  }
};

// Platform-specific product IDs
export const SUBSCRIPTION_SKUS = {
  ios: {
    spark_monthly: 'app.sifia.com.spark.monthly',
    spark_annual: 'app.sifia.com.spark.annual',
    growth_monthly: 'app.sifia.com.growth.monthly',
    growth_annual: 'app.sifia.com.growth.annual',
    transformation_monthly: 'app.sifia.com.transformation.monthly',
    transformation_annual: 'app.sifia.com.transformation.annual',
    family_monthly: 'app.sifia.com.family.monthly',
    family_annual: 'app.sifia.com.family.annual',
  },
  android: {
    spark_monthly: 'spark_monthly',
    spark_annual: 'spark_annual',
    growth_monthly: 'growth_monthly',
    growth_annual: 'growth_annual',
    transformation_monthly: 'transformation_monthly',
    transformation_annual: 'transformation_annual',
    family_monthly: 'family_monthly',
    family_annual: 'family_annual',
  },
};

export interface SubscriptionProduct {
  productId: string;
  tier: SubscriptionTier;
  billing: 'monthly' | 'annual';
  price: string;
  currency: string;
  localizedPrice: string;
}

export interface UpgradeRequest {
  currentProductId: string;
  targetProductId: string;
  currentTier: SubscriptionTier;
  targetTier: SubscriptionTier;
  billing: 'monthly' | 'annual';
}

export interface UpgradeResult {
  success: boolean;
  transactionId?: string;
  receipt?: string;
  error?: string;
  platform: 'ios' | 'android';
}

export class PlatformSubscriptionError extends Error {
  constructor(
    message: string,
    public code: string,
    public platform: 'ios' | 'android',
    public originalError?: any
  ) {
    super(message);
    this.name = 'PlatformSubscriptionError';
  }
}

class PlatformSubscriptionService {
  private products: SubscriptionProduct[] = [];
  private isInitialized = false;

  /**
   * Initialize the subscription service
   */
  async initialize(): Promise<void> {
    try {

      // Initialize RNIap
      await RNIap.initConnection();

      // Get platform-specific SKUs
      const platformOS = Platform.OS;
      if (platformOS !== 'ios' && platformOS !== 'android') {
        throw new Error(`Unsupported platform: ${platformOS}`);
      }
      const skus = SUBSCRIPTION_SKUS[platformOS];
      const skuList = Object.values(skus);

      // Fetch product details from platform
      const products = await RNIap.getSubscriptions({ skus: skuList });

      // Map to our product interface
      this.products = products.map(product => ({
        productId: product.productId,
        tier: this.extractTierFromSku(product.productId),
        billing: product.productId.includes('annual') ? 'annual' : 'monthly',
        price: (product as any).price || '0',
        currency: (product as any).currency || 'USD',
        localizedPrice: (product as any).localizedPrice || '$0.00',
      }));

      this.isInitialized = true;

    } catch (error) {
      console.error('[PlatformSubscription] Initialization failed:', error);
      throw new PlatformSubscriptionError(
        'Failed to initialize subscription service',
        'INIT_FAILED',
        Platform.OS as 'ios' | 'android',
        error
      );
    }
  }

  /**
   * Get available subscription products
   */
  getProducts(): SubscriptionProduct[] {
    if (!this.isInitialized) {
      throw new PlatformSubscriptionError(
        'Service not initialized',
        'NOT_INITIALIZED',
        Platform.OS as 'ios' | 'android'
      );
    }
    return this.products;
  }

  /**
   * Get product by tier and billing cycle
   */
  getProduct(tier: SubscriptionTier, billing: 'monthly' | 'annual'): SubscriptionProduct | null {
    return this.products.find(p => p.tier === tier && p.billing === billing) || null;
  }

  /**
   * Upgrade subscription (handles both iOS and Android)
   */
  async upgradeSubscription(request: UpgradeRequest): Promise<UpgradeResult> {
    try {

      if (!this.isInitialized) {
        await this.initialize();
      }

      let result;

      if (Platform.OS === 'ios') {
        result = await this.upgradeIOS(request);
      } else {
        result = await this.upgradeAndroid(request);
      }

      return result;

    } catch (error) {
      console.error('[PlatformSubscription] Upgrade failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new PlatformSubscriptionError(
        `Upgrade failed: ${errorMessage}`,
        'UPGRADE_FAILED',
        Platform.OS as 'ios' | 'android',
        error
      );
    }
  }

  /**
   * iOS-specific upgrade handling
   */
  private async upgradeIOS(request: UpgradeRequest): Promise<UpgradeResult> {
    try {
      // Apple handles proration automatically - simple SKU string
      const purchase = await RNIap.requestSubscription({
        sku: request.targetProductId,
        andDangerouslyFinishTransactionAutomaticallyIOS: false,
      });

      if (!purchase) {
        throw new Error('Purchase failed - no transaction returned');
      }

      const purchaseData = Array.isArray(purchase) ? purchase[0] : purchase;

      return {
        success: true,
        transactionId: (purchaseData as any).transactionId || (purchaseData as any).purchaseToken,
        receipt: (purchaseData as any).transactionReceipt || (purchaseData as any).originalJson,
        platform: 'ios',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new PlatformSubscriptionError(
        `iOS upgrade failed: ${errorMessage}`,
        'IOS_UPGRADE_FAILED',
        'ios',
        error
      );
    }
  }

  /**
   * Android-specific upgrade handling
   */
  private async upgradeAndroid(request: UpgradeRequest): Promise<UpgradeResult> {
    try {
      // Get current subscription token
      const currentToken = await this.getCurrentSubscriptionToken();

      if (!currentToken) {
        throw new Error('No current subscription token found');
      }

      // Get appropriate replacement mode
      const replacementMode = getReplacementMode(request.currentTier, request.targetTier);

      // Android upgrade with proper subscription update params
      const purchase = await RNIap.requestSubscription({
        sku: request.targetProductId,
        subscriptionOffers: [{
          offerToken: '',
        }] as any,
        oldPurchaseToken: currentToken,
        replacementMode: replacementMode,
      } as any);

      if (!purchase) {
        throw new Error('Purchase failed - no transaction returned');
      }

      const purchaseData = Array.isArray(purchase) ? purchase[0] : purchase;

      return {
        success: true,
        transactionId: (purchaseData as any).transactionId || (purchaseData as any).purchaseToken,
        receipt: (purchaseData as any).transactionReceipt || (purchaseData as any).originalJson,
        platform: 'android',
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      throw new PlatformSubscriptionError(
        `Android upgrade failed: ${errorMessage}`,
        'ANDROID_UPGRADE_FAILED',
        'android',
        error
      );
    }
  }

  /**
   * Handle subscription downgrade
   * Note: Platforms handle this differently
   */
  async requestDowngrade(
    currentTier: SubscriptionTier,
    targetTier: SubscriptionTier,
    billing: 'monthly' | 'annual'
  ): Promise<{ requiresPlatformAction: boolean; message: string }> {

    if (Platform.OS === 'ios') {
      // iOS: User must downgrade through Settings
      return {
        requiresPlatformAction: true,
        message: 'To downgrade, go to Settings > Apple ID > Subscriptions > siFia and select your new plan.',
      };
    } else {
      // Android: Can be handled in-app for some cases
      if (billing === 'monthly') {
        // Monthly subscriptions can be changed immediately
        try {
          const targetProduct = this.getProduct(targetTier, billing);
          if (!targetProduct) {
            throw new Error('Target product not found');
          }

          const currentToken = await this.getCurrentSubscriptionToken();
          await RNIap.requestSubscription({
            sku: targetProduct.productId,
            subscriptionOffers: [{
              offerToken: '',
            }] as any,
            oldPurchaseToken: currentToken,
            replacementMode: GOOGLE_REPLACEMENT_MODES.DEFERRED,
          } as any);

          return {
            requiresPlatformAction: false,
            message: 'Downgrade scheduled for your next billing cycle.',
          };
        } catch (error) {
          return {
            requiresPlatformAction: true,
            message: 'Please manage your subscription through Google Play Store.',
          };
        }
      } else {
        // Annual subscriptions: redirect to Play Store
        return {
          requiresPlatformAction: true,
          message: 'To change your annual subscription, go to Google Play Store > Subscriptions > siFia.',
        };
      }
    }
  }

  /**
   * Get current subscription status
   */
  async getCurrentSubscription(): Promise<any> {
    try {
      const purchases = await RNIap.getAvailablePurchases();
      const platform = Platform.OS as 'ios' | 'android';
      const subscriptions = purchases.filter(p =>
        SUBSCRIPTION_SKUS[platform] && Object.values(SUBSCRIPTION_SKUS[platform]).includes(p.productId)
      );

      // Return the most recent subscription
      return subscriptions.sort((a, b) =>
        new Date(b.transactionDate).getTime() - new Date(a.transactionDate).getTime()
      )[0] || null;

    } catch (error) {
      console.error('[PlatformSubscription] Failed to get current subscription:', error);
      return null;
    }
  }

  /**
   * Restore purchases (iOS requirement)
   */
  async restorePurchases(): Promise<any[]> {
    try {
      const purchases = await RNIap.getAvailablePurchases();

      return purchases;
    } catch (error) {
      console.error('[PlatformSubscription] Restore failed:', error);
      throw new PlatformSubscriptionError(
        'Failed to restore purchases',
        'RESTORE_FAILED',
        Platform.OS as 'ios' | 'android',
        error
      );
    }
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      await RNIap.endConnection();
      this.isInitialized = false;

    } catch (error) {
      console.error('[PlatformSubscription] Cleanup failed:', error);
    }
  }

  /**
   * Helper: Extract tier from SKU
   */
  private extractTierFromSku(sku: string): SubscriptionTier {
    if (sku.includes('spark')) {return 'spark';}
    if (sku.includes('growth')) {return 'growth';}
    if (sku.includes('transformation')) {return 'transformation';}
    if (sku.includes('family')) {return 'family';}
    return 'spark'; // fallback
  }

  /**
   * Helper: Get current subscription token (Android)
   */
  private async getCurrentSubscriptionToken(): Promise<string | null> {
    try {
      const current = await this.getCurrentSubscription();
      return current?.purchaseToken || null;
    } catch (error) {
      console.error('[PlatformSubscription] Failed to get subscription token:', error);
      return null;
    }
  }

  /**
   * Get tier hierarchy for upgrade validation
   */
  getTierHierarchy(): SubscriptionTier[] {
    return ['spark', 'growth', 'transformation', 'family'];
  }

  /**
   * Check if upgrade is valid
   */
  isValidUpgrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
    const hierarchy = this.getTierHierarchy();
    const currentIndex = hierarchy.indexOf(currentTier);
    const targetIndex = hierarchy.indexOf(targetTier);

    return targetIndex > currentIndex;
  }

  /**
   * Check if downgrade is valid
   */
  isValidDowngrade(currentTier: SubscriptionTier, targetTier: SubscriptionTier): boolean {
    const hierarchy = this.getTierHierarchy();
    const currentIndex = hierarchy.indexOf(currentTier);
    const targetIndex = hierarchy.indexOf(targetTier);

    return targetIndex < currentIndex;
  }
}

export const platformSubscriptionService = new PlatformSubscriptionService();
export default platformSubscriptionService;
