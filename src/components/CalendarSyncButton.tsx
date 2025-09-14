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
import { calendarSyncService, CalendarEvent } from '../services/calendarSyncService';
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
  const calendarGating = useCalendarGating();
  const [isLoading, setIsLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'synced' | 'unsynced' | 'error'>
    (calendarEventId ? 'synced' : 'unsynced');

  const handleSync = async () => {
    // Check permissions first
    if (!calendarGating.canSyncToCalendar) {
      calendarGating.handleCalendarLockTap();
      return;
    }

    setIsLoading(true);
    triggerLightHaptic();

    try {
      const calendarEvent: CalendarEvent = {
        id: calendarEventId,
        title: timeBlock.title,
        startDate: timeBlock.startTime,
        endDate: timeBlock.endTime,
        location: timeBlock.location,
        notes: timeBlock.notes,
        allDay: timeBlock.isAllDay,
        timeBlockId: timeBlock.id,
      };

      // Add recurrence rule if repeat is set
      if (timeBlock.repeat.frequency !== 'never') {
        calendarEvent.recurrenceRule = {
          frequency: timeBlock.repeat.frequency as any,
          interval: timeBlock.repeat.customFrequency?.value || 1,
          endDate: timeBlock.repeat.endDate,
          daysOfWeek: timeBlock.repeat.customDays,
        };
      }

      const result = await calendarSyncService.syncToCalendar(
        calendarEvent,
        !!calendarEventId
      );

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
        Alert.alert(
          'Sync Failed',
          result.error || 'Failed to sync to calendar. Please try again.',
          [{ text: 'OK' }]
        );
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
    if (!calendarEventId) return;

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
              const result = await calendarSyncService.deleteFromCalendar(
                calendarEventId,
                { type: 'all' },
                timeBlock.id
              );

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
      return <MaterialCommunityIcons name="lock" size={16} color={Colors.mediumGray} />;
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
