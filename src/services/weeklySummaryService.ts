import { supabase } from './supabaseClient';
import { Logger } from '../utils/ProductionLogger';
import { notificationSchedulerService } from './notificationSchedulerService';
import { NotificationQueueItem } from './notificationManagementService';

export interface WeeklySummary {
  userId: string;
  firstName: string;
  weekStart: Date;
  weekEnd: Date;
  stats: {
    prayersLogged: number;
    devotionalsCompleted: number;
    journalEntries: number;
    playbooksCompleted: number;
    faithfulActionsCompleted: number;
    answeredPrayers: number;
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

      // Fetch first name alongside stats
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('first_name')
        .eq('id', userId)
        .single();

      const firstName = profile?.first_name || 'Friend';

      // Get user's activity for the past week
      const stats = await this.getWeeklyStats(userId, weekStart, weekEnd);

      return {
        userId,
        firstName,
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
        summary.stats.playbooksCompleted > 0 ||
        summary.stats.faithfulActionsCompleted > 0 ||
        summary.stats.answeredPrayers > 0;

      if (!hasActivity) {
        Logger.info('No activity this week - skipping summary', {
          component: 'weeklySummaryService',
          userId,
        });
        return false;
      }

      // Generate personalized title + message
      const title = `Your week in faith, ${summary.firstName} 🌱`;
      const message = this.generateSummaryMessage(summary);

      // Schedule for Sunday evening at 7 PM
      const scheduledFor = this.getNextSunday();
      scheduledFor.setHours(19, 0, 0, 0);

      const notification: NotificationQueueItem = {
        user_id: userId,
        type: 'weekly_summary',
        title,
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
   * Generate personalized summary message.
   *
   * Format:
   *   "This week: {N} prayers, {N} journal entries, {N} devotionals,
   *    {N} faithful actions, and {N} answered prayers.
   *    You earned {N} faith points.
   *    Take a moment to look back on what God carried you through."
   *
   * Any stat that is 0 is omitted from the list.
   * If faithPointsEarned is 0 that sentence is also omitted.
   */
  private generateSummaryMessage(summary: WeeklySummary): string {
    const { stats } = summary;

    const p = (n: number, singular: string, plural = `${singular}s`) =>
      `${n} ${n === 1 ? singular : plural}`;

    // Build the "This week: …" list — only non-zero items
    const highlights: string[] = [];
    if (stats.prayersLogged > 0)
      {highlights.push(p(stats.prayersLogged, 'prayer'));}
    if (stats.journalEntries > 0)
      {highlights.push(p(stats.journalEntries, 'journal entry', 'journal entries'));}
    if (stats.devotionalsCompleted > 0)
      {highlights.push(p(stats.devotionalsCompleted, 'devotional'));}
    if (stats.faithfulActionsCompleted > 0)
      {highlights.push(p(stats.faithfulActionsCompleted, 'faithful action'));}
    if (stats.answeredPrayers > 0)
      {highlights.push(p(stats.answeredPrayers, 'answered prayer'));}

    // Join list with Oxford-style comma
    let listStr = '';
    if (highlights.length === 1) {
      listStr = highlights[0];
    } else if (highlights.length === 2) {
      listStr = `${highlights[0]} and ${highlights[1]}`;
    } else if (highlights.length > 2) {
      listStr = `${highlights.slice(0, -1).join(', ')}, and ${highlights[highlights.length - 1]}`;
    }

    const parts: string[] = [];
    if (listStr) {parts.push(`This week: ${listStr}.`);}
    if (stats.faithPointsEarned > 0)
      {parts.push(`You earned ${stats.faithPointsEarned} faith points.`);}
    parts.push('Take a moment to look back on what God carried you through.');

    return parts.join(' ');
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
    weekStart: Date,
    weekEnd: Date
  ): Promise<WeeklySummary['stats']> {
    try {
      const weekStartIso = weekStart.toISOString();
      const weekEndIso = weekEnd.toISOString();

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

      // Query faith_points_log for weekly activity
      const { data: faithPointsData, error: faithPointsError } = await supabase
        .from('faith_points_log')
        .select('activity_type, points')
        .eq('user_id', userId)
        .gte('created_at', weekStartIso)
        .lte('created_at', weekEndIso);

      if (faithPointsError) {
        Logger.error('Failed to query faith_points_log', faithPointsError as Error, {
          component: 'weeklySummaryService',
          userId,
        });
      }

      // Calculate stats from faith_points_log
      const faithfulActionsCompleted =
        faithPointsData?.filter((entry) => entry.activity_type === 'action_step_completed').length || 0;
      const answeredPrayers =
        faithPointsData?.filter((entry) => entry.activity_type === 'prayer_answered').length || 0;
      const faithPointsEarned =
        faithPointsData?.reduce((sum, entry) => sum + (entry.points || 0), 0) || 0;

      // Query prayer entries
      const { count: prayersLogged } = await supabase
        .from('prayers')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', weekStartIso)
        .lte('created_at', weekEndIso);

      // Query devotional completions (from devotional_progress)
      const { count: devotionalsCompleted } = await supabase
        .from('devotional_progress')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', weekStartIso)
        .lte('completed_at', weekEndIso);

      // Query journal entries (reflection_entries, gratitude_entries, time_block_entries)
      const [{ count: reflectionCount }, { count: gratitudeCount }, { count: timeBlockCount }] =
        await Promise.all([
          supabase
            .from('reflection_entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', weekStartIso)
            .lte('created_at', weekEndIso),
          supabase
            .from('gratitude_entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', weekStartIso)
            .lte('created_at', weekEndIso),
          supabase
            .from('time_block_entries')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', userId)
            .gte('created_at', weekStartIso)
            .lte('created_at', weekEndIso),
        ]);

      const journalEntries = (reflectionCount || 0) + (gratitudeCount || 0) + (timeBlockCount || 0);

      // Query completed playbooks
      const { count: playbooksCompleted } = await supabase
        .from('playbooks')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('completed', true)
        .gte('completed_at', weekStartIso)
        .lte('completed_at', weekEndIso);

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
        prayersLogged: prayersLogged || 0,
        devotionalsCompleted: devotionalsCompleted || 0,
        journalEntries: journalEntries || 0,
        playbooksCompleted: playbooksCompleted || 0,
        faithfulActionsCompleted,
        answeredPrayers,
        faithPointsEarned,
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
        faithfulActionsCompleted: 0,
        answeredPrayers: 0,
        faithPointsEarned: 0,
        currentStreaks: {
          prayer: 0,
          devotional: 0,
          journal: 0,
        },
        topAchievement: undefined,
      };
    }
  }
}

export const weeklySummaryService = new WeeklySummaryService();
