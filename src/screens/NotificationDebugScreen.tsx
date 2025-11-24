import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { notificationDebugger } from '../utils/notificationDebugger';
import { notificationTesting } from '../utils/notificationTesting';
import { directNotificationTest } from '../utils/directNotificationTest';
import { deviceTokenFix } from '../utils/deviceTokenFix';
import { notificationDeliveryService } from '../services/notificationDeliveryService';
import { comprehensiveNotificationTest } from '../utils/comprehensiveNotificationTest';
import { Logger } from '../utils/ProductionLogger';
import { Colors } from '../theme/colors';
import { testNotifications } from '../utils/testNotifications';
import ThemedText from '../components/common/ThemedText';

const NotificationDebugScreen = () => {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  
  const [isRunningDiagnostic, setIsRunningDiagnostic] = useState(false);
  const [diagnosticResults, setDiagnosticResults] = useState<any>(null);
  const [quickStatus, setQuickStatus] = useState<any>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);

  useEffect(() => {
    if (user?.id) {
      loadQuickStatus();
    }
  }, [user?.id]);

  const loadQuickStatus = async () => {
    if (!user?.id) return;
    
    try {
      const status = await notificationDebugger.getQuickStatus(user.id);
      setQuickStatus(status);
      Logger.info('Quick status loaded', { status });
    } catch (error) {
      Logger.error('Failed to load quick status', error as Error);
    }
  };

  const runFullDiagnostic = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    setIsRunningDiagnostic(true);
    try {
      Logger.info('Starting full notification diagnostic');
      const results = await notificationDebugger.runFullDiagnostic(user.id);
      setDiagnosticResults(results);
      Logger.info('Diagnostic completed', { issues: results.issues.length });
      
      // Show summary alert
      if (results.issues.length === 0) {
        Alert.alert('✅ Diagnostic Complete', 'No issues found! Your notification system appears to be working correctly.');
      } else {
        Alert.alert(
          '⚠️ Issues Found', 
          `Found ${results.issues.length} issue(s). Check the detailed results below.`
        );
      }
    } catch (error) {
      Logger.error('Diagnostic failed', error as Error);
      Alert.alert('Error', 'Failed to run diagnostic. Check logs for details.');
    } finally {
      setIsRunningDiagnostic(false);
    }
  };

  const sendTestNotification = async (testType: string) => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    setIsSendingTest(true);
    try {
      switch (testType) {
        case 'streak':
          await testNotifications.sendPrayerStreakAlert();
          break;
        case 'devotional':
          await testNotifications.sendDevotionalReminder();
          break;
        case 'milestone':
          await testNotifications.sendMilestoneCelebration();
          break;
        case 'gratitude':
          await testNotifications.sendGratitudeReminder();
          break;
        case 'prayer':
          await testNotifications.sendPrayerRequest();
          break;
        case 'critical':
          await notificationTesting.sendCriticalTestNotification(user.id);
          break;
        case 'force':
          await notificationTesting.forceScheduleDailyNotifications(user.id);
          break;
        case 'direct':
          await directNotificationTest.sendImmediateTest(user.id);
          break;
        case 'now':
          await directNotificationTest.sendNowTest(user.id);
          break;
        case 'basic':
          await directNotificationTest.sendBasicTest(user.id);
          break;
        case 'all':
          await testNotifications.sendAllTests();
          break;
      }
      
      Alert.alert('✅ Test Sent', `Test ${testType} notification scheduled! You should receive it in a few seconds.`);
      Logger.info('Test notification sent', { testType });
    } catch (error) {
      Logger.error('Failed to send test notification', error as Error);
      Alert.alert('❌ Error', 'Failed to send test notification. Check logs for details.');
    } finally {
      setIsSendingTest(false);
    }
  };

  const testPushService = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    try {
      const test = await directNotificationTest.testPushService();
      
      const message = `
Push Service Available: ${test.available ? 'Yes' : 'No'}
Device Token: ${test.deviceToken ? 'Found' : 'Not Found'}
Permissions: ${JSON.stringify(test.permissions)}
${test.error ? `Error: ${test.error}` : ''}
      `.trim();

      Alert.alert('🔍 Push Service Test', message);
      Logger.info('Push service test completed', { test });
    } catch (error) {
      Logger.error('Failed to test push service', error as Error);
      Alert.alert('❌ Error', 'Failed to test push service');
    }
  };

  const testDeliveryService = async () => {
    try {
      Alert.alert('📦 Testing Delivery Service', 'Processing pending notifications...');
      
      // Manually trigger delivery service processing
      await notificationDeliveryService.processPendingNotifications();
      
      // Get delivery stats
      const stats = await notificationDeliveryService.getDeliveryStats();
      
      const message = `
Delivery Service Status: Active
Pending: ${stats.pending}
Processing: ${stats.processing}
Sent: ${stats.sent}
Failed: ${stats.failed}
Total: ${stats.total}

The delivery service processes pending notifications every 30 seconds.
      `.trim();

      Alert.alert('📦 Delivery Service Test', message);
      Logger.info('Delivery service test completed', { stats });
    } catch (error) {
      Logger.error('Failed to test delivery service', error as Error);
      Alert.alert('❌ Error', 'Failed to test delivery service');
    }
  };

  const runComprehensiveTest = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    try {
      Alert.alert('🧪 Running Comprehensive Test', 'Testing complete notification pipeline...\n\nThis may take 10-15 seconds.');
      
      const result = await comprehensiveNotificationTest.testCompletePipeline(user.id);
      
      const stepsMessage = result.steps.join('\n\n');
      
      Alert.alert(
        result.success ? '🎉 Test Completed' : '❌ Test Failed', 
        `Pipeline test completed!\n\n${stepsMessage}`,
        [
          {
            text: 'View Queue Analysis',
            onPress: () => viewQueueAnalysis(),
          },
          {
            text: 'OK',
            style: 'cancel',
          },
        ]
      );
      
      Logger.info('Comprehensive test completed', { result });
    } catch (error) {
      Logger.error('Failed to run comprehensive test', error as Error);
      Alert.alert('❌ Error', 'Failed to run comprehensive test');
    }
  };

  const viewQueueAnalysis = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    try {
      const analysis = await comprehensiveNotificationTest.getQueueAnalysis(user.id);
      
      const statusBreakdown = Object.entries(analysis.byStatus)
        .map(([status, count]) => `${status}: ${count}`)
        .join('\n');

      const typeBreakdown = Object.entries(analysis.byType)
        .map(([type, count]) => `${type}: ${count}`)
        .join('\n');

      const message = `
Queue Analysis for ${user.id}:
Total Notifications: ${analysis.total}

Status Breakdown:
${statusBreakdown || 'None'}

Type Breakdown:
${typeBreakdown || 'None'}

Recent Notifications: ${analysis.recent.length} shown
      `.trim();

      Alert.alert('📊 Queue Analysis', message);
      Logger.info('Queue analysis completed', { analysis });
    } catch (error) {
      Logger.error('Failed to analyze queue', error as Error);
      Alert.alert('❌ Error', 'Failed to analyze queue');
    }
  };

  const fixDeviceToken = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    try {
      Alert.alert('🔧 Fixing Device Token', 'Starting device token registration fix...\n\nThis may take a few seconds.');
      
      const result = await deviceTokenFix.forceRegisterToken(user.id);
      
      const stepsMessage = result.steps.join('\n\n');
      
      if (result.success) {
        Alert.alert(
          '✅ Token Registration Successful!', 
          `Device token registered successfully!\n\n${stepsMessage}`,
          [
            {
              text: 'Test Notification',
              onPress: () => deviceTokenFix.testPushWithToken(user.id),
            },
            {
              text: 'OK',
              style: 'cancel',
            },
          ]
        );
      } else {
        Alert.alert(
          '❌ Token Registration Failed', 
          `Failed to register device token.\n\n${stepsMessage}\n\nError: ${result.error || 'Unknown error'}`
        );
      }
      
      Logger.info('Device token fix completed', { result });
    } catch (error) {
      Logger.error('Failed to fix device token', error as Error);
      Alert.alert('❌ Error', 'Failed to fix device token');
    }
  };

  const diagnoseSuppression = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User ID not found');
      return;
    }

    try {
      const diagnosis = await notificationTesting.diagnoseSuppression(user.id);
      
      const message = `
App Active: ${diagnosis.appActive ? 'Yes (suppressing notifications)' : 'No'}
Fatigue: ${diagnosis.fatigue ? 'Yes (too many notifications)' : 'No'}
Recent Count: ${diagnosis.recentCount}/3 daily limit

Recommendations:
${diagnosis.recommendations.join('\n')}
      `.trim();

      Alert.alert('🔍 Suppression Diagnosis', message);
      Logger.info('Suppression diagnosis completed', { diagnosis });
    } catch (error) {
      Logger.error('Failed to diagnose suppression', error as Error);
      Alert.alert('❌ Error', 'Failed to diagnose suppression');
    }
  };

  const renderStatusCard = (title: string, status: 'pass' | 'fail' | 'unknown', details: any) => {
    const statusColor = status === 'pass' ? '#10b981' : status === 'fail' ? '#ef4444' : '#6b7280';
    const statusIcon = status === 'pass' ? '✅' : status === 'fail' ? '❌' : '❓';

    return (
      <View style={[styles.card, { borderLeftColor: statusColor }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{title}</Text>
          <Text style={[styles.statusBadge, { color: statusColor, backgroundColor: statusColor + '20' }]}>
            {statusIcon} {status.toUpperCase()}
          </Text>
        </View>
        
        <View style={styles.cardContent}>
          {Object.entries(details).map(([key, value]) => (
            <Text key={key} style={styles.detailText}>
              {key}: {JSON.stringify(value)}
            </Text>
          ))}
        </View>
      </View>
    );
  };

  const renderQuickStatus = () => {
    if (!quickStatus) return null;

    return (
      <View style={[styles.quickStatusCard, { 
        backgroundColor: quickStatus.overallStatus === 'healthy' ? '#10b98120' : '#ef444420' 
      }]}>
        <Text style={styles.quickStatusTitle}>
          {quickStatus.overallStatus === 'healthy' ? '✅ System Healthy' : '⚠️ Issues Found'}
        </Text>
        
        <View style={styles.quickStatusGrid}>
          <View style={styles.quickStatusItem}>
            <Text style={styles.quickStatusLabel}>Device Token</Text>
            <Text style={styles.quickStatusValue}>
              {quickStatus.hasDeviceToken ? '✅' : '❌'}
            </Text>
          </View>
          
          <View style={styles.quickStatusItem}>
            <Text style={styles.quickStatusLabel}>Permissions</Text>
            <Text style={styles.quickStatusValue}>
              {quickStatus.hasPermissions ? '✅' : '❌'}
            </Text>
          </View>
          
          <View style={styles.quickStatusItem}>
            <Text style={styles.quickStatusLabel}>Scheduled</Text>
            <Text style={styles.quickStatusValue}>
              {quickStatus.notificationsScheduled ? '✅' : '❌'}
            </Text>
          </View>
          
          <View style={styles.quickStatusItem}>
            <Text style={styles.quickStatusLabel}>Pending</Text>
            <Text style={styles.quickStatusValue}>
              {quickStatus.pendingNotifications}
            </Text>
          </View>
        </View>
        
        {quickStatus.keyIssues.length > 0 && (
          <View style={styles.issuesSection}>
            <Text style={styles.issuesTitle}>Key Issues:</Text>
            {quickStatus.keyIssues.map((issue: string, index: number) => (
              <Text key={index} style={styles.issueText}>• {issue}</Text>
            ))}
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🔔 Notification Debug</Text>
        <Text style={styles.headerSubtitle}>Diagnose and test push notifications</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Status */}
        {renderQuickStatus()}

        {/* Actions Section */}
        <View style={styles.actionsSection}>
          <TouchableOpacity 
            style={[styles.actionButton, styles.primaryButton]}
            onPress={runFullDiagnostic}
            disabled={isRunningDiagnostic}
          >
            {isRunningDiagnostic ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.actionButtonText}>🔍 Run Full Diagnostic</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.testButton]}
            onPress={runComprehensiveTest}
          >
            <Text style={styles.actionButtonText}>🧪 Pipeline Test</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.deliveryButton]}
            onPress={testDeliveryService}
          >
            <Text style={styles.actionButtonText}>📦 Process Queue</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.fixButton]}
            onPress={fixDeviceToken}
          >
            <Text style={styles.actionButtonText}>🔧 Fix Device Token</Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.actionButton, styles.secondaryButton]}
            onPress={testPushService}
          >
            <Text style={[styles.actionButtonText, { color: Colors.anchorBlue }]}>
              🔍 Test Push Service
            </Text>
          </TouchableOpacity>
        </View>

        {/* Test Notifications */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🧪 Test Notifications</Text>
          
          <View style={styles.testButtonsGrid}>
            {[
              { type: 'streak', label: '🔥 Streak Alert' },
              { type: 'devotional', label: '📖 Devotional' },
              { type: 'milestone', label: '🌟 Milestone' },
              { type: 'gratitude', label: '🙏 Gratitude' },
              { type: 'prayer', label: '🙏 Pray for Someone' },
              { type: 'critical', label: '🚨 Critical Test' },
              { type: 'force', label: '⚡ Force Daily' },
              { type: 'now', label: '⚡ NOW Test' },
              { type: 'basic', label: '📱 Basic Test' },
              { type: 'all', label: '🎯 All Tests' },
            ].map((test) => (
              <TouchableOpacity
                key={test.type}
                style={[styles.testNotificationButton, isSendingTest && styles.disabledButton]}
                onPress={() => sendTestNotification(test.type)}
                disabled={isSendingTest}
              >
                <Text style={styles.testButtonText}>{test.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Detailed Results */}
        {diagnosticResults && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>📊 Diagnostic Results</Text>
            
            {/* Issues and Recommendations */}
            {diagnosticResults.issues.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>❌ Issues Found</Text>
                {diagnosticResults.issues.map((issue: string, index: number) => (
                  <Text key={index} style={styles.issueText}>• {issue}</Text>
                ))}
              </View>
            )}

            {diagnosticResults.recommendations.length > 0 && (
              <View style={styles.card}>
                <Text style={styles.cardTitle}>💡 Recommendations</Text>
                {diagnosticResults.recommendations.map((rec: string, index: number) => (
                  <Text key={index} style={styles.recommendationText}>• {rec}</Text>
                ))}
              </View>
            )}

            {/* Detailed Checks */}
            {Object.entries(diagnosticResults.checks).map(([key, check]: [string, any]) => (
              <View key={key} style={{ marginBottom: 16 }}>
                {renderStatusCard(
                  key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase()),
                  check.status,
                  check.details
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  header: {
    backgroundColor: Colors.anchorBlue,
    paddingHorizontal: 24,
    paddingVertical: 20,
    paddingBottom: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  quickStatusCard: {
    marginVertical: 16,
    padding: 16,
    borderRadius: 12,
    borderLeftWidth: 4,
  },
  quickStatusTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 12,
  },
  quickStatusGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 12,
  },
  quickStatusItem: {
    width: '50%',
    marginBottom: 8,
  },
  quickStatusLabel: {
    fontSize: 12,
    color: '#64748b',
    marginBottom: 2,
  },
  quickStatusValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  issuesSection: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e2e8f0',
  },
  issuesTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    color: '#ef4444',
  },
  issueText: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 2,
  },
  actionsSection: {
    flexDirection: 'row',
    gap: 12,
    marginVertical: 16,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButton: {
    backgroundColor: Colors.anchorBlue,
  },
  criticalButton: {
    backgroundColor: '#ef4444',
  },
  fixButton: {
    backgroundColor: '#f59e0b',
  },
  deliveryButton: {
    backgroundColor: '#10b981',
  },
  testButton: {
    backgroundColor: '#8b5cf6',
  },
  secondaryButton: {
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: Colors.anchorBlue,
  },
  actionButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  section: {
    marginVertical: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    color: '#1e293b',
  },
  testButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  testNotificationButton: {
    flex: 1,
    minWidth: '45%',
    padding: 12,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    alignItems: 'center',
  },
  disabledButton: {
    opacity: 0.5,
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#475569',
  },
  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#6b7280',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    fontSize: 10,
    fontWeight: '600',
  },
  cardContent: {
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#64748b',
    fontFamily: 'monospace',
  },
  recommendationText: {
    fontSize: 12,
    color: '#059669',
    marginBottom: 2,
  },
});

export default NotificationDebugScreen;
