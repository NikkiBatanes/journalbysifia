/**
 * useFeatureAccess Hook
 *
 * React hook for checking feature access and handling restrictions
 * across the application.
 */

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useSubscription } from './useSubscription';
import { tierRestrictionService, FeatureAccessResult } from '../services/tierRestrictionService';
import { retentionService } from '../services/retentionService';

export interface UseFeatureAccessOptions {
  feature: string;
  skipUsageCheck?: boolean;
  onRestricted?: (result: FeatureAccessResult) => void;
}

export interface UseFeatureAccessReturn {
  hasAccess: boolean;
  isLoading: boolean;
  accessResult: FeatureAccessResult | null;
  checkAccess: () => Promise<void>;
  handleRestriction: () => void;
  showUpgradePrompt: () => void;
}

/**
 * Hook for checking access to a single feature
 */
export function useFeatureAccess({
  feature,
  skipUsageCheck = false,
  onRestricted,
}: UseFeatureAccessOptions): UseFeatureAccessReturn {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(false);
  const [accessResult, setAccessResult] = useState<FeatureAccessResult | null>(null);

  const checkAccess = useCallback(async () => {
    if (!user?.id) {
      setAccessResult({ hasAccess: false, reason: 'tier_restriction' });
      return;
    }

    setIsLoading(true);
    try {
      const result = await tierRestrictionService.checkFeatureAccess(
        user.id,
        feature,
        { skipUsageCheck }
      );

      setAccessResult(result);

      if (!result.hasAccess && onRestricted) {
        onRestricted(result);
      }
    } catch (error) {
      console.error('[useFeatureAccess] Error checking access:', error);
      // Default to allowing access on error
      setAccessResult({ hasAccess: true });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, feature, skipUsageCheck, onRestricted]);

  const handleRestriction = useCallback(() => {
    if (!user?.id || !subscription?.tier) {return;}

    // Log restriction event for retention
    tierRestrictionService.triggerRestrictionRetention(
      user.id,
      feature,
      subscription.tier
    );
  }, [user?.id, subscription?.tier, feature]);

  const showUpgradePrompt = useCallback(() => {
    if (!accessResult?.upgradePrompt) {return;}

    // This would typically navigate to subscription screen or show modal
    // Implementation depends on navigation setup
    console.log('Show upgrade prompt:', accessResult.upgradePrompt);
  }, [accessResult]);

  // Check access when dependencies change
  useEffect(() => {
    checkAccess();
  }, [checkAccess]);

  return {
    hasAccess: accessResult?.hasAccess ?? false,
    isLoading,
    accessResult,
    checkAccess,
    handleRestriction,
    showUpgradePrompt,
  };
}

/**
 * Hook for checking access to multiple features
 */
export function useMultipleFeatureAccess(features: string[]) {
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [accessResults, setAccessResults] = useState<Record<string, FeatureAccessResult>>({});

  const checkAllAccess = useCallback(async () => {
    if (!user?.id || features.length === 0) {
      setAccessResults({});
      return;
    }

    setIsLoading(true);
    try {
      const results = await tierRestrictionService.checkMultipleFeatures(user.id, features);
      setAccessResults(results);
    } catch (error) {
      console.error('[useMultipleFeatureAccess] Error checking access:', error);
      // Default to allowing access on error
      const defaultResults: Record<string, FeatureAccessResult> = {};
      features.forEach(feature => {
        defaultResults[feature] = { hasAccess: true };
      });
      setAccessResults(defaultResults);
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, features]);

  // Check access when dependencies change
  useEffect(() => {
    checkAllAccess();
  }, [checkAllAccess]);

  return {
    accessResults,
    isLoading,
    checkAllAccess,
    hasAccess: (feature: string) => accessResults[feature]?.hasAccess ?? false,
    getAccessResult: (feature: string) => accessResults[feature] || null,
  };
}

/**
 * Hook for tier-specific feature lists
 */
export function useTierFeatures() {
  const { subscription } = useSubscription();
  const [availableFeatures, setAvailableFeatures] = useState<string[]>([]);
  const [restrictedFeatures, setRestrictedFeatures] = useState<string[]>([]);

  useEffect(() => {
    if (!subscription?.tier) {
      setAvailableFeatures([]);
      setRestrictedFeatures([]);
      return;
    }

    const available = tierRestrictionService.getAvailableFeaturesForTier(subscription.tier);
    const restricted = tierRestrictionService.getRestrictionsForTier(subscription.tier);

    setAvailableFeatures(available);
    setRestrictedFeatures(restricted);
  }, [subscription?.tier]);

  return {
    availableFeatures,
    restrictedFeatures,
    isFeatureAvailable: (feature: string) => availableFeatures.includes(feature),
    isFeatureRestricted: (feature: string) => restrictedFeatures.includes(feature),
  };
}

/**
 * Hook for handling export restrictions specifically
 */
export function useExportAccess() {
  const pdfAccess = useFeatureAccess({ feature: 'export_pdf' });
  const docxAccess = useFeatureAccess({ feature: 'export_docx' });

  const canExportPDF = pdfAccess.hasAccess;
  const canExportDOCX = docxAccess.hasAccess;
  const canExportAny = canExportPDF || canExportDOCX;

  const handleExportRestriction = useCallback((format: 'pdf' | 'docx') => {
    if (format === 'pdf') {
      pdfAccess.handleRestriction();
    } else {
      docxAccess.handleRestriction();
    }
  }, [pdfAccess, docxAccess]);

  return {
    canExportPDF,
    canExportDOCX,
    canExportAny,
    pdfAccessResult: pdfAccess.accessResult,
    docxAccessResult: docxAccess.accessResult,
    isLoading: pdfAccess.isLoading || docxAccess.isLoading,
    handleExportRestriction,
    showUpgradePrompt: () => {
      if (!canExportPDF) {pdfAccess.showUpgradePrompt();}
      else if (!canExportDOCX) {docxAccess.showUpgradePrompt();}
    },
  };
}


/**
 * Hook for handling retention offers when users hit restrictions
 */
export function useRestrictionRetention() {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [retentionOffer, setRetentionOffer] = useState<any>(null);
  const [isLoadingOffer, setIsLoadingOffer] = useState(false);

  const triggerRetentionOffer = useCallback(async (
    feature: string,
    originalPrice: number = 999
  ) => {
    if (!user?.id || !subscription?.tier) {return;}

    setIsLoadingOffer(true);
    try {
      // Calculate days since last restriction event (simplified)
      const daysSinceEvent = 0; // Would be calculated from retention events

      const offer = await retentionService.getDynamicRetentionOffer(
        user.id,
        'feature_restriction',
        originalPrice,
        subscription.tier,
        daysSinceEvent
      );

      setRetentionOffer(offer);
    } catch (error) {
      console.error('[useRestrictionRetention] Error getting offer:', error);
    } finally {
      setIsLoadingOffer(false);
    }
  }, [user?.id, subscription?.tier]);

  const clearRetentionOffer = useCallback(() => {
    setRetentionOffer(null);
  }, []);

  return {
    retentionOffer,
    isLoadingOffer,
    triggerRetentionOffer,
    clearRetentionOffer,
    hasRetentionOffer: !!retentionOffer,
  };
}
