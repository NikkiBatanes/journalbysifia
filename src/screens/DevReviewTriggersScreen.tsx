import React, { useMemo } from 'react';
import { ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import { toLocalDateString } from '../utils/date';
import {
  getWeeklyPeriodFor,
  getMonthlyPeriodFor,
  getQuarterlyPeriodFor,
} from '../services/reviewPeriodService';
import { type ReviewType } from '../storage/reviewStorage';

interface TriggerItem {
  type: ReviewType;
  label: string;
  periodStart: string;
  periodEnd: string;
}

const DevReviewTriggersScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();

  const triggers = useMemo<TriggerItem[]>(() => {
    const today = new Date();
    const todayStr = toLocalDateString(today);
    const y = today.getFullYear();
    const m = today.getMonth();
    const beginYearYear = m === 0 ? y : y - 1;

    const weekly = getWeeklyPeriodFor(0, todayStr);
    const monthly = getMonthlyPeriodFor(todayStr);
    const quarterly = getQuarterlyPeriodFor(todayStr);

    return [
      {
        type: 'weekly',
        label: 'Weekly Review',
        periodStart: weekly.periodStart,
        periodEnd: weekly.periodEnd,
      },
      {
        type: 'monthly',
        label: 'Monthly Review',
        periodStart: monthly.periodStart,
        periodEnd: monthly.periodEnd,
      },
      {
        type: 'quarterly',
        label: 'Quarterly Review',
        periodStart: quarterly.periodStart,
        periodEnd: quarterly.periodEnd,
      },
      {
        type: 'year_end',
        label: 'Year End Review',
        periodStart: `${y - 1}-01-01`,
        periodEnd: `${y - 1}-12-31`,
      },
      {
        type: 'begin_year',
        label: 'Begin Year Review',
        periodStart: `${beginYearYear}-01-01`,
        periodEnd: `${beginYearYear}-01-14`,
      },
    ];
  }, []);

  const openReview = (type: ReviewType, periodStart: string, periodEnd: string) => {
    triggerLightHaptic();
    (navigation as any).navigate('MainTabs', {
      screen: 'Journal',
      params: {
        screen: 'Review',
        params: { type, periodStart, periodEnd },
      },
    });
  };

  const openPastReviews = () => {
    triggerLightHaptic();
    (navigation as any).navigate('MainTabs', {
      screen: 'Journal',
      params: {
        screen: 'PastReviews',
      },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} />
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
          Dev Review Flows
        </ThemedText>
        <View style={styles.closeButton} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}>
        <ThemedText style={styles.body}>
          Tap any review below to open its full stage flow. This is for testing only.
        </ThemedText>

        {triggers.map((trigger, i) => (
          <TouchableOpacity
            key={trigger.type}
            style={[styles.button, i === 0 ? undefined : { marginTop: 12 }]}
            onPress={() => openReview(trigger.type, trigger.periodStart, trigger.periodEnd)}
            activeOpacity={0.7}>
            <ThemedText weight="bold" style={styles.buttonText}>
              {trigger.label}
            </ThemedText>
            <ThemedText style={styles.period}>
              {trigger.periodStart} → {trigger.periodEnd}
            </ThemedText>
          </TouchableOpacity>
        ))}

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={openPastReviews}
          activeOpacity={0.7}>
          <ThemedText weight="bold" style={styles.secondaryButtonText}>
            Past Reviews
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
  body: {
    fontSize: 14,
    lineHeight: 21,
    color: Colors.textGray,
    marginBottom: 24,
  },
  button: {
    backgroundColor: Colors.sage,
    borderRadius: 18,
    padding: 18,
  },
  buttonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  period: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 4,
  },
  secondaryButton: {
    marginTop: 24,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.text,
  },
});

export default DevReviewTriggersScreen;
