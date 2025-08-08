/**
 * AIInsights.tsx
 * AI-powered personalized recommendations and insights
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';

interface AIInsight {
  id: string;
  type: 'recommendation' | 'pattern' | 'encouragement' | 'challenge';
  title: string;
  description: string;
  actionText?: string;
  priority: 'high' | 'medium' | 'low';
  category: 'prayer' | 'study' | 'growth' | 'community';
}

interface AIInsightsProps {
  onInsightPress?: (insight: AIInsight) => void;
  onActionPress?: (insight: AIInsight) => void;
}

const AIInsights: React.FC<AIInsightsProps> = ({ onInsightPress, onActionPress }) => {
  const { user } = useAuth();
  const [insights, setInsights] = useState<AIInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentInsightIndex, setCurrentInsightIndex] = useState(0);

  const generateInsights = async () => {
    if (!user) {return;}

    try {
      setLoading(true);

      // Fetch user activity data for the last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: activities, error } = await supabase
        .from('faith_points_log')
        .select('*')
        .eq('user_id', user.id)
        .gte('created_at', thirtyDaysAgo.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching activities:', error);
        // Use fallback data when database tables don't exist
        setInsights(getFallbackInsights());
        return;
      }

      // Generate AI insights based on user patterns
      const generatedInsights = analyzeUserPatterns(activities || []);
      setInsights(generatedInsights);

    } catch (err) {
      console.error('Error generating insights:', err);
      setInsights(getFallbackInsights());
    } finally {
      setLoading(false);
    }
  };

  const analyzeUserPatterns = (activities: any[]): AIInsight[] => {
    const insights: AIInsight[] = [];

    // Analyze prayer patterns
    const prayerActivities = activities.filter(a => a.activity_type === 'prayer_log');
    if (prayerActivities.length > 0) {
      const avgPrayersPerWeek = (prayerActivities.length / 4);
      if (avgPrayersPerWeek < 3) {
        insights.push({
          id: 'prayer-consistency',
          type: 'recommendation',
          title: 'Build Prayer Consistency',
          description: 'You\'ve been praying less frequently lately. Consider setting a daily prayer reminder.',
          actionText: 'Set Prayer Reminder',
          priority: 'high',
          category: 'prayer',
        });
      } else if (avgPrayersPerWeek > 5) {
        insights.push({
          id: 'prayer-strength',
          type: 'encouragement',
          title: 'Strong Prayer Life! 🙏',
          description: 'Your consistent prayer life is inspiring. Keep nurturing this spiritual discipline.',
          priority: 'medium',
          category: 'prayer',
        });
      }
    }

    // Analyze study patterns
    const studyActivities = activities.filter(a =>
      a.activity_type === 'devotional_read' || a.activity_type === 'playbook_step'
    );
    if (studyActivities.length < 5) {
      insights.push({
        id: 'study-growth',
        type: 'challenge',
        title: 'Deepen Your Study',
        description: 'Try exploring more devotionals or playbook content to strengthen your foundation.',
        actionText: 'Browse Content',
        priority: 'medium',
        category: 'study',
      });
    }

    // Analyze journaling patterns
    const journalActivities = activities.filter(a => a.activity_type === 'journal_entry');
    if (journalActivities.length === 0) {
      insights.push({
        id: 'journaling-start',
        type: 'recommendation',
        title: 'Start Journaling',
        description: 'Journaling can help you reflect on your spiritual journey and track God\'s faithfulness.',
        actionText: 'Write First Entry',
        priority: 'medium',
        category: 'growth',
      });
    }

    // Pattern-based insights
    const recentActivities = activities.slice(0, 7);
    const morningActivities = recentActivities.filter(a => {
      const hour = new Date(a.created_at).getHours();
      return hour >= 6 && hour <= 10;
    });

    if (morningActivities.length > recentActivities.length * 0.7) {
      insights.push({
        id: 'morning-routine',
        type: 'pattern',
        title: 'Morning Warrior! 🌅',
        description: 'You\'re consistently engaging with God in the morning. This sets a strong foundation for your day.',
        priority: 'low',
        category: 'growth',
      });
    }

    // Community engagement
    insights.push({
      id: 'community-connect',
      type: 'recommendation',
      title: 'Connect with Community',
      description: 'Consider sharing your journey or joining a study group to grow alongside others.',
      actionText: 'Find Community',
      priority: 'low',
      category: 'community',
    });

    return insights.slice(0, 4); // Limit to 4 insights
  };

  const getFallbackInsights = (): AIInsight[] => [
    {
      id: 'welcome',
      type: 'encouragement',
      title: 'Welcome to Your Journey! 🌟',
      description: 'Every step you take in faith matters. Start with small, consistent actions.',
      actionText: 'Begin Today',
      priority: 'high',
      category: 'growth',
    },
    {
      id: 'prayer-start',
      type: 'recommendation',
      title: 'Start with Prayer',
      description: 'Begin each day by connecting with God through prayer, even if it\'s just for a few minutes.',
      actionText: 'Pray Now',
      priority: 'high',
      category: 'prayer',
    },
    {
      id: 'study-explore',
      type: 'challenge',
      title: 'Explore God\'s Word',
      description: 'Dive into daily devotionals or Bible study to build your spiritual foundation.',
      actionText: 'Start Reading',
      priority: 'medium',
      category: 'study',
    },
  ];

  useEffect(() => {
    generateInsights();
  }, [user]);

  useEffect(() => {
    if (insights.length > 1) {
      const interval = setInterval(() => {
        setCurrentInsightIndex((prev) => (prev + 1) % insights.length);
      }, 8000); // Change every 8 seconds

      return () => clearInterval(interval);
    }
  }, [insights.length]);

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'recommendation': return 'bulb';
      case 'pattern': return 'analytics';
      case 'encouragement': return 'heart';
      case 'challenge': return 'trophy';
      default: return 'sparkles';
    }
  };

  const getInsightColor = (category: string) => {
    switch (category) {
      case 'prayer': return Colors.faithGold;
      case 'study': return Colors.lightPurple;
      case 'growth': return Colors.successGreen;
      case 'community': return Colors.alertCoral;
      default: return Colors.alertCoral;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return Colors.alertCoral;
      case 'medium': return Colors.faithGold;
      case 'low': return Colors.successGreen;
      default: return Colors.mediumGray;
    }
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>AI Insights</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.alertCoral} />
          <Text style={styles.loadingText}>Analyzing your journey...</Text>
        </View>
      </View>
    );
  }

  if (insights.length === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="sparkles" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>AI Insights</Text>
        </View>
        <Text style={styles.emptyText}>Keep engaging to unlock personalized insights!</Text>
      </View>
    );
  }

  const currentInsight = insights[currentInsightIndex];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="sparkles" size={24} color={Colors.alertCoral} />
        <View style={styles.titleContainer}>
          <Text style={styles.title}>AI Insights</Text>
          <Text style={styles.subtitle}>Personalized for you</Text>
        </View>
        {insights.length > 1 && (
          <View style={styles.indicators}>
            {insights.map((_, index) => (
              <View
                key={index}
                style={[
                  styles.indicator,
                  index === currentInsightIndex && styles.activeIndicator,
                ]}
              />
            ))}
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[
          styles.insightCard,
          { borderLeftColor: getInsightColor(currentInsight.category) },
        ]}
        onPress={() => onInsightPress?.(currentInsight)}
        activeOpacity={0.8}
      >
        <View style={styles.insightHeader}>
          <View style={[
            styles.iconContainer,
            { backgroundColor: getInsightColor(currentInsight.category) },
          ]}>
            <Ionicons
              name={getInsightIcon(currentInsight.type) as any}
              size={20}
              color={Colors.hopeWhite}
            />
          </View>
          <View style={styles.insightInfo}>
            <Text style={styles.insightTitle}>{currentInsight.title}</Text>
            <View style={styles.metaInfo}>
              <View style={[
                styles.priorityBadge,
                { backgroundColor: getPriorityColor(currentInsight.priority) },
              ]}>
                <Text style={styles.priorityText}>
                  {currentInsight.priority.toUpperCase()}
                </Text>
              </View>
              <Text style={styles.categoryText}>{currentInsight.category}</Text>
            </View>
          </View>
        </View>

        <Text style={styles.insightDescription}>{currentInsight.description}</Text>

        {currentInsight.actionText && (
          <TouchableOpacity
            style={[
              styles.actionButton,
              { backgroundColor: getInsightColor(currentInsight.category) },
            ]}
            onPress={() => onActionPress?.(currentInsight)}
          >
            <Text style={styles.actionButtonText}>{currentInsight.actionText}</Text>
            <Ionicons name="arrow-forward" size={16} color={Colors.hopeWhite} />
          </TouchableOpacity>
        )}
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
    marginBottom: 16,
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
  subtitle: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 2,
  },
  indicators: {
    flexDirection: 'row',
    gap: 4,
  },
  indicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  activeIndicator: {
    backgroundColor: Colors.alertCoral,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  emptyText: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  insightCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  iconContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  insightInfo: {
    flex: 1,
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 4,
  },
  metaInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  categoryText: {
    fontSize: 11,
    color: Colors.mediumGray,
    textTransform: 'capitalize',
  },
  insightDescription: {
    fontSize: 14,
    color: Colors.lightGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    gap: 8,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
});

export default AIInsights;
