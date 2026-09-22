import { useAuth } from '../context/IndustryStandardAuthContext';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ScrollView,
  Platform,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import {
  getReviewSettings,
  setReviewSettings,
  type ReviewSettings,
  DEFAULT_REVIEW_SETTINGS,
} from '../storage/reviewSettingsStorage';
import { rescheduleReviewNotifications } from '../services/reviewNotificationService';
import { type ReviewType } from '../storage/reviewStorage';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const CADENCE_LABELS: Record<ReviewType, string> = {
  weekly: 'Weekly review',
  monthly: 'Monthly review',
  quarterly: 'Quarterly review',
  year_end: 'Year End review',
  begin_year: 'Begin Year review',
};

const CADENCE_ORDER: ReviewType[] = [
  'weekly',
  'monthly',
  'quarterly',
  'year_end',
  'begin_year',
];

const isValidTime = (value: string): boolean => {
  return /^([01]?\d|2[0-3]):([0-5]\d)$/.test(value);
};

const timeValueToDate = (value: string): Date => {
  const date = new Date();
  const [hour = 19, minute = 0] = value.split(':').map(Number);
  date.setHours(hour, minute, 0, 0);
  return date;
};

const dateToTimeValue = (date: Date): string =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

const formatTwelveHourTime = (value: string): string => {
  const [hour = 19, minute = 0] = value.split(':').map(Number);
  const period = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${String(minute).padStart(2, '0')} ${period}`;
};

const ReviewSettingsScreen: React.FC = () => {
  const { preferences } = useAuth();
  const weekStart = preferences?.weekStart || 'monday';
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === 'android' ? StatusBar.currentHeight ?? 0 : 0);
  const [settings, setLocalSettings] = useState<ReviewSettings | null>(null);
  const [showTimePicker, setShowTimePicker] = useState(false);

  useEffect(() => {
    getReviewSettings(weekStart).then(setLocalSettings);
  }, [weekStart]);

  const update = useCallback((patch: Partial<ReviewSettings>) => {
    setLocalSettings(prev => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const toggleCadence = useCallback((type: ReviewType) => {
    setLocalSettings(prev => {
      if (!prev) {return prev;}
      return {
        ...prev,
        enabledCadences: {
          ...prev.enabledCadences,
          [type]: !prev.enabledCadences[type],
        },
      };
    });
  }, []);

  const save = useCallback(async () => {
    if (!settings) {return;}
    if (!isValidTime(settings.reminderTime)) {
      // fallback to default if user typed something invalid
      settings.reminderTime = DEFAULT_REVIEW_SETTINGS.reminderTime;
    }
    await setReviewSettings(settings);
    await rescheduleReviewNotifications();
    triggerLightHaptic();
    navigation.goBack();
  }, [settings, navigation]);

  if (!settings) {
    return (
      <SafeAreaView style={[styles.safeArea, { paddingTop: topInset }]} edges={['left', 'right']}>
        <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} translucent={false} />
        <View style={styles.loading}>
          <ThemedText style={styles.sectionTitle}>Loading…</ThemedText>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safeArea, { paddingTop: topInset }]} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} translucent={false} />
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            triggerLightHaptic();
            navigation.goBack();
          }}
          activeOpacity={0.7}>
          <Ionicons name="close" size={20} color={Colors.text} />
        </TouchableOpacity>
        <ThemedText weight="bold" style={styles.title}>
          Review Settings
        </ThemedText>
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 8,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}>
        <ThemedText weight="semiBold" style={styles.sectionTitle}>Review week</ThemedText>
        <ThemedText style={styles.toggleLabel}>
          {DAY_NAMES[(settings.weekEndsOn + 1) % 7]}–{DAY_NAMES[settings.weekEndsOn]} · follows Week Start in Profile
        </ThemedText>

        <ThemedText weight="semiBold" style={styles.sectionTitle}>
          Reminder time
        </ThemedText>
        <TouchableOpacity
          style={styles.timeInput}
          onPress={() => {
            triggerLightHaptic();
            setShowTimePicker(true);
          }}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel={`Reminder time, ${formatTwelveHourTime(settings.reminderTime)}`}>
          <ThemedText weight="semiBold" style={styles.timeText}>
            {formatTwelveHourTime(settings.reminderTime)}
          </ThemedText>
          <Ionicons name="time-outline" size={20} color={Colors.sage} />
        </TouchableOpacity>
        {showTimePicker && (
          <View style={styles.timePickerContainer}>
            <DateTimePicker
              value={timeValueToDate(settings.reminderTime)}
              mode="time"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              is24Hour={false}
              locale="en-US"
              onChange={(event, selectedTime) => {
                if (Platform.OS === 'android') {
                  setShowTimePicker(false);
                }
                if (event.type !== 'dismissed' && selectedTime) {
                  update({ reminderTime: dateToTimeValue(selectedTime) });
                }
              }}
            />
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={styles.timePickerDone}
                onPress={() => {
                  triggerLightHaptic();
                  setShowTimePicker(false);
                }}
                activeOpacity={0.7}>
                <ThemedText weight="semiBold" style={styles.timePickerDoneText}>Done</ThemedText>
              </TouchableOpacity>
            )}
          </View>
        )}

        <ThemedText weight="semiBold" style={styles.sectionTitle}>
          Review cadences
        </ThemedText>
        {CADENCE_ORDER.map(type => (
          <TouchableOpacity
            key={type}
            style={styles.toggleRow}
            onPress={() => toggleCadence(type)}
            activeOpacity={0.7}>
            <ThemedText style={styles.toggleLabel}>
              {CADENCE_LABELS[type]}
            </ThemedText>
            <View
              style={[
                styles.togglePill,
                settings.enabledCadences[type] && styles.togglePillActive,
              ]}>
              <Ionicons
                name={settings.enabledCadences[type] ? 'checkmark' : 'close'}
                size={14}
                color={
                  settings.enabledCadences[type] ? Colors.hopeWhite : Colors.textGray
                }
              />
            </View>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={styles.saveButton}
          onPress={save}
          activeOpacity={0.7}>
          <ThemedText weight="bold" style={styles.saveButtonText}>
            Save
          </ThemedText>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 12,
  },
  closeButton: {
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontFamily: Fonts.lora.bold,
    fontSize: 24,
    color: Colors.text,
  },
  sectionTitle: {
    fontSize: 16,
    color: Colors.text,
    marginTop: 24,
    marginBottom: 12,
  },
  dayRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  dayButton: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    backgroundColor: Colors.cardBackground,
  },
  dayButtonActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  dayText: {
    fontSize: 14,
    color: Colors.text,
  },
  dayTextActive: {
    color: Colors.hopeWhite,
  },
  timeInput: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
  },
  timeText: {
    fontSize: 18,
    color: Colors.text,
  },
  timePickerContainer: {
    marginTop: 10,
    padding: 12,
    borderRadius: 16,
    backgroundColor: Colors.cardBackground,
  },
  timePickerDone: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    backgroundColor: Colors.sage,
  },
  timePickerDoneText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 16,
    marginBottom: 10,
  },
  toggleLabel: {
    fontSize: 15,
    color: Colors.text,
  },
  togglePill: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.cardBorder,
    justifyContent: 'center',
    alignItems: 'center',
  },
  togglePillActive: {
    backgroundColor: Colors.sage,
  },
  saveButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
  },
  saveButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
});

export default ReviewSettingsScreen;
