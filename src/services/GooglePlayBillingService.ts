import { Platform } from 'react-native';
import RNIap, {
  ProductPurchase,
  PurchaseError,
  initConnection,
  endConnection,
  getSubscriptions,
  requestSubscription,
  finishTransaction,
  validateReceiptAndroid,
  purchaseErrorListener,
  purchaseUpdatedListener,
} from 'react-native-iap';
import { NewSubscriptionService } from './NewSubscriptionService';
import { supabase } from './supabaseClient';

export interface GooglePlayProduct {
  productId: string;
  price: string;
  currency: string;
  localizedPrice: string;
  title: string;
  description: string;
}

export interface GooglePlayPurchaseResult {
  success: boolean;
  transactionId?: string;
  receipt?: string;
  error?: string;
}

export class GooglePlayBillingService {
  private static instance: GooglePlayBillingService;
  private isInitialized = false;
  private purchaseUpdateSubscription: any;
  private purchaseErrorSubscription: any;

  // Product IDs for Google Play subscription tiers
  private static readonly PRODUCT_IDS = {
    spark: 'com.yourcompany.sifia.spark.monthly',
    growth: 'com.yourcompany.sifia.growth.monthly',
    transformation: 'com.yourcompany.sifia.transformation.monthly',
    family: 'com.yourcompany.sifia.family.monthly',
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

      const result = await initConnection();

      // Set up purchase listeners
      this.setupPurchaseListeners();

      this.isInitialized = true;
      return true;
    } catch (error) {
      console.error('[GooglePlay] Failed to initialize billing:', error);
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
        console.error('[GooglePlay] Purchase error:', error);
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

      return products.map((product: any) => ({
        productId: product.productId,
        price: product.price,
        currency: product.currency,
        localizedPrice: product.localizedPrice,
        title: product.title,
        description: product.description,
      }));
    } catch (error) {
      console.error('[GooglePlay] Failed to get products:', error);
      return [];
    }
  }

  /**
   * Purchase a subscription through Google Play
   */
  async purchaseSubscription(
    productId: string,
    _userId: string
  ): Promise<GooglePlayPurchaseResult> {
    try {
      await this.initialize();

      if (Platform.OS !== 'android') {
        throw new Error('Google Play Billing is only available on Android');
      }

      await requestSubscription({ sku: productId });

      // The actual purchase handling will be done in the listener
      return { success: true };
    } catch (error) {
      console.error('[GooglePlay] Purchase failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Handle purchase updates from Google Play
   */
  private async handlePurchaseUpdate(purchase: ProductPurchase): Promise<void> {
    try {

      // Validate the purchase with Google Play
      const isValid = await this.validatePurchase(purchase);

      if (!isValid) {
        console.error('[GooglePlay] Purchase validation failed');
        return;
      }

      // Map product ID to subscription tier
      const tier = this.getSubscriptionTierFromProductId(purchase.productId);

      if (!tier) {
        console.error('[GooglePlay] Unknown product ID:', purchase.productId);
        return;
      }

      // Update user subscription in database
      await this.updateUserSubscription(purchase, tier);

      // Acknowledge the purchase (required for subscriptions)
      await finishTransaction({ purchase, isConsumable: false });

    } catch (error) {
      console.error('[GooglePlay] Failed to handle purchase update:', error);
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

      // For Google Play, we validate using the purchase token and package name
      const receiptBody = {
        packageName: 'com.yourcompany.sifia', // Replace with your actual package name
        productId: purchase.productId,
        purchaseToken: purchase.purchaseToken,
        subscription: true,
      };

      const result = await validateReceiptAndroid(receiptBody as any);

      // Google Play validation should return purchase details if valid
      return result && result.purchaseState === 1; // 1 = Purchased
    } catch (error) {
      console.error('[GooglePlay] Purchase validation error:', error);
      return false;
    }
  }

  /**
   * Map product ID to subscription tier
   */
  private getSubscriptionTierFromProductId(productId: string): string | null {
    const productMap = {
      [GooglePlayBillingService.PRODUCT_IDS.spark]: 'spark',
      [GooglePlayBillingService.PRODUCT_IDS.growth]: 'growth',
      [GooglePlayBillingService.PRODUCT_IDS.transformation]: 'transformation',
      [GooglePlayBillingService.PRODUCT_IDS.family]: 'family',
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

      await NewSubscriptionService.upgradeSubscription(userId, {
        target_tier: tier as any,
        platform: 'google',
        platform_subscription_id: purchase.productId,
        platform_transaction_id: purchase.transactionId,
      });

    } catch (error) {
      console.error('[GooglePlay] Failed to update user subscription:', error);
      throw error;
    }
  }

  /**
   * Get current user ID (placeholder - implement based on your auth system)
   */
  private async getCurrentUserId(): Promise<string | null> {
    // TODO: Implement this based on your authentication system
    console.warn('[GooglePlay] getCurrentUserId not implemented - using placeholder');
    return null;
  }

  /**
   * Handle purchase errors
   */
  private handlePurchaseError(error: PurchaseError): void {
    console.error('[GooglePlay] Purchase error details:', {
      code: error.code,
      message: error.message,
      debugMessage: error.debugMessage,
    });

    // Map Google Play error codes to user-friendly messages
    let userMessage = 'Purchase failed. Please try again.';

    switch (error.code as string) {
      case 'E_USER_CANCELLED':
        userMessage = 'Purchase was cancelled.';
        break;
      case 'E_NETWORK_ERROR':
        userMessage = 'Network error. Please check your connection.';
        break;
      case 'E_BILLING_UNAVAILABLE':
        userMessage = 'Billing is not available on this device.';
        break;
      case 'E_ITEM_UNAVAILABLE':
        userMessage = 'This subscription is not available.';
        break;
      case 'E_DEVELOPER_ERROR':
        userMessage = 'Configuration error. Please contact support.';
        break;
    }

    // You can emit events or show toast messages here

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

      for (const purchase of purchases) {
        await this.handlePurchaseUpdate(purchase);
      }

      return true;
    } catch (error) {
      console.error('[GooglePlay] Failed to restore purchases:', error);
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
      console.error('[GooglePlay] Failed to get subscription status:', error);
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
      console.error('[GooglePlay] Failed to initiate cancellation:', error);
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
      console.error('[GooglePlay] Cleanup error:', error);
    }
  }
}

export default GooglePlayBillingService;
