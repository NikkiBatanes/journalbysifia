/**
 * ReflectionQuestionsCard.tsx
 * Displays reflection questions from user's playbooks and devotionals
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DeviceEventEmitter } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Pencil } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { ReflectionApi } from '../../services/api/reflectionApi';
import { useQueryClient } from '@tanstack/react-query';
import DashboardReflectionSkeleton from '../SkeletonLoader/DashboardReflectionSkeleton';
import { GUIDED_PROMPTS } from '../journal/reflectionConstants';
// Devotional-only rebuild: no date-based filtering required

interface ReflectionQuestion {
  id: string;
  question: string;
  source: string;
  sourceType: 'playbook' | 'devotional' | 'guided';
  category?: string;
  isAnswered?: boolean;
  sourceId?: string;
  // Optional metadata for better context when navigating
  dayNumber?: number; // 1-based day index when coming from per-day content
  dayTitle?: string;  // Title of the day if available
  questionIndex?: number; // 1-based index within the group (e.g., Questions to Ponder)
  questionKey?: string; // Which key produced this question (reflectionQuestions, questionsToPonder, etc.)
  groupLabel?: string; // Human label like 'Questions to Ponder' or 'Reflection Questions'
  totalDays?: number; // Total number of days in the devotional, when available
}

interface ReflectionQuestionsCardProps {
  onQuestionPress?: (question: ReflectionQuestion) => void;
  onViewAll?: () => void;
}



const ReflectionQuestionsCard: React.FC<ReflectionQuestionsCardProps> = ({
  onQuestionPress,
  onViewAll: _onViewAll,
}) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<ReflectionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // No need to fetch today's reflections for this version
  const [_diag, setDiag] = useState<{
    devotionalCount: number;
    totalQuestions: number;
    sampleDevotional?: { id: string; hasContent: boolean; hasDaysColumn: boolean; contentKeys: string[] } | null;
  }>({ devotionalCount: 0, totalQuestions: 0, sampleDevotional: null });

  const fetchReflectionQuestions = useCallback(async () => {
    if (!user) {
      // If user is not available (e.g., logged out or auth still initializing),
      // stop loading to avoid an infinite spinner and show a gentle empty state.
      setQuestions([]);
      setError(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // First, get all journaled questions to filter them out
      const journaledEntries = await ReflectionApi.searchReflections({
        userId: user.id,
        limit: 1000, // Get all journaled entries
      });

      // Create a set of journaled question identifiers for quick lookup
      const journaledQuestionIds = new Set(
        journaledEntries
          .filter(entry =>
            entry.devotional_id &&
            entry.day_number !== undefined &&
            entry.question_number !== undefined
          )
          .map(entry => `${entry.devotional_id}-${entry.day_number}-${entry.question_number}`)
      );

      // Fetch devotionals only (mirror DevotionalCarousel behavior)
      const devotionalsResult = await supabase
        .from('devotionals')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (devotionalsResult.error) {
        console.warn('Supabase devotionals error:', devotionalsResult.error);
      }

      const allQuestions: ReflectionQuestion[] = [];

      // Extract questions from devotionals (top-level and per-day)
      if (devotionalsResult.data) {
        devotionalsResult.data.forEach(devotional => {
          try {
            const content = typeof devotional.content === 'string'
              ? JSON.parse(devotional.content)
              : devotional.content;

            const pushQ = (
              text: any,
              idxSuffix: string,
              category?: string,
              ctx?: { dayNumber?: number; dayTitle?: string; questionIndex?: number; questionKey?: string; groupLabel?: string; totalDays?: number }
            ) => {
              const qText = typeof text === 'string' ? text : text?.question || text?.text || text?.prompt || '';
              if (!qText || typeof qText !== 'string') { return; }

              // Check if this question has already been journaled
              const questionId = `${devotional.id}-${ctx?.dayNumber || 1}-${ctx?.questionIndex || 1}`;
              if (journaledQuestionIds.has(questionId)) {
                return; // Skip journaled questions
              }

              allQuestions.push({
                id: `devotional-${devotional.id}-${idxSuffix}`,
                question: qText,
                source: devotional.title,
                sourceType: 'devotional',
                category: (typeof text === 'object' && (text.category || text.type)) || category || 'Devotional',
                sourceId: String(devotional.id),
                dayNumber: ctx?.dayNumber,
                dayTitle: ctx?.dayTitle,
                questionIndex: ctx?.questionIndex,
                questionKey: ctx?.questionKey,
                groupLabel: ctx?.groupLabel,
                totalDays: ctx?.totalDays,
              });
            };

            // Top-level arrays
            const arrayKeys = ['reflectionQuestions', 'questionsToPonder', 'questions', 'ponderQuestions'] as const;
            arrayKeys.forEach((key) => {
              const arr = (content as any)?.[key];
              if (Array.isArray(arr)) {
                arr.forEach((q: any, index: number) => pushQ(q, `${key}-${index}`,
                  undefined,
                  { questionIndex: index + 1, questionKey: key, groupLabel: key === 'questionsToPonder' ? 'Questions to Ponder' : 'Reflection Questions' }
                ));
              }
            });

            // Single top-level question
            if ((content as any)?.reflectionQuestion) {
              pushQ((content as any).reflectionQuestion, 'single', undefined, { questionIndex: 1, questionKey: 'reflectionQuestion', groupLabel: 'Reflection Question' });
            }

            // Per-day arrays: use top-level column if present, else content.days
            let days = (devotional as any)?.days ?? (content as any)?.days;
            if (typeof days === 'string') { try { days = JSON.parse(days); } catch {} }
            if (Array.isArray(days)) {
              const totalDays = days.length;
              days.forEach((day: any, dayIdx: number) => {
                const perDayArrayKeys = ['reflectionQuestions', 'questionsToPonder', 'questions', 'ponderQuestions'] as const;
                perDayArrayKeys.forEach((key) => {
                  const arr = day?.[key];
                  if (Array.isArray(arr)) {
                    arr.forEach((q: any, qIdx: number) => pushQ(
                      q,
                      `day${dayIdx + 1}-${key}-${qIdx}`,
                      undefined,
                      {
                        dayNumber: dayIdx + 1,
                        dayTitle: typeof day?.title === 'string' ? day.title : undefined,
                        questionIndex: qIdx + 1,
                        questionKey: key,
                        groupLabel: key === 'questionsToPonder' ? 'Questions to Ponder' : 'Reflection Questions',
                        totalDays,
                      }
                    ));
                  }
                });
                if (day?.reflectionQuestion) {
                  pushQ(
                    day.reflectionQuestion,
                    `day${dayIdx + 1}-single`,
                    undefined,
                    {
                      dayNumber: dayIdx + 1,
                      dayTitle: typeof day?.title === 'string' ? day.title : undefined,
                      questionIndex: 1,
                      questionKey: 'reflectionQuestion',
                      groupLabel: 'Reflection Question',
                      totalDays,
                    }
                  );
                }
              });
            }
            // If days is an object with nested questions (edge-case), try best-effort extraction
            if (!Array.isArray(days) && days && typeof days === 'object') {
              const maybeArr = (days as any)?.items || (days as any)?.list;
              if (Array.isArray(maybeArr)) {
                const totalDays = maybeArr.length;
                maybeArr.forEach((d: any, idx: number) => {
                  const arr = d?.reflectionQuestions || d?.questionsToPonder || d?.questions || d?.ponderQuestions;
                  if (Array.isArray(arr)) {
                    arr.forEach((q: any, qIdx: number) => pushQ(
                      q,
                      `dayObj${idx + 1}-arr-${qIdx}`,
                      undefined,
                      {
                        dayNumber: idx + 1,
                        dayTitle: typeof d?.title === 'string' ? d.title : undefined,
                        questionIndex: qIdx + 1,
                        questionKey: (arr === d?.questionsToPonder) ? 'questionsToPonder' : (arr === d?.reflectionQuestions ? 'reflectionQuestions' : 'questions'),
                        groupLabel: d?.questionsToPonder ? 'Questions to Ponder' : 'Reflection Questions',
                        totalDays,
                      }
                    ));
                  }
                  if (d?.reflectionQuestion) {
                    pushQ(
                      d.reflectionQuestion,
                      `dayObj${idx + 1}-single`,
                      undefined,
                      {
                        dayNumber: idx + 1,
                        dayTitle: typeof d?.title === 'string' ? d.title : undefined,
                        questionIndex: 1,
                        questionKey: 'reflectionQuestion',
                        groupLabel: 'Reflection Question',
                        totalDays,
                      }
                    );
                  }
                });
              }
            }
          } catch (parseError) {
            console.warn('Error parsing devotional content:', parseError);
          }
        });
      }

      const diagPayload = {
        devotionalCount: devotionalsResult.data?.length || 0,
        totalQuestions: allQuestions.length,
        sampleDevotional: devotionalsResult.data?.[0] ? {
          id: devotionalsResult.data[0].id,
          hasContent: !!devotionalsResult.data[0].content,
          hasDaysColumn: !!(devotionalsResult.data[0] as any).days,
          contentKeys: (() => { try { const c = typeof devotionalsResult.data[0].content === 'string' ? JSON.parse(devotionalsResult.data[0].content) : devotionalsResult.data[0].content; return c ? Object.keys(c) : []; } catch { return []; } })(),
        } : null,
      };
      setDiag(diagPayload);

      // Add 5 daily-random guided prompts (deterministic per user per day)
      /* eslint-disable no-bitwise */
      const pickDailyGuided = (count: number): ReflectionQuestion[] => {
        const dateStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const seedStr = `${user.id}-${dateStr}`;
        // Simple string hash -> number
        let h = 2166136261 >>> 0;
        for (let i = 0; i < seedStr.length; i++) {
          h ^= seedStr.charCodeAt(i);
          h = Math.imul(h, 16777619);
        }
        // Mulberry32 PRNG
        const mulberry32 = (a: number) => () => {
          a |= 0; a = (a + 0x6D2B79F5) | 0;
          let t = Math.imul(a ^ (a >>> 15), 1 | a);
          t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
          return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
        const rand = mulberry32(h);
        // Copy and shuffle indices deterministically
        const indices = Array.from({ length: GUIDED_PROMPTS.length }, (_, i) => i);
        for (let i = indices.length - 1; i > 0; i--) {
          const j = Math.floor(rand() * (i + 1));
          [indices[i], indices[j]] = [indices[j], indices[i]];
        }
        const selected = indices.slice(0, Math.min(count, indices.length));
        return selected.map((idx, i) => ({
          id: `guided-${dateStr}-${idx}`,
          question: GUIDED_PROMPTS[idx],
          source: 'Guided Prompt',
          sourceType: 'guided',
          category: 'Guided',
          questionIndex: i + 1,
          questionKey: 'guidedPrompt',
          groupLabel: 'Guided Prompt',
        }));
      };

      // Filter out guided prompts that were already completed today
      const dateStrKey = new Date().toISOString().slice(0, 10);
      const storageKey = `@guided_completed_${dateStrKey}`;
      let completedGuided: string[] = [];
      try {
        const stored = await AsyncStorage.getItem(storageKey);
        completedGuided = stored ? JSON.parse(stored) : [];
      } catch {}

      const guidedDaily = pickDailyGuided(5).filter(g => !completedGuided.includes(g.question));
      setQuestions([...allQuestions, ...guidedDaily]);

    } catch (err) {
      console.error('Error fetching reflection questions:', err);
      setError('Unable to load reflection questions');
      setQuestions([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchReflectionQuestions();
  }, [fetchReflectionQuestions]);

  // Listen to guided completion event and remove from list immediately
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('guided_reflection_completed', (payload: { question?: string; date?: string }) => {
      if (!payload?.question) {return;}
      setQuestions(prev => prev.filter(q => !(q.sourceType === 'guided' && q.question === payload.question)));
    });
    return () => {
      try { sub.remove(); } catch {}
    };
  }, []);

  // Realtime updates: refresh when devotionals change
  useEffect(() => {
    if (!user) { return; }
    const channelName = `reflection_questions_realtime_${user.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reflection_questions' }, () => {
        fetchReflectionQuestions();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'devotionals' }, () => {
        fetchReflectionQuestions();
      })
      .subscribe();

    return () => {
      try { 
        channel.unsubscribe();
        supabase.removeChannel(channel); 
      } catch {}
    };
  }, [user, fetchReflectionQuestions]);

  // Listen for reflection entries changes to refetch questions
  useEffect(() => {
    const handleReflectionChange = () => {
      // Defer to next tick to avoid setState during another component's render
      setTimeout(() => {
        fetchReflectionQuestions();
      }, 0);
    };

    // Listen for reflection entries invalidation
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'reflections') {
        handleReflectionChange();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, fetchReflectionQuestions]);

  // Listen for devotional changes to refetch questions
  useEffect(() => {
    const handleDevotionalChange = () => {
      // Defer to next tick to avoid setState during another component's render
      setTimeout(() => {
        fetchReflectionQuestions();
      }, 0);
    };

    // Listen for devotional invalidation
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event?.query?.queryKey?.[0] === 'devotionals') {
        handleDevotionalChange();
      }
    });

    return () => {
      unsubscribe();
    };
  }, [queryClient, fetchReflectionQuestions]);

  const handleRefresh = () => {
    fetchReflectionQuestions();
  };

  const getSourceIcon = (sourceType: 'playbook' | 'devotional' | 'guided') => {
    if (sourceType === 'playbook') {return 'library';}
    if (sourceType === 'guided') {return 'feather';}
    return 'book';
  };

  // Carousel layout and animated scroll ref (hooks must be unconditional)
  const { width: screenWidth } = Dimensions.get('window');
  // Match PrayCarousel sizing
  const CARD_HORIZONTAL_PADDING = 16; // matches styles.card padding
  const VISIBLE_WIDTH = Math.max(0, screenWidth - CARD_HORIZONTAL_PADDING * 2);
  const CARD_WIDTH = VISIBLE_WIDTH * 0.8;
  const CARD_SPACING = 8;
  const ITEM_WIDTH = CARD_WIDTH;
  const ITEM_SPACING = CARD_SPACING;
  const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
  // Padding should center the visible card itself (exclude spacing)
  // Center within visible area (account for card padding)
  const SIDE_INSET = Math.max(0, (VISIBLE_WIDTH - ITEM_WIDTH) / 2);
  // Precompute exact snap offsets for perfect centering
  const snapOffsets = React.useMemo(() => {
    return questions.map((_, i) => i * ITEM_SIZE);
  }, [questions, ITEM_SIZE]);
  const scrollX = React.useRef(new Animated.Value(0)).current;

  if (loading) {
    return <DashboardReflectionSkeleton />;
  }

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <ThemedText weight="semiBold" style={styles.title}>Reflection Questions</ThemedText>
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText weight="regular" style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity onPress={handleRefresh} style={styles.retryButton}>
            <ThemedText weight="semiBold" style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : questions && questions.length > 0 ? (
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContainer, { paddingHorizontal: SIDE_INSET }]}
          contentOffset={{ x: 0, y: 0 }}
          contentInsetAdjustmentBehavior="never"
          decelerationRate="fast"
          snapToInterval={ITEM_SIZE}
          snapToAlignment="start"
          snapToOffsets={snapOffsets}
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          bounces={true}
          removeClippedSubviews={false}
          // Expand scroll to full-screen width so centering isn't skewed by card padding
          style={styles.scrollExpanded}
        >
          {questions.map((item, index) => {
            const inputRange = [
              (index - 1) * ITEM_SIZE,
              index * ITEM_SIZE,
              (index + 1) * ITEM_SIZE,
            ];
            const scale = scrollX.interpolate({
              inputRange,
              outputRange: [0.96, 1, 0.96],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.9, 1, 0.9],
              extrapolate: 'clamp',
            });
            const translateY = scrollX.interpolate({
              inputRange,
              outputRange: [2, 0, 2],
              extrapolate: 'clamp',
            });

            return (
              <Animated.View
                key={item.id}
                style={[
                  styles.questionCard,
                  { width: ITEM_WIDTH, marginRight: ITEM_SPACING },
                  { transform: [{ scale }, { translateY }], opacity },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name={getSourceIcon(item.sourceType)} size={20} color={Colors.mediumGray} style={styles.sectionIcon} />
                  <ThemedText weight="semiBold" style={styles.sectionLabel}>
                    {item.sourceType === 'guided' ? 'GUIDED PROMPT' : 'QUESTION TO PONDER'}
                  </ThemedText>
                </View>
                <ThemedText weight="bold" style={styles.questionText}>{item.question}</ThemedText>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.reflectButton}
                    onPress={() => onQuestionPress?.(item)}
                    accessibilityRole="button"
                    accessibilityLabel="Reflect on this question"
                  >
                    <Pencil size={16} color={Colors.hopeWhite} style={styles.buttonIcon} />
                    <ThemedText weight="medium" style={styles.reflectButtonText}>Reflect</ThemedText>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            );
          })}
        </Animated.ScrollView>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 120,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
    gap: 0,
  },
  title: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  questionContainer: {
    flex: 1,
  },
  carouselItem: {
    width: '100%',
  },
  questionText: {
    fontSize: 18,
    lineHeight: 26,
    color: Colors.hopeWhite,
    marginBottom: 0,
    textAlign: 'center',
    alignSelf: 'center',
    maxWidth: '90%',
    paddingHorizontal: 8,
  },
  // New carousel styles
  scrollContainer: {
    paddingRight: 0,
  },
  scrollExpanded: {
    overflow: 'visible',
    marginHorizontal: -16, // matches CARD_HORIZONTAL_PADDING
  },
  questionCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 30,
    padding: 24,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    height: 300,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: 16,
  },
  tapHint: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  tapHintText: {
    fontSize: 12,
    color: Colors.alertCoral,
  },
  sectionHeader: {
    alignItems: 'center',
    paddingHorizontal: 12,
    marginBottom: 0,
  },
  sectionIcon: {
    alignSelf: 'center',
    marginBottom: 4,
    opacity: 0.9,
  },
  sectionLabel: {
    fontSize: 12,
    color: Colors.mediumGray,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: 0,
  },
  buttonRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 0,
  },
  reflectButton: {
    marginTop: 0,
    alignSelf: 'center',
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 10,
    paddingHorizontal: 24,
    borderRadius: 20,
    minWidth: 120,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  reflectButtonText: {
    color: Colors.hopeWhite,
    fontSize: 15,
    letterSpacing: 0.5,
  },
  buttonIcon: {
    marginRight: 8,
  },
  loadingContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  errorContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  emptyContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },

  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: Colors.hopeWhite,
  },
});

export default ReflectionQuestionsCard;
