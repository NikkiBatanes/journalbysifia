import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { notificationSchedulerService } from './notificationSchedulerService';
import { NotificationQueueItem } from './notificationManagementService';

export interface UserStreaks {
  id?: string;
  user_id: string;
  prayer_streak: number;
  prayer_last_date?: string;
  prayer_best_streak: number;
  journal_streak: number;
  journal_last_date?: string;
  journal_best_streak: number;
  updated_at?: string;
  created_at?: string;
}

export type StreakType = 'prayer' | 'journal';

/**
 * Streak Tracking Service
 * Manages user activity streaks and triggers streak alert notifications
 */
class StreakTrackingService {
  /**
   * Get user's current streaks
   */
  async getUserStreaks(userId: string): Promise<UserStreaks | null> {
    try {
      const { data, error } = await supabase
        .from('user_streaks')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No streaks found - initialize
          return await this.initializeUserStreaks(userId);
        }

        if (error.code === '42P01' || error.message?.includes('relation') || error.message?.includes('does not exist')) {
          Logger.warn('user_streaks table not found - skipping streak tracking', {
            component: 'streakTrackingService',
          });
          return null;
        }

        Logger.error('Failed to get user streaks', error as Error, {
          component: 'streakTrackingService',
          userId,
        });
        return null;
      }

      return data;
    } catch (error) {
      Logger.error('Error getting user streaks', error as Error, {
        component: 'streakTrackingService',
        userId,
      });
      return null;
    }
  }

  /**
   * Initialize streaks for new user
   */
  private async initializeUserStreaks(userId: string): Promise<UserStreaks> {
    const initialStreaks: UserStreaks = {
      user_id: userId,
      prayer_streak: 0,
      prayer_best_streak: 0,
      journal_streak: 0,
      journal_best_streak: 0,
    };

    const { data, error } = await supabase
      .from('user_streaks')
      .insert(initialStreaks)
      .select()
      .single();

    if (error) {
      Logger.error('Failed to initialize user streaks', error as Error, {
        component: 'streakTrackingService',
        userId,
      });
      return initialStreaks;
    }

    return data;
  }

  /**
   * Update streak when user completes an activity
   */
  async updateStreak(userId: string, streakType: StreakType): Promise<boolean> {
    try {
      // Use database function for atomic streak update
      const { error } = await supabase.rpc('update_user_streak', {
        p_user_id: userId,
        p_streak_type: streakType,
      });

      if (error) {
        // Fallback to manual update if function doesn't exist
        if (error.code === '42883' || error.message?.includes('function') || error.message?.includes('does not exist')) {
          Logger.warn('update_user_streak function not found - using fallback', {
            component: 'streakTrackingService',
          });
          return await this.updateStreakManual(userId, streakType);
        }

        Logger.error('Failed to update streak', error as Error, {
          component: 'streakTrackingService',
          userId,
          streakType,
        });
        return false;
      }

      Logger.info('Streak updated successfully', {
        component: 'streakTrackingService',
        userId,
        streakType,
      });

      return true;
    } catch (error) {
      Logger.error('Error updating streak', error as Error, {
        component: 'streakTrackingService',
        userId,
        streakType,
      });
      return false;
    }
  }

  /**
   * Manual streak update (fallback if database function doesn't exist)
   */
  private async updateStreakManual(userId: string, streakType: StreakType): Promise<boolean> {
    try {
      const streaks = await this.getUserStreaks(userId);
      if (!streaks) {
        return false;
      }

      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      let currentStreak = 0;
      let lastDate = '';
      let bestStreak = 0;

      // Get current values for this streak type
      if (streakType === 'prayer') {
        currentStreak = streaks.prayer_streak;
        lastDate = streaks.prayer_last_date || '';
        bestStreak = streaks.prayer_best_streak;
      } else if (streakType === 'journal') {
        currentStreak = streaks.journal_streak;
        lastDate = streaks.journal_last_date || '';
        bestStreak = streaks.journal_best_streak;
      }

      // Calculate new streak
      if (lastDate === today) {
        // Already logged today, no change
        return true;
      } else if (lastDate === yesterday) {
        // Continuing streak
        currentStreak += 1;
      } else {
        // Streak broken, start new
        currentStreak = 1;
      }

      // Update best streak if needed
      if (currentStreak > bestStreak) {
        bestStreak = currentStreak;
      }

      // Update database
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (streakType === 'prayer') {
        updateData.prayer_streak = currentStreak;
        updateData.prayer_last_date = today;
        updateData.prayer_best_streak = bestStreak;
      } else if (streakType === 'journal') {
        updateData.journal_streak = currentStreak;
        updateData.journal_last_date = today;
        updateData.journal_best_streak = bestStreak;
      }

      const { error } = await supabase
        .from('user_streaks')
        .update(updateData)
        .eq('user_id', userId);

      if (error) {
        Logger.error('Failed to update streak manually', error as Error, {
          component: 'streakTrackingService',
          userId,
          streakType,
        });
        return false;
      }

      return true;
    } catch (error) {
      Logger.error('Error in manual streak update', error as Error, {
        component: 'streakTrackingService',
        userId,
        streakType,
      });
      return false;
    }
  }

  /**
   * Check if user needs a streak alert notification
   * Returns true if notification was scheduled
   */
  async checkAndScheduleStreakAlert(userId: string, streakType: StreakType): Promise<boolean> {
    try {
      const streaks = await this.getUserStreaks(userId);
      if (!streaks) {
        return false;
      }

      let currentStreak = 0;
      let lastDate = '';

      if (streakType === 'prayer') {
        currentStreak = streaks.prayer_streak;
        lastDate = streaks.prayer_last_date || '';
      } else if (streakType === 'journal') {
        currentStreak = streaks.journal_streak;
        lastDate = streaks.journal_last_date || '';
      }

      // Only alert if streak is 3+ days and user hasn't logged today
      if (currentStreak < 3) {
        return false;
      }

      const today = new Date().toISOString().split('T')[0];
      if (lastDate === today) {
        // Already logged today, no alert needed
        return false;
      }

      // Schedule streak alert notification
      const alertResult = await this.scheduleStreakAlert(userId, streakType, currentStreak);

      // Check for milestone celebration (7, 14, 30, 60, 100 days)
      const milestones = [7, 14, 30, 60, 100];
      if (milestones.includes(currentStreak)) {
        await this.scheduleMilestoneCelebration(userId, streakType, currentStreak);
      }

      return alertResult;
    } catch (error) {
      Logger.error('Error checking streak alert', error as Error, {
        component: 'streakTrackingService',
        userId,
        streakType,
      });
      return false;
    }
  }

  /**
   * Schedule a streak alert notification
   */
  private async scheduleStreakAlert(
    userId: string,
    streakType: StreakType,
    currentStreak: number
  ): Promise<boolean> {
    try {
      const messages = {
        prayer: {
          title: `Don't Break Your ${currentStreak}-Day Prayer Streak! 🔥`,
          message: 'You\'re on fire! Keep your spiritual momentum going.',
          deepLink: 'sifia://journal/prayer',
          time: '11:30', // 11:30 AM - to avoid overlap with weekly summary on Sunday
        },
        journal: {
          title: `Continue Your ${currentStreak}-Day Journaling Journey! ✍🏼`,
          message: 'You\'re building consistency. Keep going!',
          deepLink: 'sifia://journal',
          time: '13:00', // 1:00 PM - after prayer_answered_check
        },
      };

      const config = messages[streakType];
      const [hour, min] = config.time.split(':').map(Number);

      const scheduledFor = new Date();
      scheduledFor.setHours(hour, min, 0, 0);

      // If scheduled time has passed, schedule for tomorrow
      if (scheduledFor < new Date()) {
        scheduledFor.setDate(scheduledFor.getDate() + 1);
      }

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'streak_alert',
        title: config.title,
        message: config.message,
        data: {
          deep_link: config.deepLink,
          streak_type: streakType,
          current_streak: currentStreak,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'high',
      };

      return await notificationSchedulerService.scheduleNotification(notification, {
        priority: 'high',
        batchWithOthers: false,
      });
    } catch (error) {
      Logger.error('Failed to schedule streak alert', error as Error, {
        component: 'streakTrackingService',
        userId,
        streakType,
        currentStreak,
      });
      return false;
    }
  }

  /**
   * Schedule milestone celebration notifications
   */
  async scheduleMilestoneCelebration(
    userId: string,
    streakType: StreakType,
    milestoneStreak: number
  ): Promise<boolean> {
    try {
      const milestoneMessages = {
        prayer: {
          7: '🔥 7-Day Prayer Streak! You\'re building spiritual discipline!',
          14: '🌸 14-Day Prayer Streak! Your consistency is inspiring!',
          30: '🏆 30-Day Prayer Streak! You\'re a prayer warrior!',
          60: '💎 60-Day Prayer Streak! Your faith is unshakeable!',
          100: '🌟 100-Day Prayer Streak! You\'re truly devoted!',
        },
        journal: {
          7: '✍🏼 7-Day Journaling Streak! Documenting your spiritual growth!',
          14: '📝 14-Day Journaling Streak! Your reflections are beautiful!',
          30: '📚 30-Day Journaling Streak! You\'re building a spiritual legacy!',
          60: '🖋️ 60-Day Journaling Streak! Your consistency is admirable!',
          100: '🌈 100-Day Journaling Streak! You\'re an inspiration to others!',
        },
      };

      const message = milestoneMessages[streakType]?.[milestoneStreak as keyof typeof milestoneMessages.prayer];
      if (!message) {
        return false; // Not a milestone we celebrate
      }

      const scheduledFor = new Date();
      scheduledFor.setMinutes(scheduledFor.getMinutes() + 10); // 10 minutes from now

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'milestone_celebration',
        title: `🌸 ${milestoneStreak}-Day ${streakType.charAt(0).toUpperCase() + streakType.slice(1)} Milestone!`,
        message,
        data: {
          deep_link: `sifia://journal/${streakType}`,
          streak_type: streakType,
          milestone_streak: milestoneStreak,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      return await notificationSchedulerService.scheduleNotification(notification, {
        priority: 'normal',
        batchWithOthers: true,
      });
    } catch (error) {
      Logger.error('Failed to schedule milestone celebration', error as Error, {
        component: 'streakTrackingService',
        userId,
        streakType,
        milestoneStreak,
      });
      return false;
    }
  }

  /**
   * Check all streaks for a user and schedule alerts if needed
   */
  async checkAllStreaksForUser(userId: string): Promise<void> {
    try {
      const streaks = await this.getUserStreaks(userId);
      if (!streaks) {return;}

      // Check each streak type
      await this.checkAndScheduleStreakAlert(userId, 'prayer');
      await this.checkAndScheduleStreakAlert(userId, 'journal');
    } catch (error) {
      Logger.error('Error checking all streaks for user', error as Error, {
        component: 'streakTrackingService',
        userId,
      });
    }
  }

  /**
   * Get streak status for a specific streak type
   */
  async getStreakStatus(userId: string, streakType: StreakType): Promise<{
    current: number;
    best: number;
    lastDate: string | null;
    isActive: boolean;
  }> {
    try {
      const streaks = await this.getUserStreaks(userId);
      if (!streaks) {
        return { current: 0, best: 0, lastDate: null, isActive: false };
      }

      let current = 0;
      let best = 0;
      let lastDate = null;

      switch (streakType) {
        case 'prayer':
          current = streaks.prayer_streak;
          best = streaks.prayer_best_streak;
          lastDate = streaks.prayer_last_date || null;
          break;
        case 'journal':
          current = streaks.journal_streak;
          best = streaks.journal_best_streak;
          lastDate = streaks.journal_last_date || null;
          break;
      }

      const today = new Date().toISOString().split('T')[0];
      const isActive = lastDate === today;

      return { current, best, lastDate, isActive };
    } catch (error) {
      Logger.error('Error getting streak status', error as Error, {
        component: 'streakTrackingService',
        userId,
        streakType,
      });
      return { current: 0, best: 0, lastDate: null, isActive: false };
    }
  }
}

export const streakTrackingService = new StreakTrackingService();
