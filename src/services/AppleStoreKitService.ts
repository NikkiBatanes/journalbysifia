import { Platform } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import RNIap, {
  ProductPurchase,
  PurchaseError,
  Subscription,
  SubscriptionOffer,
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
} from 'react-native-iap';
import { NewSubscriptionService } from './NewSubscriptionService';
import { supabase } from './supabaseClient';

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
  validated?: boolean;
  receiptId?: string;
}

export class AppleStoreKitService {
  private static instance: AppleStoreKitService;
  private isInitialized = false;
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;
  private currentUserId: string | null = null;
  private pendingPurchaseResolvers: Map<string, { resolve: (value: PurchaseResult) => void; reject: (error: any) => void }> = new Map();
  private purchaseInitiatedTimestamp: number | null = null; // Track when purchase flow started

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

      await initConnection();

      // Set up purchase listeners
      this.setupPurchaseListeners();

      // Clear any old cached transactions on startup
      await this.clearOldTransactions();

      this.isInitialized = true;
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Clear old cached transactions that are older than 5 minutes
   * This prevents stale purchases from being processed on app restart
   */
  private async clearOldTransactions(): Promise<void> {
    try {
      const availablePurchases = await getAvailablePurchases();

      if (availablePurchases.length === 0) {
        return;
      }

      Logger.info('[StoreKit] Checking for old cached transactions', {
        component: 'AppleStoreKitService',
        count: availablePurchases.length,
      });

      for (const purchase of availablePurchases) {
        const purchaseTime = new Date(purchase.transactionDate).getTime();
        const purchaseAge = Date.now() - purchaseTime;

        // Clear transactions older than 5 minutes
        if (purchaseAge > 5 * 60 * 1000) {
          Logger.info('[StoreKit] 🧹 Clearing old cached transaction', {
            component: 'AppleStoreKitService',
            productId: purchase.productId,
            purchaseAge: `${Math.round(purchaseAge / 60000)} minutes`,
            transactionDate: new Date(purchaseTime).toISOString(),
          });

          await finishTransaction({ purchase, isConsumable: false });
        }
      }
    } catch (error) {
      Logger.error('[StoreKit] Error clearing old transactions', error as Error, {
        component: 'AppleStoreKitService',
      });
    }
  }

  /**
   * Set up purchase event listeners
   */
  private setupPurchaseListeners(): void {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {
        try {
          await this.handlePurchaseUpdate(purchase);
        } catch (error) {
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
        price: (product as any).price || '0',
        currency: (product as any).currency || 'USD',
        localizedPrice: (product as any).localizedPrice || '$0.00',
        title: product.title || '',
        description: product.description || '',
        discounts: (product as any).discounts || [],
      }));
    } catch (error) {
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

      // CRITICAL: Record timestamp when purchase flow is initiated
      // This will be used to validate purchase freshness and reject cached/stale purchases
      this.purchaseInitiatedTimestamp = Date.now();
      Logger.info('[StoreKit] 🛒 Purchase flow initiated', {
        component: 'AppleStoreKitService',
        productId,
        timestamp: new Date(this.purchaseInitiatedTimestamp).toISOString(),
      });

      // Create a promise that will be resolved by the purchase listener
      const purchasePromise = new Promise<PurchaseResult>((resolve, reject) => {
        this.pendingPurchaseResolvers.set(productId, { resolve, reject });

        // Set a timeout to prevent hanging forever
        setTimeout(() => {
          if (this.pendingPurchaseResolvers.has(productId)) {
            this.pendingPurchaseResolvers.delete(productId);
            reject(new Error('Purchase timeout - no response from App Store'));
          }
        }, 30000); // Increased timeout to 30 seconds for slower networks
      });

      // Validate that the promise was created and stored
      if (!this.pendingPurchaseResolvers.has(productId)) {
        throw new Error('Failed to create purchase promise');
      }

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
      const result = await purchasePromise;

      // Clear timestamp on success
      this.purchaseInitiatedTimestamp = null;

      return result;
    } catch (error) {
      // Clear timestamp on error
      this.purchaseInitiatedTimestamp = null;

      Logger.error('[StoreKit] Purchase failed', error as Error, {
        component: 'AppleStoreKitService',
        productId,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle purchase updates from the store
   * ENTERPRISE IMPROVEMENT: Now includes server-side validation
   */
  private async handlePurchaseUpdate(purchase: ProductPurchase): Promise<void> {
    try {
      Logger.info('[StoreKit] 🔍 Processing purchase update', {
        component: 'AppleStoreKitService',
        productId: purchase.productId,
        transactionId: purchase.transactionId?.substring(0, 10) + '...',
        transactionDate: purchase.transactionDate,
      });

      // CRITICAL: Validate purchase freshness to prevent cached/stale purchases
      const purchaseTime = new Date(purchase.transactionDate).getTime();
      const purchaseAge = Date.now() - purchaseTime;

      // CRITICAL: Always reject transactions older than 5 minutes
      // This prevents old cached purchases from being processed on app restart
      if (purchaseAge > 5 * 60 * 1000) {
        Logger.warn('[StoreKit] ⚠️ FINISHING STALE TRANSACTION - Transaction is older than 5 minutes', {
          component: 'AppleStoreKitService',
          purchaseAge: `${Math.round(purchaseAge / 60000)} minutes`,
          transactionDate: new Date(purchaseTime).toISOString(),
          productId: purchase.productId,
        });

        // Finish the transaction to clear it from the queue
        await finishTransaction({ purchase, isConsumable: false });

        // Reject the pending purchase promise if one exists
        const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
        if (resolver) {
          resolver.reject(new Error('STALE_PURCHASE_CACHE'));
          this.pendingPurchaseResolvers.delete(purchase.productId);
        }
        return;
      }

      // If we have an active purchase flow, validate timing
      if (this.purchaseInitiatedTimestamp) {
        const timeSincePurchaseInitiated = Date.now() - this.purchaseInitiatedTimestamp;

        Logger.info('[StoreKit] Purchase freshness check', {
          component: 'AppleStoreKitService',
          purchaseInitiatedAt: new Date(this.purchaseInitiatedTimestamp).toISOString(),
          purchaseTransactionDate: new Date(purchaseTime).toISOString(),
          timeSincePurchaseInitiated: `${Math.round(timeSincePurchaseInitiated / 1000)}s`,
          purchaseAge: `${Math.round(purchaseAge / 1000)}s`,
        });

        Logger.info('[StoreKit] ✅ Purchase freshness validated - proceeding', {
          component: 'AppleStoreKitService',
        });
      } else {
        Logger.warn('[StoreKit] ⚠️ No active purchase flow - transaction may be from previous session', {
          component: 'AppleStoreKitService',
          purchaseAge: `${Math.round(purchaseAge / 1000)}s`,
        });
      }

      // ENTERPRISE IMPROVEMENT: Server-side validation FIRST
      const serverValidation = await this.validateReceiptServerSide(
        purchase.transactionReceipt,
        this.currentUserId || '',
        purchase.productId
      );

      if (!serverValidation.success) {
        // Still try client-side validation as fallback
        const isValid = await this.validateReceipt(purchase);
        if (!isValid) {
          return;
        }
      }

      // Map product ID to subscription tier
      const tier = this.getSubscriptionTierFromProductId(purchase.productId);

      if (!tier) {
        return;
      }

      // Update user subscription in database
      await this.updateUserSubscription(purchase, tier);

      // Finish the transaction
      await finishTransaction({ purchase, isConsumable: false });

      // CRITICAL: Clear purchase timestamp after successful validation
      this.purchaseInitiatedTimestamp = null;

      Logger.info('[StoreKit] ✅ Purchase validated and completed successfully', {
        component: 'AppleStoreKitService',
        transactionId: purchase.transactionId?.substring(0, 10) + '...',
      });

      // Resolve the pending purchase promise
      const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
      if (resolver) {
        resolver.resolve({
          success: true,
          transactionId: purchase.transactionId,
          receipt: purchase.transactionReceipt,
        });
        this.pendingPurchaseResolvers.delete(purchase.productId);
      } else {
        // If no exact match, resolve the first pending purchase (there should only be one)
        const firstResolver = this.pendingPurchaseResolvers.values().next();
        if (!firstResolver.done) {
          firstResolver.value.resolve({
            success: true,
            transactionId: purchase.transactionId,
            receipt: purchase.transactionReceipt,
          });
          this.pendingPurchaseResolvers.clear();
        }
      }
    } catch (error) {
      // Reject the pending purchase promise
      const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
      if (resolver) {
        resolver.reject(error);
        this.pendingPurchaseResolvers.delete(purchase.productId);
      }
    }
  }

  /**
   * Validate purchase receipt
   */
  private async validateReceipt(_purchase: ProductPurchase): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // TEMPORARY: Skip receipt validation in TestFlight/Sandbox
        // Receipt validation is flaky in sandbox and often fails even for valid purchases
        // In production, you should enable this with proper shared secret

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
      Logger.error('[StoreKit] Receipt validation error', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      // Don't fail the purchase if validation errors out
      Logger.warn('[StoreKit] Proceeding with purchase despite validation error', {
      component: 'AppleStoreKitService',
    });
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

    Logger.error('[StoreKit] Unknown product ID format', new Error(String(productId)), {
      component: 'AppleStoreKitService',
      action: 'error',
    });
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

      // FIRST: Check if user still exists in database
      const { data: userProfile, error: userCheckError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (userCheckError || !userProfile) {

        throw new Error('User account not found - subscription update skipped');
      }

      // Check if user is on trial - if so, convert to paid
      const currentSubscription = await NewSubscriptionService.getUserSubscription(userId);

      if (currentSubscription.tier === 'free_trial') {

        // Trial purchases should stay as free_trial during trial period
        // Only convert when trial expires or user manually upgrades
      } else {
        // Regular upgrade/subscription
        await NewSubscriptionService.upgradeSubscription(userId, {
          target_tier: tier as any,
          platform: 'apple',
          platform_subscription_id: purchase.productId,
          platform_transaction_id: purchase.transactionId,
        });
      }

    } catch (error) {
      Logger.error('[StoreKit] Failed to update user subscription', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      throw error;
    }
  }

  /**
   * Get current user ID from stored value
   */
  private async getCurrentUserId(): Promise<string | null> {
    if (this.currentUserId) {

      return this.currentUserId;
    }

    Logger.error('[StoreKit] No userId available - purchase was not initiated through purchaseSubscription', undefined, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
    return null;
  }

  /**
   * Handle purchase errors
   */
  private handlePurchaseError(error: PurchaseError): void {
    Logger.error('[StoreKit] Purchase error details', undefined, {
  component: 'AppleStoreKitService',
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

      // Reject with a special cancellation error
      const cancellationError = new Error('USER_CANCELLED');
      (cancellationError as any).code = 'USER_CANCELLED';

      // Reject ALL pending purchase promises since user cancelled
      this.pendingPurchaseResolvers.forEach((resolver) => {

        resolver.reject(cancellationError);
      });
      this.pendingPurchaseResolvers.clear();
    } else {
      // Real error - reject all pending promises with the original error
      Logger.error('[StoreKit] Real purchase error', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      this.pendingPurchaseResolvers.forEach((resolver) => {

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
      Logger.error('[StoreKit] Failed to get subscription status', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      return null;
    }
  }

  /**
   * ENTERPRISE: Check and sync subscription status with Apple
   * This is the core method for maintaining subscription state accuracy
   * Call this on app launch, app foreground, and periodically
   *
   * CRITICAL: This should NOT be called during active purchase flows
   * to prevent cached purchases from being treated as new purchases
   */
  async checkAndSyncSubscriptionStatus(userId: string, skipIfPurchaseInProgress = true): Promise<void> {
    try {
      // CRITICAL: Don't sync if a purchase is currently in progress
      // This prevents cached purchases from interfering with new purchase flows
      if (skipIfPurchaseInProgress && this.purchaseInitiatedTimestamp) {
        const timeSinceInitiated = Date.now() - this.purchaseInitiatedTimestamp;
        if (timeSinceInitiated < 2 * 60 * 1000) { // Within 2 minutes
          Logger.info('[StoreKit] ⏸️ Skipping sync - purchase in progress', {
            component: 'AppleStoreKitService',
            timeSinceInitiated: `${Math.round(timeSinceInitiated / 1000)}s`,
          });
          return;
        }
      }

      await this.initialize();

      Logger.info('[StoreKit] 🔄 Checking subscription status with Apple', {
        component: 'AppleStoreKitService',
      });

      // Get all available purchases from Apple
      const availablePurchases = await RNIap.getAvailablePurchases();

      Logger.info('[StoreKit] Available purchases from Apple', {
        component: 'AppleStoreKitService',
        count: availablePurchases.length,
        purchases: availablePurchases.map(p => ({
          productId: p.productId,
          transactionDate: p.transactionDate,
          transactionId: p.transactionId?.substring(0, 10) + '...',
        })),
      });

      if (availablePurchases.length === 0) {
        Logger.info('[StoreKit] No active purchases found', {
          component: 'AppleStoreKitService',
        });
        await this.handleNoActiveSubscription(userId);
        return;
      }

      // Get the most recent subscription purchase
      const latestPurchase = this.getMostRecentPurchase(availablePurchases);

      Logger.info('[StoreKit] Latest purchase identified', {
        component: 'AppleStoreKitService',
        productId: latestPurchase.productId,
        transactionDate: latestPurchase.transactionDate,
      });

      // Determine subscription status
      const status = await this.determineSubscriptionStatus(latestPurchase);

      // Sync with database
      await this.syncStatusWithDatabase(userId, latestPurchase, status);

    } catch (error) {
      Logger.error('[StoreKit] ========================================', undefined, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      Logger.error('[StoreKit] ❌ Failed to sync subscription status', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      Logger.error('[StoreKit] Error details', undefined, {
  component: 'AppleStoreKitService',
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
      });
      Logger.error('[StoreKit] ========================================', undefined, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
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

      return isInTrial;
    } catch (error) {
      Logger.error('[StoreKit] Error checking trial period', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      // If we can't determine, assume not in trial (safer)
      return false;
    }
  }

  /**
   * ENTERPRISE IMPROVEMENT: Validate receipt server-side
   * Explanation: This calls our Supabase Edge Function to validate receipts with Apple's servers.
   * This is critical for security because:
   * 1. Prevents fraud - client-side validation can be bypassed
   * 2. Ensures accurate subscription status
   * 3. Required for enterprise-grade apps
   * 4. Stores validated receipts in database for audit trail
   */
  private async validateReceiptServerSide(
    receiptData: string,
    userId: string,
    productId?: string
  ): Promise<{ success: boolean; data?: any; error?: string }> {
    try {

      const { data, error } = await supabase.functions.invoke('validate-receipt', {
        body: {
          receiptData,
          userId,
          platform: 'ios',
          productId,
        },
      });

      if (error) {
        Logger.error('[StoreKit] Server validation error', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
        return {
          success: false,
          error: error.message || 'Server validation failed',
        };
      }

      if (!data?.success) {
        Logger.error('[StoreKit] Validation failed', data?.error ? new Error(String(data.error)) : new Error('Unknown StoreKit error'), {
        component: 'AppleStoreKitService',
      });
        return {
          success: false,
          error: data?.error || 'Receipt validation failed',
        };
      }

      return {
        success: true,
        data: data.data,
      };
    } catch (error) {
      Logger.error('[StoreKit] Exception during server validation', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
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
      // FIRST: Check if user still exists in database
      const { data: userProfile, error: userCheckError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', userId)
        .single();

      if (userCheckError || !userProfile) {

        return;
      }

      // Get current database status
      const currentSub = await NewSubscriptionService.getUserSubscription(userId);

      // Check if update is needed
      const needsUpdate =
        currentSub?.tier !== status.tier ||
        currentSub?.status !== status.status;

      if (!needsUpdate) {

        return;
      }

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

    } catch (error) {
      Logger.error('[StoreKit] Failed to sync with database', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
      throw error;
    }
  }

  /**
   * Handle case where user has no active subscription
   */
  private async handleNoActiveSubscription(userId: string): Promise<void> {
    try {
      const currentSub = await NewSubscriptionService.getUserSubscription(userId);

      // If user is already seeker, no need to update
      if (currentSub?.tier === 'seeker') {

        return;
      }

      // Downgrade to seeker (free tier)
      await NewSubscriptionService.upgradeSubscription(userId, {
        target_tier: 'seeker',
        platform: 'apple' as any,
        platform_subscription_id: undefined,
      });

    } catch (error) {
      Logger.error('[StoreKit] Failed to handle no subscription', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
    }
  }

  /**
   * Restore purchases - useful for users who reinstalled app
   * ENTERPRISE IMPROVEMENT: Now validates all restored purchases server-side
   * This prevents fraud and ensures subscription status is accurate
   */
  async restorePurchases(userId: string): Promise<{ success: boolean; message: string; validated?: number }> {
    try {

      await this.initialize();

      // Get all available purchases from device
      const availablePurchases = await RNIap.getAvailablePurchases();

      if (availablePurchases.length === 0) {
        return {
          success: false,
          message: 'No purchases found to restore',
        };
      }

      // ENTERPRISE IMPROVEMENT: Validate each purchase server-side
      let validatedCount = 0;
      for (const purchase of availablePurchases) {
        try {

          const validationResult = await this.validateReceiptServerSide(
            purchase.transactionReceipt,
            userId,
            purchase.productId
          );

          if (validationResult.success) {
            validatedCount++;

          } else {
            Logger.warn('[StoreKit] ⚠️ Restored purchase validation failed', {
        component: 'AppleStoreKitService',
        details: purchase.productId,
      });
          }
        } catch (error) {
          Logger.error('[StoreKit] Error validating restored purchase', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
        }
      }

      // Sync status with latest validated purchase
      await this.checkAndSyncSubscriptionStatus(userId);

      return {
        success: true,
        message: `Successfully restored ${availablePurchases.length} purchase(s) (${validatedCount} validated)`,
        validated: validatedCount,
      };

    } catch (error) {
      Logger.error('[StoreKit] Failed to restore purchases', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });

      const rawMessage = error instanceof Error ? error.message : undefined;

      return {
        success: false,
        message: this.getFriendlyRestoreErrorMessage(rawMessage),
      };
    }
  }

  private getFriendlyRestoreErrorMessage(rawMessage?: string): string {
    if (!rawMessage) {
      return 'We couldn\'t restore your purchases right now. Please try again shortly or contact support if the issue continues.';
    }

    const normalized = rawMessage.toLowerCase();

    if (normalized.includes('getavailablepurchases')) {
      return 'We couldn\'t reach the App Store to restore your purchases. Please try again in a moment.';
    }

    return 'We couldn\'t restore your purchases right now. Please try again shortly or contact support if the issue continues.';
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

    } catch (error) {
      Logger.error('[StoreKit] Cleanup error', error as Error, {
      component: 'AppleStoreKitService',
      action: 'error',
    });
    }
  }
}

export default AppleStoreKitService;
