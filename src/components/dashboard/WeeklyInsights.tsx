/**
 * WeeklyInsights.tsx
 * Shows weekly spiritual growth insights and analytics
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';

const { width } = Dimensions.get('window');

interface WeeklyInsight {
  metric: string;
  value: number;
  change: number;
  trend: 'up' | 'down' | 'stable';
  icon: string;
  color: string;
}

interface WeeklyInsightsProps {
  onInsightPress?: (insight: WeeklyInsight) => void;
}



const WeeklyInsights: React.FC<WeeklyInsightsProps> = ({ onInsightPress }) => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<WeeklyInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [weekRange, setWeekRange] = useState('');

  const fetchWeeklyInsights = async () => {
    if (!user) {return;}

    try {
      setLoading(true);

      // Calculate current week and previous week dates
      const now = new Date();
      const currentWeekStart = new Date(now);
      currentWeekStart.setDate(now.getDate() - now.getDay());
      currentWeekStart.setHours(0, 0, 0, 0);

      const currentWeekEnd = new Date(currentWeekStart);
      currentWeekEnd.setDate(currentWeekStart.getDate() + 6);
      currentWeekEnd.setHours(23, 59, 59, 999);

      const previousWeekStart = new Date(currentWeekStart);
      previousWeekStart.setDate(currentWeekStart.getDate() - 7);

      const previousWeekEnd = new Date(currentWeekStart);
      previousWeekEnd.setDate(currentWeekStart.getDate() - 1);

      // Set week range display
      setWeekRange(`${currentWeekStart.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })} - ${currentWeekEnd.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      })}`);

      // Fetch current week activities
      console.log('[WeeklyInsights] Fetching data for user:', user.id);
      console.log('[WeeklyInsights] Current week:', currentWeekStart.toISOString(), 'to', currentWeekEnd.toISOString());
      console.log('[WeeklyInsights] Previous week:', previousWeekStart.toISOString(), 'to', previousWeekEnd.toISOString());

      const { data: currentData, error: currentError } = await supabase
        .from('faith_points_log')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', currentWeekStart.toISOString())
        .lte('created_at', currentWeekEnd.toISOString());

      if (currentError) {
        console.error('[WeeklyInsights] Error fetching current week data:', currentError);
        return;
      }

      console.log('[WeeklyInsights] Current week activities:', currentData?.length || 0);
      console.log('[WeeklyInsights] Current week data:', currentData);

      // Fetch previous week activities
      const { data: previousWeekData, error: previousError } = await supabase
        .from('faith_points_log')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', previousWeekStart.toISOString())
        .lte('created_at', previousWeekEnd.toISOString());

      if (previousError) {
        console.error('[WeeklyInsights] Error fetching previous week data:', previousError);
        return;
      }

      console.log('[WeeklyInsights] Previous week activities:', previousWeekData?.length || 0);

      // Calculate insights
      const calculatedInsights = calculateInsights(
        currentData || [],
        previousWeekData || []
      );
      setInsights(calculatedInsights);

    } catch (err) {
      console.error('Error fetching weekly insights:', err);
    } finally {
      setLoading(false);
    }
  };

  const calculateInsights = (currentWeek: any[], previousWeek: any[]): WeeklyInsight[] => {
    const insights: WeeklyInsight[] = [];

    // Prayer sessions (using daily_streak as proxy)
    const currentPrayers = currentWeek.filter(a => a.activity_type === 'daily_streak').length;
    const previousPrayers = previousWeek.filter(a => a.activity_type === 'daily_streak').length;
    const prayerChange = previousPrayers > 0 ?
      ((currentPrayers - previousPrayers) / previousPrayers) * 100 :
      currentPrayers > 0 ? 100 : 0;

    insights.push({
      metric: 'Prayer Sessions',
      value: currentPrayers,
      change: Math.round(prayerChange),
      trend: prayerChange > 5 ? 'up' : prayerChange < -5 ? 'down' : 'stable',
      icon: 'heart',
      color: Colors.faithGold,
    });

    // Devotionals generated
    const currentDevotionals = currentWeek.filter(a => a.activity_type === 'devotional_generated').length;
    const previousDevotionals = previousWeek.filter(a => a.activity_type === 'devotional_generated').length;
    const devotionalChange = previousDevotionals > 0 ?
      ((currentDevotionals - previousDevotionals) / previousDevotionals) * 100 :
      currentDevotionals > 0 ? 100 : 0;

    insights.push({
      metric: 'Devotionals',
      value: currentDevotionals,
      change: Math.round(devotionalChange),
      trend: devotionalChange > 5 ? 'up' : devotionalChange < -5 ? 'down' : 'stable',
      icon: 'book',
      color: Colors.lightPurple,
    });

    // Journal entries
    const currentJournals = currentWeek.filter(a => a.activity_type === 'journal_entry').length;
    const previousJournals = previousWeek.filter(a => a.activity_type === 'journal_entry').length;
    const journalChange = previousJournals > 0 ?
      ((currentJournals - previousJournals) / previousJournals) * 100 :
      currentJournals > 0 ? 100 : 0;

    insights.push({
      metric: 'Journal Entries',
      value: currentJournals,
      change: Math.round(journalChange),
      trend: journalChange > 5 ? 'up' : journalChange < -5 ? 'down' : 'stable',
      icon: 'journal',
      color: Colors.alertCoral,
    });

    // Playbook steps completed
    const currentPlaybookSteps = currentWeek.filter(a => a.activity_type === 'action_step_completed').length;
    const previousPlaybookSteps = previousWeek.filter(a => a.activity_type === 'action_step_completed').length;
    const playbookChange = previousPlaybookSteps > 0 ?
      ((currentPlaybookSteps - previousPlaybookSteps) / previousPlaybookSteps) * 100 :
      currentPlaybookSteps > 0 ? 100 : 0;

    insights.push({
      metric: 'Playbook Steps',
      value: currentPlaybookSteps,
      change: Math.round(playbookChange),
      trend: playbookChange > 5 ? 'up' : playbookChange < -5 ? 'down' : 'stable',
      icon: 'library',
      color: Colors.playbookBlue,
    });

    return insights;
  };

  useEffect(() => {
    fetchWeeklyInsights();
  }, [user]);

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return 'trending-up';
      case 'down': return 'trending-down';
      default: return 'remove';
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'up': return Colors.successGreen;
      case 'down': return Colors.alertCoral;
      default: return Colors.mediumGray;
    }
  };

  const renderInsightCard = (insight: WeeklyInsight, index: number) => (
    <TouchableOpacity
      key={insight.metric}
      style={[
        styles.insightCard,
        { width: (width - 64) / 2 }, // 2 cards per row with margins
        index % 2 === 1 && styles.rightCard,
      ]}
      onPress={() => onInsightPress?.(insight)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={[styles.iconContainer, { backgroundColor: insight.color }]}>
          <Ionicons name={insight.icon as any} size={18} color={Colors.hopeWhite} />
        </View>
        <View style={[styles.trendContainer, { backgroundColor: getTrendColor(insight.trend) }]}>
          <Ionicons
            name={getTrendIcon(insight.trend) as any}
            size={12}
            color={Colors.hopeWhite}
          />
        </View>
      </View>

      <Text style={styles.metricValue}>{insight.value}</Text>
      <Text style={styles.metricLabel}>{insight.metric}</Text>

      <View style={styles.changeContainer}>
        <Text style={[styles.changeText, { color: getTrendColor(insight.trend) }]}>
          {insight.change > 0 ? '+' : ''}{insight.change}%
        </Text>
        <Text style={styles.changeLabel}>vs last week</Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="analytics" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Weekly Insights</Text>
        </View>
        <Text style={styles.loadingText}>Analyzing your week...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="analytics" size={24} color={Colors.alertCoral} />
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Weekly Insights</Text>
          <Text style={styles.weekRange}>{weekRange}</Text>
        </View>
      </View>

      <View style={styles.insightsGrid}>
        {insights.map(renderInsightCard)}
      </View>

      <TouchableOpacity style={styles.viewAllButton} activeOpacity={0.8}>
        <Text style={styles.viewAllText}>View Detailed Analytics</Text>
        <Ionicons name="chevron-forward" size={16} color={Colors.alertCoral} />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  weekRange: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 2,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  insightsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -6,
  },
  insightCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    marginHorizontal: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  rightCard: {
    marginLeft: 6,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  trendContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  metricLabel: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginBottom: 8,
  },
  changeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  changeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  changeLabel: {
    fontSize: 10,
    color: Colors.lightGray,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.alertCoral,
  },
});

export default WeeklyInsights;
