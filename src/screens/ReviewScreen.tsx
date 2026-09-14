import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  Animated,
  Keyboard,
  PanResponder,
  ScrollView,
  StatusBar,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';

import ThemedText from '../components/common/ThemedText';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import { triggerLightHaptic } from '../utils/haptics';
import { toLocalDateString } from '../utils/date';
import {
  type ReviewType,
  type LocalReviewEntry,
  type ReviewMemorableItem,
  getOrCreateLocalReviewForPeriod,
  updateLocalReview,
} from '../storage/reviewStorage';
import { getReviewSettings } from '../storage/reviewSettingsStorage';
import {
  getWeeklyPeriodFor,
  getMonthlyPeriodFor,
  getQuarterlyPeriodFor,
  getYearEndPeriodFor,
  getBeginYearPeriodFor,
  type ReviewPeriod,
} from '../services/reviewPeriodService';
import { getReviewCapture, type ReviewCapture, type ReviewCaptureKind } from '../services/reviewCaptureService';
import { getReviewStages, type ReviewStageConfig } from '../services/reviewStages';

const AnimatedTouchableOpacity =
  Animated.createAnimatedComponent(TouchableOpacity);

type ReviewStage = number;

const CATEGORY_LABELS: Record<ReviewCaptureKind, string> = {
  sermon: 'Sermons',
  prayer: 'Prayers',
  reflection: 'Reflections',
  scripture: 'Scripture',
  journal: 'Journal',
  gratitude: 'Gratitudes',
  win: 'Wins',
  morning: 'Morning',
  evening: 'Evening',
};

const ReviewScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const scrollRef = useRef<ScrollView>(null);

  const [stage, setStage] = useState<ReviewStage>(1);
  const [review, setReview] = useState<LocalReviewEntry | null>(null);
  const [reviewType, setReviewType] = useState<ReviewType>('weekly');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [memorableItems, setMemorableItems] = useState(review?.memorableItems ?? []);
  const [capture, setCapture] = useState<ReviewCapture | null>(null);

  const stages = useMemo(() => getReviewStages(reviewType), [reviewType]);
  const stageCount = stages.length;

  const typeFromRoute = route.params?.type as ReviewType | undefined;
  const startFromRoute = route.params?.periodStart as string | undefined;
  const endFromRoute = route.params?.periodEnd as string | undefined;

  const loadReview = useCallback(async () => {
    const anchor = toLocalDateString(new Date());
    const settings = await getReviewSettings();
    let type: ReviewType = typeFromRoute ?? 'weekly';
    let start = '';
    let end = '';

    if (typeFromRoute && startFromRoute && endFromRoute) {
      start = startFromRoute;
      end = endFromRoute;
    } else {
      let period: ReviewPeriod | null = null;
      switch (type) {
        case 'weekly':
          period = getWeeklyPeriodFor(settings.weekEndsOn, anchor);
          break;
        case 'monthly':
          period = getMonthlyPeriodFor(anchor);
          break;
        case 'quarterly':
          period = getQuarterlyPeriodFor(anchor);
          break;
        case 'year_end':
          period = getYearEndPeriodFor(anchor);
          break;
        case 'begin_year':
          period = getBeginYearPeriodFor(anchor);
          break;
      }

      if (!period) {
        start = anchor;
        end = anchor;
      } else {
        type = period.type;
        start = period.periodStart;
        end = period.periodEnd;
      }
    }

    const existing = await getOrCreateLocalReviewForPeriod({
      type,
      periodStart: start,
      periodEnd: end,
    });

    const captured = await getReviewCapture(start, end);

    setReview(existing);
    setReviewType(type);
    setPeriodStart(existing.periodStart);
    setPeriodEnd(existing.periodEnd);
    setAnswers(existing.answers);
    setMemorableItems(existing.memorableItems);
    setCapture(captured);
  }, [typeFromRoute, startFromRoute, endFromRoute]);

  useEffect(() => {
    loadReview();
  }, [loadReview]);

  const saveReview = useCallback(
    async (patch: Partial<Pick<LocalReviewEntry, 'answers' | 'memorableItems' | 'status' | 'completedAt'>>) => {
      if (!review) {return;}
      const updated = {
        ...review,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      await updateLocalReview(updated);
      setReview(updated);
    },
    [review],
  );

  useEffect(() => {
    if (stage === stageCount && review && review.status !== 'completed') {
      saveReview({ status: 'completed', completedAt: new Date().toISOString() });
    }
  }, [stage, stageCount, review, saveReview]);

  const goTo = useCallback(
    (next: ReviewStage) => {
      if (next < 1 || next > stageCount) {return;}
      triggerLightHaptic();
      Keyboard.dismiss();
      setStage(next);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    },
    [stageCount],
  );

  const stageRef = useRef(stage);
  const stageCountRef = useRef(stageCount);

  useEffect(() => {
    stageRef.current = stage;
  }, [stage]);

  useEffect(() => {
    stageCountRef.current = stageCount;
  }, [stageCount]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => false,
        onMoveShouldSetPanResponder: (_e, g) =>
          Math.abs(g.dx) > 12 && Math.abs(g.dy) < Math.abs(g.dx),
        onPanResponderRelease: (_e, g) => {
          const threshold = 40;
          if (g.dx < -threshold && stageRef.current < stageCountRef.current) {
            goTo(stageRef.current + 1);
          } else if (g.dx > threshold && stageRef.current > 1) {
            goTo(stageRef.current - 1);
          }
        },
      }),
    [goTo],
  );

  useFocusEffect(
    useCallback(() => {
      return () => {
        Keyboard.dismiss();
      };
    }, []),
  );

  const periodLabel = useMemo(() => {
    if (!periodStart || !periodEnd) {return '';}
    const start = new Date(periodStart);
    const end = new Date(periodEnd);
    const month = start.toLocaleString('default', { month: 'short' }).toUpperCase();
    return `${month} ${start.getDate()}–${end.getDate()}`;
  }, [periodStart, periodEnd]);

  const onAnswerChange = (beat: string, text: string) => {
    const next = { ...answers, [beat]: text };
    setAnswers(next);
    // Autosave draft
    saveReview({ answers: next });
  };

  const toggleMemorable = (item: { kind: ReviewMemorableItem['kind']; id: string; selectedDate: string }) => {
    const exists = memorableItems.find(
      m => m.id === item.id && m.selectedDate === item.selectedDate,
    );
    const next = exists
      ? memorableItems.filter(
          m => !(m.id === item.id && m.selectedDate === item.selectedDate),
        )
      : [...memorableItems, { kind: item.kind, id: item.id, selectedDate: item.selectedDate }];
    setMemorableItems(next);
    saveReview({ memorableItems: next });
  };

  const renderCurrentStage = (): React.ReactNode => {
    const current = stages[stage - 1];
    if (!current) {return null;}

    if (current.kind === 'cover') {
      const eyebrow = current.eyebrow ?? `${reviewType.replace('_', ' ').toUpperCase()} REVIEW`;
      return (
        <View style={styles.stage}>
          <ThemedText weight="semiBold" style={styles.eyebrow}>
            {eyebrow}
          </ThemedText>
          <ThemedText weight="bold" style={styles.title}>
            {periodLabel}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {current.subtitle}
          </ThemedText>

          {capture && (
            <View style={styles.captureStats}>
              <ThemedText weight="bold" style={styles.captureStatTotal}>
                {capture.items.length} moments from your {reviewType === 'weekly' ? 'week' : 'month'}
              </ThemedText>
              {Object.entries(capture.summary)
                .filter(([, count]) => count > 0)
                .map(([kind, count]) => (
                  <View key={kind} style={styles.captureStatRow}>
                    <ThemedText style={styles.captureStatLabel}>
                      {CATEGORY_LABELS[kind as ReviewCaptureKind]}
                    </ThemedText>
                    <ThemedText weight="semiBold" style={styles.captureStatValue}>
                      {count}
                    </ThemedText>
                  </View>
                ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => goTo(2)}
            activeOpacity={0.7}>
            <ThemedText weight="bold" style={styles.primaryButtonText}>
              {reviewType === 'year_end' ? 'Review my year' : 'Review my ' + reviewType.replace('_', ' ')}
            </ThemedText>
          </TouchableOpacity>

          {reviewType === 'weekly' && (
            <View style={styles.todayPreview}>
              <ThemedText style={styles.todayPreviewLabel}>
                FROM YOUR WEEK · {periodLabel}
              </ThemedText>
              <ThemedText style={styles.todayPreviewHeading}>
                You said this mattered.
              </ThemedText>
              {(['priority_1', 'priority_2', 'priority_3'] as const).map(key => {
                const text = answers[key]?.trim();
                return text ? (
                  <View key={key} style={styles.todayPreviewRow}>
                    <ThemedText style={styles.todayPreviewBullet}>○</ThemedText>
                    <ThemedText style={styles.todayPreviewText}>{text}</ThemedText>
                  </View>
                ) : null;
              })}
              {!answers.priority_1?.trim() && !answers.priority_2?.trim() && !answers.priority_3?.trim() ? (
                <>
                  <View style={styles.todayPreviewRow}>
                    <ThemedText style={styles.todayPreviewBullet}>○</ThemedText>
                    <ThemedText style={styles.todayPreviewText}>Finish Journal onboarding</ThemedText>
                  </View>
                  <View style={styles.todayPreviewRow}>
                    <ThemedText style={styles.todayPreviewBullet}>○</ThemedText>
                    <ThemedText style={styles.todayPreviewText}>Prepare for Friday meeting</ThemedText>
                  </View>
                  <View style={styles.todayPreviewRow}>
                    <ThemedText style={styles.todayPreviewBullet}>○</ThemedText>
                    <ThemedText style={styles.todayPreviewText}>Dinner with family</ThemedText>
                  </View>
                </>
              ) : null}
              <View style={styles.todayPreviewStep}>
                <ThemedText style={styles.todayPreviewMeta}>One faithful step</ThemedText>
                <ThemedText style={styles.todayPreviewStepText}>
                  {answers.faithful_step?.trim() || 'Send the message I’ve been putting off.'}
                </ThemedText>
              </View>
              <ThemedText style={styles.todayPreviewLink}>
                Look back into this week →
              </ThemedText>
            </View>
          )}
        </View>
      );
    }

    if (current.kind === 'captured') {
      return (
        <View style={styles.stage}>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {capture
              ? `${capture.items.length} moments from your ${reviewType === 'weekly' ? 'week' : 'month'}.`
              : 'Loading…'}
          </ThemedText>
          {capture?.items.map(item => {
            const isSel = memorableItems.some(
              m => m.id === item.id && m.selectedDate === item.selectedDate,
            );
            return (
              <View key={`${item.kind}-${item.id}`} style={styles.captureItem}>
                <View style={styles.captureItemHeader}>
                  <ThemedText weight="semiBold" style={styles.captureItemTitle}>
                    {item.title}
                  </ThemedText>
                  {item.subtitle ? (
                    <ThemedText style={styles.captureItemSubtitle}>
                      {item.subtitle} · {item.selectedDate}
                    </ThemedText>
                  ) : null}
                </View>
                <TouchableOpacity
                  style={[
                    styles.rememberButton,
                    isSel && styles.rememberButtonActive,
                  ]}
                  onPress={() => toggleMemorable(item)}
                  activeOpacity={0.8}>
                  <Ionicons
                    name={isSel ? 'heart' : 'heart-outline'}
                    size={14}
                    color={isSel ? Colors.hopeWhite : Colors.sage}
                  />
                  <ThemedText
                    weight="semiBold"
                    style={[
                      styles.rememberButtonText,
                      isSel && styles.rememberButtonTextActive,
                    ]}>
                    {isSel ? 'Remembered' : 'Remember this'}
                  </ThemedText>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>
      );
    }

    if (current.kind === 'remembered') {
      return (
        <View style={styles.stage}>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {memorableItems.length > 0
              ? `You chose ${memorableItems.length} thing${
                  memorableItems.length === 1 ? '' : 's'
                } to carry with this review.`
              : 'Tap the heart on anything you want to carry with this review.'}
          </ThemedText>
          {memorableItems
            .map(m => capture?.items.find(i => i.id === m.id && i.selectedDate === m.selectedDate))
            .filter(Boolean)
            .map(item => (
              <View key={`${item!.kind}-${item!.id}`} style={styles.captureItem}>
                <View style={styles.captureItemHeader}>
                  <ThemedText weight="semiBold" style={styles.captureItemTitle}>
                    {item!.title}
                  </ThemedText>
                  {item!.subtitle ? (
                    <ThemedText style={styles.captureItemSubtitle}>
                      {item!.subtitle} · {item!.selectedDate}
                    </ThemedText>
                  ) : null}
                </View>
              </View>
            ))}
        </View>
      );
    }

    if (current.kind === 'question') {
      return (
        <View style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && <Ionicons name={current.icon as any} size={16} color={Colors.sage} />}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.question}>
            {current.question}
          </ThemedText>
          <TextInput
            style={styles.input}
            multiline
            value={answers[current.answerKey!] ?? ''}
            onChangeText={t => onAnswerChange(current.answerKey!, t)}
            placeholder={current.placeholder ?? 'Start writing...'}
            placeholderTextColor={Colors.textGray}
            textAlignVertical="top"
          />
        </View>
      );
    }

    if (current.kind === 'priorities') {
      return (
        <View style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && <Ionicons name={current.icon as any} size={16} color={Colors.sage} />}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.question}>
            {current.question}
          </ThemedText>
          {current.subtitle ? (
            <ThemedText style={styles.subtitle}>{current.subtitle}</ThemedText>
          ) : null}
          {current.answerKeys!.map((key, index) => (
            <TextInput
              key={key}
              style={[styles.input, styles.shortInput]}
              value={answers[key] ?? ''}
              onChangeText={t => onAnswerChange(key, t)}
              placeholder={`${current.label} ${index + 1}`}
              placeholderTextColor={Colors.textGray}
            />
          ))}
        </View>
      );
    }

    if (current.kind === 'transition') {
      return (
        <View style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && <Ionicons name={current.icon as any} size={16} color={Colors.sage} />}
            <ThemedText weight="semiBold" style={styles.label}>
              {current.label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.title}>
            {current.title}
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            {current.subtitle}
          </ThemedText>
        </View>
      );
    }

    if (current.kind === 'ready') {
      const isMonthly = reviewType === 'monthly';
      const label = current.label ?? `${reviewType.replace('_', ' ').toUpperCase()} IS READY`;
      const periodNoun = isMonthly ? 'month' : 'week';

      const priorityKeys =
        reviewType === 'quarterly'
          ? ['quarter_priority_1', 'quarter_priority_2', 'quarter_priority_3']
          : isMonthly
          ? ['next_month_priority_1', 'next_month_priority_2', 'next_month_priority_3']
          : ['priority_1', 'priority_2', 'priority_3'];
      const priorityCount = priorityKeys.map(k => answers[k]).filter(Boolean).length;

      const summaryRows =
        reviewType === 'begin_year' ? (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What matters
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {priorityCount} priorities
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Posture
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.posture?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Scripture
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.scripture_begin?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What I’m entrusting
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.surrender?.trim() || '—'}
              </ThemedText>
            </View>
          </>
        ) : reviewType === 'year_end' ? (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Moments marked
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {memorableItems.length} thing
                {memorableItems.length === 1 ? '' : 's'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Prayers answered
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {capture?.prayerStats.answered ?? 0} prayer
                {capture?.prayerStats.answered === 1 ? '' : 's'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Still praying
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {capture?.prayerStats.pending ?? 0} prayer
                {capture?.prayerStats.pending === 1 ? '' : 's'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What I want to carry
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.carry?.trim() || '—'}
              </ThemedText>
            </View>
          </>
        ) : reviewType === 'quarterly' ? (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What matters
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {priorityCount} priorities
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                One faithful focus
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.faithfulness_quarter?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Important decision
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.decision?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What you’re carrying
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {memorableItems.length > 0
                  ? `${memorableItems.length} thing${
                      memorableItems.length === 1 ? '' : 's'
                    }`
                  : '—'}
              </ThemedText>
            </View>
          </>
        ) : isMonthly ? (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What matters
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {priorityCount} priorities
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What you’re carrying
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {memorableItems.length > 0
                  ? `${memorableItems.length} thing${
                      memorableItems.length === 1 ? '' : 's'
                    }`
                  : '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Prayer for next month
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.prayer_for_month?.trim() || '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Rhythm to protect
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.rhythm?.trim() || '—'}
              </ThemedText>
            </View>
          </>
        ) : (
          <>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What matters
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {priorityCount} priorities
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                What you’re carrying
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {memorableItems.length > 0
                  ? `${memorableItems.length} thing${
                      memorableItems.length === 1 ? '' : 's'
                    }`
                  : '—'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                Still in prayer
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {capture?.prayerStats.pending ?? 0} prayer
                {capture?.prayerStats.pending === 1 ? '' : 's'}
              </ThemedText>
            </View>
            <View style={styles.summaryRow}>
              <ThemedText weight="semiBold" style={styles.summaryKey}>
                One faithful step
              </ThemedText>
              <ThemedText style={styles.summaryValue}>
                {answers.faithful_step?.trim() || '—'}
              </ThemedText>
            </View>
          </>
        );

      return (
        <View style={styles.stage}>
          <View style={styles.labelRow}>
            {current.icon && <Ionicons name={current.icon as any} size={16} color={Colors.sage} />}
            <ThemedText weight="semiBold" style={styles.label}>
              YOUR {label}
            </ThemedText>
          </View>
          <ThemedText weight="bold" style={styles.title}>
            {periodLabel}
          </ThemedText>

          <View style={styles.summaryCard}>
            {summaryRows}
          </View>

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => {
              triggerLightHaptic();
              navigation.goBack();
            }}
            activeOpacity={0.7}>
            <ThemedText weight="bold" style={styles.primaryButtonText}>
              Done
            </ThemedText>
          </TouchableOpacity>
        </View>
      );
    }

    return null;
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['left', 'right']}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.lightBackground} />

      <View
        style={[
          styles.actionProgressBar,
          { top: insets.top + 25 },
        ]}
        pointerEvents="none">
        <View
          style={[
            styles.actionProgressFill,
            { width: `${(stage / stageCount) * 100}%` },
          ]}
        />
      </View>

      <TouchableOpacity
        style={[styles.closeButton, { top: insets.top + 8 }]}
        onPress={() => {
          triggerLightHaptic();
          Keyboard.dismiss();
          navigation.goBack();
        }}
        activeOpacity={0.7}>
        <Ionicons name="close" size={20} color={Colors.text} />
      </TouchableOpacity>

      <View style={{ flex: 1 }} {...panResponder.panHandlers}>
        <ScrollView
          ref={scrollRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingTop: insets.top + 36,
            paddingBottom: insets.bottom + 28,
          }}
          keyboardShouldPersistTaps="always"
          showsVerticalScrollIndicator={false}>
          {renderCurrentStage()}
        </ScrollView>
      </View>

      {stage >= 4 && stage < stageCount && (
        <AnimatedTouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + 20 }]}
          activeOpacity={0.7}
          onPress={() => goTo(stage + 1)}>
          <Ionicons name="chevron-forward" size={24} color={Colors.hopeWhite} />
        </AnimatedTouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.lightBackground,
  },
  actionProgressBar: {
    position: 'absolute',
    left: '50%',
    zIndex: 20,
    height: 6,
    width: 120,
    marginLeft: -60,
    backgroundColor: Colors.cardBorder,
    borderRadius: 3,
    overflow: 'hidden' as const,
  },
  actionProgressFill: {
    height: '100%',
    backgroundColor: Colors.sage,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    right: 18,
    zIndex: 21,
    width: 42,
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: 21,
  },
  stage: {
    paddingHorizontal: 28,
    paddingTop: 60,
    paddingBottom: 40,
  },
  eyebrow: {
    fontSize: 12,
    letterSpacing: 1.5,
    color: Colors.sage,
    textTransform: 'uppercase' as const,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  title: {
    fontFamily: Fonts.lora.bold,
    fontSize: 36,
    lineHeight: 44,
    textAlign: 'center' as const,
    color: Colors.text,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center' as const,
    color: Colors.textGray,
    marginBottom: 32,
  },
  primaryButton: {
    width: '100%',
    height: 54,
    borderRadius: 27,
    backgroundColor: Colors.sage,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  primaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
  },
  label: {
    fontSize: 11,
    letterSpacing: 1,
    color: Colors.sage,
    textTransform: 'uppercase' as const,
  },
  question: {
    fontFamily: Fonts.lora.bold,
    fontSize: 24,
    lineHeight: 30,
    textAlign: 'center' as const,
    color: Colors.text,
    marginBottom: 24,
  },
  input: {
    fontFamily: Fonts.regular,
    fontSize: 18,
    lineHeight: 26,
    color: Colors.text,
    paddingVertical: 16,
    minHeight: 200,
    textAlignVertical: 'top' as const,
  },
  shortInput: {
    minHeight: 56,
    paddingVertical: 12,
    marginBottom: 12,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.sage,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#29342E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    zIndex: 30,
  },
  captureStats: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  captureStatTotal: {
    fontSize: 16,
    color: Colors.text,
    marginBottom: 12,
    textAlign: 'center' as const,
  },
  captureStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
  },
  captureStatLabel: {
    fontSize: 14,
    color: Colors.textGray,
  },
  captureStatValue: {
    fontSize: 14,
    color: Colors.text,
  },
  captureItem: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  captureItemHeader: {
    gap: 4,
  },
  captureItemTitle: {
    fontSize: 16,
    color: Colors.text,
  },
  captureItemSubtitle: {
    fontSize: 12,
    color: Colors.textGray,
  },
  rememberButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.sage,
  },
  rememberButtonActive: {
    backgroundColor: Colors.sage,
    borderColor: Colors.sage,
  },
  rememberButtonText: {
    fontSize: 12,
    color: Colors.sage,
  },
  rememberButtonTextActive: {
    color: Colors.hopeWhite,
  },
  summaryCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    gap: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  summaryKey: {
    fontSize: 14,
    color: Colors.textGray,
    flexShrink: 0,
    width: 120,
  },
  summaryValue: {
    fontSize: 14,
    color: Colors.text,
    flex: 1,
    textAlign: 'right' as const,
  },
  todayPreview: {
    width: '100%',
    backgroundColor: Colors.cardBackground,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 18,
    marginTop: 32,
  },
  todayPreviewLabel: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 11,
    letterSpacing: 1.5,
    textTransform: 'uppercase' as const,
  },
  todayPreviewHeading: {
    color: Colors.text,
    fontFamily: Fonts.bold,
    fontSize: 19,
    marginTop: 10,
    marginBottom: 4,
  },
  todayPreviewRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  todayPreviewBullet: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 14,
  },
  todayPreviewText: {
    color: Colors.text,
    fontSize: 15,
    lineHeight: 21,
    flex: 1,
  },
  todayPreviewStep: {
    backgroundColor: Colors.anchorBlueLight,
    borderRadius: 14,
    padding: 14,
    marginTop: 18,
  },
  todayPreviewMeta: {
    color: Colors.textGray,
    fontSize: 12,
  },
  todayPreviewStepText: {
    color: Colors.text,
    fontFamily: Fonts.lora.medium,
    fontSize: 16,
    lineHeight: 23,
    marginTop: 4,
  },
  todayPreviewLink: {
    color: Colors.sage,
    fontFamily: Fonts.semiBold,
    fontSize: 12.5,
    marginTop: 18,
  },
});

export default ReviewScreen;
