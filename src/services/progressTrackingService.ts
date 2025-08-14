import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { smartNotificationService } from './smartNotificationService';

export interface SpiritualProgressData {
  userId: string;
  currentStreak: number;
  longestStreak: number;
  totalPlaybooksCompleted: number;
  totalActionStepsCompleted: number;
  totalQuestionsAsked: number;
  totalInsightsReceived: number;
  spiritualMaturityLevel: 'beginner' | 'growing' | 'mature' | 'advanced';
  weeklyGoal: number;
  weeklyProgress: number;
  monthlyStats: {
    playbooksStarted: number;
    playbooksCompleted: number;
    actionStepsCompleted: number;
    consistentDays: number;
  };
  growthAreas: {
    prayer: number; // 1-10 scale
    scripture: number;
    service: number;
    fellowship: number;
    worship: number;
  };
  lastActivityDate: string;
  joinedDate: string;
  updatedAt: string;
}

export interface WeeklyProgressSummary {
  weekStartDate: string;
  weekEndDate: string;
  goalMet: boolean;
  playbooksCompleted: number;
  actionStepsCompleted: number;
  questionsAsked: number;
  consistentDays: number;
  highlights: string[];
  areasForGrowth: string[];
  encouragement: string;
}

export interface SpiritualGrowthInsight {
  id: string;
  userId: string;
  type: 'strength' | 'growth_area' | 'recommendation' | 'celebration';
  title: string;
  description: string;
  actionable: boolean;
  suggestedAction?: string;
  relatedPlaybooks?: string[];
  createdAt: string;
}

class ProgressTrackingService {
  private readonly STORAGE_KEY = 'spiritual_progress_data';

  /**
   * Get user's spiritual progress data
   */
  async getUserProgress(userId: string): Promise<SpiritualProgressData> {
    try {
      // Try to get from local storage first
      const stored = await AsyncStorage.getItem(`${this.STORAGE_KEY}_${userId}`);

      if (stored) {
        const localData: SpiritualProgressData = JSON.parse(stored);

        // Check if data is recent (within 24 hours)
        const lastUpdate = new Date(localData.updatedAt);
        const now = new Date();
        const hoursSinceUpdate = (now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60);

        if (hoursSinceUpdate < 24) {
          return localData;
        }
      }

      // Fetch fresh data from Supabase
      const freshData = await this.fetchProgressFromSupabase(userId);
      await this.saveProgressLocally(freshData);

      return freshData;
    } catch (error) {
      console.error('[ProgressTrackingService] Error getting user progress:', error);

      // Return default progress data if all else fails
      return this.getDefaultProgressData(userId);
    }
  }

  /**
   * Update user progress after completing an action
   */
  async updateProgress(
    userId: string,
    action: 'playbook_started' | 'playbook_completed' | 'action_step_completed' | 'question_asked' | 'insight_received',
    metadata?: any
  ): Promise<SpiritualProgressData> {
    try {
      const currentProgress = await this.getUserProgress(userId);
      const updatedProgress = { ...currentProgress };
      const now = new Date().toISOString();

      // Update streak
      const lastActivity = new Date(currentProgress.lastActivityDate);
      const today = new Date();
      const daysSinceLastActivity = Math.floor((today.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));

      if (daysSinceLastActivity === 0) {
        // Same day, maintain streak
      } else if (daysSinceLastActivity === 1) {
        // Consecutive day, increment streak
        updatedProgress.currentStreak += 1;
        updatedProgress.longestStreak = Math.max(updatedProgress.longestStreak, updatedProgress.currentStreak);
      } else {
        // Streak broken, reset to 1
        updatedProgress.currentStreak = 1;
      }

      // Update specific metrics based on action
      switch (action) {
        case 'playbook_completed':
          updatedProgress.totalPlaybooksCompleted += 1;
          updatedProgress.monthlyStats.playbooksCompleted += 1;

          // Check for milestone
          await smartNotificationService.trackProgressMilestone(userId, 'playbook_completion', {
            playbookTitle: metadata?.playbookTitle,
            completedSteps: metadata?.completedSteps,
            totalSteps: metadata?.totalSteps,
          });
          break;

        case 'action_step_completed':
          updatedProgress.totalActionStepsCompleted += 1;
          updatedProgress.monthlyStats.actionStepsCompleted += 1;
          updatedProgress.weeklyProgress += 1;
          break;

        case 'question_asked':
          updatedProgress.totalQuestionsAsked += 1;
          break;

        case 'insight_received':
          updatedProgress.totalInsightsReceived += 1;
          break;
      }

      // Update spiritual maturity level based on overall progress
      updatedProgress.spiritualMaturityLevel = this.calculateSpiritualMaturity(updatedProgress);

      // Check for streak milestones
      if (action !== 'question_asked') { // Only count substantial actions for streaks
        await smartNotificationService.trackProgressMilestone(userId, 'streak_achievement', {
          currentStreak: updatedProgress.currentStreak,
        });
      }

      // Update timestamps
      updatedProgress.lastActivityDate = now;
      updatedProgress.updatedAt = now;

      // Save updated progress
      await this.saveProgressLocally(updatedProgress);
      await this.saveProgressToSupabase(updatedProgress);

      return updatedProgress;
    } catch (error) {
      console.error('[ProgressTrackingService] Error updating progress:', error);
      throw error;
    }
  }

  /**
   * Get weekly progress summary
   */
  async getWeeklyProgressSummary(userId: string): Promise<WeeklyProgressSummary> {
    try {
      const progress = await this.getUserProgress(userId);
      const now = new Date();
      // TODO: Get user's week start preference from user settings
      const weekStartsOn = 0; // Default to Sunday for now
      const weekStart = new Date(now);
      const dayOfWeek = now.getDay();
      const adjustedDayIndex = dayOfWeek - weekStartsOn;
      const daysToSubtract = adjustedDayIndex < 0 ? adjustedDayIndex + 7 : adjustedDayIndex;
      weekStart.setDate(now.getDate() - daysToSubtract); // Start of current week
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6); // End of current week

      const goalMet = progress.weeklyProgress >= progress.weeklyGoal;

      // Generate highlights and growth areas
      const highlights = this.generateWeeklyHighlights(progress);
      const areasForGrowth = this.generateGrowthAreas(progress);
      const encouragement = this.generateEncouragement(progress, goalMet);

      return {
        weekStartDate: weekStart.toISOString(),
        weekEndDate: weekEnd.toISOString(),
        goalMet,
        playbooksCompleted: progress.monthlyStats.playbooksCompleted,
        actionStepsCompleted: progress.weeklyProgress,
        questionsAsked: progress.totalQuestionsAsked,
        consistentDays: progress.currentStreak,
        highlights,
        areasForGrowth,
        encouragement,
      };
    } catch (error) {
      console.error('[ProgressTrackingService] Error getting weekly summary:', error);
      throw error;
    }
  }

  /**
   * Generate spiritual growth insights
   */
  async generateGrowthInsights(userId: string): Promise<SpiritualGrowthInsight[]> {
    try {
      const progress = await this.getUserProgress(userId);
      const insights: SpiritualGrowthInsight[] = [];

      // Strength insights
      if (progress.currentStreak >= 7) {
        insights.push({
          id: `strength_consistency_${Date.now()}`,
          userId,
          type: 'strength',
          title: 'Consistency Champion',
          description: `Your ${progress.currentStreak}-day streak shows incredible dedication to spiritual growth!`,
          actionable: false,
          createdAt: new Date().toISOString(),
        });
      }

      if (progress.totalPlaybooksCompleted >= 5) {
        insights.push({
          id: `strength_completion_${Date.now()}`,
          userId,
          type: 'strength',
          title: 'Faithful Finisher',
          description: `You've completed ${progress.totalPlaybooksCompleted} playbooks! Your commitment to following through is inspiring.`,
          actionable: false,
          createdAt: new Date().toISOString(),
        });
      }

      // Growth area insights
      if (progress.weeklyProgress < progress.weeklyGoal * 0.5) {
        insights.push({
          id: `growth_consistency_${Date.now()}`,
          userId,
          type: 'growth_area',
          title: 'Building Consistency',
          description: 'Consider setting smaller, more achievable daily goals to build momentum.',
          actionable: true,
          suggestedAction: 'Try committing to just 5 minutes of spiritual growth daily',
          createdAt: new Date().toISOString(),
        });
      }

      // Recommendations
      if (progress.totalQuestionsAsked < 5) {
        insights.push({
          id: `recommendation_questions_${Date.now()}`,
          userId,
          type: 'recommendation',
          title: 'Deepen Your Understanding',
          description: 'Asking questions helps personalize your spiritual journey and deepen insights.',
          actionable: true,
          suggestedAction: 'Try asking "How does this apply to my current situation?" on your next action step',
          createdAt: new Date().toISOString(),
        });
      }

      // Celebrations
      if (progress.currentStreak > progress.longestStreak * 0.8) {
        insights.push({
          id: `celebration_streak_${Date.now()}`,
          userId,
          type: 'celebration',
          title: 'Amazing Progress!',
          description: `You're approaching your longest streak of ${progress.longestStreak} days. Keep going!`,
          actionable: false,
          createdAt: new Date().toISOString(),
        });
      }

      return insights;
    } catch (error) {
      console.error('[ProgressTrackingService] Error generating insights:', error);
      return [];
    }
  }

  /**
   * Set weekly goal
   */
  async setWeeklyGoal(userId: string, goal: number): Promise<void> {
    try {
      const progress = await this.getUserProgress(userId);
      progress.weeklyGoal = goal;
      progress.updatedAt = new Date().toISOString();

      await this.saveProgressLocally(progress);
      await this.saveProgressToSupabase(progress);
    } catch (error) {
      console.error('[ProgressTrackingService] Error setting weekly goal:', error);
      throw error;
    }
  }

  /**
   * Reset weekly progress (called at start of new week)
   */
  async resetWeeklyProgress(userId: string): Promise<void> {
    try {
      const progress = await this.getUserProgress(userId);

      // Check if weekly goal was met before resetting
      const goalMet = progress.weeklyProgress >= progress.weeklyGoal;

      if (goalMet) {
        await smartNotificationService.trackProgressMilestone(userId, 'consistency', {
          weeklyGoal: progress.weeklyGoal,
          weeklyCompleted: progress.weeklyProgress,
          weeksConsistent: 1, // This would be calculated based on historical data
        });
      }

      progress.weeklyProgress = 0;
      progress.updatedAt = new Date().toISOString();

      await this.saveProgressLocally(progress);
      await this.saveProgressToSupabase(progress);
    } catch (error) {
      console.error('[ProgressTrackingService] Error resetting weekly progress:', error);
    }
  }

  // =============================================
  // PRIVATE HELPER METHODS
  // =============================================

  private async fetchProgressFromSupabase(userId: string): Promise<SpiritualProgressData> {
    try {
      const { data, error } = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        return {
          userId: data.user_id,
          currentStreak: data.current_streak || 0,
          longestStreak: data.longest_streak || 0,
          totalPlaybooksCompleted: data.total_playbooks_completed || 0,
          totalActionStepsCompleted: data.total_action_steps_completed || 0,
          totalQuestionsAsked: data.total_questions_asked || 0,
          totalInsightsReceived: data.total_insights_received || 0,
          spiritualMaturityLevel: data.spiritual_maturity_level || 'beginner',
          weeklyGoal: data.weekly_goal || 3,
          weeklyProgress: data.weekly_progress || 0,
          monthlyStats: data.monthly_stats || {
            playbooksStarted: 0,
            playbooksCompleted: 0,
            actionStepsCompleted: 0,
            consistentDays: 0,
          },
          growthAreas: data.growth_areas || {
            prayer: 5,
            scripture: 5,
            service: 5,
            fellowship: 5,
            worship: 5,
          },
          lastActivityDate: data.last_activity_date || new Date().toISOString(),
          joinedDate: data.joined_date || new Date().toISOString(),
          updatedAt: data.updated_at || new Date().toISOString(),
        };
      }

      // No existing data, return default
      return this.getDefaultProgressData(userId);
    } catch (error) {
      console.error('[ProgressTrackingService] Error fetching from Supabase:', error);
      return this.getDefaultProgressData(userId);
    }
  }

  private getDefaultProgressData(userId: string): SpiritualProgressData {
    const now = new Date().toISOString();

    return {
      userId,
      currentStreak: 0,
      longestStreak: 0,
      totalPlaybooksCompleted: 0,
      totalActionStepsCompleted: 0,
      totalQuestionsAsked: 0,
      totalInsightsReceived: 0,
      spiritualMaturityLevel: 'beginner',
      weeklyGoal: 3,
      weeklyProgress: 0,
      monthlyStats: {
        playbooksStarted: 0,
        playbooksCompleted: 0,
        actionStepsCompleted: 0,
        consistentDays: 0,
      },
      growthAreas: {
        prayer: 5,
        scripture: 5,
        service: 5,
        fellowship: 5,
        worship: 5,
      },
      lastActivityDate: now,
      joinedDate: now,
      updatedAt: now,
    };
  }

  private calculateSpiritualMaturity(progress: SpiritualProgressData): SpiritualProgressData['spiritualMaturityLevel'] {
    const totalActivity = progress.totalPlaybooksCompleted + (progress.totalActionStepsCompleted / 10);

    if (totalActivity >= 20) {return 'advanced';}
    if (totalActivity >= 10) {return 'mature';}
    if (totalActivity >= 3) {return 'growing';}
    return 'beginner';
  }

  private generateWeeklyHighlights(progress: SpiritualProgressData): string[] {
    const highlights: string[] = [];

    if (progress.currentStreak >= 7) {
      highlights.push(`🔥 ${progress.currentStreak}-day consistency streak!`);
    }

    if (progress.monthlyStats.playbooksCompleted > 0) {
      highlights.push(`📚 Completed ${progress.monthlyStats.playbooksCompleted} playbook${progress.monthlyStats.playbooksCompleted > 1 ? 's' : ''}!`);
    }

    if (progress.weeklyProgress >= progress.weeklyGoal) {
      highlights.push(`🎯 Met your weekly goal of ${progress.weeklyGoal} action steps!`);
    }

    if (highlights.length === 0) {
      highlights.push('🌱 Every step forward is growth in your faith journey!');
    }

    return highlights;
  }

  private generateGrowthAreas(progress: SpiritualProgressData): string[] {
    const areas: string[] = [];

    if (progress.weeklyProgress < progress.weeklyGoal) {
      areas.push('Consider smaller daily commitments to build consistency');
    }

    if (progress.totalQuestionsAsked < 5) {
      areas.push('Ask more questions to deepen your understanding');
    }

    if (progress.currentStreak < 3) {
      areas.push('Focus on building a daily spiritual habit');
    }

    return areas;
  }

  private generateEncouragement(progress: SpiritualProgressData, goalMet: boolean): string {
    if (goalMet) {
      return 'Wonderful work this week! Your dedication to spiritual growth is inspiring. God sees your faithful heart! 🙌';
    }

    if (progress.weeklyProgress > 0) {
      return "Every step counts in your spiritual journey! You're making progress, and that's what matters. Keep going! 💪";
    }

    return "This week is a fresh start! Remember, God's mercies are new every morning. You've got this! ✨";
  }

  private async saveProgressLocally(progress: SpiritualProgressData): Promise<void> {
    try {
      await AsyncStorage.setItem(
        `${this.STORAGE_KEY}_${progress.userId}`,
        JSON.stringify(progress)
      );
    } catch (error) {
      console.error('[ProgressTrackingService] Error saving locally:', error);
    }
  }

  private async saveProgressToSupabase(progress: SpiritualProgressData): Promise<void> {
    try {
      const { error } = await supabase
        .from('user_progress')
        .upsert({
          user_id: progress.userId,
          current_streak: progress.currentStreak,
          longest_streak: progress.longestStreak,
          total_playbooks_completed: progress.totalPlaybooksCompleted,
          total_action_steps_completed: progress.totalActionStepsCompleted,
          total_questions_asked: progress.totalQuestionsAsked,
          total_insights_received: progress.totalInsightsReceived,
          spiritual_maturity_level: progress.spiritualMaturityLevel,
          weekly_goal: progress.weeklyGoal,
          weekly_progress: progress.weeklyProgress,
          monthly_stats: progress.monthlyStats,
          growth_areas: progress.growthAreas,
          last_activity_date: progress.lastActivityDate,
          joined_date: progress.joinedDate,
          updated_at: progress.updatedAt,
        });

      if (error) {
        console.error('[ProgressTrackingService] Error saving to Supabase:', error);
      }
    } catch (error) {
      console.error('[ProgressTrackingService] Error saving to Supabase:', error);
    }
  }
}

export const progressTrackingService = new ProgressTrackingService();
