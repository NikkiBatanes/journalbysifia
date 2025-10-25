import { useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import platformSubscriptionService, {
  SubscriptionProduct,
  UpgradeRequest,
  UpgradeResult,
  PlatformSubscriptionError,
} from '../services/platformSubscriptionService';
import { SubscriptionTier } from '../types/subscription';
import { useAuth } from '../context/IndustryStandardAuthContext';

export interface UsePlatformSubscriptionReturn {
  // State
  products: SubscriptionProduct[];
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  upgradeSubscription: (request: UpgradeRequest) => Promise<UpgradeResult>;
  requestDowngrade: (currentTier: SubscriptionTier, targetTier: SubscriptionTier, billing: 'monthly' | 'annual') => Promise<{ requiresPlatformAction: boolean; message: string }>;
  restorePurchases: () => Promise<any[]>;
  getCurrentSubscription: () => Promise<any>;

  // Helpers
  getProduct: (tier: SubscriptionTier, billing: 'monthly' | 'annual') => SubscriptionProduct | null;
  isValidUpgrade: (currentTier: SubscriptionTier, targetTier: SubscriptionTier) => boolean;
  isValidDowngrade: (currentTier: SubscriptionTier, targetTier: SubscriptionTier) => boolean;
}

export const usePlatformSubscription = (): UsePlatformSubscriptionReturn => {
  const { user } = useAuth();
  const [products, setProducts] = useState<SubscriptionProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Initialize the platform subscription service
   */
  const initialize = useCallback(async () => {
    if (isInitialized) {return;}

    setIsLoading(true);
    setError(null);

    try {
      console.log('[usePlatformSubscription] Initializing...');
      await platformSubscriptionService.initialize();

      const availableProducts = platformSubscriptionService.getProducts();
      setProducts(availableProducts);
      setIsInitialized(true);

      console.log(`[usePlatformSubscription] Initialized with ${availableProducts.length} products`);
    } catch (err) {
      const errorMessage = err instanceof PlatformSubscriptionError
        ? err.message
        : 'Failed to initialize subscription service';

      console.error('[usePlatformSubscription] Initialization failed:', err);
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  /**
   * Upgrade subscription
   */
  const upgradeSubscription = useCallback(async (request: UpgradeRequest): Promise<UpgradeResult> => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[usePlatformSubscription] Starting upgrade:', request);

      // Validate upgrade
      if (!platformSubscriptionService.isValidUpgrade(request.currentTier, request.targetTier)) {
        throw new Error(`Invalid upgrade: ${request.currentTier} to ${request.targetTier}`);
      }

      const result = await platformSubscriptionService.upgradeSubscription(request);

      console.log('[usePlatformSubscription] Upgrade completed:', result);
      return result;

    } catch (err) {
      const errorMessage = err instanceof PlatformSubscriptionError
        ? err.message
        : `Upgrade failed: ${(err as any).message || 'Unknown error'}`;

      console.error('[usePlatformSubscription] Upgrade failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Request downgrade
   */
  const requestDowngrade = useCallback(async (
    currentTier: SubscriptionTier,
    targetTier: SubscriptionTier,
    billing: 'monthly' | 'annual'
  ) => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[usePlatformSubscription] Requesting downgrade:', { currentTier, targetTier, billing });

      // Validate downgrade
      if (!platformSubscriptionService.isValidDowngrade(currentTier, targetTier)) {
        throw new Error(`Invalid downgrade: ${currentTier} to ${targetTier}`);
      }

      const result = await platformSubscriptionService.requestDowngrade(currentTier, targetTier, billing);

      console.log('[usePlatformSubscription] Downgrade request completed:', result);
      return result;

    } catch (err) {
      const errorMessage = err instanceof PlatformSubscriptionError
        ? err.message
        : `Downgrade request failed: ${(err as any).message || 'Unknown error'}`;

      console.error('[usePlatformSubscription] Downgrade request failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Restore purchases
   */
  const restorePurchases = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      console.log('[usePlatformSubscription] Restoring purchases...');
      const purchases = await platformSubscriptionService.restorePurchases();

      console.log(`[usePlatformSubscription] Restored ${purchases.length} purchases`);
      return purchases;

    } catch (err) {
      const errorMessage = err instanceof PlatformSubscriptionError
        ? err.message
        : 'Failed to restore purchases';

      console.error('[usePlatformSubscription] Restore failed:', err);
      setError(errorMessage);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Get current subscription
   */
  const getCurrentSubscription = useCallback(async () => {
    try {
      console.log('[usePlatformSubscription] Getting current subscription...');
      const subscription = await platformSubscriptionService.getCurrentSubscription();

      console.log('[usePlatformSubscription] Current subscription:', subscription);
      return subscription;

    } catch (err) {
      console.error('[usePlatformSubscription] Failed to get current subscription:', err);
      return null;
    }
  }, []);

  /**
   * Get product by tier and billing
   */
  const getProduct = useCallback((tier: SubscriptionTier, billing: 'monthly' | 'annual') => {
    return platformSubscriptionService.getProduct(tier, billing);
  }, []);

  /**
   * Check if upgrade is valid
   */
  const isValidUpgrade = useCallback((currentTier: SubscriptionTier, targetTier: SubscriptionTier) => {
    return platformSubscriptionService.isValidUpgrade(currentTier, targetTier);
  }, []);

  /**
   * Check if downgrade is valid
   */
  const isValidDowngrade = useCallback((currentTier: SubscriptionTier, targetTier: SubscriptionTier) => {
    return platformSubscriptionService.isValidDowngrade(currentTier, targetTier);
  }, []);

  /**
   * Auto-initialize when user is available
   */
  useEffect(() => {
    if (user && !isInitialized && !isLoading) {
      console.log('[usePlatformSubscription] Auto-initializing for user:', user.id);
      initialize();
    }
  }, [user, isInitialized, isLoading, initialize]);

  /**
   * Cleanup on unmount
   */
  useEffect(() => {
    return () => {
      if (isInitialized) {
        console.log('[usePlatformSubscription] Cleaning up...');
        platformSubscriptionService.cleanup();
      }
    };
  }, [isInitialized]);

  return {
    // State
    products,
    isLoading,
    isInitialized,
    error,

    // Actions
    initialize,
    upgradeSubscription,
    requestDowngrade,
    restorePurchases,
    getCurrentSubscription,

    // Helpers
    getProduct,
    isValidUpgrade,
    isValidDowngrade,
  };
};
