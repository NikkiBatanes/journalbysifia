import React, { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { withErrorBoundary } from '../components/ErrorBoundary/withErrorBoundary';
import { useTheme } from '../hooks/useTheme';
import { getFontFamily } from '../theme/fonts';
import { useFamilySubscription } from '../hooks/useFamilySubscription';
import ThemedText from '../components/common/ThemedText';
import { FamilyUsageChart } from '../components/family/FamilyUsageChart';
import { FamilyActivityLog } from '../components/family/FamilyActivityLog';
import { Logger } from '../utils/ProductionLogger';

/**
 * FamilyAnalyticsScreen
 *
 * Enterprise-grade analytics dashboard for family subscriptions
 * Features:
 * - Usage trends and insights
 * - Member engagement metrics
 * - Activity timeline
 * - Export capabilities
 */

type TimePeriod = 'week' | 'month' | 'quarter' | 'year';

const FamilyAnalyticsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';

  const fonts = useMemo(() => ({
    regular: getFontFamily(fontKey, 'regular'),
    medium: getFontFamily(fontKey, 'medium'),
    semiBold: getFontFamily(fontKey, 'semiBold'),
    bold: getFontFamily(fontKey, 'bold'),
  }), [fontKey]);

  const styles = useMemo(() => createStyles(fonts), [fonts]);

  const {
    familyGroup,
    isAdmin,
    getFamilyUsageAnalytics,
    refreshFamilyData,
  } = useFamilySubscription();

  const [selectedPeriod, setSelectedPeriod] = useState<TimePeriod>('month');
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<any>(null);
  const [activities, setActivities] = useState<any[]>([]);

  const loadAnalytics = useCallback(async () => {
    try {
      const data = await getFamilyUsageAnalytics();
      setAnalytics(data);

      // Mock activity data - replace with actual API call
      setActivities([
        {
          id: '1',
          activity_type: 'member_added',
          user_name: 'John Doe',
          affected_user_name: 'Jane Doe',
          created_at: new Date().toISOString(),
        },
        {
          id: '2',
          activity_type: 'subscription_renewed',
          created_at: new Date(Date.now() - 86400000).toISOString(),
        },
      ]);
    } catch (error) {
      Logger.error('Failed to load analytics', error as Error, {
        component: 'FamilyAnalyticsScreen',
      });
    }
  }, [getFamilyUsageAnalytics]);

  useEffect(() => {
    if (familyGroup && isAdmin) {
      loadAnalytics();
    }
  }, [familyGroup, isAdmin, loadAnalytics]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshFamilyData();
    await loadAnalytics();
    setRefreshing(false);
  };

  const handleExport = () => {
    // TODO: Implement export functionality
    Logger.info('Exporting analytics data');
  };

  if (!isAdmin) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Ionicons name="lock-closed" size={64} color={Colors.textGray} />
          <ThemedText style={styles.errorTitle}>Access Denied</ThemedText>
          <ThemedText style={styles.errorText}>
            Only family administrators can view analytics.
          </ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  const totalPlaybooks = analytics?.totalPlaybooks || 0;
  const totalDevotionals = analytics?.totalDevotionals || 0;
  const activeMembers = analytics?.active_members || familyGroup?.current_members || 0;
  const avgPlaybooks = analytics?.avg_playbooks_per_member || 0;
  const avgDevotionals = analytics?.avg_devotionals_per_member || 0;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.anchorBlue} />
        </TouchableOpacity>
        <ThemedText style={styles.headerTitle}>Family Analytics</ThemedText>
        <TouchableOpacity onPress={handleExport} style={styles.exportButton}>
          <Ionicons name="download-outline" size={20} color={Colors.anchorBlue} />
        </TouchableOpacity>
      </View>

      {/* Period Selector */}
      <View style={styles.periodSelector}>
        {(['week', 'month', 'quarter', 'year'] as TimePeriod[]).map((period) => (
          <TouchableOpacity
            key={period}
            style={[
              styles.periodButton,
              selectedPeriod === period && styles.periodButtonActive,
            ]}
            onPress={() => setSelectedPeriod(period)}
          >
            <ThemedText
              style={[
                styles.periodButtonText,
                selectedPeriod === period && styles.periodButtonTextActive,
              ]}
            >
              {period.charAt(0).toUpperCase() + period.slice(1)}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      >
        {/* Overview Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.playbookBlue + '20' }]}>
              <Ionicons name="book" size={24} color={Colors.playbookBlue} />
            </View>
            <ThemedText style={styles.statValue}>{totalPlaybooks}</ThemedText>
            <ThemedText style={styles.statLabel}>Total Playbooks</ThemedText>
            <ThemedText style={styles.statSubtext}>
              {avgPlaybooks.toFixed(1)} per member
            </ThemedText>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.devotionalPurple + '20' }]}>
              <Ionicons name="heart" size={24} color={Colors.devotionalPurple} />
            </View>
            <ThemedText style={styles.statValue}>{totalDevotionals}</ThemedText>
            <ThemedText style={styles.statLabel}>Total Devotionals</ThemedText>
            <ThemedText style={styles.statSubtext}>
              {avgDevotionals.toFixed(1)} per member
            </ThemedText>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.growthGreen + '20' }]}>
              <Ionicons name="people" size={24} color={Colors.growthGreen} />
            </View>
            <ThemedText style={styles.statValue}>{activeMembers}</ThemedText>
            <ThemedText style={styles.statLabel}>Active Members</ThemedText>
            <ThemedText style={styles.statSubtext}>
              {familyGroup?.max_members} total slots
            </ThemedText>
          </View>

          <View style={styles.statCard}>
            <View style={[styles.statIcon, { backgroundColor: Colors.faithGold + '20' }]}>
              <Ionicons name="trending-up" size={24} color={Colors.faithGold} />
            </View>
            <ThemedText style={styles.statValue}>
              {totalPlaybooks + totalDevotionals}
            </ThemedText>
            <ThemedText style={styles.statLabel}>Total Engagement</ThemedText>
            <ThemedText style={styles.statSubtext}>
              All activities
            </ThemedText>
          </View>
        </View>

        {/* Playbook Usage Chart */}
        {analytics?.memberUsage && analytics.memberUsage.length > 0 && (
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Playbook Usage by Member</ThemedText>
            <FamilyUsageChart memberUsage={analytics.memberUsage} type="playbooks" />
          </View>
        )}

        {/* Devotional Usage Chart */}
        {analytics?.memberUsage && analytics.memberUsage.length > 0 && (
          <View style={styles.card}>
            <ThemedText style={styles.cardTitle}>Devotional Usage by Member</ThemedText>
            <FamilyUsageChart memberUsage={analytics.memberUsage} type="devotionals" />
          </View>
        )}

        {/* Engagement Insights */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Engagement Insights</ThemedText>

          <View style={styles.insightItem}>
            <View style={styles.insightIcon}>
              <Ionicons name="star" size={20} color={Colors.faithGold} />
            </View>
            <View style={styles.insightContent}>
              <ThemedText style={styles.insightTitle}>Most Active Member</ThemedText>
              <ThemedText style={styles.insightValue}>
                {analytics?.memberUsage?.[0]?.fullName || 'N/A'}
              </ThemedText>
            </View>
          </View>

          <View style={styles.insightItem}>
            <View style={styles.insightIcon}>
              <Ionicons name="calendar" size={20} color={Colors.anchorBlue} />
            </View>
            <View style={styles.insightContent}>
              <ThemedText style={styles.insightTitle}>Average Daily Usage</ThemedText>
              <ThemedText style={styles.insightValue}>
                {((totalPlaybooks + totalDevotionals) / 30).toFixed(1)} items/day
              </ThemedText>
            </View>
          </View>

          <View style={styles.insightItem}>
            <View style={styles.insightIcon}>
              <Ionicons name="trophy" size={20} color={Colors.growthGreen} />
            </View>
            <View style={styles.insightContent}>
              <ThemedText style={styles.insightTitle}>Engagement Rate</ThemedText>
              <ThemedText style={styles.insightValue}>
                {activeMembers > 0 ? ((activeMembers / (familyGroup?.max_members || 1)) * 100).toFixed(0) : 0}% of family active
              </ThemedText>
            </View>
          </View>
        </View>

        {/* Recent Activity */}
        <View style={styles.card}>
          <ThemedText style={styles.cardTitle}>Recent Activity</ThemedText>
          <FamilyActivityLog activities={activities} maxItems={5} />
        </View>

        {/* Recommendations */}
        <View style={styles.card}>
          <View style={styles.recommendationHeader}>
            <Ionicons name="bulb" size={24} color={Colors.faithGold} />
            <ThemedText style={styles.cardTitle}>Recommendations</ThemedText>
          </View>

          {activeMembers < (familyGroup?.max_members || 5) && (
            <View style={styles.recommendationItem}>
              <ThemedText style={styles.recommendationText}>
                You have {(familyGroup?.max_members || 5) - activeMembers} unused member slot(s).
                Invite more family members to maximize your subscription value!
              </ThemedText>
            </View>
          )}

          {avgPlaybooks < 5 && (
            <View style={styles.recommendationItem}>
              <ThemedText style={styles.recommendationText}>
                Your family is averaging {avgPlaybooks.toFixed(1)} playbooks per member.
                Encourage more engagement with personalized playbooks!
              </ThemedText>
            </View>
          )}

          {activeMembers === (familyGroup?.max_members || 5) && (
            <View style={styles.recommendationItem}>
              <ThemedText style={styles.recommendationText}>
                Your family is at full capacity! Consider increasing your member limit if you
                want to add more family members.
              </ThemedText>
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (fonts: any) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: Colors.hopeWhite,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    backButton: {
      padding: 8,
    },
    headerTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
    },
    exportButton: {
      padding: 8,
    },
    periodSelector: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingVertical: 12,
      gap: 8,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    periodButton: {
      flex: 1,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: Colors.lightGray,
      alignItems: 'center',
    },
    periodButtonActive: {
      backgroundColor: Colors.anchorBlue,
    },
    periodButtonText: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: Colors.textGray,
    },
    periodButtonTextActive: {
      color: Colors.hopeWhite,
      fontFamily: fonts.semiBold,
    },
    scrollView: {
      flex: 1,
    },
    statsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      padding: 16,
      gap: 12,
    },
    statCard: {
      width: (Dimensions.get('window').width - 52) / 2,
      backgroundColor: Colors.hopeWhite,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    statIcon: {
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 12,
    },
    statValue: {
      fontSize: 28,
      fontFamily: fonts.bold,
      color: Colors.text,
      marginBottom: 4,
    },
    statLabel: {
      fontSize: 13,
      fontFamily: fonts.medium,
      color: Colors.textGray,
      textAlign: 'center',
      marginBottom: 4,
    },
    statSubtext: {
      fontSize: 11,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      textAlign: 'center',
    },
    card: {
      backgroundColor: Colors.hopeWhite,
      marginHorizontal: 20,
      marginVertical: 8,
      padding: 20,
      borderRadius: 12,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3,
    },
    cardTitle: {
      fontSize: 18,
      fontFamily: fonts.semiBold,
      color: Colors.anchorBlue,
      marginBottom: 16,
    },
    insightItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 12,
      borderBottomWidth: 1,
      borderBottomColor: Colors.lightGray,
    },
    insightIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.lightGray,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 12,
    },
    insightContent: {
      flex: 1,
    },
    insightTitle: {
      fontSize: 14,
      fontFamily: fonts.medium,
      color: Colors.textGray,
      marginBottom: 4,
    },
    insightValue: {
      fontSize: 16,
      fontFamily: fonts.semiBold,
      color: Colors.text,
    },
    recommendationHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    recommendationItem: {
      backgroundColor: Colors.faithGold + '10',
      borderLeftWidth: 3,
      borderLeftColor: Colors.faithGold,
      borderRadius: 8,
      padding: 12,
      marginBottom: 12,
    },
    recommendationText: {
      fontSize: 14,
      fontFamily: fonts.regular,
      color: Colors.text,
      lineHeight: 20,
    },
    errorContainer: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
    },
    errorTitle: {
      fontSize: 20,
      fontFamily: fonts.semiBold,
      color: Colors.text,
      marginTop: 16,
      marginBottom: 8,
    },
    errorText: {
      fontSize: 16,
      fontFamily: fonts.regular,
      color: Colors.textGray,
      textAlign: 'center',
    },
  });

export default withErrorBoundary(FamilyAnalyticsScreen, 'FamilyAnalyticsScreen');
