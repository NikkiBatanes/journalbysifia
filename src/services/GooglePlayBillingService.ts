import { Platform } from 'react-native';
import { Logger } from '../utils/ProductionLogger';
import RNIap, {
  ProductPurchase,
  PurchaseError,
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from 'react-native-iap';
import { NewSubscriptionService } from './NewSubscriptionService';
import { supabase } from './supabaseClient';
import { metaAppEventsService } from './metaAppEventsService';

export interface GooglePlayProduct {
  productId: string;
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
  subscriptionOfferDetails?: GooglePlaySubscriptionOffer[];
}

interface GooglePlayPricingPhase {
  formattedPrice?: string;
  priceCurrencyCode?: string;
  billingPeriod?: string;
  billingCycleCount?: number;
  priceAmountMicros?: string;
}

interface GooglePlaySubscriptionOffer {
  basePlanId?: string;
  offerId?: string | null;
  offerToken: string;
  pricingPhases?: {
    pricingPhaseList?: GooglePlayPricingPhase[];
  };
  offerTags?: string[];
}

type GooglePlayTier = 'spark' | 'growth' | 'transformation' | 'family';
type GooglePlayBillingCycle = 'monthly' | 'annual';

interface GooglePlayPlanSelection {
  tier?: GooglePlayTier;
  billing?: GooglePlayBillingCycle;
  trialRequested: boolean;
}

interface PendingPurchaseContext {
  userId: string;
  selectionId: string;
  actualProductId: string;
  tier: string;
  billing: GooglePlayBillingCycle;
  offer?: GooglePlaySubscriptionOffer;
  isTrialOffer: boolean;
  trialDurationDays: number;
}

interface PendingPurchaseEntry {
  resolve: (result: GooglePlayPurchaseResult) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
  context: PendingPurchaseContext;
}

export interface GooglePlayPurchaseResult {
  success: boolean;
  transactionId?: string;
  receipt?: string;
  error?: string;
  errorCode?: string;
  validated?: boolean;
  receiptId?: string;
  validation?: any;
}

export class GooglePlayBillingService {
  private static instance: GooglePlayBillingService;
  private isInitialized = false;
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;
  private currentUserId: string | null = null;
  private productsById = new Map<string, GooglePlayProduct>();
  private pendingPurchases = new Map<string, PendingPurchaseEntry>();
  private handledPurchaseKeys = new Set<string>();
  private processingPurchaseKeys = new Set<string>();

  // Product IDs for Google Play subscription tiers
  private static readonly PRODUCT_IDS = {
    spark_monthly: 'spark_monthly',
    spark_annual: 'spark_annual',
    growth_monthly: 'growth_monthly',
    growth_annual: 'growth_annual',
    transformation_monthly: 'transformation_monthly',
    transformation_annual: 'transformation_annual',
    // POST-LAUNCH: family_monthly: 'family_monthly',
    // POST-LAUNCH: family_annual: 'family_annual',
  };

  private constructor() {}

  static getInstance(): GooglePlayBillingService {
    if (!GooglePlayBillingService.instance) {
      GooglePlayBillingService.instance = new GooglePlayBillingService();
    }
    return GooglePlayBillingService.instance;
  }

  /**
   * Initialize the connection to Google Play Billing
   */
  async initialize(): Promise<boolean> {
    try {
      if (this.isInitialized) {
        return true;
      }

      if (Platform.OS !== 'android') {

        return false;
      }

      await initConnection();

      // Set up purchase listeners
      this.setupPurchaseListeners();

      this.isInitialized = true;
      return true;
    } catch (error) {
      Logger.error('[GooglePlay] Failed to initialize billing', error as Error, {
      component: 'GooglePlayBillingService',
    });
      return false;
    }
  }

  /**
   * Set up purchase event listeners
   */
  private setupPurchaseListeners(): void {
    this.purchaseUpdateSubscription = purchaseUpdatedListener(
      async (purchase: ProductPurchase) => {

        await this.handlePurchaseUpdate(purchase);
      }
    );

    this.purchaseErrorSubscription = purchaseErrorListener(
      (error: PurchaseError) => {
        Logger.error('[GooglePlay] Purchase error', error as Error, {
      component: 'GooglePlayBillingService',
    });
        this.handlePurchaseError(error);
      }
    );
  }

  /**
   * Get available subscription products from Google Play
   */
  async getAvailableProducts(): Promise<GooglePlayProduct[]> {
    try {
      await this.initialize();

      if (Platform.OS !== 'android') {
        return [];
      }

      const productIds = Object.values(GooglePlayBillingService.PRODUCT_IDS);
      const products = await getSubscriptions({ skus: productIds });

      const mappedProducts = products.map((product: any) => {
        const offers = product.subscriptionOfferDetails || [];
        const displayOffer = this.selectDisplayOffer(offers);
        const displayPhase = this.getRecurringPricingPhase(displayOffer) || this.getFirstPricingPhase(displayOffer);

        return {
          productId: product.productId,
          price: displayPhase?.priceAmountMicros || product.price || '0',
          currency: displayPhase?.priceCurrencyCode || product.currency || '',
          localizedPrice: displayPhase?.formattedPrice || product.localizedPrice || '',
          title: product.title || product.name || product.productId,
          description: product.description || '',
          subscriptionOfferDetails: offers,
        };
      });

      this.productsById = new Map();
      mappedProducts.forEach(product => this.indexProduct(product));
      return mappedProducts;
    } catch (error) {
      Logger.error('[GooglePlay] Failed to get products', error as Error, {
      component: 'GooglePlayBillingService',
    });
      return [];
    }
  }

  /**
   * Purchase a subscription through Google Play
   */
  async purchaseSubscription(
    productId: string,
    userId: string
  ): Promise<GooglePlayPurchaseResult> {
    try {
      await this.initialize();

      if (Platform.OS !== 'android') {
        throw new Error('Google Play Billing is only available on Android');
      }

      this.currentUserId = userId || null;
      const product = await this.getProductForPurchase(productId);
      const actualProductId = product.productId;
      const offer = this.selectPurchaseOffer(product.subscriptionOfferDetails || [], productId, actualProductId);

      if (!offer?.offerToken) {
        throw new Error(`No Google Play offer token available for ${productId}`);
      }

      const isTrialOffer = this.isFreeTrialOffer(offer);
      const trialDurationDays = this.getTrialDurationDays(offer);
      const selection = this.parsePlanSelection(productId, offer, actualProductId);
      const tier = this.getSubscriptionTierFromProductId(productId, offer, actualProductId);

      if (!tier) {
        throw new Error(`Unknown Google Play product ID: ${productId}`);
      }

      Logger.info('[GooglePlay] Launching subscription purchase', {
        component: 'GooglePlayBillingService',
        selectionId: productId,
        actualProductId,
        basePlanId: offer.basePlanId,
        offerId: offer.offerId,
        isTrialOffer,
        trialDurationDays,
        billing: selection.billing,
      });

      const pendingResult = new Promise<GooglePlayPurchaseResult>((resolve, reject) => {
        let pendingPurchase: PendingPurchaseEntry | undefined;
        const timeout = setTimeout(() => {
          if (pendingPurchase) {
            this.recoverOrRejectPendingPurchase(pendingPurchase);
          }
        }, 60000);

        pendingPurchase = {
          resolve,
          reject,
          timeout,
          context: {
            userId,
            selectionId: productId,
            actualProductId,
            tier,
            billing: selection.billing || 'monthly',
            offer,
            isTrialOffer,
            trialDurationDays,
          },
        };

        this.pendingPurchases.set(productId, pendingPurchase);
        this.pendingPurchases.set(actualProductId, pendingPurchase);
      });
      pendingResult.catch(() => {});

      const requestResult = await requestSubscription({
        subscriptionOffers: [{
          sku: actualProductId,
          offerToken: offer.offerToken,
        }],
        obfuscatedAccountIdAndroid: userId,
      } as any);

      await this.handleNativePurchaseResult(requestResult, actualProductId);

      return await pendingResult;
    } catch (error) {
      const pending = this.findPendingPurchase(productId);
      if (pending) {
        this.clearPendingPurchase(pending);
      }

      Logger.error('[GooglePlay] Purchase failed', error as Error, {
      component: 'GooglePlayBillingService',
    });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: error instanceof Error ? (error as any).code : undefined,
      };
    }
  }

  /**
   * Handle purchase updates from Google Play
   */
  private async handlePurchaseUpdate(purchase: ProductPurchase): Promise<void> {
    const productId = this.getPurchaseProductId(purchase);
    const pending = this.findPendingPurchase(productId) || this.findOnlyPendingPurchase();
    const resolutionProductId = productId || pending?.context.actualProductId || pending?.context.selectionId || '';
    const purchaseKey = this.getPurchaseKey(purchase);

    if (this.handledPurchaseKeys.has(purchaseKey)) {
      if (pending && resolutionProductId) {
        this.resolvePendingPurchase(
          resolutionProductId,
          this.createPurchaseResult(purchase, true, pending.context)
        );
      }
      return;
    }

    if (this.processingPurchaseKeys.has(purchaseKey)) {
      return;
    }

    this.processingPurchaseKeys.add(purchaseKey);

    try {
      // Validate the purchase with Google Play
      const isValid = await this.validatePurchase(purchase);

      if (!isValid) {
        const error = new Error('Google Play purchase validation failed');
        Logger.error('[GooglePlay] Purchase validation failed', error, {
      component: 'GooglePlayBillingService',
    });
        if (resolutionProductId) {
          this.resolvePendingPurchase(resolutionProductId, { success: false, error: error.message });
        }
        return;
      }

      // Map product ID to subscription tier
      const tier = pending?.context.tier || this.getSubscriptionTierFromProductId(productId, pending?.context.offer);

      if (!tier) {
        const error = new Error(`Unknown Google Play product ID: ${productId}`);
        Logger.error('[GooglePlay] Unknown product ID', error, {
        component: 'GooglePlayBillingService',
        productId,
      });
        if (resolutionProductId) {
          this.resolvePendingPurchase(resolutionProductId, { success: false, error: error.message });
        }
        return;
      }

      // Update user subscription in database
      await this.updateUserSubscription(purchase, tier, pending?.context);

      // Acknowledge the purchase (required for subscriptions)
      await this.finishGooglePlayTransaction(purchase);

      const trackingProductId = pending?.context.selectionId || productId;
      const amount = this.getAmountFromProductId(trackingProductId);
      if (amount > 0) {
        metaAppEventsService.trackPurchase({
          amount,
          currency: 'PHP',
          productId: trackingProductId,
          transactionId: purchase.transactionId || purchase.purchaseToken,
          tier,
          platform: 'android',
        });
      }

      this.handledPurchaseKeys.add(purchaseKey);

      if (resolutionProductId) {
        this.resolvePendingPurchase(
          resolutionProductId,
          this.createPurchaseResult(purchase, true, pending?.context)
        );
      }
    } catch (error) {
      this.handledPurchaseKeys.delete(purchaseKey);
      Logger.error('[GooglePlay] Failed to handle purchase update', error as Error, {
      component: 'GooglePlayBillingService',
    });
      if (resolutionProductId) {
        this.resolvePendingPurchase(resolutionProductId, {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown purchase error',
        });
      }
    } finally {
      this.processingPurchaseKeys.delete(purchaseKey);
    }
  }

  /**
   * Validate purchase with Google Play
   */
  private async validatePurchase(purchase: ProductPurchase): Promise<boolean> {
    try {
      if (Platform.OS !== 'android') {
        return false;
      }

      // Production validation should happen server-side. Locally, trust Play
      // Billing's purchase update state so checkout can finish and acknowledge.
      if (typeof purchase.purchaseStateAndroid === 'number') {
        return purchase.purchaseStateAndroid === 1; // BillingClient.PurchaseState.PURCHASED
      }

      return Boolean(purchase.purchaseToken || purchase.transactionReceipt);
    } catch (error) {
      Logger.error('[GooglePlay] Purchase validation error', error as Error, {
      component: 'GooglePlayBillingService',
    });
      return false;
    }
  }

  /**
   * Map product ID to subscription tier
   */
  private getSubscriptionTierFromProductId(
    productId: string,
    offer?: GooglePlaySubscriptionOffer,
    fallbackProductId?: string
  ): string | null {
    const selection = this.parsePlanSelection(productId, offer, fallbackProductId);
    const tier = selection.tier;

    if (!tier) {
      return null;
    }

    if (selection.billing === 'annual') {
      return `${tier}_annual`;
    }

    return tier;
  }

  /**
   * Update user subscription in database
   */
  private async updateUserSubscription(
    purchase: ProductPurchase,
    tier: string,
    context?: PendingPurchaseContext
  ): Promise<void> {
    try {
      // This would typically be called with the current user's ID
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

      const transactionId = purchase.transactionId || purchase.purchaseToken || purchase.transactionReceipt;

      if (context?.isTrialOffer) {
        await NewSubscriptionService.startFreeTrial({
          user_id: userId,
          duration_days: context.trialDurationDays,
          trial_chosen_tier: tier.replace('_annual', '') as any,
          billing_cycle: tier.includes('annual') ? 'annual' : 'monthly',
          platform_transaction_id: transactionId,
          // original_transaction_id is Apple-specific. Google Play purchase
          // tokens are stored in platform_transaction_id.
          original_transaction_id: undefined,
          platform_subscription_id: context.actualProductId,
        });
      } else {
        await NewSubscriptionService.upgradeSubscription(userId, {
          target_tier: tier as any,
          platform: 'google',
          platform_subscription_id: context?.actualProductId || this.getPurchaseProductId(purchase),
          platform_transaction_id: transactionId,
        });
      }

    } catch (error) {
      Logger.error('[GooglePlay] Failed to update user subscription', error as Error, {
      component: 'GooglePlayBillingService',
    });
      throw error;
    }
  }

  private async getProductForPurchase(productId: string): Promise<GooglePlayProduct> {
    // Always refresh immediately before purchase. Google Play offer tokens can
    // go stale, especially for trials and tester eligibility changes.
    const products = await this.getAvailableProducts();
    const product = this.productsById.get(productId) || products.find(item => this.productMatchesSelection(item, productId));

    if (!product) {
      throw new Error(`Google Play product not found: ${productId}`);
    }

    return product;
  }

  private indexProduct(product: GooglePlayProduct): void {
    this.addProductAlias(product.productId, product);

    const productSelection = this.parsePlanSelection(product.productId);
    this.addPlanAliases(product, productSelection);

    product.subscriptionOfferDetails?.forEach(offer => {
      if (offer.basePlanId) {
        this.addProductAlias(offer.basePlanId, product);
      }

      if (offer.offerId) {
        this.addProductAlias(offer.offerId, product);
      }

      const offerSelection = this.parsePlanSelection(product.productId, offer);
      this.addPlanAliases(product, offerSelection);
    });
  }

  private addProductAlias(alias: string | undefined | null, product: GooglePlayProduct): void {
    if (alias) {
      this.productsById.set(alias, product);
    }
  }

  private addPlanAliases(product: GooglePlayProduct, selection: GooglePlayPlanSelection): void {
    if (!selection.tier || !selection.billing) {
      return;
    }

    this.addProductAlias(`${selection.tier}_${selection.billing}`, product);
    this.addProductAlias(`${selection.tier}-${selection.billing}`, product);

    if (selection.trialRequested) {
      this.addProductAlias(`${selection.tier}-${selection.billing}-trial`, product);
    }
  }

  private productMatchesSelection(product: GooglePlayProduct, selectionId: string): boolean {
    if (product.productId === selectionId) {
      return true;
    }

    const desired = this.parsePlanSelection(selectionId);
    const productSelection = this.parsePlanSelection(product.productId);

    if (desired.tier && productSelection.tier && desired.tier !== productSelection.tier) {
      return false;
    }

    if (desired.billing && productSelection.billing && desired.billing !== productSelection.billing) {
      return false;
    }

    if (desired.tier && productSelection.tier && desired.billing && productSelection.billing) {
      return true;
    }

    return Boolean(product.subscriptionOfferDetails?.some(offer => {
      const offerSelection = this.parsePlanSelection(product.productId, offer);
      const tierMatches = !desired.tier || !offerSelection.tier || desired.tier === offerSelection.tier;
      const billingMatches = !desired.billing || !offerSelection.billing || desired.billing === offerSelection.billing;
      return tierMatches && billingMatches;
    }));
  }

  private selectDisplayOffer(offers: GooglePlaySubscriptionOffer[]): GooglePlaySubscriptionOffer | undefined {
    return offers.find(offer => !this.isFreeTrialOffer(offer)) || offers[0];
  }

  private selectPurchaseOffer(
    offers: GooglePlaySubscriptionOffer[],
    selectionId: string,
    actualProductId: string
  ): GooglePlaySubscriptionOffer | undefined {
    if (offers.length === 0) {
      return undefined;
    }

    return offers
      .map(offer => ({
        offer,
        score: this.scoreOfferForSelection(offer, selectionId, actualProductId),
      }))
      .filter(item => item.score >= 0)
      .sort((a, b) => b.score - a.score)[0]?.offer || offers[0];
  }

  private scoreOfferForSelection(
    offer: GooglePlaySubscriptionOffer,
    selectionId: string,
    actualProductId: string
  ): number {
    const desired = this.parsePlanSelection(selectionId);
    const actual = this.parsePlanSelection(actualProductId, offer);
    const identifiers = this.getOfferIdentifierText(offer);
    const isTrial = this.isFreeTrialOffer(offer);
    let score = 0;

    if (desired.tier && actual.tier) {
      if (desired.tier !== actual.tier) {
        return -1;
      }
      score += 20;
    }

    if (desired.billing && actual.billing) {
      if (desired.billing !== actual.billing) {
        return -1;
      }
      score += 40;
    }

    if (desired.tier && desired.billing) {
      const expectedBasePlanId = `${desired.tier}-${desired.billing}`;
      const expectedTrialOfferId = `${expectedBasePlanId}-trial`;

      if (identifiers.includes(expectedTrialOfferId)) {
        score += desired.trialRequested ? 120 : 10;
      }

      if (identifiers.includes(expectedBasePlanId)) {
        score += 60;
      }
    }

    if (desired.trialRequested) {
      score += isTrial ? 80 : -20;
    } else {
      score += isTrial ? 0 : 30;
    }

    return score;
  }

  private isFreeTrialOffer(offer?: GooglePlaySubscriptionOffer): boolean {
    if (!offer) {
      return false;
    }

    const identifiers = this.getOfferIdentifierText(offer);
    if (identifiers.includes('trial')) {
      return true;
    }

    return Boolean(offer.pricingPhases?.pricingPhaseList?.some(phase => {
      const amount = Number(phase.priceAmountMicros || '0');
      return Number.isFinite(amount) && amount === 0 && Boolean(phase.billingPeriod);
    }));
  }

  private getFirstPricingPhase(offer?: GooglePlaySubscriptionOffer): GooglePlayPricingPhase | undefined {
    return offer?.pricingPhases?.pricingPhaseList?.[0];
  }

  private getRecurringPricingPhase(offer?: GooglePlaySubscriptionOffer): GooglePlayPricingPhase | undefined {
    const phases = offer?.pricingPhases?.pricingPhaseList || [];
    return [...phases].reverse().find(phase => Number(phase.priceAmountMicros || '0') > 0) || phases[phases.length - 1];
  }

  private getTrialDurationDays(offer?: GooglePlaySubscriptionOffer): number {
    const freePhase = offer?.pricingPhases?.pricingPhaseList?.find(phase => Number(phase.priceAmountMicros || '0') === 0);
    return this.parseBillingPeriodToDays(freePhase?.billingPeriod) || 3;
  }

  private parsePlanSelection(
    selectionId = '',
    offer?: GooglePlaySubscriptionOffer,
    fallbackProductId = ''
  ): GooglePlayPlanSelection {
    const raw = [
      selectionId,
      fallbackProductId,
      offer?.basePlanId,
      offer?.offerId,
      ...(offer?.offerTags || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    const normalized = raw
      .replace(/app\.sifia\.com/g, ' ')
      .replace(/free\s*trial|freetrial/g, ' trial ')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();

    const tier = this.getTierFromText(normalized);
    const billing = this.getBillingCycleFromText(normalized) || this.getBillingCycleFromOffer(offer);
    const trialRequested = normalized.split(/\s+/).includes('trial');

    return {
      tier,
      billing,
      trialRequested,
    };
  }

  private getTierFromText(text: string): GooglePlayTier | undefined {
    if (text.includes('transformation')) {
      return 'transformation';
    }
    if (text.includes('growth')) {
      return 'growth';
    }
    if (text.includes('spark')) {
      return 'spark';
    }
    if (text.includes('family')) {
      return 'family';
    }
    return undefined;
  }

  private getBillingCycleFromText(text: string): GooglePlayBillingCycle | undefined {
    const parts = text.split(/\s+/);

    if (parts.some(part => ['annual', 'yearly', 'year'].includes(part))) {
      return 'annual';
    }

    if (parts.some(part => ['monthly', 'month'].includes(part))) {
      return 'monthly';
    }

    return undefined;
  }

  private getBillingCycleFromOffer(offer?: GooglePlaySubscriptionOffer): GooglePlayBillingCycle | undefined {
    const recurringPeriod = this.getRecurringPricingPhase(offer)?.billingPeriod;

    if (recurringPeriod === 'P1Y') {
      return 'annual';
    }

    if (recurringPeriod === 'P1M') {
      return 'monthly';
    }

    return undefined;
  }

  private getOfferIdentifierText(offer?: GooglePlaySubscriptionOffer): string {
    return [
      offer?.basePlanId,
      offer?.offerId,
      ...(offer?.offerTags || []),
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
  }

  private parseBillingPeriodToDays(period?: string): number | null {
    if (!period) {
      return null;
    }

    const match = period.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/);
    if (!match) {
      return null;
    }

    const years = Number(match[1] || 0);
    const months = Number(match[2] || 0);
    const weeks = Number(match[3] || 0);
    const days = Number(match[4] || 0);
    return (years * 365) + (months * 30) + (weeks * 7) + days;
  }

  private getPurchaseProductId(purchase: ProductPurchase | undefined): string {
    return purchase?.productId || purchase?.productIds?.[0] || (purchase as any)?.ids?.[0] || '';
  }

  private getPurchaseKey(purchase: ProductPurchase): string {
    return purchase.purchaseToken || purchase.transactionId || purchase.transactionReceipt || this.getPurchaseProductId(purchase);
  }

  private createPurchaseResult(
    purchase: ProductPurchase,
    validated: boolean,
    context?: PendingPurchaseContext
  ): GooglePlayPurchaseResult {
    const transactionId = purchase.transactionId || purchase.purchaseToken || purchase.transactionReceipt;

    return {
      success: true,
      transactionId,
      receipt: purchase.transactionReceipt || purchase.purchaseToken,
      validated,
      validation: {
        isTrialPeriod: context?.isTrialOffer === true,
        trialDurationDays: context?.trialDurationDays,
        productId: context?.actualProductId || this.getPurchaseProductId(purchase),
        selectionId: context?.selectionId,
        basePlanId: context?.offer?.basePlanId,
        offerId: context?.offer?.offerId,
        transactionId,
        environment: 'google_play',
      },
    };
  }

  private async handleNativePurchaseResult(requestResult: unknown, expectedProductId: string): Promise<void> {
    const purchases = this.normalizePurchaseResult(requestResult);

    if (purchases.length === 0) {
      Logger.info('[GooglePlay] Native request returned no purchase payload; waiting for listener', {
        component: 'GooglePlayBillingService',
        expectedProductId,
      });
      return;
    }

    const purchase = purchases.find(item => this.purchaseMatchesProductId(item, expectedProductId)) || purchases[0];

    Logger.info('[GooglePlay] Native request returned purchase payload', {
      component: 'GooglePlayBillingService',
      expectedProductId,
      returnedProductId: this.getPurchaseProductId(purchase),
      hasPurchaseToken: !!purchase.purchaseToken,
      purchaseStateAndroid: purchase.purchaseStateAndroid,
    });

    await this.handlePurchaseUpdate(purchase);
  }

  private normalizePurchaseResult(requestResult: unknown): ProductPurchase[] {
    if (!requestResult) {
      return [];
    }

    return (Array.isArray(requestResult) ? requestResult : [requestResult])
      .filter(item => item && typeof item === 'object') as ProductPurchase[];
  }

  private async recoverOrRejectPendingPurchase(pending: PendingPurchaseEntry): Promise<void> {
    if (!this.isPendingPurchaseActive(pending)) {
      return;
    }

    try {
      Logger.warn('[GooglePlay] Purchase listener timed out; checking available purchases before rejecting', {
        component: 'GooglePlayBillingService',
        selectionId: pending.context.selectionId,
        actualProductId: pending.context.actualProductId,
      });

      const recoveredPurchase = await this.findAvailablePurchaseForPending(pending);

      if (recoveredPurchase) {
        Logger.info('[GooglePlay] Recovered completed purchase from Google Play', {
          component: 'GooglePlayBillingService',
          productId: this.getPurchaseProductId(recoveredPurchase),
          hasPurchaseToken: !!recoveredPurchase.purchaseToken,
          purchaseStateAndroid: recoveredPurchase.purchaseStateAndroid,
        });

        await this.handlePurchaseUpdate(recoveredPurchase);

        if (!this.isPendingPurchaseActive(pending)) {
          return;
        }
      }
    } catch (error) {
      Logger.warn('[GooglePlay] Purchase timeout recovery failed', {
        component: 'GooglePlayBillingService',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    if (!this.isPendingPurchaseActive(pending)) {
      return;
    }

    this.clearPendingPurchase(pending);
    pending.reject(new Error('Google Play purchase is still processing. Please try Sync Purchases from your profile, or try again in a moment.'));
  }

  private async findAvailablePurchaseForPending(pending: PendingPurchaseEntry): Promise<ProductPurchase | undefined> {
    const purchases = await RNIap.getAvailablePurchases() as ProductPurchase[];

    Logger.info('[GooglePlay] Available purchases checked for recovery', {
      component: 'GooglePlayBillingService',
      count: purchases.length,
      productIds: purchases.map(purchase => this.getPurchaseProductId(purchase)).filter(Boolean),
    });

    const matchingPurchase = purchases.find(purchase =>
      this.purchaseMatchesPendingContext(purchase, pending.context)
    );

    if (matchingPurchase) {
      return matchingPurchase;
    }

    return this.findOnlyPendingPurchase() === pending && purchases.length === 1
      ? purchases[0]
      : undefined;
  }

  private purchaseMatchesPendingContext(
    purchase: ProductPurchase,
    context: PendingPurchaseContext
  ): boolean {
    if (this.purchaseMatchesProductId(purchase, context.actualProductId)) {
      return true;
    }

    const purchaseProductId = this.getPurchaseProductId(purchase);
    const expected = this.parsePlanSelection(context.selectionId, context.offer, context.actualProductId);
    const actual = this.parsePlanSelection(purchaseProductId);

    return Boolean(
      expected.tier &&
      actual.tier &&
      expected.tier === actual.tier &&
      expected.billing &&
      actual.billing &&
      expected.billing === actual.billing
    );
  }

  private purchaseMatchesProductId(purchase: ProductPurchase, expectedProductId: string): boolean {
    const purchaseProductId = this.getPurchaseProductId(purchase);
    const productIds = Array.isArray((purchase as any)?.productIds)
      ? (purchase as any).productIds
      : [];

    return purchaseProductId === expectedProductId || productIds.includes(expectedProductId);
  }

  private findPendingPurchase(productId: string | undefined): PendingPurchaseEntry | undefined {
    if (!productId) {
      return undefined;
    }

    const exact = this.pendingPurchases.get(productId);
    if (exact) {
      return exact;
    }

    return Array.from(this.pendingPurchases.values()).find(pending =>
      pending.context.actualProductId === productId ||
      pending.context.selectionId === productId
    );
  }

  private findOnlyPendingPurchase(): PendingPurchaseEntry | undefined {
    const pendingPurchases = Array.from(new Set(this.pendingPurchases.values()));
    return pendingPurchases.length === 1 ? pendingPurchases[0] : undefined;
  }

  private isPendingPurchaseActive(pending: PendingPurchaseEntry): boolean {
    return Array.from(this.pendingPurchases.values()).includes(pending);
  }

  private resolvePendingPurchase(productId: string, result: GooglePlayPurchaseResult): void {
    const pending = this.findPendingPurchase(productId);
    if (!pending) {
      return;
    }

    this.clearPendingPurchase(pending);
    pending.resolve(result);
  }

  private clearPendingPurchase(pending: PendingPurchaseEntry): void {
    clearTimeout(pending.timeout);

    for (const [key, value] of this.pendingPurchases.entries()) {
      if (value === pending) {
        this.pendingPurchases.delete(key);
      }
    }
  }

  private async finishGooglePlayTransaction(purchase: ProductPurchase): Promise<void> {
    if ((purchase as any).isAcknowledgedAndroid === true) {
      Logger.info('[GooglePlay] Purchase already acknowledged; skipping finishTransaction', {
        component: 'GooglePlayBillingService',
        productId: this.getPurchaseProductId(purchase),
      });
      return;
    }

    try {
      await finishTransaction({ purchase, isConsumable: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      const alreadyFinished = /already|acknowledged|not suitable/i.test(message);

      if (alreadyFinished) {
        Logger.warn('[GooglePlay] Purchase finish skipped because it appears already handled', {
          component: 'GooglePlayBillingService',
          productId: this.getPurchaseProductId(purchase),
          errorMessage: message,
        });
        return;
      }

      throw error;
    }
  }

  /**
   * Get current user ID (placeholder - implement based on your auth system)
   */
  private async getCurrentUserId(): Promise<string | null> {
    if (this.currentUserId) {
      return this.currentUserId;
    }

    try {
      const { data } = await supabase.auth.getUser();
      return data.user?.id || null;
    } catch (error) {
      Logger.warn('[GooglePlay] Unable to read current Supabase user', {
        component: 'GooglePlayBillingService',
        action: 'get_current_user_id',
        errorMessage: error instanceof Error ? error.message : String(error),
      });
      return null;
    }
  }

  private getAmountFromProductId(productId: string): number {
    const tier = productId.includes('transformation')
      ? 'transformation'
      : productId.includes('growth')
        ? 'growth'
        : productId.includes('spark')
          ? 'spark'
          : null;
    const billing = productId.includes('annual') ? 'annual' : 'monthly';

    const pricing: Record<string, Record<string, number>> = {
      spark: { monthly: 199, annual: 1990 },
      growth: { monthly: 399, annual: 3990 },
      transformation: { monthly: 599, annual: 5990 },
    };

    return tier ? pricing[tier]?.[billing] || 0 : 0;
  }

  /**
   * Handle purchase errors
   */
  private handlePurchaseError(error: PurchaseError): void {
    Logger.error('[GooglePlay] Purchase error details', undefined, {
        component: 'GooglePlayBillingService',
      code: error?.code,
      message: error?.message,
      debugMessage: error?.debugMessage,
    });

    // Handle different error types
    switch (error?.code) {
      case 'E_USER_CANCELLED':
        // Purchase was cancelled
        break;
      case 'E_DEVELOPER_ERROR':
        // Configuration error
        break;
    }

    const pendingError = new Error(error?.message || 'Google Play purchase failed') as Error & { code?: string };
    pendingError.code = error?.code;

    Array.from(new Set(this.pendingPurchases.values())).forEach(pending => {
      this.clearPendingPurchase(pending);
      pending.reject(pendingError);
    });

  }

  /**
   * Restore previous purchases
   */
  async restorePurchases(_userId: string): Promise<boolean> {
    try {
      await this.initialize();

      if (Platform.OS !== 'android') {
        return false;
      }

      // Get available purchases (active subscriptions)
      const purchases = await RNIap.getAvailablePurchases();

      if (!purchases || purchases.length === 0) {
        return false;
      }

      for (const purchase of purchases) {
        await this.handlePurchaseUpdate(purchase);
      }

      return true;
    } catch (error) {
      Logger.error('[GooglePlay] Failed to restore purchases', error as Error, {
      component: 'GooglePlayBillingService',
    });
      return false;
    }
  }

  /**
   * Check subscription status with Google Play
   */
  async getCurrentSubscriptionStatus(userId: string): Promise<any> {
    try {
      // Get the user's current subscription from database
      const subscription = await NewSubscriptionService.getUserSubscription(userId);

      if (!subscription.platform_subscription_id || subscription.platform !== 'google') {
        return null;
      }

      // For Google Play, you might want to verify the subscription status
      // This is a simplified version
      return {
        isActive: subscription.status === 'active',
        tier: subscription.tier,
        expiryDate: subscription.subscription_end_date,
      };
    } catch (error) {
      Logger.error('[GooglePlay] Failed to get subscription status', error as Error, {
      component: 'GooglePlayBillingService',
    });
      return null;
    }
  }

  /**
   * Cancel subscription (redirect to Google Play)
   */
  async cancelSubscription(): Promise<void> {
    try {
      // Google Play doesn't allow programmatic cancellation
      // Users must cancel through the Google Play Store

      // You could open the Google Play Store subscription management page
      // This would require additional implementation with Linking API
    } catch (error) {
      Logger.error('[GooglePlay] Failed to initiate cancellation', error as Error, {
      component: 'GooglePlayBillingService',
    });
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

    } catch (error) {
      Logger.error('[GooglePlay] Cleanup error', error as Error, {
      component: 'GooglePlayBillingService',
    });
    }
  }
}

export default GooglePlayBillingService;
