import { NativeModules, Platform } from 'react-native';
import RNIap, {
  Product,
  ProductPurchase,
  PurchaseError,
  Subscription,
  initConnection,
  endConnection,
  getProducts,
  getSubscriptions,
  requestPurchase,
  requestSubscription,
  finishTransaction,
  validateReceiptIos,
  validateReceiptAndroid,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from 'react-native-iap';
import { NewSubscriptionService } from './NewSubscriptionService';

export interface StoreProduct {
  productId: string;
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
}

export interface PurchaseResult {
  success: boolean;
  transactionId?: string;
  receipt?: string;
  error?: string;
}

export class AppleStoreKitService {
  private static instance: AppleStoreKitService;
  private isInitialized = false;
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  // Product IDs for subscription tiers
  private static readonly PRODUCT_IDS = {
    spark: 'com.yourcompany.sifia.spark.monthly',
    growth: 'com.yourcompany.sifia.growth.monthly',
    transformation: 'com.yourcompany.sifia.transformation.monthly',
    family: 'com.yourcompany.sifia.family.monthly',
  };

  private constructor() {}

  static getInstance(): AppleStoreKitService {
    if (!AppleStoreKitService.instance) {
      AppleStoreKitService.instance = new AppleStoreKitService();
    }
    return AppleStoreKitService.instance;
  }

  /**
   * Initialize the connection to the App Store
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      const result = await initConnection();
      console.log('[StoreKit] Connection initialized:', result);

      // Set up purchase listeners
      this.setupPurchaseListeners();
      
      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[StoreKit] Failed to initialize:', error);
      return false;
    }
  }

  /**
   * Set up purchase event listeners
   */
  private setupPurchaseListeners(): void {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {
        console.log('[StoreKit] Purchase updated:', purchase);
        await this.handlePurchaseUpdate(purchase);
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('[StoreKit] Purchase error:', error);
        this.handlePurchaseError(error);
      }
    );
  }

  /**
   * Get available subscription products from the App Store
   */
  async getAvailableProducts(): Promise<StoreProduct[]> {
    try {
      await this.initialize();

      const productIds = Object.values(AppleStoreKitService.PRODUCT_IDS);
      const products = await getSubscriptions({ skus: productIds });

      return products.map((product: Subscription) => ({
        productId: product.productId,
        price: product.price,
        currency: product.currency,
        localizedPrice: product.localizedPrice,
        title: product.title,
        description: product.description,
      }));
    } catch (error) {
      console.error('[StoreKit] Failed to get products:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription
   */
  async purchaseSubscription(
    productId: string,
    userId: string
  ): Promise<PurchaseResult> {
    try {
      await this.initialize();

      console.log('[StoreKit] Requesting subscription purchase:', productId);
      
      if (Platform.OS === 'ios') {
        await requestSubscription({ sku: productId });
      } else {
        // For Android, we'll handle this in GooglePlayBillingService
        throw new Error('Use GooglePlayBillingService for Android purchases');
      }

      // The actual purchase handling will be done in the listener
      return { success: true };
    } catch (error) {
      console.error('[StoreKit] Purchase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle purchase updates from the store
   */
  private async handlePurchaseUpdate(purchase: ProductPurchase): Promise<void> {
    try {
      console.log('[StoreKit] Processing purchase:', {
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        transactionDate: purchase.transactionDate,
      });

      // Validate the receipt
      const isValid = await this.validateReceipt(purchase);
      
      if (!isValid) {
        console.error('[StoreKit] Receipt validation failed');
        return;
      }

      // Map product ID to subscription tier
      const tier = this.getSubscriptionTierFromProductId(purchase.productId);
      
      if (!tier) {
        console.error('[StoreKit] Unknown product ID:', purchase.productId);
        return;
      }

      // Update user subscription in database
      await this.updateUserSubscription(purchase, tier);

      // Finish the transaction
      await finishTransaction({ purchase, isConsumable: false });
      
      console.log('[StoreKit] Purchase completed successfully');
    } catch (error) {
      console.error('[StoreKit] Failed to handle purchase update:', error);
    }
  }

  /**
   * Validate purchase receipt
   */
  private async validateReceipt(purchase: ProductPurchase): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        const receiptBody = {
          'receipt-data': purchase.transactionReceipt,
          password: 'your-app-store-shared-secret', // Replace with actual shared secret
        };
        
        const result = await validateReceiptIos(receiptBody, false);
        return result && result.status === 0;
      } else {
        // Android validation will be handled by GooglePlayBillingService
        return true;
      }
    } catch (error) {
      console.error('[StoreKit] Receipt validation error:', error);
      return false;
    }
  }

  /**
   * Map product ID to subscription tier
   */
  private getSubscriptionTierFromProductId(productId: string): string | null {
    const productMap = {
      [AppleStoreKitService.PRODUCT_IDS.spark]: 'spark',
      [AppleStoreKitService.PRODUCT_IDS.growth]: 'growth',
      [AppleStoreKitService.PRODUCT_IDS.transformation]: 'transformation',
      [AppleStoreKitService.PRODUCT_IDS.family]: 'family',
    };

    return productMap[productId] || null;
  }

  /**
   * Update user subscription in database
   */
  private async updateUserSubscription(
    purchase: ProductPurchase,
    tier: string
  ): Promise<void> {
    try {
      // This would typically be called with the current user's ID
      // For now, we'll need to get it from the auth context
      const userId = await this.getCurrentUserId();
      
      if (!userId) {
        throw new Error('No authenticated user found');
      }

      await NewSubscriptionService.upgradeSubscription(userId, {
        target_tier: tier as any,
        platform: 'apple',
        platform_subscription_id: purchase.productId,
        platform_transaction_id: purchase.transactionId,
      });

      console.log('[StoreKit] User subscription updated successfully');
    } catch (error) {
      console.error('[StoreKit] Failed to update user subscription:', error);
      throw error;
    }
  }

  /**
   * Get current user ID (this should be implemented based on your auth system)
   */
  private async getCurrentUserId(): Promise<string | null> {
    // TODO: Implement this based on your authentication system
    // This is a placeholder that should be replaced with actual auth logic
    console.warn('[StoreKit] getCurrentUserId not implemented - using placeholder');
    return null;
  }

  /**
   * Handle purchase errors
   */
  private handlePurchaseError(error: PurchaseError): void {
    console.error('[StoreKit] Purchase error details:', {
      code: error.code,
      message: error.message,
      debugMessage: error.debugMessage,
    });

    // You can add custom error handling here
    // For example, show user-friendly error messages
  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(userId: string): Promise<boolean> {
    try {
      await this.initialize();

      // This will trigger purchase update listeners for any active subscriptions
      const purchases = await RNIap.getAvailablePurchases();
      
      console.log('[StoreKit] Found purchases to restore:', purchases.length);

      for (const purchase of purchases) {
        await this.handlePurchaseUpdate(purchase);
      }

      return true;
    } catch (error) {
      console.error('[StoreKit] Failed to restore purchases:', error);
      return false;
    }
  }

  /**
   * Check current subscription status
   */
  async getCurrentSubscriptionStatus(userId: string): Promise<any> {
    try {
      // Get the user's current subscription from database
      const subscription = await NewSubscriptionService.getUserSubscription(userId);
      
      if (!subscription.platform_subscription_id) {
        return null;
      }

      // For iOS, you might want to validate the current receipt
      // This is a simplified version
      return {
        isActive: subscription.status === 'active',
        tier: subscription.tier,
        expiryDate: subscription.subscription_end_date,
      };
    } catch (error) {
      console.error('[StoreKit] Failed to get subscription status:', error);
      return null;
    }
  }

  /**
   * Clean up connections and listeners
   */
  async cleanup(): Promise<void> {
    try {
      if (this.purchaseUpdateSubscription) {
        this.purchaseUpdateSubscription.remove();
      }
      
      if (this.purchaseErrorSubscription) {
        this.purchaseErrorSubscription.remove();
      }

      await endConnection();
      this.isInitialized = false;
      
      console.log('[StoreKit] Cleanup completed');
    } catch (error) {
      console.error('[StoreKit] Cleanup error:', error);
    }
  }
}

export default AppleStoreKitService;
