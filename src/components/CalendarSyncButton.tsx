/**
 * Calendar Sync Button Component
 * Shows sync status and handles calendar integration with feature gating
 */

import React, { useState, useRef, useEffect } from 'react';
import { Logger } from '../utils/ProductionLogger';
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
import { syncTimeBlockToCalendar, removeTimeBlockFromCalendar, updateTimeBlockInCalendar } from '../services/calendarSyncService';
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
  const [syncStatus, setSyncStatus] = useState<'synced' | 'unsynced' | 'syncing' | 'error'>(calendarEventId ? 'synced' : 'unsynced');

  // Check if auto-sync is enabled
  const userPreferences = user?.user_metadata?.preferences || {};
  const autoSyncEnabled = userPreferences.calendar?.autoSync || false;

  // Prevent duplicate sync calls
  const syncInProgress = useRef(false);

  // Update sync status when calendarEventId prop changes
  useEffect(() => {
    setSyncStatus(calendarEventId ? 'synced' : 'unsynced');
  }, [calendarEventId]);

  const handleSync = async () => {
    // Prevent duplicate calls
    if (syncInProgress.current || isLoading) {

      return;
    }

    if (!calendarGating.canSyncToCalendar) {

      calendarGating.handleCalendarLockTap();
      return;
    }

    syncInProgress.current = true;
    setSyncStatus('syncing');
    triggerLightHaptic();

    try {
      let result;

      // If already synced, update the existing event instead of creating a new one
      if (calendarEventId) {

        const updateResult = await updateTimeBlockInCalendar(calendarEventId, {
          ...timeBlock,
          repeat: {
            ...timeBlock.repeat,
            frequency: timeBlock.repeat.frequency as 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly',
          },
        });

        // If update failed (event might have been deleted from calendar), create a new one
        if (!updateResult.success) {
          Logger.warn('Calendar update failed, creating new event', {
            component: 'CalendarSyncButton',
            errorMessage: updateResult.error,
          });
          result = await syncTimeBlockToCalendar({
            ...timeBlock,
            repeat: {
              ...timeBlock.repeat,
              frequency: timeBlock.repeat.frequency as 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly',
            },
          });
        } else {
          result = { ...updateResult, eventId: calendarEventId };
        }

      } else {

        // First time sync - create new event
        result = await syncTimeBlockToCalendar({
          ...timeBlock,
          repeat: {
            ...timeBlock.repeat,
            frequency: timeBlock.repeat.frequency as 'never' | 'daily' | 'weekly' | 'monthly' | 'yearly',
          },
        });

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
      Logger.error('Calendar sync error', error as Error, { component: 'CalendarSyncButton' });
      setSyncStatus('error');
      Alert.alert(
        'Sync Error',
        'An unexpected error occurred. Please try again.',
        [{ text: 'OK' }]
      );
    } finally {
      setIsLoading(false);
      syncInProgress.current = false;
    }
  };

  const handleUnsync = async () => {
    if (!calendarEventId) {return;}

    const isRecurring = timeBlock.repeat?.frequency && timeBlock.repeat.frequency !== 'never';

    if (isRecurring) {
      // For recurring events, ask if user wants to remove all instances or just this one
      Alert.alert(
        'Remove Recurring Event',
        'This is a recurring event. What would you like to remove?',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Just This Event',
            onPress: async () => {
              setIsLoading(true);
              try {
                Logger.info('CalendarSyncButton: Removing single instance', { eventId: calendarEventId });
                const result = await removeTimeBlockFromCalendar(calendarEventId, {
                  type: 'single',
                  date: timeBlock.startTime,
                });
                Logger.info('CalendarSyncButton: Remove result', { result });

                if (result.success) {
                  Logger.info('CalendarSyncButton: Successfully removed single instance (series still synced)');
                  // Don't clear calendar_event_id for single instance removal - the series is still synced
                  triggerSelectionHaptic();
                  Alert.alert('Success', 'This event removed from calendar. Other recurring events remain synced.');
                } else {
                  Logger.error('CalendarSyncButton: Remove failed', { errorMessage: result.error });
                  Alert.alert(
                    'Remove Failed',
                    result.error || 'Failed to remove from calendar.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                Logger.error('CalendarSyncButton: Exception during remove', { error });
                Logger.error('Calendar remove error', error as Error, { component: 'CalendarSyncButton' });
                Alert.alert('Remove Error', 'An unexpected error occurred: ' + (error instanceof Error ? error.message : 'Unknown error'));
              } finally {
                setIsLoading(false);
              }
            },
          },
          {
            text: 'All Events',
            style: 'destructive',
            onPress: async () => {
              setIsLoading(true);
              try {
                Logger.info('CalendarSyncButton: Removing all instances', { eventId: calendarEventId });
                const result = await removeTimeBlockFromCalendar(calendarEventId, { type: 'all' });
                Logger.info('CalendarSyncButton: Remove result', { result });

                if (result.success) {
                  Logger.info('CalendarSyncButton: Successfully removed all instances, calling onSyncComplete(null)');
                  setSyncStatus('unsynced');
                  await onSyncComplete(null);
                  triggerSelectionHaptic();
                  Alert.alert('Success', 'All recurring events removed from calendar.');
                } else {
                  Logger.error('CalendarSyncButton: Remove failed', { errorMessage: result.error });
                  Alert.alert(
                    'Remove Failed',
                    result.error || 'Failed to remove from calendar.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                Logger.error('CalendarSyncButton: Exception during remove', { error });
                Logger.error('Calendar remove error', error as Error, { component: 'CalendarSyncButton' });
                Alert.alert('Remove Error', 'An unexpected error occurred: ' + (error instanceof Error ? error.message : 'Unknown error'));
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    } else {
      // For non-recurring events, show simple confirmation
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
                Logger.info('CalendarSyncButton: Removing calendar event', { eventId: calendarEventId });
                const result = await removeTimeBlockFromCalendar(calendarEventId);
                Logger.info('CalendarSyncButton: Remove result', { result });

                if (result.success) {
                  Logger.info('CalendarSyncButton: Successfully removed, calling onSyncComplete(null)');
                  setSyncStatus('unsynced');
                  await onSyncComplete(null);
                  triggerSelectionHaptic();
                  Alert.alert('Success', 'Time block removed from calendar.');
                } else {
                  Logger.error('CalendarSyncButton: Remove failed', { errorMessage: result.error });
                  Alert.alert(
                    'Remove Failed',
                    result.error || 'Failed to remove from calendar.',
                    [{ text: 'OK' }]
                  );
                }
              } catch (error) {
                Logger.error('CalendarSyncButton: Exception during remove', { error });
                Logger.error('Calendar remove error', error as Error, { component: 'CalendarSyncButton' });
                Alert.alert('Remove Error', 'An unexpected error occurred: ' + (error instanceof Error ? error.message : 'Unknown error'));
              } finally {
                setIsLoading(false);
              }
            },
          },
        ]
      );
    }
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
