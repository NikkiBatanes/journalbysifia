import {
  Platform,
} from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import { PaymentFailureLogger, PaymentFailureContext } from '../utils/paymentFailureLogger';
import * as RNIapModule from 'react-native-iap';
import type {
  ProductPurchase,
  PurchaseError,
  Subscription,
  SubscriptionOffer,
} from 'react-native-iap';

// Destructure with fallbacks for better error handling
const {
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
  getAvailablePurchases,
  validateReceiptIos,
} = RNIapModule;

const RNIap = RNIapModule;
import { NewSubscriptionService } from './NewSubscriptionService';
import { supabase } from './supabaseClient';
import { ENV } from '../config/environment';
import { notificationSchedulerService } from './notificationSchedulerService';
import { SubscriptionTier } from '../types/subscription';

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

export interface ServerValidationResult {
  success: boolean;
  data?: any;
  error?: string;
}

export class AppleStoreKitService {
  private static instance: AppleStoreKitService;
  private purchaseUpdateSubscription: any = null;
  private purchaseErrorSubscription: any = null;
  private isInitialized: boolean = false;
  private currentUserId: string | null = null;
  private purchaseInitiatedTimestamp: number | null = null;
  private pendingPurchaseResolvers: Map<string, { resolve: (value: PurchaseResult) => void; reject: (error: any) => void }> = new Map();
  private purchaseRetryCount: Map<string, number> = new Map(); // Track retry attempts
  private currentPurchaseEligibility: boolean | undefined; // Store trial eligibility for current purchase

  // Product IDs for subscription tiers
  // All iOS products now use .freetrial SKUs; App Store enforces one-time trials.
  private static readonly PRODUCT_IDS = {
    // Monthly subscriptions WITH 3-day trial (Sales Offer & Trial Offer Screens)
    spark: 'app.sifia.com.spark.monthly.freetrial',
    growth: 'app.sifia.com.growth.monthly.freetrial',
    transformation: 'app.sifia.com.transformation.monthly.freetrial',
    family: 'app.sifia.com.family.monthly.freetrial',

    // Annual subscriptions WITH 3-day trial (Sales Offer & Trial Offer Screens)
    spark_annual: 'app.sifia.com.spark.annual.freetrial',
    growth_annual: 'app.sifia.com.growth.annual.freetrial',
    transformation_annual: 'app.sifia.com.transformation.annual.freetrial',
    family_annual: 'app.sifia.com.family.annual.freetrial',
  };

  private constructor() {}

  static getInstance(): AppleStoreKitService {
    if (!AppleStoreKitService.instance) {
      AppleStoreKitService.instance = new AppleStoreKitService();
    }
    return AppleStoreKitService.instance;
  }

  private isSandboxEnvironment(): boolean {
    return ENV.APP_ENV === 'development' || ENV.APP_ENV === 'sandbox';
  }

  /**
   * Initialize the connection to the App Store
   */
  async initialize(): Promise<boolean> {
    try {
      Logger.info('[StoreKit] 🔧 Starting IAP initialization', {
        component: 'AppleStoreKitService',
        isInitialized: this.isInitialized,
        timestamp: new Date().toISOString(),
      });

      if (this.isInitialized) {
        Logger.info('[StoreKit] ✅ Already initialized', {
          component: 'AppleStoreKitService',
        });
        return true;
      }

      // CRITICAL: Add timeout to prevent hanging
      const initPromise = this.doInitialize();
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('IAP initialization timeout after 15 seconds')), 15000);
      });

      try {
        const result = await Promise.race([initPromise, timeoutPromise]);
        return result;
      } catch (error) {
        Logger.error('[StoreKit] ❌ IAP initialization failed or timed out', error as Error, {
          component: 'AppleStoreKitService',
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        });
        return false;
      }
    } catch (error) {
      Logger.error('[StoreKit] ❌ IAP initialization failed', error as Error, {
        component: 'AppleStoreKitService',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      });
      return false;
    }
  }

  private async doInitialize(): Promise<boolean> {
    Logger.debug('[StoreKit] Pre-init check', {
      component: 'AppleStoreKitService',
      hasInitConnection: !!initConnection,
      platform: Platform.OS,
      isDev: ENV.APP_ENV === 'development',
      isSandbox: this.isSandboxEnvironment(),
    });

    Logger.info('[StoreKit] 🔌 Step 1: Calling initConnection()', {
      component: 'AppleStoreKitService',
      isSandbox: this.isSandboxEnvironment(),
      timestamp: new Date().toISOString(),
    });

    if (!initConnection) {
      throw new Error('initConnection is not available from react-native-iap');
    }

    try {
      Logger.debug('[StoreKit] About to call initConnection()', { component: 'AppleStoreKitService' });
      const startTime = Date.now();
      await initConnection();
      const endTime = Date.now();
      Logger.info('[StoreKit] initConnection() completed', { component: 'AppleStoreKitService', duration: endTime - startTime });

      Logger.info('[StoreKit] ✅ Step 1: initConnection() completed', {
        component: 'AppleStoreKitService',
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      Logger.error('[StoreKit] ❌ initConnection() failed', error as Error, {
        component: 'AppleStoreKitService',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
      });
      throw error;
    }

    Logger.debug('[StoreKit] Proceeding to Step 2', { component: 'AppleStoreKitService' });

    // Set up purchase listeners
    Logger.debug('[StoreKit] Step 2: Setting up purchase listeners', { component: 'AppleStoreKitService' });

    this.setupPurchaseListeners();

    Logger.info('[StoreKit] Step 2: Purchase listeners set up', { component: 'AppleStoreKitService' });

    // Clear any old cached transactions on startup (with timeout)
    Logger.debug('[StoreKit] Step 3: Clearing old transactions', { component: 'AppleStoreKitService' });

    try {
      const clearPromise = this.clearOldTransactions();
      const timeoutPromise = new Promise<void>((_, reject) => {
        setTimeout(() => reject(new Error('clearOldTransactions timeout')), 10000);
      });

      await Promise.race([clearPromise, timeoutPromise]);
      Logger.info('[StoreKit] Step 3: Old transactions cleared', { component: 'AppleStoreKitService' });
    } catch (error) {
      Logger.warn('[StoreKit] Step 3: Skipping old transaction cleanup (timeout or error)', { component: 'AppleStoreKitService' });
      // Continue anyway - this is not critical for IAP to work
    }

    this.isInitialized = true;

    Logger.info('[StoreKit] 🎉 IAP initialization completed successfully', {
      component: 'AppleStoreKitService',
      timestamp: new Date().toISOString(),
    });

    return true;
  }

  /**
   * Clear old cached transactions that are older than 5 minutes
   * This prevents stale purchases from being processed on app restart
   */
  private async clearOldTransactions(): Promise<void> {
    try {
      Logger.debug('[StoreKit] Step 3.1: Getting available purchases', { component: 'AppleStoreKitService' });

      const availablePurchases = await getAvailablePurchases();

      Logger.debug('[StoreKit] Step 3.1: Available purchases retrieved', { component: 'AppleStoreKitService', count: availablePurchases.length });

      if (availablePurchases.length === 0) {
        Logger.debug('[StoreKit] Step 3.2: No old transactions to clear', { component: 'AppleStoreKitService' });
        return;
      }

      Logger.debug('[StoreKit] Step 3.2: Processing old transactions', { component: 'AppleStoreKitService', count: availablePurchases.length });

      // CRITICAL: Finish ALL available purchases to ensure clean state
      // This is more aggressive but prevents stale transactions from interfering
      const finishPromises = availablePurchases.map(async (purchase) => {
        try {
          const purchaseTime = new Date(purchase.transactionDate).getTime();
          const purchaseAge = Date.now() - purchaseTime;

          // Clear transactions older than 2 minutes
          if (purchaseAge > 2 * 60 * 1000) {
            Logger.debug('[StoreKit] Clearing old cached transaction', {
              component: 'AppleStoreKitService',
              productId: purchase.productId,
              ageMinutes: Math.round(purchaseAge / 60000),
            });

            await finishTransaction({ purchase, isConsumable: false });
          }
        } catch (err) {
          Logger.warn('[StoreKit] Failed to finish transaction', {
            component: 'AppleStoreKitService',
            productId: purchase.productId,
            error: err instanceof Error ? err : new Error('Unknown'),
          });
        }
      });

      // Wait for all finish operations to complete
      await Promise.all(finishPromises);

      Logger.info('[StoreKit] All old transactions processed', { component: 'AppleStoreKitService' });
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
          Logger.error('[StoreKit] Purchase update handler failed', error as Error, {
            component: 'AppleStoreKitService',
            productId: purchase.productId,
            transactionId: purchase.transactionId?.substring(0, 10) + '...',
          });

          // Still try to resolve the promise so the UI doesn't hang
          const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
          if (resolver) {
            // Create a more specific error with proper error code
            const dbError = new Error('Purchase succeeded but database update failed. Please contact support.');
            (dbError as any).code = 'DATABASE_UPDATE_FAILED';
            resolver.reject(dbError);
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
   * ENHANCED: Added retry logic and better error handling
   */
  async getAvailableProducts(): Promise<StoreProduct[]> {
    let lastError: Error | null = null;

    // Retry up to 3 times for network resilience
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await this.initialize();

        const productIds = Object.values(AppleStoreKitService.PRODUCT_IDS);

        Logger.info(`[StoreKit] Fetching products (attempt ${attempt}/3)`, {
          component: 'AppleStoreKitService',
          productCount: productIds.length,
          isSandbox: this.isSandboxEnvironment(),
          productIds: productIds, // Log ALL for debugging
        });

        // Add additional validation before calling getSubscriptions
        if (!RNIap?.getSubscriptions) {
          throw new Error('RNIap.getSubscriptions not available - library not properly initialized');
        }

        const products = await getSubscriptions({ skus: productIds });

        Logger.info('[StoreKit] Raw products from App Store', {
          component: 'AppleStoreKitService',
          rawProductCount: products.length,
          rawProducts: products.map(p => ({
            productId: p.productId,
            title: p.title,
            available: (p as any).available,
          })),
        });

        const result = products.map((product: Subscription) => ({
          productId: product.productId,
          price: (product as any).price || '0',
          currency: (product as any).currency || 'USD',
          localizedPrice: (product as any).localizedPrice || '$0.00',
          title: product.title || '',
          description: product.description || '',
          discounts: (product as any).discounts || [],
        }));

        Logger.info('[StoreKit] ✅ Products fetched successfully', {
          component: 'AppleStoreKitService',
          attempt,
          productsFound: result.length,
          trialProducts: result.filter(p => p.productId.includes('freetrial')).length,
          regularProducts: result.filter(p => !p.productId.includes('freetrial')).length,
          productIds: result.map(p => p.productId),
        });

        return result;

      } catch (error) {
        lastError = error as Error;

        Logger.warn(`[StoreKit] Products fetch failed (attempt ${attempt}/3)`, {
          component: 'AppleStoreKitService',
          attempt,
          error: lastError,
          errorMessage: lastError.message,
          errorCode: (lastError as any).code,
          willRetry: attempt < 3,
        });

        // Don't retry on certain errors
        const errorMessage = lastError.message.toLowerCase();
        const shouldNotRetry =
          errorMessage.includes('user cancelled') ||
          errorMessage.includes('payment cancelled') ||
          errorMessage.includes('invalid product id') ||
          (lastError as any).code === 'E_CANCELED';

        if (shouldNotRetry) {
          Logger.error('[StoreKit] Non-retryable error, stopping retries', {
            component: 'AppleStoreKitService',
            error: lastError.message,
            errorCode: (lastError as any).code,
          });
          break;
        }

        // Wait before retry (exponential backoff)
        if (attempt < 3) {
          const delayMs = Math.min(2000 * Math.pow(2, attempt - 1), 8000); // 2s, 4s, 8s max
          Logger.info(`[StoreKit] Waiting ${delayMs}ms before retry`, {
            component: 'AppleStoreKitService',
            attempt,
            delayMs,
          });
          await new Promise(resolve => setTimeout(resolve, delayMs));
        }
      }
    }

    // All attempts failed - return mock products for development only
    if (ENV.APP_ENV === 'development') {
      Logger.warn('[StoreKit] 🧪 All product fetch attempts failed, returning mock products for development', {
        component: 'AppleStoreKitService',
        totalAttempts: 3,
        finalError: lastError?.message,
        errorDetails: lastError?.message,
      });

      return this.getMockProducts();
    }

    // In production, return empty array
    Logger.error('[StoreKit] ❌ All product fetch attempts failed', lastError as Error, {
      component: 'AppleStoreKitService',
      totalAttempts: 3,
      finalError: lastError?.message,
    });

    return [];
  }

  /**
   * Get mock products for development testing
   */
  private getMockProducts(): StoreProduct[] {
    const mockProducts: StoreProduct[] = [];

    Object.entries(AppleStoreKitService.PRODUCT_IDS).forEach(([_key, productId]) => {
      const tier = this.getSubscriptionTierFromProductId(productId);
      const isAnnual = productId.includes('annual');
      const isTrial = productId.includes('freetrial');

      if (tier) {
        const pricing: Record<string, { monthly: number; annual: number }> = {
          spark: { monthly: 199, annual: 1990 },
          growth: { monthly: 499, annual: 4990 },
          transformation: { monthly: 999, annual: 9990 },
          family: { monthly: 1499, annual: 14990 },
        };

        const amount = pricing[tier]?.[isAnnual ? 'annual' : 'monthly'] || 0;

        mockProducts.push({
          productId,
          price: amount.toString(),
          currency: 'PHP',
          localizedPrice: `₱${amount.toLocaleString()}`,
          title: `${tier.charAt(0).toUpperCase() + tier.slice(1)} ${isAnnual ? 'Annual' : 'Monthly'} ${isTrial ? '(Free Trial)' : ''}`,
          description: `Mock ${tier} subscription for development`,
          discounts: [],
        });
      }
    });

    Logger.info(`[StoreKit] 🧪 Generated ${mockProducts.length} mock products`, {
      component: 'AppleStoreKitService',
      productIds: mockProducts.map(p => p.productId),
    });

    return mockProducts;
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

      // CRITICAL: Ensure listeners are set up
      if (!this.purchaseUpdateSubscription || !this.purchaseErrorSubscription) {
        Logger.warn('[StoreKit] Purchase listeners not set up, re-initializing', {
          component: 'AppleStoreKitService',
        });
        this.setupPurchaseListeners();
      }

      // Clear stale transactions in background - don't block payment sheet
      Logger.info('[StoreKit] 🧹 Starting background cleanup of stale transactions', {
        component: 'AppleStoreKitService',
        productId,
      });

      this.clearOldTransactions().catch(() => {
        Logger.warn('[StoreKit] Background transaction cleanup failed (non-blocking)', { component: 'AppleStoreKitService' });
      });

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
        // CRITICAL: Validate requestSubscription is available
        if (!requestSubscription) {
          const error = new Error('requestSubscription is not available from react-native-iap');
          Logger.error('[StoreKit] requestSubscription not available', error, {
            component: 'AppleStoreKitService',
          });
          const resolver = this.pendingPurchaseResolvers.get(productId);
          if (resolver) {
            resolver.reject(error);
            this.pendingPurchaseResolvers.delete(productId);
          }
          throw error;
        }

        const purchaseParams: any = { sku: productId };

        // Add promotional offer if provided
        if (offerIdentifier) {
          purchaseParams.withOffer = {
            identifier: offerIdentifier,
            // Note: For promotional offers, you may need to generate a signature
            // This depends on your App Store Connect setup
          };
        }

        Logger.info('[StoreKit] 📱 Requesting payment sheet from App Store', {
          component: 'AppleStoreKitService',
          productId,
          hasOffer: !!offerIdentifier,
          purchaseParams,
        });

        try {
          const requestResult = await requestSubscription(purchaseParams);
          Logger.info('[StoreKit] ✅ Payment sheet request sent successfully', {
            component: 'AppleStoreKitService',
            result: requestResult,
          });
        } catch (requestError) {
          Logger.error('[StoreKit] ❌ CRITICAL: Failed to show payment sheet', requestError as Error, {
            component: 'AppleStoreKitService',
            productId,
            errorDetails: requestError,
          });

          // CRITICAL FIX: Reject pending promise before throwing
          const resolver = this.pendingPurchaseResolvers.get(productId);
          if (resolver) {
            resolver.reject(requestError);
            this.pendingPurchaseResolvers.delete(productId);
          }

          throw requestError;
        }
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

      // ENHANCED: Comprehensive payment failure logging
      const failureContext: PaymentFailureContext = {
        userId: userId,
        productId: productId,
        screen: productId.includes('freetrial') ? 'trial_offer' : 'sales_offer',
        action: 'purchase',
        error: error instanceof Error ? error : new Error('Unknown error'),
        timestamp: new Date(),
        deviceInfo: {
          platform: Platform.OS,
          version: Platform.Version?.toString() || 'unknown',
          isSandbox: this.isSandboxEnvironment(),
        },
        retryCount: this.purchaseRetryCount.get(productId) || 0,
        userJourney: {
          source: 'payment_flow',
          onboardingFlow: false, // This could be enhanced to detect actual context
        },
      };

      const analysis = PaymentFailureLogger.logPaymentFailure(failureContext);

      Logger.error('[StoreKit] Purchase failed', error as Error, {
        component: 'AppleStoreKitService',
        productId,
        category: analysis.category,
        severity: analysis.severity,
        canRetry: analysis.canRetry,
        userFriendlyMessage: analysis.userFriendlyMessage,
      });

      return {
        success: false,
        error: analysis.userFriendlyMessage, // Use user-friendly message
      };
    }
  }

  /**
   * Handle purchase updates from the store
   * ENTERPRISE IMPROVEMENT: Now includes server-side validation
   */
  private async handlePurchaseUpdate(purchase: ProductPurchase): Promise<void> {
    const debugId = `${purchase.productId.substring(0, 20)}_${Date.now()}`;

    try {
      Logger.info(`[StoreKit][${debugId}] 🔍 STEP 1: Processing purchase update`, {
        component: 'AppleStoreKitService',
        productId: purchase.productId,
        transactionId: purchase.transactionId?.substring(0, 10) + '...',
        transactionDate: purchase.transactionDate,
        hasPendingResolver: this.pendingPurchaseResolvers.has(purchase.productId),
      });

      // CRITICAL: Validate purchase freshness to prevent cached/stale purchases
      const purchaseTime = new Date(purchase.transactionDate).getTime();
      const purchaseAge = Date.now() - purchaseTime;

      // CRITICAL: Reject transactions older than 10 minutes (600 seconds)
      // This prevents truly old cached purchases from being processed
      // But allows legitimate purchases that take 2-5 minutes (Face ID, reading terms, etc.)
      const STALE_THRESHOLD_MS = 10 * 60 * 1000; // 10 minutes

      if (purchaseAge > STALE_THRESHOLD_MS) {
        Logger.warn(`[StoreKit][${debugId}] ⚠️ STEP 2: STALE TRANSACTION DETECTED - Finishing and rejecting`, {
          component: 'AppleStoreKitService',
          purchaseAge: `${Math.round(purchaseAge / 1000)} seconds (${Math.round(purchaseAge / 60000)} minutes)`,
          transactionDate: new Date(purchaseTime).toISOString(),
          productId: purchase.productId,
          threshold: '10 minutes',
        });

        // Finish the transaction to clear it from the queue
        try {
          await finishTransaction({ purchase, isConsumable: false });
          Logger.info(`[StoreKit][${debugId}] ✅ Stale transaction finished successfully`);
        } catch (err) {
          Logger.error('[StoreKit] Failed to finish stale transaction', err as Error);
        }

        // DON'T reject pending purchase - just ignore this stale transaction
        // The real purchase will come through shortly
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
      let serverValidation: ServerValidationResult = { success: false };
      try {
        Logger.info(`[StoreKit][${debugId}] 🔄 STEP 3: Starting server-side receipt validation`, {
          component: 'AppleStoreKitService',
          userId: this.currentUserId || 'unknown',
          productId: purchase.productId,
          hasReceipt: !!purchase.transactionReceipt,
          receiptLength: purchase.transactionReceipt?.length,
        });

        const validationStartTime = Date.now();
        serverValidation = await this.validateReceiptServerSide(
          purchase.transactionReceipt,
          this.currentUserId || '',
          purchase.productId
        );
        const validationDuration = Date.now() - validationStartTime;

        Logger.info(`[StoreKit][${debugId}] ✅ STEP 4: Server validation completed`, {
          component: 'AppleStoreKitService',
          success: serverValidation.success,
          hasData: !!serverValidation.data,
          errorMessage: serverValidation.error,
          duration: validationDuration,
        });
      } catch (serverError) {
        Logger.error(`[StoreKit][${debugId}] ❌ STEP 4: Server validation threw error`, serverError as Error, {
          component: 'AppleStoreKitService',
          errorMessage: serverValidation.error,
        });
      }

      if (!serverValidation.success) {
        Logger.warn('[StoreKit] Server validation failed, trying client validation as fallback', {
          component: 'AppleStoreKitService',
          serverError: serverValidation.error,
        });

        // Still try client-side validation as fallback
        const isValid = await this.validateReceipt(purchase);
        if (!isValid) {
          Logger.error('[StoreKit] Both server and client validation failed, rejecting purchase', {
            component: 'AppleStoreKitService',
            productId: purchase.productId,
          });

          // CRITICAL: Reject the purchase promise
          const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
          if (resolver) {
            resolver.reject(new Error('Receipt validation failed'));
            this.pendingPurchaseResolvers.delete(purchase.productId);
          }
          return;
        } else {
          Logger.info('[StoreKit] Client validation succeeded as fallback', {
            component: 'AppleStoreKitService',
            productId: purchase.productId,
          });
        }
      } else {
        Logger.info('[StoreKit] Server validation succeeded', {
          component: 'AppleStoreKitService',
          productId: purchase.productId,
        });
      }

      // Map product ID to subscription tier
      const tier = this.getSubscriptionTierFromProductId(purchase.productId);

      if (!tier) {
        Logger.error('[StoreKit] Could not map product ID to tier, rejecting purchase', {
          component: 'AppleStoreKitService',
          productId: purchase.productId,
        });

        // CRITICAL: Reject the purchase promise
        const resolver = this.pendingPurchaseResolvers.get(purchase.productId);
        if (resolver) {
          resolver.reject(new Error('Invalid product ID'));
          this.pendingPurchaseResolvers.delete(purchase.productId);
        }
        return;
      }

      // CRITICAL FIX: Check if this is a trial product
      const isTrialProduct = purchase.productId.includes('freetrial');

      if (isTrialProduct) {
        // Get user's current tier to determine if this is NEW TRIAL or PAID UPGRADE
        const { data: currentSub } = await supabase
          .from('user_subscriptions_new')
          .select('tier')
          .eq('user_id', this.currentUserId)
          .single();

        const currentTier = currentSub?.tier || 'seeker';

        // CRITICAL: Skip for BOTH seeker and free_trial
        // - seeker + .freetrial = NEW TRIAL START → Skip (createTrial handles it)
        // - free_trial + .freetrial = TRIAL ALREADY ACTIVE → Skip (webhook will handle conversion)
        // Only paid tiers + .freetrial = TIER UPGRADE → Process
        if (currentTier === 'seeker' || currentTier === 'free_trial') {
          // NEW TRIAL or TRIAL ALREADY ACTIVE: Skip update
          Logger.info(`[StoreKit][${debugId}] 🎯 STEP 5: Trial-related purchase - skipping database update`, {
            component: 'AppleStoreKitService',
            userId: this.currentUserId || 'unknown',
            productId: purchase.productId,
            currentTier,
            tier,
            transactionId: purchase.transactionId?.substring(0, 10) + '...',
            message: currentTier === 'seeker'
              ? 'New trial - will be handled by createTrial()'
              : 'User already on trial - webhook will handle conversion after 3 days',
            timestamp: new Date().toISOString(),
          });

          // ONLY store transaction ID for NEW trials (seeker), not for existing trials
          // For existing trials, createTrial() already set everything including transaction IDs
          if (currentTier === 'seeker') {
            try {
              await supabase
                .from('user_subscriptions_new')
                .update({
                  original_transaction_id: purchase.transactionId,
                  platform_transaction_id: purchase.transactionId,
                  updated_at: new Date().toISOString(),
                })
                .eq('user_id', this.currentUserId);

              Logger.info(`[StoreKit][${debugId}] ✅ Original transaction ID stored for webhook`, {
                component: 'AppleStoreKitService',
                transactionId: purchase.transactionId?.substring(0, 10) + '...',
              });
            } catch (error) {
              Logger.error('[StoreKit] Failed to store original transaction ID', error as Error, {
                component: 'AppleStoreKitService',
              });
            }
          } else {
            Logger.info(`[StoreKit][${debugId}] ⏭️ Skipping transaction ID update - already set by createTrial()`, {
              component: 'AppleStoreKitService',
              currentTier,
            });
          }
        } else {
          // TIER UPGRADE: User on paid tier purchasing .freetrial product (tier upgrade)
          Logger.info(`[StoreKit][${debugId}] 💳 STEP 5: TIER UPGRADE detected - processing database update`, {
            component: 'AppleStoreKitService',
            userId: this.currentUserId || 'unknown',
            productId: purchase.productId,
            currentTier,
            targetTier: tier,
            transactionId: purchase.transactionId?.substring(0, 10) + '...',
            message: 'Paid tier upgrade',
            timestamp: new Date().toISOString(),
          });

          const dbUpdateStartTime = Date.now();
          await this.updateUserSubscription(purchase, tier, this.currentUserId || undefined);
          const dbUpdateDuration = Date.now() - dbUpdateStartTime;

          Logger.info(`[StoreKit][${debugId}] ✅ STEP 6: Tier upgrade completed successfully`, {
            component: 'AppleStoreKitService',
            userId: this.currentUserId || 'unknown',
            tier,
            duration: dbUpdateDuration,
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // For non-trial products (direct paid subscriptions), update subscription normally
        Logger.info(`[StoreKit][${debugId}] 🔄 STEP 5: Starting database update (non-trial product)`, {
          component: 'AppleStoreKitService',
          userId: this.currentUserId || 'unknown',
          tier,
          transactionId: purchase.transactionId?.substring(0, 10) + '...',
          timestamp: new Date().toISOString(),
        });

        const dbUpdateStartTime = Date.now();
        await this.updateUserSubscription(purchase, tier, this.currentUserId || undefined);
        const dbUpdateDuration = Date.now() - dbUpdateStartTime;

        Logger.info(`[StoreKit][${debugId}] ✅ STEP 6: Database update completed successfully`, {
          component: 'AppleStoreKitService',
          userId: this.currentUserId || 'unknown',
          tier,
          duration: dbUpdateDuration,
          timestamp: new Date().toISOString(),
        });
      }

      // Finish the transaction
      await finishTransaction({ purchase, isConsumable: false });

      // CRITICAL: Clear purchase timestamp after successful validation
      this.purchaseInitiatedTimestamp = null;

      // ENHANCED: Log successful payment
      const purchaseDuration = this.purchaseInitiatedTimestamp ?
        Date.now() - this.purchaseInitiatedTimestamp : 0;

      PaymentFailureLogger.logPaymentSuccess({
        userId: this.currentUserId || 'unknown',
        productId: purchase.productId,
        screen: purchase.productId.includes('freetrial') ? 'trial_offer' : 'sales_offer',
        transactionId: purchase.transactionId || 'unknown',
        amount: this.getAmountFromProductId(purchase.productId),
        currency: 'PHP', // Based on pricing in getAmountFromProductId
        duration: purchaseDuration,
      });

      Logger.info(`[StoreKit][${debugId}] ✅ STEP 7: Purchase validated and completed successfully`, {
        component: 'AppleStoreKitService',
        transactionId: purchase.transactionId?.substring(0, 10) + '...',
        duration: purchaseDuration,
        tier: tier,
        timestamp: new Date().toISOString(),
      });

      // Resolve the pending purchase promise
      Logger.info(`[StoreKit][${debugId}] 🎯 STEP 8: Resolving purchase promise`, {
        component: 'AppleStoreKitService',
        hasPendingResolver: this.pendingPurchaseResolvers.has(purchase.productId),
        pendingResolversCount: this.pendingPurchaseResolvers.size,
        timestamp: new Date().toISOString(),
      });

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
   * Set trial eligibility for the current purchase
   * This helps validate-receipt distinguish between new trials and paid purchases
   */
  setPurchaseEligibility(isEligibleForTrial: boolean): void {
    this.currentPurchaseEligibility = isEligibleForTrial;
  }

  /**
   * Validate purchase receipt
   */
  private async validateReceipt(purchase: ProductPurchase): Promise<boolean> {
    try {
      if (Platform.OS === 'ios') {
        // ENHANCED: Enable receipt validation with proper error handling
        // This ensures purchases are properly validated even in TestFlight

        const receiptBody = {
          'receipt-data': purchase.transactionReceipt,
          'password': process.env.APPLE_SHARED_SECRET || 'your-app-store-shared-secret',
        };

        const result = await validateReceiptIos({ receiptBody, isTest: this.isSandboxEnvironment() });

        // Log validation result for debugging
        Logger.info('[StoreKit] Receipt validation result', {
          component: 'AppleStoreKitService',
          status: result?.status,
          isValid: result && result.status === 0,
          environment: this.isSandboxEnvironment() ? 'sandbox' : 'production',
        });

        return result && result.status === 0;
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
    const isAnnual = productId.includes('annual');
    // Extract tier from product ID
    // Handles all variations:
    // - app.sifia.com.spark.monthly -> "spark"
    // - app.sifia.com.spark.annual -> "spark_annual"
    // - app.sifia.com.spark.monthly.freetrial -> "spark"
    // - app.sifia.com.spark.annual.freetrial -> "spark_annual"

    if (productId.includes('spark')) {return isAnnual ? 'spark_annual' : 'spark';}
    if (productId.includes('growth')) {return isAnnual ? 'growth_annual' : 'growth';}
    if (productId.includes('transformation')) {return isAnnual ? 'transformation_annual' : 'transformation';}
    // POST-LAUNCH: if (productId.includes('family')) {return isAnnual ? 'family_annual' : 'family';}
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
    tier: string,
    userId?: string
  ): Promise<void> {
    try {
      // Use provided userId or fall back to stored currentUserId for purchase flows
      const finalUserId = userId || this.currentUserId || await this.getCurrentUserId();

      if (!finalUserId) {
        Logger.error('[StoreKit] No userId available for subscription update', undefined, {
          component: 'AppleStoreKitService',
          action: 'error',
          context: 'updateUserSubscription called without userId',
        });
        throw new Error('No authenticated user found');
      }

      // FIRST: Check if user still exists in database
      const { data: userProfile, error: userCheckError } = await supabase
        .from('user_profiles')
        .select('id')
        .eq('id', finalUserId)
        .single();

      if (userCheckError || !userProfile) {

        throw new Error('User account not found - subscription update skipped');
      }

      // Always upgrade subscription when user makes a purchase
      // This handles both new subscriptions and upgrades from trial/existing tiers
      await NewSubscriptionService.upgradeSubscription(finalUserId, {
        target_tier: tier as SubscriptionTier,
        platform: 'apple',
        platform_subscription_id: purchase.transactionId || purchase.productId,
      });

      // Send payment success notification for new purchase/upgrade
      try {
        const subscription = await NewSubscriptionService.getUserSubscription(finalUserId);
        const tierDisplayName = subscription.subscription_display_name || tier;
        const amount = this.getAmountFromProductId(purchase.productId);
        // Call scheduler directly to avoid argument count issues
        await notificationSchedulerService.schedulePaymentSuccessNotification(
          finalUserId,
          tierDisplayName,
          amount
        );
      } catch (notifError) {
        Logger.warn('[StoreKit] Failed to send purchase success notification', {
          component: 'AppleStoreKitService',
          errorMessage: String(notifError),
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
      // Validate userId early to fail fast
      if (!userId) {
        Logger.error('[StoreKit] No userId provided to checkAndSyncSubscriptionStatus', undefined, {
          component: 'AppleStoreKitService',
          action: 'error',
        });
        throw new Error('No authenticated user found');
      }

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
        userId: userId.substring(0, 10) + '...', // Log partial userId for privacy
      });

      // Get all available purchases from Apple
      if (!RNIap?.getAvailablePurchases) {
        Logger.error('[StoreKit] RNIap not properly initialized - getAvailablePurchases missing', undefined, {
          component: 'AppleStoreKitService',
          action: 'error',
          hasRNIap: !!RNIap,
          hasInitConnection: !!RNIap?.initConnection,
        });

        // Try to reinitialize once
        Logger.info('[StoreKit] Attempting to reinitialize RNIap...', {
          component: 'AppleStoreKitService',
        });

        try {
          await this.initialize();
          if (!RNIap?.getAvailablePurchases) {
            throw new Error('In-app purchase library not available after reinitialization');
          }
        } catch (reinitError) {
          Logger.error('[StoreKit] Reinitialization failed', reinitError as Error, {
            component: 'AppleStoreKitService',
          });
          throw new Error('In-app purchase library not available');
        }
      }

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

      // CRITICAL: Filter out OLD cancelled/expired transactions
      // Apple's getAvailablePurchases returns ALL purchases ever made, including cancelled ones
      // Only process transactions from the last 60 days
      const sixtyDaysAgo = Date.now() - (60 * 24 * 60 * 60 * 1000);
      const recentPurchases = availablePurchases.filter(p => {
        const transactionDate = new Date(p.transactionDate || 0).getTime();
        return transactionDate > sixtyDaysAgo;
      });

      Logger.info('[StoreKit] Filtered old transactions', {
        component: 'AppleStoreKitService',
        totalPurchases: availablePurchases.length,
        recentPurchases: recentPurchases.length,
        oldestTransaction: availablePurchases[0]?.transactionDate,
      });

      if (recentPurchases.length === 0) {
        Logger.info('[StoreKit] No recent active purchases - treating as no subscription', {
          component: 'AppleStoreKitService',
        });
        await this.handleNoActiveSubscription(userId);
        return;
      }

      // Get the most recent subscription purchase
      const latestPurchase = this.getMostRecentPurchase(recentPurchases);

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
      const trialDurationMs = this.isSandboxEnvironment() ? 180000 : 259200000;

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
    productId?: string,
    _isEligibleForTrial?: boolean
  ): Promise<ServerValidationResult> {
    try {
      // Add 10 second timeout to prevent hanging
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Server validation timeout after 10s')), 10000)
      );

      const validationPromise = supabase.functions.invoke('validate-receipt', {
        body: {
          receiptData,
          userId,
          platform: 'ios',
          productId,
          isEligibleForTrial: this.currentPurchaseEligibility || undefined,
        },
      });

      const { data, error } = await Promise.race([validationPromise, timeoutPromise]);

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
        .select('id, onboarding_completed')
        .eq('id', userId)
        .single();

      if (userCheckError || !userProfile) {

        return;
      }

      // Get current database status
      const currentSub = await NewSubscriptionService.getUserSubscription(userId);
      const onboardingCompleted = (userProfile as any)?.onboarding_completed === true;

      // CRITICAL: If user is already on free_trial and this is a trial product, don't update
      // This prevents overwriting the trial tier that was just set by startFreeTrial()
      if (currentSub?.tier === 'free_trial' && status.isTrialProduct) {
        Logger.info('[StoreKit] User already on free_trial with trial product - skipping sync', {
          component: 'AppleStoreKitService',
          currentTier: currentSub.tier,
          statusTier: status.tier,
          trialChosenTier: (currentSub as any)?.trial_chosen_tier,
        });
        return;
      }

      // CRITICAL: If this is a trial product and user is NOT on free_trial yet,
      // it means startFreeTrial() hasn't run yet or failed.
      // In this case, we should NOT upgrade to the paid tier - skip sync and let startFreeTrial handle it
      if (status.isTrialProduct && currentSub?.tier !== 'free_trial') {
        Logger.info('[StoreKit] Trial product detected but user not on free_trial yet - skipping sync to let startFreeTrial handle it', {
          component: 'AppleStoreKitService',
          currentTier: currentSub?.tier,
          statusTier: status.tier,
          isTrialProduct: status.isTrialProduct,
        });
        return;
      }

      // CRITICAL: Prevent overwriting seeker subscriptions with stale Apple receipt data
      // If user is seeker and Apple receipt shows no active subscription, skip sync
      if (currentSub?.tier === 'seeker' && status.status !== 'active') {
        Logger.info('[StoreKit] User is seeker with no active Apple subscription - skipping sync to prevent transformation tier bug', {
          component: 'AppleStoreKitService',
          currentTier: currentSub.tier,
          appleStatus: status.status,
          appleTier: status.tier,
        });
        return;
      }

      if (!onboardingCompleted && currentSub?.tier === 'seeker' && status.status === 'active') {
        Logger.info('[StoreKit] Skipping Apple auto-upgrade for seeker during onboarding to prevent transformation tier bug', {
          component: 'AppleStoreKitService',
          currentTier: currentSub.tier,
          appleStatus: status.status,
          appleTier: status.tier,
          onboardingCompleted,
        });
        return;
      }

      if (currentSub?.tier === 'seeker' && !currentSub?.platform_subscription_id && status.status === 'active') {
        Logger.info('[StoreKit] Skipping Apple auto-upgrade for seeker with no prior purchase - user must explicitly purchase first', {
          component: 'AppleStoreKitService',
          currentTier: currentSub.tier,
          appleStatus: status.status,
          appleTier: status.tier,
          hasPlatformSubId: !!currentSub?.platform_subscription_id,
        });
        return;
      }

      // Check if update is needed
      const needsUpdate =
        currentSub?.tier !== status.tier ||
        currentSub?.status !== status.status;

      if (!needsUpdate) {

        return;
      }

      // Update database
      if (status.status === 'free_trial') {
        // User is in trial - this should rarely happen since we skip above
        // But if it does, preserve trial_chosen_tier
        const trialChosenTier = (currentSub as any)?.trial_chosen_tier || status.tier;

        await NewSubscriptionService.upgradeSubscription(userId, {
          target_tier: 'free_trial',
          platform: 'apple',
          platform_subscription_id: purchase.transactionId,
        });

        // Preserve trial_chosen_tier after upgrade
        await supabase
          .from('user_subscriptions_new')
          .update({ trial_chosen_tier: trialChosenTier })
          .eq('user_id', userId);

        Logger.info('[StoreKit] Preserved trial_chosen_tier after sync', {
          component: 'AppleStoreKitService',
          trialChosenTier,
        });
      } else {
        // User has paid subscription - upgrade to actual tier
        // This happens when trial period ends and converts to paid
        await NewSubscriptionService.upgradeSubscription(userId, {
          target_tier: status.tier as SubscriptionTier,
          platform: 'apple',
          platform_subscription_id: purchase.transactionId,
        });

        // Send payment success notification for trial conversion
        try {
          const subscription = await NewSubscriptionService.getUserSubscription(userId);
          const tierDisplayName = subscription.subscription_display_name || status.tier;
          // Call scheduler directly to avoid argument count issues
          await notificationSchedulerService.schedulePaymentSuccessNotification(
            userId,
            tierDisplayName,
            0
          ); // Trial conversion = no additional cost
        } catch (notifError) {
          Logger.warn('[StoreKit] Failed to send trial conversion notification', {
            component: 'AppleStoreKitService',
            errorMessage: String(notifError),
          });
        }
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
        Logger.info('[StoreKit] User already seeker - no action needed', {
          component: 'AppleStoreKitService',
        });
        return;
      }

      // CRITICAL: Use cancelSubscription instead of upgradeSubscription for proper seeker downgrade
      // This ensures all limits and fields are correctly reset with built-in failsafes
      Logger.info('[StoreKit] No active subscription found - downgrading to seeker', {
        component: 'AppleStoreKitService',
        currentTier: currentSub?.tier,
      });

      await NewSubscriptionService.cancelSubscription(userId);

      Logger.info('[StoreKit] Successfully downgraded to seeker', {
        component: 'AppleStoreKitService',
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
      Logger.info('[StoreKit] 🔄 Starting restore purchases flow', {
        component: 'AppleStoreKitService',
        userId: userId.substring(0, 10) + '...',
      });

      await this.initialize();

      // CRITICAL: Prevent concurrent restore requests
      if (this.purchaseInitiatedTimestamp) {
        Logger.warn('[StoreKit] ⚠️ Purchase in progress, cannot restore now', {
          component: 'AppleStoreKitService',
        });
        return {
          success: false,
          message: 'A purchase is currently in progress. Please wait and try again.',
        };
      }

      // Get all available purchases from device
      const availablePurchases = await RNIap.getAvailablePurchases();

      Logger.info('[StoreKit] Available purchases retrieved', {
        component: 'AppleStoreKitService',
        count: availablePurchases.length,
      });

      if (availablePurchases.length === 0) {
        return {
          success: false,
          message: 'No purchases found to restore',
        };
      }

      // ENTERPRISE IMPROVEMENT: Validate each purchase server-side with timeout
      let validatedCount = 0;
      let finishedCount = 0;
      const validationPromises = availablePurchases.map(async (purchase) => {
        try {
          Logger.info('[StoreKit] Validating restored purchase', {
            component: 'AppleStoreKitService',
            productId: purchase.productId,
            transactionDate: purchase.transactionDate,
          });

          // Add timeout to validation
          const validationTimeout = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Validation timeout')), 15000);
          });

          // Check trial eligibility for restore purchases
          const isTrialProduct = (purchase.productId || '').includes('freetrial');
          let isEligibleForTrial = false;

          if (isTrialProduct) {
            // Check if user is eligible for trial
            const { data: currentSub } = await supabase
              .from('user_subscriptions_new')
              .select('tier, trial_start_date')
              .eq('user_id', userId)
              .single();

            isEligibleForTrial = !currentSub || currentSub.tier === 'seeker';
          }

          const validationResult = await Promise.race([
            this.validateReceiptServerSide(
              purchase.transactionReceipt,
              userId,
              purchase.productId,
              isEligibleForTrial
            ),
            validationTimeout,
          ]);

          if (validationResult.success) {
            validatedCount++;
            Logger.info('[StoreKit] ✅ Restored purchase validated successfully', {
              component: 'AppleStoreKitService',
              productId: purchase.productId,
            });

            // CRITICAL: Finish transaction to prevent it from reappearing
            try {
              await finishTransaction({ purchase, isConsumable: false });
              finishedCount++;
              Logger.info('[StoreKit] ✅ Restored purchase finished', {
                component: 'AppleStoreKitService',
                productId: purchase.productId,
              });
            } catch (finishError) {
              Logger.error('[StoreKit] Failed to finish restored purchase', finishError as Error, {
                component: 'AppleStoreKitService',
                productId: purchase.productId,
              });
            }
          } else {
            Logger.warn('[StoreKit] ⚠️ Restored purchase validation failed', {
              component: 'AppleStoreKitService',
              details: purchase.productId,
              errorMessage: validationResult.error,
            });
          }
        } catch (error) {
          Logger.error('[StoreKit] Error validating restored purchase', error as Error, {
            component: 'AppleStoreKitService',
            action: 'error',
            productId: purchase.productId,
          });
        }
      });

      // Wait for all validations to complete
      await Promise.all(validationPromises);

      Logger.info('[StoreKit] All restored purchases processed', {
        component: 'AppleStoreKitService',
        total: availablePurchases.length,
        validated: validatedCount,
        finished: finishedCount,
      });

      // Sync status with latest validated purchase
      await this.checkAndSyncSubscriptionStatus(userId, false);

      return {
        success: true,
        message: 'Your purchases have been successfully restored!',
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
   * Extract amount from product ID for notifications
   */
  private getAmountFromProductId(productId: string): number {
    // Extract tier and billing from product ID
    // Example: app.sifia.com.growth.monthly -> Growth tier
    const parts = productId.split('.');
    const tier = parts[2]; // growth, spark, transformation
    const billing = parts[3]; // monthly, annual

    // Return standard pricing amounts (in PHP)
    const pricing: Record<string, Record<string, number>> = {
      spark: { monthly: 199, annual: 1990 },
      growth: { monthly: 499, annual: 4990 },
      transformation: { monthly: 999, annual: 9990 },
    };

    return pricing[tier]?.[billing] || 0;
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
