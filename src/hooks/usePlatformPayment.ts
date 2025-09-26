import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { PlatformPaymentService, UnifiedProduct, UnifiedPurchaseResult, SubscriptionStatus } from '../services/PlatformPaymentService';

export interface UsePlatformPaymentResult {
  // State
  products: UnifiedProduct[];
  loading: boolean;
  error: string | null;
  subscriptionStatus: SubscriptionStatus | null;

  // Actions
  purchaseSubscription: (productId: string) => Promise<UnifiedPurchaseResult>;
  restorePurchases: () => Promise<boolean>;
  cancelSubscription: () => Promise<boolean>;
  refreshSubscriptionStatus: () => Promise<void>;

  // Utilities
  isPaymentAvailable: boolean;
  getProductPricing: () => Promise<Record<string, string>>;
}

/**
 * Hook for managing platform-specific payments and subscriptions
 */
export function usePlatformPayment(): UsePlatformPaymentResult {
  const { user } = useAuth();
  const [products, setProducts] = useState<UnifiedProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null);
  const [isPaymentAvailable, setIsPaymentAvailable] = useState(false);

  const paymentService = PlatformPaymentService.getInstance();

  /**
   * Initialize payment service and load products
   */
  const initializePayments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Initialize the payment service
      const initialized = await paymentService.initialize();
      setIsPaymentAvailable(initialized);

      if (!initialized) {
        throw new Error('Payment service initialization failed');
      }

      // Load available products
      const availableProducts = await paymentService.getAvailableProducts();
      setProducts(availableProducts);

      // Load subscription status if user is authenticated
      if (user?.id) {
        const status = await paymentService.getSubscriptionStatus(user.id);
        setSubscriptionStatus(status);
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to initialize payments';
      setError(errorMessage);
      console.error('[usePlatformPayment] Initialization error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id, paymentService]);

  /**
   * Purchase a subscription
   */
  const purchaseSubscription = useCallback(async (productId: string): Promise<UnifiedPurchaseResult> => {
    if (!user?.id) {
      throw new Error('User must be authenticated to purchase');
    }

    try {
      setError(null);

      const result = await paymentService.purchaseSubscription(productId, user.id);

      if (result.success) {
        // Refresh subscription status after successful purchase
        await refreshSubscriptionStatus();
      } else {
        setError(result.error || 'Purchase failed');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Purchase failed';
      setError(errorMessage);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [user?.id, paymentService]);

  /**
   * Restore previous purchases
   */
  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User must be authenticated to restore purchases');
    }

    try {
      setError(null);

      const success = await paymentService.restorePurchases(user.id);

      if (success) {
        // Refresh subscription status after restore
        await refreshSubscriptionStatus();
      } else {
        setError('Failed to restore purchases');
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to restore purchases';
      setError(errorMessage);
      return false;
    }
  }, [user?.id, paymentService]);

  /**
   * Cancel subscription
   */
  const cancelSubscription = useCallback(async (): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User must be authenticated to cancel subscription');
    }

    try {
      setError(null);

      const success = await paymentService.cancelSubscription(user.id);

      if (success) {
        // Refresh subscription status after cancellation
        await refreshSubscriptionStatus();
      } else {
        setError('Failed to cancel subscription');
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel subscription';
      setError(errorMessage);
      return false;
    }
  }, [user?.id, paymentService]);

  /**
   * Refresh subscription status
   */
  const refreshSubscriptionStatus = useCallback(async (): Promise<void> => {
    if (!user?.id) {
      return;
    }

    try {
      const status = await paymentService.getSubscriptionStatus(user.id);
      setSubscriptionStatus(status);
    } catch (err) {
      console.error('[usePlatformPayment] Failed to refresh subscription status:', err);
    }
  }, [user?.id, paymentService]);

  /**
   * Get product pricing
   */
  const getProductPricing = useCallback(async (): Promise<Record<string, string>> => {
    try {
      return await paymentService.getProductPricing();
    } catch (err) {
      console.error('[usePlatformPayment] Failed to get pricing:', err);
      return {};
    }
  }, [paymentService]);

  // Initialize on mount and when user changes
  useEffect(() => {
    initializePayments();
  }, [initializePayments]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      paymentService.cleanup();
    };
  }, [paymentService]);

  return {
    // State
    products,
    loading,
    error,
    subscriptionStatus,

    // Actions
    purchaseSubscription,
    restorePurchases,
    cancelSubscription,
    refreshSubscriptionStatus,

    // Utilities
    isPaymentAvailable,
    getProductPricing,
  };
}

export default usePlatformPayment;
