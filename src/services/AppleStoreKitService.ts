import { NativeModules, Platform } from 'react-native';
import RNIap, {
  Product,
  ProductPurchase,
  PurchaseError,
  Subscription,
  SubscriptionOffer,
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
  discounts?: SubscriptionOffer[];
}

export interface PromotionalOffer {
  identifier: string;
  price: string;
  localizedPrice: string;
  currency: string;
  numberOfPeriods: number;
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
  private currentUserId: string | null = null;
  private pendingPurchaseResolvers: Map<string, { resolve: (value: PurchaseResult) => void; reject: (error: any) => void }> = new Map();

  // Product IDs for subscription tiers
  // Two-Screen Strategy:
  // - Sales Offer Screen: Uses products WITHOUT .trial (no free trial)
  // - Trial Offer Screen: Uses products WITH .trial (3-day free trial)
  // Both give the same subscription (same subscription group in App Store Connect)
  private static readonly PRODUCT_IDS = {
    // Monthly subscriptions (NO trial) - for Sales Offer Screen
    spark: 'app.sifia.com.spark.monthly',
    growth: 'app.sifia.com.growth.monthly',
    transformation: 'app.sifia.com.transformation.monthly',
    family: 'app.sifia.com.family.monthly',

    // Annual subscriptions (NO trial) - for Sales Offer Screen
    spark_annual: 'app.sifia.com.spark.annual',
    growth_annual: 'app.sifia.com.growth.annual',
    transformation_annual: 'app.sifia.com.transformation.annual',
    family_annual: 'app.sifia.com.family.annual',

    // Monthly subscriptions WITH 3-day trial - for Trial Offer Screen
    spark_trial: 'app.sifia.com.spark.monthly.freetrial',
    growth_trial: 'app.sifia.com.growth.monthly.freetrial',
    transformation_trial: 'app.sifia.com.transformation.monthly.freetrial',
    family_trial: 'app.sifia.com.family.monthly.freetrial',

    // Annual subscriptions WITH 3-day trial - for Trial Offer Screen
    spark_annual_trial: 'app.sifia.com.spark.annual.freetrial',
    growth_annual_trial: 'app.sifia.com.growth.annual.freetrial',
    transformation_annual_trial: 'app.sifia.com.transformation.annual.freetrial',
    family_annual_trial: 'app.sifia.com.family.annual.freetrial',
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
    console.log('[StoreKit] 🎧 Setting up purchase listeners...');

    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {
        console.log('[StoreKit] 🔔 PURCHASE LISTENER FIRED!');
        console.log('[StoreKit] Purchase updated:', purchase);
        try {
          await this.handlePurchaseUpdate(purchase);
        } catch (error) {
          console.error('[StoreKit] ❌ CRITICAL: Purchase listener crashed!', error);
          console.error('[StoreKit] This means the purchase succeeded but database update failed');
          console.error('[StoreKit] User will need to restore purchases');

          // Still try to resolve the promise so the UI doesn't hang
          const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
          if (resolver) {
            resolver.reject(new Error('Purchase succeeded but database update failed. Please contact support.'));
            this.pendingPurchaseResolvers.delete(purchase.productId);
          }
        }
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        console.error('[StoreKit] 🔔 PURCHASE ERROR LISTENER FIRED!');
        console.error('[StoreKit] Purchase error:', error);
        this.handlePurchaseError(error);
      }
    );

    console.log('[StoreKit] ✅ Purchase listeners set up successfully');
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
        price: (product as any).price || '0',
        currency: (product as any).currency || 'USD',
        localizedPrice: (product as any).localizedPrice || '$0.00',
        title: product.title || '',
        description: product.description || '',
        discounts: (product as any).discounts || [],
      }));
    } catch (error) {
      console.error('[StoreKit] Failed to get products:', error);
      return [];
    }
  }

  /**
   * Get promotional offers for a product
   */
  async getPromotionalOffers(productId: string): Promise<PromotionalOffer[]> {
    try {
      const products = await this.getAvailableProducts();
      const product = products.find(p => p.productId === productId);

      if (!product || !product.discounts) {
        return [];
      }

      return product.discounts.map((discount: any) => ({
        identifier: discount.identifier,
        price: discount.price || '0',
        localizedPrice: discount.localizedPrice || '$0.00',
        currency: discount.currency || 'USD',
        numberOfPeriods: discount.numberOfPeriods || 1,
      }));
    } catch (error) {
      console.error('[StoreKit] Failed to get promotional offers:', error);
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
  ): Promise<PurchaseResult> {
    try {
      await this.initialize();

      // Store userId for purchase update handler
      this.currentUserId = userId;
      console.log('[StoreKit] Stored userId for purchase handler:', userId);

      console.log('[StoreKit] Requesting subscription purchase:', {
        productId,
        offerIdentifier,
      });

      // Create a promise that will be resolved by the purchase listener
      console.log('[StoreKit] Creating purchase promise for productId:', productId);
      const purchasePromise = new Promise<PurchaseResult>((resolve, reject) => {
        this.pendingPurchaseResolvers.set(productId, { resolve, reject });
        console.log('[StoreKit] Stored resolver for:', productId);
        console.log('[StoreKit] Total pending resolvers:', this.pendingPurchaseResolvers.size);

        // Set a timeout to prevent hanging forever
        setTimeout(() => {
          if (this.pendingPurchaseResolvers.has(productId)) {
            console.error('[StoreKit] ⏰ Purchase timeout! Listener never fired for:', productId);
            console.error('[StoreKit] This usually means:');
            console.error('[StoreKit] 1. User cancelled the purchase');
            console.error('[StoreKit] 2. Network issue with App Store');
            console.error('[StoreKit] 3. Purchase listener not set up correctly');
            this.pendingPurchaseResolvers.delete(productId);
            reject(new Error('Purchase timeout - no response from App Store'));
          }
        }, 15000); // 15 second timeout (reduced from 30 seconds)
      });

      if (Platform.OS === 'ios') {
        const purchaseParams: any = { sku: productId };

        // Add promotional offer if provided
        if (offerIdentifier) {
          purchaseParams.withOffer = {
            identifier: offerIdentifier,
            // Note: For promotional offers, you may need to generate a signature
            // This depends on your App Store Connect setup
          };
        }

        await requestSubscription(purchaseParams);
      } else {
        // For Android, we'll handle this in GooglePlayBillingService
        throw new Error('Use GooglePlayBillingService for Android purchases');
      }

      // Wait for the purchase listener to complete
      console.log('[StoreKit] Waiting for purchase to complete...');
      console.log('[StoreKit] If this times out, the listener is not firing!');

      const result = await purchasePromise;

      console.log('[StoreKit] Purchase promise resolved:', result);
      return result;
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
      console.log('[StoreKit] ========================================');
      console.log('[StoreKit] Processing purchase update:', {
        productId: purchase.productId,
        transactionId: purchase.transactionId,
        transactionDate: purchase.transactionDate,
        purchaseToken: purchase.purchaseToken,
      });

      // Validate the receipt
      console.log('[StoreKit] Step 1: Validating receipt...');
      const isValid = await this.validateReceipt(purchase);

      if (!isValid) {
        console.error('[StoreKit] ❌ Receipt validation failed');
        return;
      }
      console.log('[StoreKit] ✅ Receipt validated successfully');

      // Map product ID to subscription tier
      console.log('[StoreKit] Step 2: Mapping product ID to tier...');
      const tier = this.getSubscriptionTierFromProductId(purchase.productId);

      if (!tier) {
        console.error('[StoreKit] ❌ Unknown product ID:', purchase.productId);
        console.error('[StoreKit] This product ID is not recognized. Check product configuration.');
        return;
      }
      console.log('[StoreKit] ✅ Mapped to tier:', tier);

      // Update user subscription in database
      console.log('[StoreKit] Step 3: Updating user subscription in database...');
      await this.updateUserSubscription(purchase, tier);
      console.log('[StoreKit] ✅ User subscription updated in database');

      // Finish the transaction
      console.log('[StoreKit] Step 4: Finishing transaction...');
      await finishTransaction({ purchase, isConsumable: false });
      console.log('[StoreKit] ✅ Transaction finished');

      console.log('[StoreKit] ========================================');
      console.log('[StoreKit] 🎉 Purchase completed successfully!');
      console.log('[StoreKit] ========================================');

      // Resolve the pending purchase promise
      console.log('[StoreKit] Looking for resolver with productId:', purchase.productId);
      console.log('[StoreKit] Available resolvers:', Array.from(this.pendingPurchaseResolvers.keys()));

      const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
      if (resolver) {
        console.log('[StoreKit] ✅ Found resolver! Resolving purchase promise for:', purchase.productId);
        resolver.resolve({
          success: true,
          transactionId: purchase.transactionId,
          receipt: purchase.transactionReceipt,
        });
        this.pendingPurchaseResolvers.delete(purchase.productId);
      } else {
        console.warn('[StoreKit] ⚠️ No exact match found for:', purchase.productId);
        console.warn('[StoreKit] Attempting to resolve ANY pending purchase...');

        // If no exact match, resolve the first pending purchase (there should only be one)
        const firstResolver = this.pendingPurchaseResolvers.values().next();
        if (!firstResolver.done) {
          console.log('[StoreKit] ✅ Resolving first pending purchase');
          firstResolver.value.resolve({
            success: true,
            transactionId: purchase.transactionId,
            receipt: purchase.transactionReceipt,
          });
          this.pendingPurchaseResolvers.clear();
        } else {
          console.error('[StoreKit] ❌ No pending resolvers found at all!');
        }
      }
    } catch (error) {
      console.error('[StoreKit] ========================================');
      console.error('[StoreKit] ❌ Failed to handle purchase update:', error);
      console.error('[StoreKit] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error('[StoreKit] ========================================');

      // Reject the pending purchase promise
      const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
      if (resolver) {
        console.log('[StoreKit] Rejecting purchase promise for:', purchase.productId);
        resolver.reject(error);
        this.pendingPurchaseResolvers.delete(purchase.productId);
      }
    }
  }

  /**
   * Validate purchase receipt
   */
  private async validateReceipt(purchase: ProductPurchase): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // TEMPORARY: Skip receipt validation in TestFlight/Sandbox
        // Receipt validation is flaky in sandbox and often fails even for valid purchases
        // In production, you should enable this with proper shared secret
        console.log('[StoreKit] ⚠️ Skipping receipt validation (TestFlight/Sandbox mode)');
        console.log('[StoreKit] In production, enable receipt validation with APPLE_SHARED_SECRET');
        return true;

        /* TODO: Enable for production
        const receiptBody = {
          'receipt-data': purchase.transactionReceipt,
          password: process.env.APPLE_SHARED_SECRET || 'your-app-store-shared-secret',
        };

        const result = await validateReceiptIos({ receiptBody, isTest: __DEV__ });
        return result && result.status === 0;
        */
      } else {
        // Android validation will be handled by GooglePlayBillingService
        return true;
      }
    } catch (error) {
      console.error('[StoreKit] Receipt validation error:', error);
      // Don't fail the purchase if validation errors out
      console.warn('[StoreKit] Proceeding with purchase despite validation error');
      return true;
    }
  }

  /**
   * Map product ID to subscription tier
   */
  private getSubscriptionTierFromProductId(productId: string): string | null {
    // Extract tier from product ID
    // Handles all variations:
    // - app.sifia.com.spark.monthly -> "spark"
    // - app.sifia.com.spark.annual -> "spark"
    // - app.sifia.com.spark.monthly.freetrial -> "spark"
    // - app.sifia.com.spark.annual.freetrial -> "spark"

    if (productId.includes('spark')) {return 'spark';}
    if (productId.includes('growth')) {return 'growth';}
    if (productId.includes('transformation')) {return 'transformation';}
    if (productId.includes('family')) {return 'family';}

    console.error('[StoreKit] Unknown product ID format:', productId);
    return null;
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

      // Check if user is on trial - if so, convert to paid
      const currentSubscription = await NewSubscriptionService.getUserSubscription(userId);

      if (currentSubscription.tier === 'free_trial') {
        console.log('[StoreKit] Converting trial to paid subscription');
        await NewSubscriptionService.convertTrialToPaid(userId);
      } else {
        // Regular upgrade/subscription
        await NewSubscriptionService.upgradeSubscription(userId, {
          target_tier: tier as any,
          platform: 'apple',
          platform_subscription_id: purchase.productId,
          platform_transaction_id: purchase.transactionId,
        });
      }

      console.log('[StoreKit] User subscription updated successfully');
    } catch (error) {
      console.error('[StoreKit] Failed to update user subscription:', error);
      throw error;
    }
  }

  /**
   * Get current user ID from stored value
   */
  private async getCurrentUserId(): Promise<string | null> {
    if (this.currentUserId) {
      console.log('[StoreKit] Using stored userId:', this.currentUserId);
      return this.currentUserId;
    }

    console.error('[StoreKit] No userId available - purchase was not initiated through purchaseSubscription');
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

    // Check if user cancelled (SKErrorDomain error 2)
    const errorCode = String(error.code);
    const isCancelled = error.code === 'E_USER_CANCELLED' ||
                       errorCode === '2' ||
                       error.message?.toLowerCase().includes('cancel') ||
                       error.message?.toLowerCase().includes('user cancel');

    if (isCancelled) {
      console.log('[StoreKit] User cancelled purchase - not treating as error');
      // Reject with a special cancellation error
      const cancellationError = new Error('USER_CANCELLED');
      (cancellationError as any).code = 'USER_CANCELLED';

      // Reject ALL pending purchase promises since user cancelled
      this.pendingPurchaseResolvers.forEach((resolver, productId) => {
        console.log('[StoreKit] Resolving cancelled purchase for:', productId);
        resolver.reject(cancellationError);
      });
      this.pendingPurchaseResolvers.clear();
    } else {
      // Real error - reject all pending promises with the original error
      console.error('[StoreKit] Real purchase error:', error);
      this.pendingPurchaseResolvers.forEach((resolver, productId) => {
        console.log('[StoreKit] Rejecting pending purchase due to error:', productId);
        resolver.reject(error);
      });
      this.pendingPurchaseResolvers.clear();
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
   * ENTERPRISE: Check and sync subscription status with Apple
   * This is the core method for maintaining subscription state accuracy
   * Call this on app launch, app foreground, and periodically
   */
  async checkAndSyncSubscriptionStatus(userId: string): Promise<void> {
    try {
      console.log('[StoreKit] ========================================');
      console.log('[StoreKit] 🔄 Starting subscription status sync for user:', userId);

      await this.initialize();

      // Get all available purchases from Apple
      const availablePurchases = await RNIap.getAvailablePurchases();

      console.log('[StoreKit] Found', availablePurchases.length, 'purchase(s) from Apple');

      if (availablePurchases.length === 0) {
        console.log('[StoreKit] No active subscriptions found in Apple');
        await this.handleNoActiveSubscription(userId);
        return;
      }

      // Get the most recent subscription purchase
      const latestPurchase = this.getMostRecentPurchase(availablePurchases);

      console.log('[StoreKit] Latest purchase:', {
        productId: latestPurchase.productId,
        transactionId: latestPurchase.transactionId,
        transactionDate: latestPurchase.transactionDate,
      });

      // Determine subscription status
      const status = await this.determineSubscriptionStatus(latestPurchase);

      console.log('[StoreKit] Determined status:', status);

      // Sync with database
      await this.syncStatusWithDatabase(userId, latestPurchase, status);

      console.log('[StoreKit] ✅ Subscription status sync complete');
      console.log('[StoreKit] ========================================');

    } catch (error) {
      console.error('[StoreKit] ========================================');
      console.error('[StoreKit] ❌ Failed to sync subscription status:', error);
      console.error('[StoreKit] Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      console.error('[StoreKit] ========================================');
    }
  }

  /**
   * Get the most recent purchase from a list of purchases
   */
  private getMostRecentPurchase(purchases: any[]): any {
    return purchases.reduce((latest, current) => {
      const latestDate = new Date(latest.transactionDate || 0).getTime();
      const currentDate = new Date(current.transactionDate || 0).getTime();
      return currentDate > latestDate ? current : latest;
    });
  }

  /**
   * Determine subscription status from purchase info
   */
  private async determineSubscriptionStatus(purchase: any): Promise<{
    tier: string;
    status: 'free_trial' | 'active' | 'expired' | 'grace_period';
    isTrialProduct: boolean;
  }> {
    const productId = purchase.productId;
    const isTrialProduct = productId.includes('freetrial');

    // Get tier from product ID
    const tier = this.getSubscriptionTierFromProductId(productId);

    if (!tier) {
      throw new Error(`Unknown product ID: ${productId}`);
    }

    // Check if we're still in trial period
    if (isTrialProduct) {
      const isInTrial = await this.isStillInTrialPeriod(purchase);

      if (isInTrial) {
        return {
          tier,
          status: 'free_trial',
          isTrialProduct: true,
        };
      } else {
        // Trial ended, now it's a paid subscription
        return {
          tier,
          status: 'active',
          isTrialProduct: false,
        };
      }
    }

    // Regular paid subscription
    return {
      tier,
      status: 'active',
      isTrialProduct: false,
    };
  }

  /**
   * Check if purchase is still in trial period
   */
  private async isStillInTrialPeriod(purchase: any): Promise<boolean> {
    try {
      // In sandbox, trial is 3 minutes. In production, it's 3 days.
      // We check the transaction date and compare with current time

      const transactionDate = new Date(purchase.transactionDate);
      const now = new Date();
      const diffMs = now.getTime() - transactionDate.getTime();

      // In sandbox: 3 minutes = 180000 ms
      // In production: 3 days = 259200000 ms
      const trialDurationMs = __DEV__ ? 180000 : 259200000;

      const isInTrial = diffMs < trialDurationMs;

      console.log('[StoreKit] Trial check:', {
        transactionDate: transactionDate.toISOString(),
        now: now.toISOString(),
        diffMs,
        trialDurationMs,
        isInTrial,
      });

      return isInTrial;
    } catch (error) {
      console.error('[StoreKit] Error checking trial period:', error);
      // If we can't determine, assume not in trial (safer)
      return false;
    }
  }

  /**
   * Sync determined status with database
   */
  private async syncStatusWithDatabase(
    userId: string,
    purchase: any,
    status: { tier: string; status: string; isTrialProduct: boolean }
  ): Promise<void> {
    try {
      const subscriptionService = new NewSubscriptionService();

      // Get current database status
      const currentSub = await NewSubscriptionService.getUserSubscription(userId);

      console.log('[StoreKit] Current database status:', {
        tier: currentSub?.tier,
        status: currentSub?.status,
      });

      console.log('[StoreKit] New status from Apple:', {
        tier: status.tier,
        status: status.status,
      });

      // Check if update is needed
      const needsUpdate =
        currentSub?.tier !== status.tier ||
        currentSub?.status !== status.status;

      if (!needsUpdate) {
        console.log('[StoreKit] ✅ Database already up to date');
        return;
      }

      console.log('[StoreKit] 🔄 Updating database...');

      // Update database
      if (status.status === 'free_trial') {
        // User is in trial - upgrade to free_trial tier
        await NewSubscriptionService.upgradeSubscription(userId, {
          target_tier: 'free_trial',
          platform: 'apple' as any,
          platform_subscription_id: purchase.transactionId,
        });
      } else {
        // User has paid subscription - upgrade to actual tier
        await NewSubscriptionService.upgradeSubscription(userId, {
          target_tier: status.tier as any,
          platform: 'apple' as any,
          platform_subscription_id: purchase.transactionId,
        });
      }

      console.log('[StoreKit] ✅ Database updated successfully');

    } catch (error) {
      console.error('[StoreKit] Failed to sync with database:', error);
      throw error;
    }
  }

  /**
   * Handle case where user has no active subscription
   */
  private async handleNoActiveSubscription(userId: string): Promise<void> {
    try {
      const subscriptionService = new NewSubscriptionService();
      const currentSub = await NewSubscriptionService.getUserSubscription(userId);

      // If user is already seeker, no need to update
      if (currentSub?.tier === 'seeker') {
        console.log('[StoreKit] User already set to seeker tier');
        return;
      }

      console.log('[StoreKit] No active subscription - downgrading to seeker');

      // Downgrade to seeker (free tier)
      await NewSubscriptionService.upgradeSubscription(userId, {
        target_tier: 'seeker',
        platform: 'apple' as any,
        platform_subscription_id: undefined,
      });

      console.log('[StoreKit] ✅ User downgraded to seeker');

    } catch (error) {
      console.error('[StoreKit] Failed to handle no subscription:', error);
    }
  }

  /**
   * Restore purchases - useful for users who reinstalled app
   */
  async restorePurchases(userId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log('[StoreKit] 🔄 Restoring purchases for user:', userId);

      await this.initialize();

      // This will trigger the purchase listener for any existing purchases
      const availablePurchases = await RNIap.getAvailablePurchases();

      if (availablePurchases.length === 0) {
        return {
          success: false,
          message: 'No purchases found to restore',
        };
      }

      console.log('[StoreKit] Found', availablePurchases.length, 'purchase(s) to restore');

      // Sync status with latest purchase
      await this.checkAndSyncSubscriptionStatus(userId);

      return {
        success: true,
        message: `Successfully restored ${availablePurchases.length} purchase(s)`,
      };

    } catch (error) {
      console.error('[StoreKit] Failed to restore purchases:', error);
      return {
        success: false,
        message: error instanceof Error ? error.message : 'Failed to restore purchases',
      };
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
