import { supabase } from './supabaseClient';

export interface SpiritualProgressMetric {
  id: string;
  userId: string;
  metricType: 'insights_generated' | 'questions_asked' | 'bookmarks_saved' | 'playbooks_completed' | 'devotionals_read';
  value: number;
  date: string;
  playbookTitle?: string;
  cardType?: string;
  context?: string;
}

export interface ProgressSummary {
  totalInsights: number;
  totalQuestions: number;
  totalBookmarks: number;
  playbooksCompleted: number;
  devotionalsRead: number;
  weeklyGrowth: number;
  monthlyGrowth: number;
  favoriteCardType: string;
  consistencyScore: number;
}

class SpiritualProgressService {
  /**
   * Track a spiritual growth metric (following personalization pattern - no caching)
   */
  async trackProgress(
    userId: string,
    metricType: SpiritualProgressMetric['metricType'],
    value: number = 1,
    context?: {
      playbookTitle?: string;
      cardType?: string;
      additionalContext?: string;
    }
  ): Promise<void> {
    try {
      const progressEntry: Omit<SpiritualProgressMetric, 'id'> = {
        userId,
        metricType,
        value,
        date: new Date().toISOString(),
        playbookTitle: context?.playbookTitle,
        cardType: context?.cardType,
        context: context?.additionalContext,
      };

      const { error } = await supabase
        .from('spiritual_progress')
        .insert(progressEntry);

      if (error) {
        console.error('[SpiritualProgressService] Error tracking progress:', error);
        // Don't throw - progress tracking shouldn't block user experience
        return;
      }

      console.log(`[SpiritualProgressService] Tracked ${metricType} progress for user`);
    } catch (error) {
      console.error('[SpiritualProgressService] Error:', error);
      // Silent fail - progress tracking is supplementary
    }
  }

  /**
   * Get personalized progress summary (always fresh, no caching)
   */
  async getProgressSummary(userId: string): Promise<ProgressSummary> {
    try {
      // Get all progress data for the user
      const { data: progressData, error } = await supabase
        .from('spiritual_progress')
        .select('*')
        .eq('userId', userId)
        .order('date', { ascending: false });

      if (error) {
        console.error('[SpiritualProgressService] Error fetching progress:', error);
        return this.getDefaultProgressSummary();
      }

      const progress = progressData || [];
      const now = new Date();
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      // Calculate metrics
      const totalInsights = this.sumMetric(progress, 'insights_generated');
      const totalQuestions = this.sumMetric(progress, 'questions_asked');
      const totalBookmarks = this.sumMetric(progress, 'bookmarks_saved');
      const playbooksCompleted = this.sumMetric(progress, 'playbooks_completed');
      const devotionalsRead = this.sumMetric(progress, 'devotionals_read');

      // Weekly and monthly growth
      const weeklyProgress = progress.filter(p => new Date(p.date) >= oneWeekAgo);
      const monthlyProgress = progress.filter(p => new Date(p.date) >= oneMonthAgo);

      const weeklyGrowth = weeklyProgress.length;
      const monthlyGrowth = monthlyProgress.length;

      // Favorite card type
      const cardTypeCounts = progress.reduce((acc, p) => {
        if (p.cardType) {
          acc[p.cardType] = (acc[p.cardType] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const favoriteCardType = Object.entries(cardTypeCounts)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'truth';

      // Consistency score (based on frequency of engagement)
      const consistencyScore = this.calculateConsistencyScore(progress);

      return {
        totalInsights,
        totalQuestions,
        totalBookmarks,
        playbooksCompleted,
        devotionalsRead,
        weeklyGrowth,
        monthlyGrowth,
        favoriteCardType,
        consistencyScore,
      };
    } catch (error) {
      console.error('[SpiritualProgressService] Error calculating summary:', error);
      return this.getDefaultProgressSummary();
    }
  }

  /**
   * Get personalized spiritual growth insights based on progress
   */
  async getGrowthInsights(userId: string): Promise<string[]> {
    try {
      const summary = await this.getProgressSummary(userId);
      const insights: string[] = [];

      // Personalized insights based on actual usage patterns
      if (summary.totalQuestions > 10) {
        insights.push("Your curiosity and desire to learn shows a heart hungry for God's wisdom. Keep asking meaningful questions!");
      }

      if (summary.totalBookmarks > 5) {
        insights.push("You're building a beautiful collection of spiritual insights. Consider reviewing your saved insights regularly for deeper reflection.");
      }

      if (summary.consistencyScore > 0.7) {
        insights.push("Your consistent engagement with God's Word shows spiritual discipline. This regular practice is strengthening your faith!");
      }

      if (summary.weeklyGrowth > 5) {
        insights.push("This week you've been particularly active in seeking God's guidance. Your spiritual hunger is evident!");
      }

      // Add card type specific insights
      switch (summary.favoriteCardType) {
        case 'truth':
          insights.push("You gravitate toward understanding God's truth. Consider balancing this with practical action steps.");
          break;
        case 'action':
          insights.push("You're focused on practical application of faith. This action-oriented approach pleases God!");
          break;
        case 'bible':
          insights.push('Your love for Scripture is evident. Consider how these verses apply to your daily challenges.');
          break;
      }

      return insights.slice(0, 3); // Return top 3 most relevant insights
    } catch (error) {
      console.error('[SpiritualProgressService] Error generating insights:', error);
      return ['Keep growing in your faith journey. Every step forward matters to God.'];
    }
  }

  private sumMetric(progress: SpiritualProgressMetric[], metricType: string): number {
    return progress
      .filter(p => p.metricType === metricType)
      .reduce((sum, p) => sum + p.value, 0);
  }

  private calculateConsistencyScore(progress: SpiritualProgressMetric[]): number {
    if (progress.length === 0) {return 0;}

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // Get unique days with activity in last 30 days
    const activeDays = new Set(
      progress
        .filter(p => new Date(p.date) >= thirtyDaysAgo)
        .map(p => new Date(p.date).toDateString())
    );

    return Math.min(activeDays.size / 30, 1); // Max score of 1.0
  }

  private getDefaultProgressSummary(): ProgressSummary {
    return {
      totalInsights: 0,
      totalQuestions: 0,
      totalBookmarks: 0,
      playbooksCompleted: 0,
      devotionalsRead: 0,
      weeklyGrowth: 0,
      monthlyGrowth: 0,
      favoriteCardType: 'truth',
      consistencyScore: 0,
    };
  }
}

export const spiritualProgressService = new SpiritualProgressService();
