import { useMemo } from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../context/IndustryStandardAuthContext';
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
  handleLockedAction: () => void;

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
  const { user } = useAuth();
  const { subscription } = useSubscription();

  // Determine if the selected date is in the future
  const isFutureDate = useMemo(() => {
    return isFuturePlanningDate(selectedDate);
  }, [selectedDate]);

  // Get current subscription tier
  const currentTier: SubscriptionTier = useMemo(() => {
    if (!user) {return 'seeker';}
    return getEffectivePlanningTier(subscription);
  }, [user, subscription]);

  // Get access rules and checks
  const accessRules = useMemo(() =>
    getPlanningAccessRules(currentTier),
    [currentTier]
  );

  const accessCheck = useMemo(() =>
    checkPlanningAccess(currentTier, context),
    [currentTier, context]
  );

  // Determine if planning should be locked
  const shouldShowLock = useMemo(() => {
    // Only lock future dates for seeker tier
    return isFutureDate && accessCheck.isLocked;
  }, [isFutureDate, accessCheck.isLocked]);

  // Handle locked action - navigate to onboarding sales offer
  const navigation = useNavigation();
  const handleLockedAction = useMemo(() => () => {
    if (onUpgradeRequired) {
      onUpgradeRequired();
    } else {
      // Navigate to onboarding sales offer like devotional modal

      (navigation as any).navigate('OnboardingSalesOffer', {
        source: 'planning_lock',
        feature: 'future_planning',
        tier: currentTier,
        skipNotificationPreference: true,
        dismissBehavior: 'goBack',
      });
    }
  }, [onUpgradeRequired, currentTier, navigation]);

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
