import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { spiritualProgressService, ProgressSummary } from '../services/spiritualProgressService';

interface SpiritualProgressScreenProps {
  navigation: any;
  user: { id: string };
}

export const SpiritualProgressScreen: React.FC<SpiritualProgressScreenProps> = ({
  navigation,
  user,
}) => {
  const [progressSummary, setProgressSummary] = useState<ProgressSummary | null>(null);
  const [growthInsights, setGrowthInsights] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadProgressData();
  }, []);

  const loadProgressData = async () => {
    if (!user?.id) {return;}

    try {
      setLoading(true);
      const [summary, insights] = await Promise.all([
        spiritualProgressService.getProgressSummary(user.id),
        spiritualProgressService.getGrowthInsights(user.id),
      ]);

      setProgressSummary(summary);
      setGrowthInsights(insights);
    } catch (error) {
      console.error('[SpiritualProgressScreen] Error loading progress:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadProgressData();
    setRefreshing(false);
  };

  const getConsistencyMessage = (score: number): string => {
    if (score >= 0.8) {return 'Excellent consistency! Your daily walk with God is strong.';}
    if (score >= 0.6) {return 'Good consistency! Keep building your spiritual habits.';}
    if (score >= 0.4) {return 'Growing consistency! Small steps lead to big changes.';}
    return 'Every step matters in your faith journey. Start small, stay consistent.';
  };

  const getConsistencyColor = (score: number): string => {
    if (score >= 0.8) {return '#4CAF50';}
    if (score >= 0.6) {return Colors.faithGold;}
    if (score >= 0.4) {return '#FF9800';}
    return '#FF5722';
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.faithGold} />
          <Text style={styles.loadingText}>Loading your spiritual growth...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={24} color={Colors.hopeWhite} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Spiritual Growth</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.faithGold}
          />
        }
      >
        {progressSummary && (
          <>
            {/* Growth Insights */}
            {growthInsights.length > 0 && (
              <View style={styles.insightsContainer}>
                <Text style={styles.sectionTitle}>Personal Growth Insights</Text>
                {growthInsights.map((insight, index) => (
                  <View key={index} style={styles.insightCard}>
                    <Icon name="bulb" size={16} color={Colors.faithGold} />
                    <Text style={styles.insightText}>{insight}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Consistency Score */}
            <View style={styles.consistencyContainer}>
              <Text style={styles.sectionTitle}>Faith Consistency</Text>
              <View style={styles.consistencyCard}>
                <View style={styles.consistencyHeader}>
                  <Icon name="calendar" size={20} color={getConsistencyColor(progressSummary.consistencyScore)} />
                  <Text style={styles.consistencyScore}>
                    {Math.round(progressSummary.consistencyScore * 100)}%
                  </Text>
                </View>
                <Text style={styles.consistencyMessage}>
                  {getConsistencyMessage(progressSummary.consistencyScore)}
                </Text>
              </View>
            </View>

            {/* Activity Metrics */}
            <View style={styles.metricsContainer}>
              <Text style={styles.sectionTitle}>Your Christian Coaching Journey</Text>

              <View style={styles.metricsGrid}>
                <View style={styles.metricCard}>
                  <Icon name="bulb-outline" size={24} color={Colors.faithGold} />
                  <Text style={styles.metricNumber}>{progressSummary.totalInsights}</Text>
                  <Text style={styles.metricLabel}>AI Insights</Text>
                </View>

                <View style={styles.metricCard}>
                  <Icon name="help-circle-outline" size={24} color="#4CAF50" />
                  <Text style={styles.metricNumber}>{progressSummary.totalQuestions}</Text>
                  <Text style={styles.metricLabel}>Questions Asked</Text>
                </View>

                <View style={styles.metricCard}>
                  <Icon name="bookmark-outline" size={24} color="#E91E63" />
                  <Text style={styles.metricNumber}>{progressSummary.totalBookmarks}</Text>
                  <Text style={styles.metricLabel}>Insights Saved</Text>
                </View>

                <View style={styles.metricCard}>
                  <Icon name="checkmark-circle-outline" size={24} color="#9C27B0" />
                  <Text style={styles.metricNumber}>{progressSummary.playbooksCompleted}</Text>
                  <Text style={styles.metricLabel}>Playbooks</Text>
                </View>
              </View>
            </View>

            {/* Recent Activity */}
            <View style={styles.activityContainer}>
              <Text style={styles.sectionTitle}>Recent Activity</Text>
              <View style={styles.activityCard}>
                <View style={styles.activityRow}>
                  <Icon name="trending-up" size={16} color={Colors.faithGold} />
                  <Text style={styles.activityText}>
                    {progressSummary.weeklyGrowth} spiritual interactions this week
                  </Text>
                </View>
                <View style={styles.activityRow}>
                  <Icon name="heart" size={16} color="#E91E63" />
                  <Text style={styles.activityText}>
                    Your favorite content: {progressSummary.favoriteCardType} cards
                  </Text>
                </View>
                <View style={styles.activityRow}>
                  <Icon name="calendar" size={16} color="#4CAF50" />
                  <Text style={styles.activityText}>
                    {progressSummary.monthlyGrowth} total interactions this month
                  </Text>
                </View>
              </View>
            </View>

            {/* Encouragement */}
            <View style={styles.encouragementContainer}>
              <Text style={styles.encouragementTitle}>Keep Growing!</Text>
              <Text style={styles.encouragementText}>
                "But grow in the grace and knowledge of our Lord and Savior Jesus Christ.
                To him be glory both now and forever! Amen." - 2 Peter 3:18
              </Text>
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.darkBackground,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  loadingText: {
    ...Typography.interRegular,
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 16,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  headerTitle: {
    ...Typography.interSemiBold,
    fontSize: 18,
    color: Colors.hopeWhite,
    flex: 1,
    textAlign: 'center' as const,
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  sectionTitle: {
    ...Typography.interSemiBold,
    fontSize: 16,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  insightsContainer: {
    padding: 20,
  },
  insightCard: {
    flexDirection: 'row' as const,
    alignItems: 'flex-start' as const,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  insightText: {
    ...Typography.interRegular,
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
    marginLeft: 12,
    flex: 1,
  },
  consistencyContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  consistencyCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  consistencyHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  consistencyScore: {
    ...Typography.interBold,
    fontSize: 24,
    color: Colors.faithGold,
    marginLeft: 12,
  },
  consistencyMessage: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 20,
  },
  metricsContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  metricsGrid: {
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
    justifyContent: 'space-between' as const,
  },
  metricCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    width: '48%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  metricNumber: {
    ...Typography.interBold,
    fontSize: 20,
    color: Colors.hopeWhite,
    marginTop: 8,
  },
  metricLabel: {
    ...Typography.interRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
    textAlign: 'center' as const,
  },
  activityContainer: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  activityCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  activityRow: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  activityText: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 12,
    flex: 1,
  },
  encouragementContainer: {
    margin: 20,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  encouragementTitle: {
    ...Typography.interSemiBold,
    fontSize: 16,
    color: Colors.faithGold,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  encouragementText: {
    ...Typography.interRegular,
    fontSize: 14,
    color: Colors.hopeWhite,
    lineHeight: 20,
    textAlign: 'center' as const,
    fontStyle: 'italic' as const,
  },
});
