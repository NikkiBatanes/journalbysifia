/**
 * Admin Dashboard Component - Phase 4
 *
 * Comprehensive business intelligence dashboard for monitoring
 * subscription metrics, user behavior, retention analytics, and system health.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';
import { analyticsService, SubscriptionAnalytics as ServiceSubscriptionAnalytics, FeatureAnalytics as ServiceFeatureAnalytics } from '../services/analyticsService';

const { width: screenWidth } = Dimensions.get('window');
const chartWidth = screenWidth - 40;

// Use the service types directly
type SubscriptionAnalytics = ServiceSubscriptionAnalytics;
type FeatureAnalytics = ServiceFeatureAnalytics;

interface DashboardMetric {
  metric_name: string;
  current_value: number;
  previous_value: number;
  change_percentage: number;
  trend: 'up' | 'down' | 'stable' | 'no_data';
}

export const AdminDashboard: React.FC = () => {
  const [dashboardMetrics, setDashboardMetrics] = useState<DashboardMetric[]>([]);
  const [subscriptionAnalytics, setSubscriptionAnalytics] = useState<SubscriptionAnalytics[]>([]);
  const [featureAnalytics, setFeatureAnalytics] = useState<FeatureAnalytics[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState<'7d' | '30d' | '90d'>('30d');
  const [activeTab, setActiveTab] = useState<'overview' | 'subscriptions' | 'features' | 'retention'>('overview');

  const loadDashboardData = useCallback(async () => {
    setIsLoading(true);
    try {
      const days = selectedTimeRange === '7d' ? 7 : selectedTimeRange === '30d' ? 30 : 90;
      const dateRange = {
        start: new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString(),
      };

      const [metrics, subscriptionData, featureData] = await Promise.all([
        analyticsService.getDashboardMetrics(days),
        analyticsService.getSubscriptionAnalytics(dateRange),
        analyticsService.getFeatureAnalytics(),
      ]);

      setDashboardMetrics(metrics || []);
      setSubscriptionAnalytics(subscriptionData || []);
      setFeatureAnalytics(featureData || []);
    } catch (error) {
      console.error('[AdminDashboard] Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [selectedTimeRange]);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
    setRefreshing(false);
  };

  // Utility functions for trend display (removed unused functions)

  // Utility functions for formatting
  const formatCurrency = useCallback((value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  }, []);

  const formatNumber = useCallback((value: number): string => {
    return new Intl.NumberFormat('en-US').format(value);
  }, []);

  const formatPercentage = useCallback((value: number): string => {
    return `${value.toFixed(1)}%`;
  }, []);

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Key Metrics Cards */}
      <View style={styles.metricsGrid}>
        {dashboardMetrics.map((metric) => (
          <MetricCard
            key={metric.metric_name}
            title={metric.metric_name.replace(/_/g, ' ').toUpperCase()}
            value={metric.metric_name.includes('revenue') ? formatCurrency(metric.current_value) :
                   metric.metric_name.includes('rate') || metric.metric_name.includes('score') ?
                   formatPercentage(metric.current_value) : formatNumber(metric.current_value)}
            change={metric.change_percentage}
            trend={metric.trend}
          />
        ))}
      </View>

      {/* Revenue Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Monthly Recurring Revenue</Text>
        <LineChart
          data={{
            labels: subscriptionAnalytics.map(item => item.tier),
            datasets: [{ data: subscriptionAnalytics.map(item => item.total_subscribers) }],
          }}
          width={screenWidth - 40}
          height={220}
          yAxisLabel=""
          chartConfig={chartConfig}
          style={styles.chartStyle}    />
      </View>

      {/* User Distribution */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>User Distribution by Tier</Text>
        <PieChart
          data={subscriptionAnalytics.map((s, index) => ({
            name: s.tier.toUpperCase(),
            population: s.active_users,
            color: pieColors[index % pieColors.length],
            legendFontColor: '#374151',
            legendFontSize: 12,
          }))}
          width={chartWidth}
          height={220}
          chartConfig={chartConfig}
          accessor="population"
          backgroundColor="transparent"
          paddingLeft="15"
          style={styles.chart}
        />
      </View>
    </View>
  );

  const renderSubscriptionsTab = () => (
    <View style={styles.tabContent}>
      {/* Subscription Metrics */}
      {subscriptionAnalytics.map((subscription, _index) => (
        <SubscriptionCard
          key={subscription.tier}
          subscription={subscription}
        />
      ))}

      {/* Churn Rate Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Churn Rate by Tier</Text>
        <BarChart
          data={{
            labels: subscriptionAnalytics.map(s => s.tier),
            datasets: [{
              data: subscriptionAnalytics.map(s => s.metrics?.totalUsers || 0),
            }],
          }}
          width={chartWidth}
          height={220}
          yAxisLabel="Users"
          yAxisSuffix=""
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 0,
            color: (opacity = 1) => `rgba(81, 150, 244, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: '6', strokeWidth: '2', stroke: '#5196f4' },
          }}
          style={styles.chartStyle}
          showValuesOnTopOfBars={true}
        />
      </View>

      {/* Conversion Rates */}
      <View style={styles.chartContainer}>
        <Text style={styles.sectionTitle}>Conversion Rates</Text>
        <BarChart
          data={{
            labels: subscriptionAnalytics.map(s => s.tier.toUpperCase()),
            datasets: [{
              data: subscriptionAnalytics.map(s => (s.metrics?.conversionRate || 0) * 100),
            }],
          }}
          width={chartWidth}
          height={220}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(81, 150, 244, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: '6', strokeWidth: '2', stroke: '#5196f4' },
          }}
          style={styles.chartStyle}
        />
      </View>
    </View>
  );

  const renderFeaturesTab = () => (
    <View style={styles.tabContent}>
      {/* Feature Usage Cards */}
      {featureAnalytics.slice(0, 6).map((feature, _index) => (
        <View key={feature.feature_name} style={styles.featureCard}>
          <Text style={styles.featureName}>{feature.feature_name.replace(/_/g, ' ').toUpperCase()}</Text>
          <Text style={styles.featureUsage}>{formatNumber(feature.total_usage)} uses</Text>
          <View style={styles.featureMetrics}>
            <Text style={styles.sectionTitle}>Revenue Metrics</Text>
            <View style={styles.metricsGrid}>
              {subscriptionAnalytics.map((tier, _tierIndex) => (
                <View key={tier.tier} style={styles.metricCard}>
                  <Text style={styles.metricTitle}>{tier.tier.toUpperCase()}</Text>
                  <Text style={styles.metricValue}>
                    {formatCurrency((tier.metrics?.averageRevenue || 0) * (tier.metrics?.activeUsers || 0))}
                  </Text>
                  <Text style={styles.metricSubtext}>
                    {tier.metrics?.activeUsers || 0} active users
                  </Text>
                </View>
              ))}
            </View>
          </View>
        </View>
      ))}

      {/* Feature Usage Chart */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Feature Usage (Total)</Text>
        <LineChart
          data={{
            labels: featureAnalytics.map(item => item.feature_name),
            datasets: [{ data: featureAnalytics.map(item => item.total_usage) }],
          }}
          width={screenWidth - 40}
          height={220}
          yAxisLabel=""
          chartConfig={chartConfig}
          style={styles.chartStyle}      showValuesOnTopOfBars
        />
      </View>

      {/* Feature Performance */}
      <View style={styles.chartContainer}>
        <Text style={styles.chartTitle}>Feature Satisfaction Scores</Text>
        <BarChart
          data={{
            labels: featureAnalytics.map(f => f.feature_name),
            datasets: [{
              data: featureAnalytics.map(f => (f.performance?.satisfactionScore || 0) * 100),
            }],
          }}
          width={chartWidth}
          height={220}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(81, 150, 244, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: '6', strokeWidth: '2', stroke: '#5196f4' },
          }}
          style={styles.chartStyle}
        />
      </View>
    </View>
  );

  const renderRetentionTab = () => (
    <View style={styles.tabContent}>
      <Text style={styles.sectionTitle}>Retention Analytics</Text>
      <Text style={styles.comingSoon}>
        Advanced retention analytics and cohort analysis coming soon...
      </Text>

      {/* Retention Rate by Tier */}
      <View style={styles.chartContainer}>
        <Text style={styles.sectionTitle}>Retention Rates</Text>
        <BarChart
          data={{
            labels: subscriptionAnalytics.map(s => s.tier.toUpperCase()),
            datasets: [{
              data: subscriptionAnalytics.map(s => (s.metrics?.retentionRate || 0) * 100),
            }],
          }}
          width={chartWidth}
          height={220}
          yAxisLabel=""
          yAxisSuffix="%"
          chartConfig={{
            backgroundColor: '#ffffff',
            backgroundGradientFrom: '#ffffff',
            backgroundGradientTo: '#ffffff',
            decimalPlaces: 1,
            color: (opacity = 1) => `rgba(81, 150, 244, ${opacity})`,
            labelColor: (opacity = 1) => `rgba(0, 0, 0, ${opacity})`,
            style: { borderRadius: 16 },
            propsForDots: { r: '6', strokeWidth: '2', stroke: '#5196f4' },
          }}
          style={styles.chartStyle}
        />
      </View>
    </View>
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
        <View style={styles.timeRangeSelector}>
          {(['7d', '30d', '90d'] as const).map((range) => (
            <TouchableOpacity
              key={range}
              style={[
                styles.timeRangeButton,
                selectedTimeRange === range && styles.activeTimeRangeButton,
              ]}
              onPress={() => setSelectedTimeRange(range)}
            >
              <Text style={[
                styles.timeRangeButtonText,
                selectedTimeRange === range && styles.activeTimeRangeButtonText,
              ]}>
                {range}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabNavigation}>
        {[
          { key: 'overview', label: 'Overview', icon: 'analytics' },
          { key: 'subscriptions', label: 'Subscriptions', icon: 'card' },
          { key: 'features', label: 'Features', icon: 'layers' },
          { key: 'retention', label: 'Retention', icon: 'people' },
        ].map((tab) => (
          <TouchableOpacity
            key={tab.key}
            style={[
              styles.tabButton,
              activeTab === tab.key && styles.activeTabButton,
            ]}
            onPress={() => setActiveTab(tab.key as any)}
          >
            <Ionicons
              name={tab.icon as any}
              size={20}
              color={activeTab === tab.key ? '#6366F1' : '#6B7280'}
            />
            <Text style={[
              styles.tabButtonText,
              activeTab === tab.key && styles.activeTabButtonText,
            ]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Content */}
      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'subscriptions' && renderSubscriptionsTab()}
        {activeTab === 'features' && renderFeaturesTab()}
        {activeTab === 'retention' && renderRetentionTab()}
      </ScrollView>
    </View>
  );
};

// Metric Card Component
const MetricCard: React.FC<{
  title: string;
  value: string;
  change: number;
  trend: string;
}> = ({ title, value, change, trend }) => (
  <View style={styles.metricCard}>
    <Text style={styles.metricTitle}>{title}</Text>
    <Text style={styles.metricValue}>{value}</Text>
    <View style={styles.metricChange}>
      <Ionicons name={getTrendIcon(trend)} size={16} color={getTrendColor(trend)} />
      <Text style={[styles.metricChange, { color: getTrendColor(trend) }]}>
        {Math.abs(change).toFixed(1)}%
      </Text>
    </View>
  </View>
);

// Subscription Card Component
const SubscriptionCard: React.FC<{
  subscription: SubscriptionAnalytics;
}> = ({ subscription }) => (
  <View style={styles.subscriptionCard}>
    <Text style={styles.subscriptionTier}>{subscription.tier.toUpperCase()}</Text>
    <View style={styles.subscriptionMetrics}>
      <Text style={styles.subscriptionMetric}>
        Revenue: {formatCurrency((subscription.metrics?.averageRevenue || 0) * (subscription.metrics?.activeUsers || 0))}
      </Text>
      <Text style={styles.subscriptionMetric}>
        Users: {(subscription.metrics?.activeUsers || 0).toLocaleString()}
      </Text>
      <Text style={styles.subscriptionMetric}>
        Churn: {formatPercentage((subscription.metrics?.churnRate || 0) * 100)}
      </Text>
      <Text style={styles.subscriptionMetric}>
        Conversion: {formatPercentage((subscription.metrics?.conversionRate || 0) * 100)}
      </Text>
    </View>
  </View>
);

// Chart configuration
const chartConfig = {
  backgroundColor: '#ffffff',
  backgroundGradientFrom: '#ffffff',
  backgroundGradientTo: '#ffffff',
  decimalPlaces: 0,
  color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`,
  labelColor: (opacity = 1) => `rgba(55, 65, 81, ${opacity})`,
  style: {
    borderRadius: 16,
  },
  propsForDots: {
    r: '6',
    strokeWidth: '2',
    stroke: '#6366F1',
  },
};

const pieColors = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4'];

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  timeRangeSelector: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
    borderRadius: 8,
    padding: 2,
  },
  timeRangeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  activeTimeRangeButton: {
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  timeRangeButtonText: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTimeRangeButtonText: {
    color: '#1F2937',
  },
  tabNavigation: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 6,
  },
  activeTabButton: {
    borderBottomWidth: 2,
    borderBottomColor: '#6366F1',
  },
  tabButtonText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  activeTabButtonText: {
    color: '#6366F1',
  },
  content: {
    flex: 1,
  },
  tabContent: {
    padding: 20,
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metricTitle: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
    marginBottom: 8,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 4,
  },
  metricChange: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricChangeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  chartContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  chartTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  chart: {
    borderRadius: 8,
  },
  subscriptionCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  subscriptionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  subscriptionTier: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  subscriptionRevenue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#10B981',
  },
  subscriptionMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  subscriptionMetric: {
    alignItems: 'center',
  },
  subscriptionMetricLabel: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 4,
  },
  subscriptionMetricValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  featureCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  featureHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  featureName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1F2937',
  },
  featureUsage: {
    fontSize: 14,
    color: '#6366F1',
    fontWeight: '500',
  },
  featureMetrics: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  featureMetric: {
    alignItems: 'center',
  },
  featureMetricLabel: {
    fontSize: 11,
    color: '#6B7280',
    marginBottom: 4,
  },
  featureMetricValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#1F2937',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 16,
  },
  comingSoon: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 20,
    fontStyle: 'italic',
  },
  chartStyle: {
    marginVertical: 8,
    borderRadius: 16,
  },
});

export default AdminDashboard;
