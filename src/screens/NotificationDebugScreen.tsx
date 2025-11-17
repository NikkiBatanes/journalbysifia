import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
} from 'react-native';
import { Colors } from '../theme/colors';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { pushNotificationService } from '../services/pushNotificationService';
import { DailyNotificationScheduler } from '../utils/dailyNotificationScheduler';
import { supabase } from '../services/supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface DebugInfo {
  deviceToken: string | null;
  permissions: any;
  lastScheduled: Date | null;
  deviceTokensInDB: number;
  notificationQueue: number;
  preferences: any;
}

export default function NotificationDebugScreen() {
  const { user } = useAuth();
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    deviceToken: null,
    permissions: null,
    lastScheduled: null,
    deviceTokensInDB: 0,
    notificationQueue: 0,
    preferences: null,
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDebugInfo();
  }, []);

  const loadDebugInfo = async () => {
    setLoading(true);
    try {
      // Get stored device token
      const token = await pushNotificationService.getStoredToken();

      // Get permissions
      const permissions = await pushNotificationService.checkPermissions();

      // Get last scheduled date
      const lastScheduled = await DailyNotificationScheduler.getLastScheduledDate();

      // Get device tokens from DB
      let deviceTokensInDB = 0;
      let notificationQueue = 0;
      let preferences = null;

      if (user?.id) {
        const { data: tokens } = await supabase
          .from('device_tokens')
          .select('*')
          .eq('user_id', user.id);
        deviceTokensInDB = tokens?.length || 0;

        const { data: queue } = await supabase
          .from('notification_queue')
          .select('*')
          .eq('user_id', user.id)
          .eq('status', 'pending');
        notificationQueue = queue?.length || 0;

        const { data: prefs } = await supabase
          .from('notification_preferences')
          .select('*')
          .eq('user_id', user.id)
          .single();
        preferences = prefs;
      }

      setDebugInfo({
        deviceToken: token,
        permissions,
        lastScheduled,
        deviceTokensInDB,
        notificationQueue,
        preferences,
      });
    } catch (error) {
      console.error('Error loading debug info:', error);
      Alert.alert('Error', 'Failed to load debug information');
    } finally {
      setLoading(false);
    }
  };

  const testLocalNotification = async () => {
    try {
      await pushNotificationService.scheduleLocalNotification({
        title: 'Test Notification',
        message: 'This is a test notification from siFia',
        data: { test: true },
      });
      Alert.alert('Success', 'Test notification scheduled for 1 second from now');
    } catch (error) {
      Alert.alert('Error', 'Failed to schedule test notification');
    }
  };

  const forceReschedule = async () => {
    if (!user?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      setLoading(true);
      const success = await DailyNotificationScheduler.forceReschedule(user.id);
      if (success) {
        Alert.alert('Success', 'Notifications rescheduled successfully');
        await loadDebugInfo();
      } else {
        Alert.alert('Error', 'Failed to reschedule notifications');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to reschedule notifications');
    } finally {
      setLoading(false);
    }
  };

  const requestPermissions = async () => {
    try {
      const granted = await pushNotificationService.requestPermissions();
      if (granted) {
        Alert.alert('Success', 'Notification permissions granted');
        await loadDebugInfo();
      } else {
        Alert.alert('Denied', 'Notification permissions were denied');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to request permissions');
    }
  };

  const openSettings = async () => {
    await pushNotificationService.openNotificationSettings();
  };

  const clearLocalData = async () => {
    try {
      await AsyncStorage.removeItem('notifications:lastScheduled');
      await AsyncStorage.removeItem('push_token');
      Alert.alert('Success', 'Local notification data cleared');
      await loadDebugInfo();
    } catch (error) {
      Alert.alert('Error', 'Failed to clear local data');
    }
  };

  const renderInfoRow = (label: string, value: any, color: string = Colors.text) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, { color }]}>{String(value)}</Text>
    </View>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Notification Debug</Text>
        <TouchableOpacity onPress={loadDebugInfo} style={styles.refreshButton}>
          <Text style={styles.refreshText}>🔄 Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📱 Device Status</Text>
        {renderInfoRow('Platform', Platform.OS)}
        {renderInfoRow('User ID', user?.id || 'Not authenticated', user?.id ? Colors.growthGreen : Colors.dangerRed)}
        {renderInfoRow(
          'Device Token',
          debugInfo.deviceToken ? `${debugInfo.deviceToken.substring(0, 20)}...` : 'Not registered',
          debugInfo.deviceToken ? Colors.growthGreen : Colors.dangerRed
        )}
        {renderInfoRow(
          'Alert Permission',
          debugInfo.permissions?.alert ? '✅ Granted' : '❌ Denied',
          debugInfo.permissions?.alert ? Colors.growthGreen : Colors.dangerRed
        )}
        {renderInfoRow(
          'Badge Permission',
          debugInfo.permissions?.badge ? '✅ Granted' : '❌ Denied',
          debugInfo.permissions?.badge ? Colors.growthGreen : Colors.dangerRed
        )}
        {renderInfoRow(
          'Sound Permission',
          debugInfo.permissions?.sound ? '✅ Granted' : '❌ Denied',
          debugInfo.permissions?.sound ? Colors.growthGreen : Colors.dangerRed
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗄️ Database Status</Text>
        {renderInfoRow(
          'Device Tokens in DB',
          debugInfo.deviceTokensInDB,
          debugInfo.deviceTokensInDB > 0 ? Colors.growthGreen : Colors.dangerRed
        )}
        {renderInfoRow('Pending Notifications', debugInfo.notificationQueue)}
        {renderInfoRow(
          'Preferences Saved',
          debugInfo.preferences ? '✅ Yes' : '❌ No',
          debugInfo.preferences ? Colors.growthGreen : Colors.dangerRed
        )}
        {debugInfo.preferences && (
          <>
            {renderInfoRow('Prayer Reminders', debugInfo.preferences.prayer_reminders ? '✅' : '❌')}
            {renderInfoRow('Devotional Reminders', debugInfo.preferences.devotional_reminders ? '✅' : '❌')}
            {renderInfoRow('Journal Prompts', debugInfo.preferences.journal_prompts ? '✅' : '❌')}
          </>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Scheduling Status</Text>
        {renderInfoRow(
          'Last Scheduled',
          debugInfo.lastScheduled
            ? debugInfo.lastScheduled.toLocaleDateString() + ' ' + debugInfo.lastScheduled.toLocaleTimeString()
            : 'Never',
          debugInfo.lastScheduled ? Colors.growthGreen : Colors.warning
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🔧 Actions</Text>
        
        <TouchableOpacity style={styles.button} onPress={requestPermissions}>
          <Text style={styles.buttonText}>Request Permissions</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testLocalNotification}>
          <Text style={styles.buttonText}>Test Local Notification</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={forceReschedule} disabled={loading}>
          <Text style={styles.buttonText}>
            {loading ? 'Rescheduling...' : 'Force Reschedule All'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={openSettings}>
          <Text style={styles.buttonText}>Open System Settings</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={clearLocalData}>
          <Text style={styles.buttonText}>Clear Local Data</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ℹ️ Troubleshooting</Text>
        <Text style={styles.troubleshootText}>
          If notifications aren't working:
          {'\n\n'}
          1. Check that all permissions are granted above
          {'\n'}
          2. Verify device token is registered
          {'\n'}
          3. Ensure preferences are saved in database
          {'\n'}
          4. Check that backend edge functions are deployed
          {'\n'}
          5. Verify APNS_JWT_TOKEN is set in Supabase secrets
          {'\n'}
          6. For TestFlight: Ensure production APNS certificate is configured
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
  },
  refreshButton: {
    padding: 8,
  },
  refreshText: {
    fontSize: 16,
    color: Colors.anchorBlue,
  },
  section: {
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.anchorBlue,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: Colors.textGray,
    flex: 1,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    flex: 1,
    textAlign: 'right',
  },
  button: {
    backgroundColor: Colors.anchorBlue,
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  dangerButton: {
    backgroundColor: Colors.dangerRed,
  },
  buttonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
  },
  troubleshootText: {
    fontSize: 14,
    color: Colors.textGray,
    lineHeight: 20,
  },
});
