import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Typography } from '../constants';
import { progressTrackingService, SpiritualProgressData, WeeklyProgressSummary, SpiritualGrowthInsight } from '../services/progressTrackingService';

const { width } = Dimensions.get('window');

interface ProgressTrackingDashboardProps {
  userId: string;
  onClose: () => void;
}

export const ProgressTrackingDashboard: React.FC<ProgressTrackingDashboardProps> = ({
  userId,
  onClose,
}) => {
  const [progressData, setProgressData] = useState<SpiritualProgressData | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgressSummary | null>(null);
  const [insights, setInsights] = useState<SpiritualGrowthInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'weekly' | 'insights'>('overview');

  const loadProgressData = useCallback(async () => {
    try {
      setLoading(true);

      const [progress, weekly, growthInsights] = await Promise.all([
        progressTrackingService.getUserProgress(userId),
        progressTrackingService.getWeeklyProgressSummary(userId),
        progressTrackingService.generateGrowthInsights(userId),
      ]);

      setProgressData(progress);
      setWeeklyProgress(weekly);
      setInsights(growthInsights);
    } catch (error) {
      console.error('Error loading progress data:', error);
      Alert.alert('Error', 'Failed to load progress data. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadProgressData();
  }, [loadProgressData]);

  const handleSetWeeklyGoal = () => {
    Alert.prompt(
      'Set Weekly Goal',
      'How many action steps would you like to complete this week?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Set Goal',
          onPress: async (value) => {
            const goal = parseInt(value || '3', 10);
            if (goal > 0 && goal <= 50) {
              try {
                await progressTrackingService.setWeeklyGoal(userId, goal);
                await loadProgressData();
              } catch (error) {
                Alert.alert('Error', 'Failed to set weekly goal');
              }
            }
          },
        },
      ],
      'plain-text',
      progressData?.weeklyGoal.toString() || '3'
    );
  };

  const renderOverviewTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {/* Current Streak Card */}
      <View style={styles.streakCard}>
        <View style={styles.streakHeader}>
          <Ionicons name="flame" size={24} color={Colors.faithGold} />
          <Text style={styles.streakTitle}>Current Streak</Text>
        </View>
        <Text style={styles.streakNumber}>{progressData?.currentStreak || 0}</Text>
        <Text style={styles.streakSubtext}>
          {progressData?.currentStreak === 1 ? 'day' : 'days'} of consistent growth
        </Text>
        <Text style={styles.streakRecord}>
          Personal best: {progressData?.longestStreak || 0} days
        </Text>
      </View>

      {/* Progress Stats Grid */}
      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Ionicons name="book" size={20} color={Colors.faithGold} />
          <Text style={styles.statNumber}>{progressData?.totalPlaybooksCompleted || 0}</Text>
          <Text style={styles.statLabel}>Playbooks Completed</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="checkmark-circle" size={20} color={Colors.faithGold} />
          <Text style={styles.statNumber}>{progressData?.totalActionStepsCompleted || 0}</Text>
          <Text style={styles.statLabel}>Action Steps</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="help-circle" size={20} color={Colors.faithGold} />
          <Text style={styles.statNumber}>{progressData?.totalQuestionsAsked || 0}</Text>
          <Text style={styles.statLabel}>Questions Asked</Text>
        </View>

        <View style={styles.statCard}>
          <Ionicons name="bulb" size={20} color={Colors.faithGold} />
          <Text style={styles.statNumber}>{progressData?.totalInsightsReceived || 0}</Text>
          <Text style={styles.statLabel}>Insights Received</Text>
        </View>
      </View>

      {/* Spiritual Maturity Level */}
      <View style={styles.maturityCard}>
        <Text style={styles.maturityTitle}>Spiritual Maturity Level</Text>
        <View style={styles.maturityLevel}>
          <Text style={styles.maturityLevelText}>
            {progressData?.spiritualMaturityLevel?.charAt(0).toUpperCase() +
             progressData?.spiritualMaturityLevel?.slice(1) || 'Beginner'}
          </Text>
          <Ionicons name="trending-up" size={16} color={Colors.faithGold} />
        </View>
        <Text style={styles.maturityDescription}>
          {getMaturityDescription(progressData?.spiritualMaturityLevel || 'beginner')}
        </Text>
      </View>

      {/* Weekly Goal Progress */}
      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalTitle}>This Week's Goal</Text>
          <TouchableOpacity onPress={handleSetWeeklyGoal} style={styles.editGoalButton}>
            <Ionicons name="pencil" size={16} color={Colors.faithGold} />
          </TouchableOpacity>
        </View>

        <View style={styles.goalProgress}>
          <Text style={styles.goalNumbers}>
            {progressData?.weeklyProgress || 0} / {progressData?.weeklyGoal || 3}
          </Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${Math.min(100, ((progressData?.weeklyProgress || 0) / (progressData?.weeklyGoal || 3)) * 100)}%`,
                },
              ]}
            />
          </View>
        </View>

        {(progressData?.weeklyProgress || 0) >= (progressData?.weeklyGoal || 3) && (
          <Text style={styles.goalAchieved}>🎉 Goal achieved this week!</Text>
        )}
      </View>
    </ScrollView>
  );

  const renderWeeklyTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {weeklyProgress && (
        <>
          {/* Weekly Summary */}
          <View style={styles.weeklyCard}>
            <Text style={styles.weeklyTitle}>This Week's Summary</Text>

            <View style={styles.weeklyStats}>
              <View style={styles.weeklyStat}>
                <Text style={styles.weeklyStatNumber}>{weeklyProgress.actionStepsCompleted}</Text>
                <Text style={styles.weeklyStatLabel}>Action Steps</Text>
              </View>
              <View style={styles.weeklyStat}>
                <Text style={styles.weeklyStatNumber}>{weeklyProgress.playbooksCompleted}</Text>
                <Text style={styles.weeklyStatLabel}>Playbooks</Text>
              </View>
              <View style={styles.weeklyStat}>
                <Text style={styles.weeklyStatNumber}>{weeklyProgress.questionsAsked}</Text>
                <Text style={styles.weeklyStatLabel}>Questions</Text>
              </View>
            </View>

            <View style={[styles.goalStatus, weeklyProgress.goalMet && styles.goalMet]}>
              <Ionicons
                name={weeklyProgress.goalMet ? 'checkmark-circle' : 'time'}
                size={16}
                color={weeklyProgress.goalMet ? Colors.faithGold : Colors.hopeWhite}
              />
              <Text style={styles.goalStatusText}>
                {weeklyProgress.goalMet ? 'Weekly goal achieved!' : 'Working toward weekly goal'}
              </Text>
            </View>
          </View>

          {/* Highlights */}
          {weeklyProgress.highlights.length > 0 && (
            <View style={styles.highlightsCard}>
              <Text style={styles.highlightsTitle}>✨ This Week's Highlights</Text>
              {weeklyProgress.highlights.map((highlight, index) => (
                <Text key={index} style={styles.highlightItem}>{highlight}</Text>
              ))}
            </View>
          )}

          {/* Growth Areas */}
          {weeklyProgress.areasForGrowth.length > 0 && (
            <View style={styles.growthAreasCard}>
              <Text style={styles.growthAreasTitle}>🌱 Areas for Growth</Text>
              {weeklyProgress.areasForGrowth.map((area, index) => (
                <Text key={index} style={styles.growthAreaItem}>{area}</Text>
              ))}
            </View>
          )}

          {/* Encouragement */}
          <View style={styles.encouragementCard}>
            <Text style={styles.encouragementText}>{weeklyProgress.encouragement}</Text>
          </View>
        </>
      )}
    </ScrollView>
  );

  const renderInsightsTab = () => (
    <ScrollView style={styles.tabContent} showsVerticalScrollIndicator={false}>
      {insights.length > 0 ? (
        insights.map((insight) => (
          <View key={insight.id} style={[styles.insightCard, getInsightCardStyle(insight.type)]}>
            <View style={styles.insightHeader}>
              <Ionicons
                name={getInsightIcon(insight.type)}
                size={20}
                color={getInsightColor(insight.type)}
              />
              <Text style={styles.insightTitle}>{insight.title}</Text>
            </View>

            <Text style={styles.insightDescription}>{insight.description}</Text>

            {insight.actionable && insight.suggestedAction && (
              <View style={styles.suggestedAction}>
                <Text style={styles.suggestedActionLabel}>💡 Try this:</Text>
                <Text style={styles.suggestedActionText}>{insight.suggestedAction}</Text>
              </View>
            )}
          </View>
        ))
      ) : (
        <View style={styles.noInsightsCard}>
          <Ionicons name="bulb-outline" size={48} color={Colors.hopeWhite} />
          <Text style={styles.noInsightsTitle}>Keep Growing!</Text>
          <Text style={styles.noInsightsText}>
            Continue your spiritual journey to unlock personalized insights and recommendations.
          </Text>
        </View>
      )}
    </ScrollView>
  );

  const getMaturityDescription = (level: string): string => {
    const descriptions = {
      beginner: "You're just starting your journey. Every step counts!",
      growing: "You're building momentum in your faith walk. Keep going!",
      mature: "You're developing deep spiritual habits. Well done!",
      advanced: "You're a seasoned spiritual traveler. Your dedication inspires!",
    };
    return descriptions[level as keyof typeof descriptions] || descriptions.beginner;
  };

  const getInsightIcon = (type: SpiritualGrowthInsight['type']): string => {
    const icons = {
      strength: 'trophy',
      growth_area: 'trending-up',
      recommendation: 'bulb',
      celebration: 'star',
    };
    return icons[type] || 'information-circle';
  };

  const getInsightColor = (type: SpiritualGrowthInsight['type']): string => {
    const colors = {
      strength: Colors.faithGold,
      growth_area: '#4ECDC4',
      recommendation: '#45B7D1',
      celebration: '#F39C12',
    };
    return colors[type] || Colors.hopeWhite;
  };

  const getInsightCardStyle = (type: SpiritualGrowthInsight['type']) => {
    const styles = {
      strength: { borderLeftColor: Colors.faithGold },
      growth_area: { borderLeftColor: '#4ECDC4' },
      recommendation: { borderLeftColor: '#45B7D1' },
      celebration: { borderLeftColor: '#F39C12' },
    };
    return styles[type] || {};
  };

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Progress Dashboard</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color={Colors.hopeWhite} />
          </TouchableOpacity>
        </View>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Loading your progress...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Progress Dashboard</Text>
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <Ionicons name="close" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'overview' && styles.activeTab]}
          onPress={() => setActiveTab('overview')}
        >
          <Text style={[styles.tabText, activeTab === 'overview' && styles.activeTabText]}>
            Overview
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'weekly' && styles.activeTab]}
          onPress={() => setActiveTab('weekly')}
        >
          <Text style={[styles.tabText, activeTab === 'weekly' && styles.activeTabText]}>
            This Week
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tab, activeTab === 'insights' && styles.activeTab]}
          onPress={() => setActiveTab('insights')}
        >
          <Text style={[styles.tabText, activeTab === 'insights' && styles.activeTabText]}>
            Insights
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tab Content */}
      {activeTab === 'overview' && renderOverviewTab()}
      {activeTab === 'weekly' && renderWeeklyTab()}
      {activeTab === 'insights' && renderInsightsTab()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.deepNavy,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  headerTitle: {
    ...Typography.interSemiBold,
    fontSize: 20,
    color: Colors.hopeWhite,
  },
  closeButton: {
    padding: 4,
  },
  tabNavigation: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  tabText: {
    ...Typography.interMedium,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  activeTabText: {
    color: Colors.faithGold,
  },
  tabContent: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.interRegular,
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  streakCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  streakTitle: {
    ...Typography.interMedium,
    fontSize: 16,
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  streakNumber: {
    ...Typography.interBold,
    fontSize: 48,
    color: Colors.faithGold,
    marginBottom: 4,
  },
  streakSubtext: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  streakRecord: {
    ...Typography.interRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.5)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    width: (width - 52) / 2, // Account for padding and gap
  },
  statNumber: {
    ...Typography.interBold,
    fontSize: 24,
    color: Colors.hopeWhite,
    marginTop: 8,
    marginBottom: 4,
  },
  statLabel: {
    ...Typography.interRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
  },
  maturityCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  maturityTitle: {
    ...Typography.interMedium,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 8,
  },
  maturityLevel: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  maturityLevelText: {
    ...Typography.interSemiBold,
    fontSize: 18,
    color: Colors.faithGold,
    marginRight: 8,
  },
  maturityDescription: {
    ...Typography.interRegular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    lineHeight: 18,
  },
  goalCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  goalTitle: {
    ...Typography.interMedium,
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  editGoalButton: {
    padding: 4,
  },
  goalProgress: {
    marginBottom: 12,
  },
  goalNumbers: {
    ...Typography.interBold,
    fontSize: 20,
    color: Colors.faithGold,
    marginBottom: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.faithGold,
    borderRadius: 4,
  },
  goalAchieved: {
    ...Typography.interMedium,
    fontSize: 14,
    color: Colors.faithGold,
    textAlign: 'center',
  },
  weeklyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  weeklyTitle: {
    ...Typography.interSemiBold,
    fontSize: 18,
    color: Colors.hopeWhite,
    marginBottom: 16,
  },
  weeklyStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  weeklyStat: {
    alignItems: 'center',
  },
  weeklyStatNumber: {
    ...Typography.interBold,
    fontSize: 24,
    color: Colors.faithGold,
  },
  weeklyStatLabel: {
    ...Typography.interRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 4,
  },
  goalStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  goalMet: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
  },
  goalStatusText: {
    ...Typography.interMedium,
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  highlightsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  highlightsTitle: {
    ...Typography.interSemiBold,
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  highlightItem: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    marginBottom: 8,
  },
  growthAreasCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  growthAreasTitle: {
    ...Typography.interSemiBold,
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  growthAreaItem: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    marginBottom: 8,
  },
  encouragementCard: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  encouragementText: {
    ...Typography.interMedium,
    fontSize: 15,
    color: Colors.hopeWhite,
    lineHeight: 22,
    textAlign: 'center',
  },
  insightCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderLeftWidth: 4,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  insightTitle: {
    ...Typography.interSemiBold,
    fontSize: 16,
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  insightDescription: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
    marginBottom: 12,
  },
  suggestedAction: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
  },
  suggestedActionLabel: {
    ...Typography.interMedium,
    fontSize: 13,
    color: Colors.faithGold,
    marginBottom: 4,
  },
  suggestedActionText: {
    ...Typography.interRegular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 18,
  },
  noInsightsCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    marginBottom: 20,
  },
  noInsightsTitle: {
    ...Typography.interSemiBold,
    fontSize: 18,
    color: Colors.hopeWhite,
    marginTop: 16,
    marginBottom: 8,
  },
  noInsightsText: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
