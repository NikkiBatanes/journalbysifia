/**
 * Calendar Sync Button Component
 * Shows sync status and handles calendar integration with feature gating
 */

import React, { useState } from 'react';
import {
  View,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme/colors';
import ThemedText from './common/ThemedText';
import { useCalendarGating } from '../hooks/useCalendarGating';
import { syncTimeBlockToCalendar, removeTimeBlockFromCalendar, updateTimeBlockInCalendar, CalendarEvent } from '../services/calendarSyncService';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { Linking } from 'react-native';
import { triggerLightHaptic, triggerSelectionHaptic } from '../utils/haptics';

interface CalendarSyncButtonProps {
  timeBlock: {
    id: string;
    title: string;
    startTime: Date;
    endTime: Date;
    location?: string;
    notes?: string;
    isAllDay: boolean;
    repeat: {
      frequency: string;
      endDate?: Date;
      customDays?: number[];
      customFrequency?: {
        value: number;
        unit: string;
      };
    };
  };
  calendarEventId?: string;
  onSyncComplete: (eventId: string | null) => void;
  compact?: boolean;
}

export const CalendarSyncButton: React.FC<CalendarSyncButtonProps> = ({
  timeBlock,
  calendarEventId,
  onSyncComplete,
  compact = false,
}) => {
  const { user } = useAuth();
  const calendarGating = useCalendarGating();
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'unsynced' | 'syncing' | 'error'>
    (calendarEventId ? 'synced' : 'unsynced');

  // Check if auto-sync is enabled
  const userPreferences = user?.user_metadata?.preferences || {};
  const autoSyncEnabled = userPreferences.calendar?.autoSync || false;

  const handleSync = async () => {
    console.log('🔵 [CalendarSyncButton] handleSync called');
    console.log('🔵 [CalendarSyncButton] canSyncToCalendar:', calendarGating.canSyncToCalendar);
    console.log('🔵 [CalendarSyncButton] calendarEventId:', calendarEventId);
    console.log('🔵 [CalendarSyncButton] timeBlock:', timeBlock);
    
    if (!calendarGating.canSyncToCalendar) {
      console.log('🔵 [CalendarSyncButton] ❌ Cannot sync - showing lock tap');
      calendarGating.handleCalendarLockTap();
      return;
    }

    setSyncStatus('syncing');
    triggerLightHaptic();

    try {
      let result;
      
      // If already synced, update the existing event instead of creating a new one
      if (calendarEventId) {
        console.log('🔵 [CalendarSyncButton] Updating existing event:', calendarEventId);
        const updateResult = await updateTimeBlockInCalendar(calendarEventId, {
          ...timeBlock,
          repeat: {
            ...timeBlock.repeat,
            frequency: timeBlock.repeat.frequency as 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly',
          },
        });
        result = { ...updateResult, eventId: calendarEventId };
        console.log('🔵 [CalendarSyncButton] Update result:', result);
      } else {
        console.log('🔵 [CalendarSyncButton] Creating new event');
        // First time sync - create new event
        result = await syncTimeBlockToCalendar({
          ...timeBlock,
          repeat: {
            ...timeBlock.repeat,
            frequency: timeBlock.repeat.frequency as 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly',
          },
        });
        console.log('🔵 [CalendarSyncButton] Create result:', result);
      }

      if (result.success && result.eventId) {
        setSyncStatus('synced');
        onSyncComplete(result.eventId);
        triggerSelectionHaptic();

        if (!calendarEventId) {
          // First time sync
          Alert.alert(
            'Synced to Calendar',
            'Your time block has been added to your device calendar.',
            [{ text: 'OK' }]
          );
        }
      } else {
        setSyncStatus('error');

        if (result.error?.includes('Calendar permission denied')) {
          Alert.alert(
            'Calendar Access Required',
            'To sync your time blocks to your calendar, please enable calendar access for siFia.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  Linking.openSettings();
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Sync Failed',
            result.error || 'Failed to sync to calendar',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('Calendar sync error:', error);
      setSyncStatus('error');
      Alert.alert(
        'Sync Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnsync = async () => {
    if (!calendarEventId) {return;}

    Alert.alert(
      'Remove from Calendar',
      'This will remove the time block from your device calendar.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);

            try {
              const result = await removeTimeBlockFromCalendar(calendarEventId);

              if (result.success) {
                setSyncStatus('unsynced');
                onSyncComplete(null);
                triggerSelectionHaptic();
              } else {
                Alert.alert(
                  'Remove Failed',
                  result.error || 'Failed to remove from calendar.',
                  [{ text: 'OK' }]
                );
              }
            } catch (error) {
              console.error('Calendar remove error:', error);
              Alert.alert('Remove Error', 'An unexpected error occurred.');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const getButtonStyle = () => {
    if (!calendarGating.canSyncToCalendar) {
      return [styles.button, styles.lockedButton];
    }

    switch (syncStatus) {
      case 'synced':
        return [styles.button, styles.syncedButton];
      case 'error':
        return [styles.button, styles.errorButton];
      default:
        return [styles.button, styles.unsyncedButton];
    }
  };

  const getIcon = () => {
    if (isLoading) {
      return <ActivityIndicator size="small" color={Colors.hopeWhite} />;
    }

    if (!calendarGating.canSyncToCalendar) {
      return <MaterialCommunityIcons name="lock" size={16} color={Colors.textGray} />;
    }

    switch (syncStatus) {
      case 'synced':
        return <Ionicons name="calendar" size={16} color={Colors.hopeWhite} />;
      case 'error':
        return <Ionicons name="alert-circle-outline" size={16} color={Colors.hopeWhite} />;
      default:
        return <Ionicons name="calendar-outline" size={16} color={Colors.hopeWhite} />;
    }
  };

  const getText = () => {
    if (!calendarGating.canSyncToCalendar) {
      return compact ? '' : 'Upgrade to Sync';
    }

    if (isLoading) {
      return compact ? '' : 'Syncing...';
    }

    // Show different text if auto-sync is enabled
    if (autoSyncEnabled && syncStatus === 'unsynced') {
      return compact ? '' : 'Auto-sync On';
    }

    switch (syncStatus) {
      case 'synced':
        return compact ? '' : 'Synced';
      case 'error':
        return compact ? '' : 'Sync Failed';
      default:
        return compact ? '' : 'Sync to Calendar';
    }
  };

  const handlePress = () => {
    if (syncStatus === 'synced') {
      handleUnsync();
    } else {
      handleSync();
    }
  };

  return (
    <TouchableOpacity
      style={getButtonStyle()}
      onPress={handlePress}
      disabled={isLoading}
      activeOpacity={0.7}
    >
      <View style={styles.buttonContent}>
        {getIcon()}
        {!compact && (
          <ThemedText weight="medium" style={styles.buttonText}>
            {getText()}
          </ThemedText>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  unsyncedButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
    borderColor: 'rgba(255, 107, 107, 0.3)',
  },
  syncedButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.1)',
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
  errorButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  lockedButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
    opacity: 0.6,
  },
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    marginLeft: 6,
  },
});
