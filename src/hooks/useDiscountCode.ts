import { useState, useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { DiscountCodeService, DiscountCode, DiscountValidationResult } from '../services/DiscountCodeService';

export interface UseDiscountCodeResult {
  // State
  validationResult: DiscountValidationResult | null;
  loading: boolean;
  error: string | null;

  // Actions
  validateCode: (code: string, targetTier: string) => Promise<DiscountValidationResult>;
  applyCode: (code: string, targetTier: string) => Promise<boolean>;
  clearValidation: () => void;

  // Utilities
  generatePostCancellationDiscount: (previousTier: string) => Promise<DiscountCode>;
  generatePersonalizedDiscount: (discountType: 'trial_extension' | 'upgrade_incentive' | 'retention') => Promise<DiscountCode>;
}

/**
 * Hook for managing discount codes
 */
export function useDiscountCode(): UseDiscountCodeResult {
  const { user } = useAuth();
  const [validationResult, setValidationResult] = useState<DiscountValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Validate a discount code
   */
  const validateCode = useCallback(async (
    code: string,
    targetTier: string
  ): Promise<DiscountValidationResult> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      const result = await DiscountCodeService.validateDiscountCode(code, user.id, targetTier);
      setValidationResult(result);

      if (!result.isValid) {
        setError(result.error || 'Invalid discount code');
      }

      return result;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate discount code';
      setError(errorMessage);

      const errorResult: DiscountValidationResult = {
        isValid: false,
        discount: null,
        error: errorMessage,
      };

      setValidationResult(errorResult);
      return errorResult;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Apply a discount code
   */
  const applyCode = useCallback(async (
    code: string,
    targetTier: string
  ): Promise<boolean> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      const success = await DiscountCodeService.applyDiscountCode(user.id, code, targetTier);

      if (success) {
        // Clear validation result after successful application
        setValidationResult(null);
      }

      return success;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to apply discount code';
      setError(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Clear validation result
   */
  const clearValidation = useCallback(() => {
    setValidationResult(null);
    setError(null);
  }, []);

  /**
   * Generate post-cancellation discount
   */
  const generatePostCancellationDiscount = useCallback(async (
    previousTier: string
  ): Promise<DiscountCode> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      const discount = await DiscountCodeService.generatePostCancellationDiscount(user.id, previousTier);
      return discount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate discount';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  /**
   * Generate personalized discount
   */
  const generatePersonalizedDiscount = useCallback(async (
    discountType: 'trial_extension' | 'upgrade_incentive' | 'retention'
  ): Promise<DiscountCode> => {
    if (!user?.id) {
      throw new Error('User must be authenticated');
    }

    try {
      setLoading(true);
      setError(null);

      const discount = await DiscountCodeService.generatePersonalizedDiscount(user.id, discountType);
      return discount;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate personalized discount';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  return {
    // State
    validationResult,
    loading,
    error,

    // Actions
    validateCode,
    applyCode,
    clearValidation,

    // Utilities
    generatePostCancellationDiscount,
    generatePersonalizedDiscount,
  };
}

export default useDiscountCode;
