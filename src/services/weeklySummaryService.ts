import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { notificationSchedulerService } from './notificationSchedulerService';
import { NotificationQueueItem } from './notificationManagementService';

export interface WeeklySummary {
  userId: string;
  weekStart: Date;
  weekEnd: Date;
  stats: {
    prayersLogged: number;
    devotionalsCompleted: number;
    journalEntries: number;
    playbooksCompleted: number;
    faithPointsEarned: number;
    currentStreaks: {
      prayer: number;
      devotional: number;
      journal: number;
    };
    topAchievement?: string;
  };
}

/**
 * Weekly Summary Service
 * Generates and sends weekly recap notifications
 */
class WeeklySummaryService {
  /**
   * Generate weekly summary for user
   */
  async generateWeeklySummary(userId: string): Promise<WeeklySummary | null> {
    try {
      const weekEnd = new Date();
      const weekStart = new Date();
      weekStart.setDate(weekStart.getDate() - 7);

      // Get user's activity for the past week
      const stats = await this.getWeeklyStats(userId, weekStart, weekEnd);

      return {
        userId,
        weekStart,
        weekEnd,
        stats,
      };
    } catch (error) {
      Logger.error('Failed to generate weekly summary', error as Error, {
        component: 'weeklySummaryService',
        userId,
      });
      return null;
    }
  }

  /**
   * Schedule weekly summary notification
   */
  async scheduleWeeklySummary(userId: string): Promise<boolean> {
    try {
      const summary = await this.generateWeeklySummary(userId);

      if (!summary) {
        return false;
      }

      // Only send if user had any activity this week
      const hasActivity =
        summary.stats.prayersLogged > 0 ||
        summary.stats.devotionalsCompleted > 0 ||
        summary.stats.journalEntries > 0 ||
        summary.stats.playbooksCompleted > 0;

      if (!hasActivity) {
        Logger.info('No activity this week - skipping summary', {
          component: 'weeklySummaryService',
          userId,
        });
        return false;
      }

      // Generate personalized message
      const message = this.generateSummaryMessage(summary);

      // Schedule for Sunday evening at 7 PM
      const scheduledFor = this.getNextSunday();
      scheduledFor.setHours(19, 0, 0, 0);

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'weekly_summary',
        title: 'Your Week in Faith 📊',
        message,
        data: {
          deep_link: 'sifia://profile/stats',
          week_start: summary.weekStart.toISOString(),
          week_end: summary.weekEnd.toISOString(),
          stats: summary.stats,
        },
        scheduled_for: scheduledFor.toISOString(),
        priority: 'normal',
      };

      const success = await notificationSchedulerService.scheduleNotification(notification, {

        priority: 'normal',
        batchWithOthers: false,
      });

      if (success) {
        Logger.info('Weekly summary scheduled', {
          component: 'weeklySummaryService',
          userId,
          scheduledFor: scheduledFor.toISOString(),
        });
      }

      return success;
    } catch (error) {
      Logger.error('Failed to schedule weekly summary', error as Error, {
        component: 'weeklySummaryService',
        userId,
      });
      return false;
    }
  }

  /**
   * Generate personalized summary message
   */
  private generateSummaryMessage(summary: WeeklySummary): string {
    const { stats } = summary;
    const highlights: string[] = [];

    // Add activity highlights
    if (stats.prayersLogged > 0) {
      highlights.push(`${stats.prayersLogged} prayer${stats.prayersLogged > 1 ? 's' : ''}`);
    }
    if (stats.devotionalsCompleted > 0) {
      highlights.push(`${stats.devotionalsCompleted} devotional${stats.devotionalsCompleted > 1 ? 's' : ''}`);
    }
    if (stats.journalEntries > 0) {
      highlights.push(`${stats.journalEntries} journal ${stats.journalEntries > 1 ? 'entries' : 'entry'}`);
    }

    // Build message
    let message = '';

    if (highlights.length > 0) {
      message = `This week: ${highlights.join(', ')}. `;
    }

    // Add streak info
    const activeStreaks = [];
    if (stats.currentStreaks.prayer > 0) {
      activeStreaks.push(`${stats.currentStreaks.prayer}-day prayer streak 🔥`);
    }
    if (stats.currentStreaks.devotional > 0) {
      activeStreaks.push(`${stats.currentStreaks.devotional}-day devotional streak 📖`);
    }
    if (stats.currentStreaks.journal > 0) {
      activeStreaks.push(`${stats.currentStreaks.journal}-day journal streak ✍️`);
    }

    if (activeStreaks.length > 0) {
      message += `Active: ${activeStreaks.join(', ')}. `;
    }

    // Add faith points
    if (stats.faithPointsEarned > 0) {
      message += `+${stats.faithPointsEarned} faith points earned! `;
    }

    // Add encouragement
    if (stats.topAchievement) {
      message += `🌟 ${stats.topAchievement}`;
    } else {
      message += 'Keep growing in faith!';
    }

    return message.trim();
  }

  /**
   * Get next Sunday date
   */
  private getNextSunday(): Date {
    const today = new Date();
    const dayOfWeek = today.getDay();
    const daysUntilSunday = dayOfWeek === 0 ? 7 : 7 - dayOfWeek;

    const nextSunday = new Date(today);
    nextSunday.setDate(today.getDate() + daysUntilSunday);

    return nextSunday;
  }

  /**
   * Get weekly stats from database
   */
  private async getWeeklyStats(
    userId: string,
    _weekStart: Date,
    _weekEnd: Date
  ): Promise<WeeklySummary['stats']> {
    try {
      // TODO: Implement actual database queries
      // For now, return placeholder data

      // Get streaks
      const { data: streaksData } = await supabase
        .from('user_streaks')
        .select('prayer_streak, devotional_streak, journal_streak')
        .eq('user_id', userId)
        .single();

      const currentStreaks = {
        prayer: streaksData?.prayer_streak || 0,
        devotional: streaksData?.devotional_streak || 0,
        journal: streaksData?.journal_streak || 0,
      };

      // Determine top achievement
      let topAchievement: string | undefined;
      const maxStreak = Math.max(
        currentStreaks.prayer,
        currentStreaks.devotional,
        currentStreaks.journal
      );

      if (maxStreak >= 7) {
        if (currentStreaks.prayer === maxStreak) {
          topAchievement = 'Week-long prayer streak!';
        } else if (currentStreaks.devotional === maxStreak) {
          topAchievement = 'Week-long devotional streak!';
        } else if (currentStreaks.journal === maxStreak) {
          topAchievement = 'Week-long journaling streak!';
        }
      }

      return {
        prayersLogged: 0, // TODO: Query prayer logs
        devotionalsCompleted: 0, // TODO: Query devotional completions
        journalEntries: 0, // TODO: Query journal entries
        playbooksCompleted: 0, // TODO: Query playbook completions
        faithPointsEarned: 0, // TODO: Query faith points earned this week
        currentStreaks,
        topAchievement,
      };
    } catch (error) {
      Logger.error('Failed to get weekly stats', error as Error, {
        component: 'weeklySummaryService',
        userId,
      });

      return {
        prayersLogged: 0,
        devotionalsCompleted: 0,
        journalEntries: 0,
        playbooksCompleted: 0,
        faithPointsEarned: 0,
        currentStreaks: {
          prayer: 0,
          devotional: 0,
          journal: 0,
        },
      };
    }
  }
}

export const weeklySummaryService = new WeeklySummaryService();
