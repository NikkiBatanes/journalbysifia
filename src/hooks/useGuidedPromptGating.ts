// useGuidedPromptGating - Simplified hook using centralized gating service
// Provides React state management for guided prompt access

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useSubscription } from './useSubscription';
import {
  guidedPromptGatingService,
  type DailyPromptAllocation,
} from '../services/guidedPromptGatingService';
import {
  checkGuidedPromptAccess,
  type GuidedPromptAccessCheck,
} from '../utils/guidedPromptGating';

export interface UseGuidedPromptGatingOptions {
  context?: 'onboarding' | 'inApp';
  onUpgradeRequired?: (accessCheck: GuidedPromptAccessCheck) => void;
}

export interface UseGuidedPromptGatingReturn {
  // Clear, single-purpose properties
  freePrompts: string[];
  lockedPrompts: string[];
  allPrompts: string[];
  isLoading: boolean;

  // Simplified methods
  canUsePrompt: (prompt: string) => Promise<boolean>;
  markPromptUsed: (prompt: string) => Promise<void>;
  refreshAccess: () => Promise<void>;

  // Legacy compatibility (deprecated)
  accessCheck: GuidedPromptAccessCheck;
  availablePrompts: string[];
  usedPrompts: number;
  showUpgradeModal: () => void;
}

/**
 * Hook for managing guided prompt access and gating
 */
export function useGuidedPromptGating({
  context = 'inApp',
  onUpgradeRequired,
}: UseGuidedPromptGatingOptions = {}): UseGuidedPromptGatingReturn {
  const { user } = useAuth();
  const { subscription } = useSubscription();
  const [isLoading, setIsLoading] = useState(true);
  const [dailyAllocation, setDailyAllocation] = useState<DailyPromptAllocation>({
    freePrompts: [],
    lockedPrompts: [],
    allPrompts: [],
  });

  // Get current tier
  const currentTier = subscription?.tier || 'seeker';

  // Legacy compatibility - calculate from new service
  const accessCheck = checkGuidedPromptAccess(currentTier, 0, context);
  const usedPrompts = 0; // Deprecated - usage is now tracked per-prompt
  const availablePrompts = dailyAllocation.allPrompts; // Legacy compatibility

  // Load daily prompt allocation
  const loadDailyAllocation = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    try {
      const allocation = guidedPromptGatingService.getDailyPrompts(user.id, currentTier);
      setDailyAllocation(allocation);
    } catch (error) {
      // Error silently handled - allocation loading failures are not critical
      setIsLoading(false);
    }
  }, [user?.id, currentTier]);

  // Simplified canUsePrompt using service
  const canUsePrompt = useCallback(async (prompt: string): Promise<boolean> => {
    if (!user?.id) {return false;}

    try {
      const check = await guidedPromptGatingService.canUsePrompt(user.id, currentTier, prompt);
      return check.canUse;
    } catch (error) {
      // Error silently handled - prompt access check failures are not critical
      return false;
    }
  }, [user?.id, currentTier]);

  // Simplified markPromptUsed using service
  const markPromptUsed = useCallback(async (prompt: string): Promise<void> => {
    if (!user?.id) {return;}

    try {
      await guidedPromptGatingService.markPromptUsed(user.id, prompt);
      // Refresh allocation to reflect changes
      await loadDailyAllocation();
    } catch (error) {
      // Error silently handled - prompt marking failures are not critical
    }
  }, [user?.id, loadDailyAllocation]);

  // Show upgrade modal
  const showUpgradeModal = useCallback(() => {
    if (onUpgradeRequired) {
      onUpgradeRequired(accessCheck);
    }
  }, [accessCheck, onUpgradeRequired]);

  // Refresh access data
  const refreshAccess = useCallback(async () => {
    setIsLoading(true);
    await loadDailyAllocation();
  }, [loadDailyAllocation]);

  // Load data on mount and when dependencies change
  useEffect(() => {
    loadDailyAllocation();
  }, [loadDailyAllocation]);

  // Note: Removed automatic upgrade trigger - let components handle this manually
  // This prevents unwanted sales offer popups when just viewing locked prompts

  return {
    // New simplified API
    freePrompts: dailyAllocation.freePrompts,
    lockedPrompts: dailyAllocation.lockedPrompts,
    allPrompts: dailyAllocation.allPrompts,
    isLoading,
    canUsePrompt,
    markPromptUsed,
    refreshAccess,

    // Legacy compatibility (deprecated)
    accessCheck,
    availablePrompts,
    usedPrompts,
    showUpgradeModal,
  };
}
