/**
 * Progress Report Generator
 * Provides detailed tabulation and percentage completion for faith points system
 */

import { faithPointsService } from '../services/faithPointsService';
import { Logger } from '../utils/ProductionLogger';
import { supabase } from '../services/supabaseClient';

interface ProgressMetrics {
  totalPoints: number;
  currentLevel: number;
  currentStreak: number;
  weeklyProgress: number;
  weeklyGoal: number;
  activitiesCompleted: number;
  devotionalsCompleted: number;
  playbooksCompleted: number;
  journalEntriesCompleted: number;
  streakActivities: number;
  badgesEarned: number;
}

interface ProgressReport {
  userId: string;
  reportDate: string;
  metrics: ProgressMetrics;
  percentages: {
    weeklyGoalCompletion: number;
    levelProgress: number;
    streakMaintenance: number;
    overallEngagement: number;
  };
  tabulation: {
    pointsByActivity: Array<{ activity: string; points: number; count: number }>;
    recentAchievements: Array<{ date: string; activity: string; points: number }>;
    weeklyBreakdown: Array<{ day: string; points: number; activities: number }>;
  };
  recommendations: string[];
}

export const generateProgressReport = async (userId: string): Promise<ProgressReport> => {

  try {
    // Get user profile
    const profile = await faithPointsService.getUserProfile(userId);

    // Get recent transactions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: transactions } = await supabase
      .from('faith_points_log')
      .select('*')
      .eq('user_id', userId)
      .gte('created_at', thirtyDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    // Get activity counts by type
    const activityCounts = await getActivityCounts(userId);

    // Calculate metrics
    const metrics: ProgressMetrics = {
      totalPoints: profile.totalPoints,
      currentLevel: profile.currentLevel,
      currentStreak: profile.currentStreak,
      weeklyProgress: profile.weeklyProgress || 0,
      weeklyGoal: profile.weeklyGoal || 7,
      activitiesCompleted: transactions?.length || 0,
      devotionalsCompleted: activityCounts.devotionals,
      playbooksCompleted: activityCounts.playbooks,
      journalEntriesCompleted: activityCounts.journal,
      streakActivities: activityCounts.streak,
      badgesEarned: 0, // TODO: Implement badge counting
    };

    // Calculate percentages
    const percentages = {
      weeklyGoalCompletion: Math.round((metrics.weeklyProgress / metrics.weeklyGoal) * 100),
      levelProgress: calculateLevelProgress(metrics.currentLevel, metrics.totalPoints),
      streakMaintenance: Math.min(100, (metrics.currentStreak / 7) * 100),
      overallEngagement: calculateOverallEngagement(metrics),
    };

    // Generate tabulation
    const tabulation = {
      pointsByActivity: generatePointsByActivity(transactions || []),
      recentAchievements: generateRecentAchievements(transactions || []),
      weeklyBreakdown: generateWeeklyBreakdown(transactions || []),
    };

    // Generate recommendations
    const recommendations = generateRecommendations(metrics, percentages);

    const report: ProgressReport = {
      userId,
      reportDate: new Date().toISOString(),
      metrics,
      percentages,
      tabulation,
      recommendations,
    };

    return report;

  } catch (error) {
    Logger.error(' Failed to generate progress report', error as Error, { component: 'progressReport' });
    throw error;
  }
};

const getActivityCounts = async (userId: string) => {
  const { data: transactions } = await supabase
    .from('faith_points_log')
    .select('activity_type')
    .eq('user_id', userId);

  const counts = {
    devotionals: 0,
    playbooks: 0,
    journal: 0,
    streak: 0,
  };

  transactions?.forEach((t: any) => {
    if (t.activity_type?.includes('devotional')) {counts.devotionals++;}
    if (t.activity_type?.includes('playbook')) {counts.playbooks++;}
    if (t.activity_type?.includes('journal')) {counts.journal++;}
    if (t.activity_type?.includes('streak')) {counts.streak++;}
  });

  return counts;
};

const calculateLevelProgress = (currentLevel: number, totalPoints: number): number => {
  // Assuming each level requires 100 points more than the previous
  const pointsForCurrentLevel = currentLevel * 100;
  const pointsForNextLevel = (currentLevel + 1) * 100;
  const progressInLevel = totalPoints - pointsForCurrentLevel;
  const pointsNeededForLevel = pointsForNextLevel - pointsForCurrentLevel;

  return Math.round((progressInLevel / pointsNeededForLevel) * 100);
};

const calculateOverallEngagement = (metrics: ProgressMetrics): number => {
  const factors = [
    metrics.weeklyProgress / metrics.weeklyGoal * 25, // 25% weight
    Math.min(metrics.currentStreak / 7, 1) * 25, // 25% weight
    Math.min(metrics.devotionalsCompleted / 5, 1) * 25, // 25% weight
    Math.min(metrics.activitiesCompleted / 10, 1) * 25, // 25% weight
  ];

  return Math.round(factors.reduce((sum, factor) => sum + factor, 0));
};

const generatePointsByActivity = (transactions: any[]) => {
  const activityMap = new Map();

  transactions.forEach(t => {
    const activity = t.activity_type || 'Unknown';
    if (!activityMap.has(activity)) {
      activityMap.set(activity, { points: 0, count: 0 });
    }
    const current = activityMap.get(activity);
    current.points += t.points || 0;
    current.count += 1;
  });

  return Array.from(activityMap.entries()).map(([activity, data]) => ({
    activity,
    points: data.points,
    count: data.count,
  })).sort((a, b) => b.points - a.points);
};

const generateRecentAchievements = (transactions: any[]) => {
  return transactions
    .slice(0, 10)
    .map(t => ({
      date: new Date(t.created_at).toLocaleDateString(),
      activity: t.activity_type || 'Activity',
      points: t.points || 0,
    }));
};

const generateWeeklyBreakdown = (transactions: any[]) => {
  const weekDays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const breakdown = weekDays.map(day => ({ day, points: 0, activities: 0 }));

  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  transactions
    .filter(t => new Date(t.created_at) >= oneWeekAgo)
    .forEach(t => {
      // Use raw getDay() for now - this maintains existing behavior
      // TODO: Consider user's week start preference for future enhancement
      const dayIndex = new Date(t.created_at).getDay();
      breakdown[dayIndex].points += t.points || 0;
      breakdown[dayIndex].activities += 1;
    });

  return breakdown;
};

const generateRecommendations = (metrics: ProgressMetrics, percentages: any): string[] => {
  const recommendations = [];

  if (percentages.weeklyGoalCompletion < 50) {
    recommendations.push('Focus on completing more daily activities to reach your weekly goal');
  }

  if (metrics.currentStreak < 3) {
    recommendations.push('Build consistency by completing at least one activity daily');
  }

  if (metrics.devotionalsCompleted < 3) {
    recommendations.push('Try reading more devotionals to deepen your spiritual growth');
  }

  if (percentages.overallEngagement < 60) {
    recommendations.push('Increase engagement by exploring different types of spiritual activities');
  }

  if (recommendations.length === 0) {
    recommendations.push('Great job! Keep up the excellent spiritual progress');
  }

  return recommendations;
};

export const printProgressReport = (report: ProgressReport) => {

  report.tabulation.pointsByActivity.forEach(() => {

  });

  report.tabulation.recentAchievements.slice(0, 5).forEach(() => {

  });

  report.tabulation.weeklyBreakdown.forEach(() => {

  });

  report.recommendations.forEach(() => {

  });

};
