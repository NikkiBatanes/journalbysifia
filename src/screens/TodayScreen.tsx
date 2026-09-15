import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StatusBar, StyleSheet, TouchableOpacity, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import { differenceInCalendarDays, endOfWeek, format, startOfWeek, subYears } from 'date-fns';

import PrayerToRevisit from '../components/dashboard/PrayerToRevisit';
import ThemedText from '../components/common/ThemedText';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useScroll } from '../context/ScrollContext';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import { getReviewEligibility, type ReviewEligibilityResult } from '../services/reviewEligibilityService';
import { getLocalReviewsByType, type LocalReviewEntry } from '../storage/reviewStorage';
import { preloadScripturePassages } from '../services/scriptureReaderService';

const SectionHeading = ({ title, detail }: { title: string; detail: string }) => (
  <View style={styles.sectionHeading}>
    <ThemedText style={styles.eyebrow}>{title}</ThemedText>
    <ThemedText style={styles.sectionDetail}>{detail}</ThemedText>
  </View>
);

const IconTile = ({ icon, family = 'ion' }: { icon: string; family?: 'ion' | 'material' }) => (
  <View style={styles.iconTile}>
    {family === 'material'
      ? <MaterialCommunityIcons name={icon} size={25} color={Colors.sage} />
      : <Ionicons name={icon} size={25} color={Colors.sage} />}
  </View>
);

const Stagger = ({ children }: { children: React.ReactNode }) => (
  <View style={{ width: '100%' }}>
    {React.Children.toArray(children).map((child, i) =>
      child != null ? (
        <Animated.View
          key={i}
          entering={FadeInUp.delay(i * 80).springify().damping(14).stiffness(180)}
        >
          {child}
        </Animated.View>
      ) : null
    )}
  </View>
);

const TodayScreen = () => {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { user, preferences: appPreferences, profile } = useAuth();
  const { showTabBar, setShowTabBar } = useScroll();
  const lastScrollYRef = useRef(0);
  const tabBarCollapsedRef = useRef(false);
  const now = useMemo(() => new Date(), []);
  const weekStartsOn = Math.max(0, ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'].indexOf(appPreferences?.weekStart || 'sunday')) as 0 | 1 | 2 | 3 | 4 | 5 | 6;
  const weekLabel = useMemo(() => {
    const start = startOfWeek(now, { weekStartsOn });
    const end = endOfWeek(now, { weekStartsOn });
    return `${format(start, 'MMM d')}–${format(end, start.getMonth() === end.getMonth() ? 'd' : 'MMM d')}`.toUpperCase();
  }, [now, weekStartsOn]);
  const firstName = useMemo(() => {
    const metadata = profile;
    const value = metadata?.first_name || metadata?.full_name || user?.email?.split('@')[0] || 'Friend';
    return String(value).trim().split(/\s+/)[0];
  }, [user, profile]);

  useEffect(() => {
    const createdAt = (user as any)?.created_at;
    const start = createdAt ? new Date(createdAt) : now;
    const psalmNumber = (Math.max(0, differenceInCalendarDays(now, start)) % 150) + 1;
    preloadScripturePassages([
      `Psalm ${psalmNumber}`,
      `Proverbs ${now.getDate()}`,
    ]);
  }, [now, user]);

  const [eligibility, setEligibility] = useState<ReviewEligibilityResult | null>(null);
  const [weeklyReview, setWeeklyReview] = useState<LocalReviewEntry | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    getReviewEligibility().then(setEligibility);
    getLocalReviewsByType('weekly').then(reviews => {
      const sorted = [...reviews].sort((a, b) =>
        b.periodEnd.localeCompare(a.periodEnd),
      );
      setWeeklyReview(sorted[0] ?? null);
    });
  }, []);

  useFocusEffect(
    useCallback(() => {
      setTick((t) => t + 1);
      lastScrollYRef.current = 0;
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);

      return () => {
        tabBarCollapsedRef.current = false;
        setShowTabBar(true);
      };
    }, [setShowTabBar])
  );

  useEffect(() => {
    if (showTabBar && lastScrollYRef.current > 60) {
      tabBarCollapsedRef.current = false;
    }
  }, [showTabBar]);

  const handleScroll = useCallback((event: any) => {
    const y = Math.max(0, event.nativeEvent.contentOffset.y);
    const isScrollingUp = y < lastScrollYRef.current;
    lastScrollYRef.current = y;

    if (y > 60 && !tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = true;
      setShowTabBar(false);
    } else if (isScrollingUp && y <= 0 && tabBarCollapsedRef.current) {
      tabBarCollapsedRef.current = false;
      setShowTabBar(true);
    }
  }, [setShowTabBar]);

  const reviewCard = useMemo(() => {
    if (!eligibility?.main) {return null;}
    const main = eligibility.main;
    if (main.review.status === 'completed') {return null;}

    const typeLabel = main.type.replace('_', ' ');
    const periodStart = new Date(main.period.periodStart);
    const periodEnd = new Date(main.period.periodEnd);
    const month = periodStart.toLocaleString('default', { month: 'short' }).toUpperCase();
    const periodText = `${month} ${periodStart.getDate()}–${periodEnd.getDate()}`;

    return (
      <TouchableOpacity
        style={[styles.card, styles.reviewCard]}
        onPress={() => {
          triggerLightHaptic();
          (navigation as any).navigate('Journal', {
            screen: 'Review',
            params: { type: main.type, periodStart: main.period.periodStart, periodEnd: main.period.periodEnd },
          });
        }}
        activeOpacity={0.7}>
        <View style={styles.reviewHeader}>
          <ThemedText style={styles.reviewEyebrow}>TIME TO LOOK BACK</ThemedText>
          <Ionicons name="chevron-forward" size={20} color={Colors.sage} />
        </View>
        <ThemedText weight="bold" style={styles.reviewTitle}>
          {typeLabel.toUpperCase()} REVIEW
        </ThemedText>
        <ThemedText style={styles.reviewPeriod}>{periodText}</ThemedText>
        {eligibility.alsoReady.length > 0 ? (
          <ThemedText style={styles.reviewAlso}>
            Also ready: {eligibility.alsoReady.map(a => a.type.replace('_', ' ')).join(', ')}
          </ThemedText>
        ) : null}
      </TouchableOpacity>
    );
  }, [eligibility, navigation]);

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.content, { paddingTop: insets.top, paddingBottom: insets.bottom + 80 }]}
        showsVerticalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        <Stagger key={tick}>
          <ThemedText style={styles.date}>{format(now, 'EEE, MMM d').toUpperCase()}</ThemedText>
        <ThemedText style={styles.greeting}>Hi, {firstName}.</ThemedText>
        <ThemedText style={styles.subtitle}>Begin where you are.</ThemedText>

        {reviewCard}

        <SectionHeading title="MORNING" detail="your daily rhythm" />
        <View style={[styles.card, styles.heroCard]}>
          <View style={styles.sunCircle}>
            <Ionicons name="sunny-outline" size={29} color={Colors.hopeWhite} />
          </View>
          <ThemedText style={styles.cardTitle}>Begin your day.</ThemedText>
          <ThemedText style={styles.body}>A gentle morning rhythm for your heart and your day. Check in, begin with a Psalm, choose what matters, and set your priorities.</ThemedText>
          <View style={styles.cardFooter}>
            <ThemedText style={styles.meta}>Check in · Psalm · Focus · Priorities</ThemedText>
            <TouchableOpacity
              style={styles.beginButton}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Begin your day"
              onPress={() => {
                triggerLightHaptic();
                (navigation as any).navigate('MorningFlow', {
                  selectedDate: new Date().toISOString(),
                  screen: 'EmotionCheckIn',
                });
              }}
            >
              <Pencil size={16} color={Colors.hopeWhite} style={styles.beginButtonIcon} />
              <ThemedText weight="medium" style={styles.beginButtonText}>Begin</ThemedText>
            </TouchableOpacity>
          </View>
        </View>

        <SectionHeading title="YOUR RHYTHM" detail="for this season" />
        {weeklyReview ? (
          <TouchableOpacity
            style={[styles.card, styles.weeklyPreviewCard]}
            activeOpacity={0.7}
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('Journal', {
                screen: 'Review',
                params: {
                  type: 'weekly',
                  periodStart: weeklyReview.periodStart,
                  periodEnd: weeklyReview.periodEnd,
                },
              });
            }}>
            <ThemedText style={styles.cardLabel}>FROM YOUR WEEK · {weekLabel}</ThemedText>
            <ThemedText style={styles.compactTitle}>You said this mattered.</ThemedText>
            {(['priority_1', 'priority_2', 'priority_3'] as const).map(key =>
              weeklyReview.answers[key]?.trim() ? (
                <View key={key} style={styles.priorityRow}>
                  <ThemedText style={styles.priorityBullet}>○</ThemedText>
                  <ThemedText style={styles.priorityText}>{weeklyReview.answers[key]}</ThemedText>
                </View>
              ) : null,
            )}
            {weeklyReview.answers.faithful_step?.trim() ? (
              <View style={styles.faithfulStepBox}>
                <ThemedText style={styles.meta}>One faithful step</ThemedText>
                <ThemedText style={styles.faithfulStepText}>{weeklyReview.answers.faithful_step}</ThemedText>
              </View>
            ) : null}
            <ThemedText style={styles.textLink}>Look back into this week →</ThemedText>
          </TouchableOpacity>
        ) : (
          <View style={styles.card}>
            <ThemedText style={styles.cardLabel}>THIS WEEK · {weekLabel}</ThemedText>
            <ThemedText style={styles.compactTitle}>Take a moment to look back.</ThemedText>
            <ThemedText style={styles.body}>Your weekly review is ready whenever you are. Notice what happened before you move into another week.</ThemedText>
            <View style={[styles.button, styles.leftButton]}><ThemedText style={styles.buttonText}>Weekly Review  →</ThemedText></View>
          </View>
        )}

        <SectionHeading title="JOURNAL" detail="write anytime" />
        <TouchableOpacity
          style={[styles.card, styles.rowCard]}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Open Heart Journal"
          onPress={() => {
            triggerLightHaptic();
            (navigation as any).navigate('Journal', {
              screen: 'ReflectionEditor',
              params: {
                selectedDate: new Date().toISOString(),
                initialMode: 'free-form',
                source: 'freeform',
                fromCarousel: true,
                openHeart: true,
                returnTo: 'Today',
              },
            });
          }}
        >
          <IconTile icon="heart" />
          <View style={styles.rowCopy}>
            <ThemedText weight="bold" style={styles.rowTitle}>Heart Journal</ThemedText>
            <ThemedText style={styles.meta}>What’s on your heart right now?</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.chevronColor} />
        </TouchableOpacity>
        <View style={styles.twoColumns}>
          <View style={[styles.card, styles.smallCard]}>
            <IconTile icon="sunny" />
            <ThemedText weight="bold" style={styles.smallTitle}>Reflection</ThemedText>
            <ThemedText style={styles.meta}>Choose a gentle prompt.</ThemedText>
          </View>
          <TouchableOpacity
            style={[styles.card, styles.smallCard]}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Open Bible Study"
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('Journal', {
                screen: 'BibleStudy',
                params: {
                  selectedDate: new Date().toISOString(),
                  returnTo: 'Today',
                },
              });
            }}
          >
            <IconTile icon="book" family="material" />
            <ThemedText weight="bold" style={styles.smallTitle}>Bible Study</ThemedText>
            <ThemedText style={styles.meta}>Read, notice, and go deeper.</ThemedText>
          </TouchableOpacity>
        </View>

        <SectionHeading title="EVENING" detail="close the day gently" />
        <View style={[styles.card, styles.heroCard]}>
          <View style={[styles.sunCircle, styles.moonCircle]}>
            <Ionicons name="moon" size={26} color={Colors.sage} />
          </View>
          <ThemedText style={styles.cardTitle}>Reflect on your day.</ThemedText>
          <ThemedText style={styles.body}>Give thanks, remember what mattered, and close with wisdom.</ThemedText>
          <TouchableOpacity
            style={[styles.beginButton, styles.leftButton]}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Reflect on your day"
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('EveningFlow', {
                screen: 'Gratitude',
                params: { selectedDate: new Date().toISOString(), routine: 'evening' },
              });
            }}
          >
            <Pencil size={16} color={Colors.hopeWhite} style={styles.beginButtonIcon} />
            <ThemedText weight="medium" style={styles.beginButtonText}>Begin</ThemedText>
          </TouchableOpacity>
        </View>

        <SectionHeading title="PRAYER" detail="bring it before God" />
        <View style={[styles.card, styles.rowCard]}>
          <IconTile icon="clover" family="material" />
          <View style={styles.rowCopy}>
            <ThemedText weight="bold" style={styles.rowTitle}>Prayer Journal</ThemedText>
            <ThemedText style={styles.meta}>Open Prayer · CAST · Pray for Someone</ThemedText>
          </View>
          <Ionicons name="chevron-forward" size={24} color={Colors.chevronColor} />
        </View>

        <SectionHeading title="REMEMBER" detail="from your journal" />
        <View style={[styles.card, styles.memoryCard]}>
          <View style={styles.memoryTop}>
            <ThemedText style={styles.cardLabel}>ON THIS DAY</ThemedText>
            <ThemedText style={styles.meta}>1 year ago</ThemedText>
          </View>
          <ThemedText style={styles.quote}>“I don’t know what happens next. That’s why I am writing this now.”</ThemedText>
          <ThemedText style={styles.meta}>{format(subYears(now, 1), 'MMMM d, yyyy')} · Heart Journal</ThemedText>
          <ThemedText style={styles.textLink}>Read this entry  →</ThemedText>
        </View>
        <PrayerToRevisit />

        <View style={styles.writeButton}>
          <Pencil size={16} color={Colors.hopeWhite} style={{ marginRight: 8 }} />
          <ThemedText weight="bold" style={styles.writeButtonText}>Write anything</ThemedText>
        </View>
        <ThemedText style={styles.closing}>Nothing on Today has to be completed.</ThemedText>

        {__DEV__ ? (
          <TouchableOpacity
            style={[styles.card, styles.rowCard]}
            activeOpacity={0.7}
            onPress={() => {
              triggerLightHaptic();
              (navigation as any).navigate('DevReviewTriggers');
            }}>
            <Ionicons name="bug-outline" size={25} color={Colors.sage} />
            <View style={styles.rowCopy}>
              <ThemedText weight="bold" style={styles.rowTitle}>Dev review flows</ThemedText>
              <ThemedText style={styles.meta}>Open any review cadence for testing</ThemedText>
            </View>
            <Ionicons name="chevron-forward" size={24} color={Colors.chevronColor} />
          </TouchableOpacity>
        ) : null}
        </Stagger>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: Colors.lightBackground },
  scroll: { flex: 1 },
  content: { paddingHorizontal: 18, maxWidth: 760, width: '100%', alignSelf: 'center' },
  date: { color: Colors.sageMuted, fontFamily: Fonts.semiBold, fontSize: 12, lineHeight: 16, letterSpacing: 1.8 },
  greeting: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 31, lineHeight: 39, marginTop: 8, letterSpacing: -0.5 },
  subtitle: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 22, marginTop: 2, marginBottom: 20 },
  sectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginTop: 24, marginBottom: 10, paddingHorizontal: 2 },
  eyebrow: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 12, lineHeight: 16, letterSpacing: 2 },
  sectionDetail: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12, lineHeight: 17, textAlign: 'right' },
  card: { backgroundColor: Colors.cardBackground, borderColor: Colors.cardBorder, borderWidth: 1, borderRadius: 22, padding: 18, shadowColor: Colors.darkBackground, shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.04, shadowRadius: 12, elevation: 2 },
  heroCard: { padding: 20 },
  sunCircle: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.sage, marginBottom: 16 },
  moonCircle: { backgroundColor: Colors.anchorBlueLight },
  cardTitle: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 23, lineHeight: 30, marginBottom: 7, letterSpacing: -0.35 },
  compactTitle: { color: Colors.text, fontFamily: Fonts.bold, fontWeight: '900', fontSize: 21, lineHeight: 28, marginTop: 9, marginBottom: 6, letterSpacing: -0.3 },
  body: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 14, lineHeight: 21 },
  meta: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12.5, lineHeight: 19 },
  cardLabel: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 11, lineHeight: 15, letterSpacing: 1.7 },
  cardFooter: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 20 },
  button: { backgroundColor: Colors.sage, paddingHorizontal: 17, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  beginButton: { backgroundColor: Colors.sage, borderWidth: 1, borderColor: Colors.sage, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, minWidth: 120, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  beginButtonIcon: { marginRight: 8 },
  beginButtonText: { fontSize: 15, color: Colors.hopeWhite, letterSpacing: 0.5 },
  leftButton: { alignSelf: 'flex-start', marginTop: 16 },
  buttonText: { color: Colors.hopeWhite, fontFamily: Fonts.semiBold, fontSize: 12 },
  rowCard: { minHeight: 98, flexDirection: 'row', alignItems: 'center', gap: 14 },
  iconTile: { width: 52, height: 52, borderRadius: 18, backgroundColor: Colors.anchorBlueLight, alignItems: 'center', justifyContent: 'center' },
  rowCopy: { flex: 1, gap: 1 },
  rowTitle: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 16, lineHeight: 22 },
  twoColumns: { flexDirection: 'row', gap: 12, marginTop: 12 },
  smallCard: { flex: 1, minHeight: 154, justifyContent: 'space-between', padding: 16 },
  smallTitle: { color: Colors.text, fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20, marginTop: 16 },
  memoryCard: { overflow: 'hidden', marginBottom: 12 },
  memoryTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  quote: { color: Colors.text, fontFamily: Fonts.lora.medium, fontSize: 22, lineHeight: 32, marginVertical: 18 },
  textLink: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 12.5, marginTop: 18 },
  prayerMemory: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 18 },
  chips: { flexDirection: 'row', gap: 8, marginTop: 18 },
  chip: { borderWidth: 1, borderColor: Colors.cardBorder, borderRadius: 20, paddingHorizontal: 14, paddingVertical: 9 },
  chipText: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 12 },
  writeButton: { height: 58, borderRadius: 20, backgroundColor: Colors.sage, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 20 },
  writeButtonText: { color: Colors.hopeWhite, fontFamily: Fonts.semiBold, fontSize: 17 },
  closing: { color: Colors.textGray, fontFamily: Fonts.regular, fontSize: 12, textAlign: 'center', marginTop: 12 },
  reviewCard: { backgroundColor: Colors.sage, borderColor: Colors.sage, marginBottom: 4 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  reviewEyebrow: { color: Colors.hopeWhite, fontFamily: Fonts.semiBold, fontSize: 11, letterSpacing: 1.5, opacity: 0.9 },
  reviewTitle: { color: Colors.hopeWhite, fontFamily: Fonts.bold, fontSize: 21, marginTop: 6 },
  reviewPeriod: { color: Colors.hopeWhite, fontFamily: Fonts.regular, fontSize: 14, marginTop: 2, opacity: 0.95 },
  reviewAlso: { color: Colors.hopeWhite, fontFamily: Fonts.regular, fontSize: 12, marginTop: 10, opacity: 0.85 },
  weeklyPreviewCard: { padding: 18 },
  priorityRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginTop: 10 },
  priorityBullet: { color: Colors.sage, fontFamily: Fonts.semiBold, fontSize: 14, lineHeight: 21 },
  priorityText: { color: Colors.text, fontFamily: Fonts.regular, fontSize: 15, lineHeight: 21, flex: 1 },
  faithfulStepBox: { marginTop: 18, padding: 14, backgroundColor: Colors.anchorBlueLight, borderRadius: 14 },
  faithfulStepText: { color: Colors.text, fontFamily: Fonts.lora.medium, fontSize: 17, lineHeight: 24, marginTop: 6 },
});

export default TodayScreen;
