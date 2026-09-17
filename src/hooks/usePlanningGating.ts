import { useMemo } from 'react';
import { useSubscription } from '../hooks/useSubscription';
import {
  checkPlanningAccess,
  getEffectivePlanningTier,
  getPlanningAccessRules,
  isFuturePlanningDate,
  type PlanningAccessCheck,
  type PlanningAccessRules,
} from '../utils/tierLockingRules';
import { SubscriptionTier } from '../types/subscription';

export type PlanningLockReason = 'future_planning' | 'repeat_timeblocks';

interface PlanningGatingResult {
  // Access Control
  isLocked: boolean;
  canAccess: boolean;
  upgradeRequired: boolean;

  // UI Elements
  lockIconVisible: boolean;
  usageMessage: string;
  upgradeMessage: string;

  // Data
  accessCheck: PlanningAccessCheck;
  currentTier: SubscriptionTier;

  // Actions
  handleLockedAction: (reason?: PlanningLockReason) => void;

  // Feature Specific
  isFutureDate: boolean;
  shouldShowLock: boolean;

  // Rules
  accessRules: PlanningAccessRules;
}

/**
 * usePlanningGating - Enterprise hook for future planning feature gating
 *
 * Provides comprehensive access control for future planning features including:
 * - Today's Focus planning for future dates
 * - Todo planning for future dates
 * - Time Block planning for future dates
 *
 * @param selectedDate - The date being accessed for planning
 * @param context - Context for upgrade messaging ('onboarding' | 'inApp')
 * @param onUpgradeRequired - Callback when upgrade is needed
 */
export const usePlanningGating = (
  selectedDate: Date,
  context: 'onboarding' | 'inApp' = 'inApp',
  onUpgradeRequired?: () => void
): PlanningGatingResult => {
  const { subscription } = useSubscription();

  // Determine if the selected date is in the future
  const isFutureDate = useMemo(() => {
    return isFuturePlanningDate(selectedDate);
  }, [selectedDate]);

  // Get current subscription tier
  const currentTier: SubscriptionTier = useMemo(
    () => getEffectivePlanningTier(subscription),
    [subscription],
  );

  // Get access rules and checks
  const accessRules = useMemo(() =>
    getPlanningAccessRules(currentTier),
    [currentTier]
  );

  const accessCheck = useMemo(() =>
    checkPlanningAccess(currentTier, context),
    [currentTier, context]
  );

  // Journal core planning is included with ownership of this app. Keep this
  // compatibility hook for its callers, but do not apply siFia tier rules.
  const shouldShowLock = false;

  // Handle locked action - navigate to onboarding sales offer
  const handleLockedAction = useMemo(() => (reason: PlanningLockReason = 'future_planning') => {
    onUpgradeRequired?.();
  }, [onUpgradeRequired]);

  return {
    // Access Control
    isLocked: shouldShowLock,
    canAccess: !shouldShowLock,
    upgradeRequired: shouldShowLock,

    // UI Elements
    lockIconVisible: shouldShowLock,
    usageMessage: accessCheck.usageMessage,
    upgradeMessage: accessCheck.upgradeMessage,

    // Data
    accessCheck,
    currentTier,

    // Actions
    handleLockedAction,

    // Feature Specific
    isFutureDate,
    shouldShowLock,

    // Rules
    accessRules,
  };
};

export default usePlanningGating;
