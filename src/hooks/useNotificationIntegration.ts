import { useCallback } from 'react';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { streakTrackingService, StreakType } from '../services/streakTrackingService';
import { milestoneCelebrationService } from '../services/milestoneCelebrationService';
import { smartNotificationEngine } from '../services/notifications/smartNotificationEngine';
import { Logger } from '../utils/ProductionLogger';

/**
 * Hook for integrating notification system with app actions
 * Use this hook in screens/components to trigger notifications
 */
export function useNotificationIntegration() {
  const { user } = useAuth();

  /**
   * Track activity and update streak
   * Call this when user completes prayer/devotional/journal
   */
  const trackActivity = useCallback(async (activityType: StreakType) => {
    if (!user?.id) {
      return;
    }

    try {
      // Update streak
      await streakTrackingService.updateStreak(user.id, activityType);

      // Check if streak alert is needed (will be scheduled if applicable)
      await streakTrackingService.checkAndScheduleStreakAlert(user.id, activityType);

      Logger.info('Activity tracked and streak updated', {
        component: 'useNotificationIntegration',
        userId: user.id,
        activityType,
      });
    } catch (error) {
      Logger.error('Failed to track activity', error as Error, {
        component: 'useNotificationIntegration',
        userId: user.id,
        activityType,
      });
    }
  }, [user?.id]);

  /**
   * Track prayer completion
   */
  const trackPrayer = useCallback(async () => {
    await trackActivity('prayer');
  }, [trackActivity]);

  /**
   * Track devotional completion
   */
  const trackDevotional = useCallback(async () => {
    await trackActivity('devotional');
  }, [trackActivity]);

  /**
   * Track journal entry
   */
  const trackJournal = useCallback(async () => {
    await trackActivity('journal');
  }, [trackActivity]);

  /**
   * Celebrate faith points milestone
   * Call this when user earns faith points
   */
  const celebrateFaithPoints = useCallback(async (
    previousPoints: number,
    currentPoints: number
  ) => {
    if (!user?.id) {
      return;
    }

    try {
      await milestoneCelebrationService.checkFaithPointsMilestone(
        user.id,
        previousPoints,
        currentPoints
      );
    } catch (error) {
      Logger.error('Failed to celebrate faith points', error as Error, {
        component: 'useNotificationIntegration',
        userId: user.id,
      });
    }
  }, [user?.id]);

  /**
   * Celebrate level up
   * Call this when user levels up
   */
  const celebrateLevelUp = useCallback(async (newLevel: number) => {
    if (!user?.id) {
      return;
    }

    try {
      await milestoneCelebrationService.celebrateLevelUp(user.id, newLevel);
    } catch (error) {
      Logger.error('Failed to celebrate level up', error as Error, {
        component: 'useNotificationIntegration',
        userId: user.id,
      });
    }
  }, [user?.id]);

  /**
   * Celebrate playbook completion
   * Call this when user completes all action steps in a playbook
   */
  const celebratePlaybookComplete = useCallback(async (
    playbookId: string,
    playbookTitle: string
  ) => {
    if (!user?.id) {
      return;
    }

    try {
      await milestoneCelebrationService.celebratePlaybookComplete(
        user.id,
        playbookId,
        playbookTitle
      );
    } catch (error) {
      Logger.error('Failed to celebrate playbook completion', error as Error, {
        component: 'useNotificationIntegration',
        userId: user.id,
      });
    }
  }, [user?.id]);

  /**
   * Celebrate prayer answered
   * Call this when user marks a prayer as answered
   */
  const celebratePrayerAnswered = useCallback(async (prayerId: string) => {
    if (!user?.id) {
      return;
    }

    try {
      await milestoneCelebrationService.celebratePrayerAnswered(user.id, prayerId);
    } catch (error) {
      Logger.error('Failed to celebrate prayer answered', error as Error, {
        component: 'useNotificationIntegration',
        userId: user.id,
      });
    }
  }, [user?.id]);

  /**
   * Get current streak status
   * Use this to display streak info in UI
   */
  const getStreakStatus = useCallback(async (streakType: StreakType) => {
    if (!user?.id) {
      return null;
    }

    try {
      return await streakTrackingService.getStreakStatus(user.id, streakType);
    } catch (error) {
      Logger.error('Failed to get streak status', error as Error, {
        component: 'useNotificationIntegration',
        userId: user.id,
        streakType,
      });
      return null;
    }
  }, [user?.id]);

  /**
   * Schedule all daily notifications
   * Call this once per day (e.g., on app launch or via background task)
   */
  const scheduleAllDailyNotifications = useCallback(async () => {
    if (!user?.id) {
      return;
    }

    try {
      await smartNotificationEngine.scheduleForUser(user.id);
    } catch (error) {
      Logger.error('Failed to schedule daily notifications', error as Error, {
        component: 'useNotificationIntegration',
        userId: user.id,
      });
    }
  }, [user?.id]);

  /**
   * Schedule specific contextual notifications
   */
  const scheduleDevotionalReminder = useCallback(async (_preferredTime?: string) => {
    if (!user?.id) {
      return;
    }
    await smartNotificationEngine.scheduleForUser(user.id);
    return true;
  }, [user?.id]);

  const schedulePrayerReminder = useCallback(async (_preferredTime?: string) => {
    if (!user?.id) {
      return;
    }
    await smartNotificationEngine.scheduleForUser(user.id);
    return true;
  }, [user?.id]);

  const scheduleGratitudeReminder = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    await smartNotificationEngine.scheduleForUser(user.id);
    return true;
  }, [user?.id]);

  const scheduleWinsReminder = useCallback(async () => {
    if (!user?.id) {
      return;
    }
    await smartNotificationEngine.scheduleForUser(user.id);
    return true;
  }, [user?.id]);

  return {
    // Activity tracking
    trackPrayer,
    trackDevotional,
    trackJournal,
    trackActivity,

    // Milestone celebrations
    celebrateFaithPoints,
    celebrateLevelUp,
    celebratePlaybookComplete,
    celebratePrayerAnswered,

    // Streak info
    getStreakStatus,

    // Daily notifications
    scheduleAllDailyNotifications,
    scheduleDevotionalReminder,
    schedulePrayerReminder,
    scheduleGratitudeReminder,
    scheduleWinsReminder,
  };
}
