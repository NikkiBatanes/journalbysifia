import React, { useCallback, useState } from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import {
  type ReviewType,
  type LocalReviewEntry,
  getLocalReviewsByType,
} from '../storage/reviewStorage';
import { toLocalDateString } from '../utils/date';

const REVIEW_TYPES: ReviewType[] = [
  'weekly',
  'monthly',
  'quarterly',
  'year_end',
  'begin_year',
];

const TYPE_LABELS: Record<ReviewType, string> = {
  weekly: 'Weekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  year_end: 'Year End',
  begin_year: 'Begin Year',
};

const PastReviewsScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const [reviews, setReviews] = useState<LocalReviewEntry[]>([]);

  const loadReviews = useCallback(async () => {
    const all = await Promise.all(
      REVIEW_TYPES.map(type => getLocalReviewsByType(type)),
    );
    const flat = all.flat().sort((a, b) => {
      const aDate = new Date(a.createdAt).getTime();
      const bDate = new Date(b.createdAt).getTime();
      return bDate - aDate;
    });
    setReviews(flat);
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadReviews();
    }, [loadReviews]),
  );

  const formatPeriod = (start: string, end: string) => {
    const s = new Date(start);
    const e = new Date(end);
    const month = s.toLocaleString('default', { month: 'short' }).toUpperCase();
    return `${month} ${s.getDate()}–${e.getDate()}`;
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
          Past Reviews
        </ThemedText>
        <TouchableOpacity
          style={styles.closeButton}
          onPress={() => {
            triggerLightHaptic();
            navigation.navigate('ReviewSettings');
          }}
          activeOpacity={0.7}>
          <Ionicons name="settings-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingTop: 24,
          paddingBottom: insets.bottom + 28,
          paddingHorizontal: 24,
        }}
        showsVerticalScrollIndicator={false}>
        {reviews.length === 0 ? (
          <ThemedText style={styles.empty}>
            No reviews yet. They’ll appear here once you complete or save one.
          </ThemedText>
        ) : (
          reviews.map(review => (
            <TouchableOpacity
              key={`${review.type}-${review.id}`}
              style={styles.card}
              onPress={() => {
                triggerLightHaptic();
                navigation.navigate('Review', {
                  type: review.type,
                  periodStart: review.periodStart,
                  periodEnd: review.periodEnd,
                });
              }}
              activeOpacity={0.7}>
              <View style={styles.cardHeader}>
                <ThemedText weight="semiBold" style={styles.cardType}>
                  {TYPE_LABELS[review.type].toUpperCase()}
                </ThemedText>
                <ThemedText style={styles.cardStatus}>
                  {review.status === 'completed' ? 'Completed' : 'Draft'}
                </ThemedText>
              </View>
              <ThemedText style={styles.cardPeriod}>
                {formatPeriod(review.periodStart, review.periodEnd)}
              </ThemedText>
              <ThemedText style={styles.cardMeta}>
                {review.memorableItems.length} carried · {Object.keys(review.answers).length} answers
              </ThemedText>
            </TouchableOpacity>
          ))
        )}
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
  empty: {
    fontSize: 16,
    color: Colors.textGray,
    textAlign: 'center',
    marginTop: 48,
  },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  cardType: {
    fontSize: 12,
    letterSpacing: 1,
    color: Colors.sage,
  },
  cardStatus: {
    fontSize: 12,
    color: Colors.textGray,
  },
  cardPeriod: {
    fontFamily: Fonts.lora.bold,
    fontSize: 18,
    color: Colors.text,
    marginBottom: 4,
  },
  cardMeta: {
    fontSize: 14,
    color: Colors.textGray,
  },
});

export default PastReviewsScreen;
