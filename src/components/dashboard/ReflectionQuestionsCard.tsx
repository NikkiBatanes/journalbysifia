/**
 * ReflectionQuestionsCard.tsx
 * Displays reflection questions from user's playbooks and devotionals
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Logger } from '../../utils/ProductionLogger';
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
// import { GUIDED_PROMPTS } from '../journal/reflectionConstants'; // Unused
import { useSubscription } from '../../hooks/useSubscription';
import { useGuidedPromptGating } from '../../hooks/useGuidedPromptGating';
import GuidedPromptLockIcon from '../GuidedPromptLockIcon';
import { useNavigation } from '@react-navigation/native';
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
  isFree?: boolean; // For guided prompts, indicates if it's a free prompt for seeker users
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
  const { subscription } = useSubscription();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<ReflectionQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const initialLoadRef = React.useRef(true);
  const [error, setError] = useState<string | null>(null);

  // Guided prompt gating
  const guidedPromptGating = useGuidedPromptGating({
    context: 'inApp',
    onUpgradeRequired: () => {
      // Navigate directly to sales offer screen
      (navigation as any).navigate('OnboardingSalesOffer', {
        source: 'guided_prompts_lock',
        feature: 'guided_prompts',
        tier: subscription?.tier || 'seeker',
        upgradeMode: false,
        skipNotificationPreference: true,
      });
    },
  });

  // Debug guided prompt gating

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
      // Only show skeleton on the very first load
      if (initialLoadRef.current) {
        setLoading(true);
      }
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
        Logger.warn('Supabase devotionals error', {
        component: 'ReflectionQuestionsCard',
        details: devotionalsResult.error,
      });
      }

      const allQuestions: ReflectionQuestion[] = [];

      // Fetch user progress for all devotionals to determine completed days
      const devotionalIds = devotionalsResult.data?.map(d => d.id) || [];
      const progressResult = await supabase
        .from('user_progress')
        .select('*')
        .eq('user_id', user.id)
        .eq('content_type', 'devotional')
        .in('content_id', devotionalIds);

      // Create a map of devotional ID to completed days
      const completedDaysMap = new Map<string, Set<number>>();

      // First, initialize with devotional current_day for ALL devotionals
      devotionalsResult.data?.forEach(dev => {
        const devCurrentDay = (dev as any).current_day || 1;
        const completedDays = new Set<number>();

        // Always include Day 1 and current day
        completedDays.add(1);
        if (devCurrentDay > 1) {
          completedDays.add(devCurrentDay);
        }

        completedDaysMap.set(dev.id, completedDays);

        // Logger.info(`[ReflectionQuestions] Initial setup for ${dev.id}: currentDay=${devCurrentDay}, completedDays=${Array.from(completedDays).join(',')}`, {
        //   component: 'ReflectionQuestionsCard',
        // });
      });

      // Then, enhance with progress_data if available
      if (progressResult.data) {
        progressResult.data.forEach(progress => {
          try {
            const progressData = typeof progress.progress_data === 'string'
              ? JSON.parse(progress.progress_data)
              : progress.progress_data;

            const contentId = progress.content_id;
            // Get the existing completedDays set (already initialized above)
            const completedDays = completedDaysMap.get(contentId) || new Set<number>();



            // Add any explicitly completed days from progress_data
            if (progressData?.days && Array.isArray(progressData.days)) {
              progressData.days.forEach((day: any, index: number) => {
                const dayNumber = index + 1;
                // Add if explicitly marked as completed
                if (day?.completed) {
                  completedDays.add(dayNumber);
                                  }
              });
            }

            // Update the map with enhanced data
            completedDaysMap.set(contentId, completedDays);

                      } catch (e) {
            Logger.warn('Error parsing progress data for reflection questions', {
              component: 'ReflectionQuestionsCard',
              details: e,
            });
          }
        });
      }

      // Extract questions from devotionals (top-level and per-day)
      if (devotionalsResult.data) {
        devotionalsResult.data.forEach(devotional => {
          try {
            const content = typeof devotional.content === 'string'
              ? JSON.parse(devotional.content)
              : devotional.content;

            // Get completed days for this devotional
            const completedDays = completedDaysMap.get(devotional.id) || new Set<number>();

            const pushQ = (
              text: any,
              idxSuffix: string,
              category?: string,
              ctx?: { dayNumber?: number; dayTitle?: string; questionIndex?: number; questionKey?: string; groupLabel?: string; totalDays?: number }
            ) => {
              const qText = typeof text === 'string' ? text : text?.question || text?.text || text?.prompt || '';
              if (!qText || typeof qText !== 'string') { return; }

              // FILTER: Only show questions from Day 1 OR completed days
              const dayNumber = ctx?.dayNumber || 1;
              if (dayNumber > 1 && !completedDays.has(dayNumber)) {
                // Logger.info(`[ReflectionQuestions] Skipping future day question: ${qText.substring(0, 50)}... (Day ${dayNumber}, completed days: ${Array.from(completedDays).join(',')})`, {
                //   component: 'ReflectionQuestionsCard',
                // });
                return; // Skip questions from incomplete future days
              }

              // Check if this question has already been journaled
              const questionId = `${devotional.id}-${ctx?.dayNumber || 1}-${ctx?.questionIndex || 1}`;
              if (journaledQuestionIds.has(questionId)) {
                // Logger.info(`[ReflectionQuestions] Skipping journaled question: ${qText.substring(0, 50)}... (ID: ${questionId})`, {
                //   component: 'ReflectionQuestionsCard',
                // });
                return; // Skip journaled questions
              }

              // Logger.info(`[ReflectionQuestions] Including question: ${qText.substring(0, 50)}... (Day ${dayNumber}, ID: ${questionId})`, {
              //   component: 'ReflectionQuestionsCard',
              // });

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
            Logger.warn('Error parsing devotional content', { component: 'ReflectionQuestionsCard', data: parseError });
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

      // Add guided prompts using centralized service (limit to 3 random daily, but stable per day)
      const guidedQuestions: ReflectionQuestion[] = [];

      // Use hook's daily allocation instead of duplicate logic
      const freePrompts = guidedPromptGating.freePrompts || [];
      const lockedPrompts = guidedPromptGating.lockedPrompts || [];
      const allGuidedPrompts = [...freePrompts, ...lockedPrompts];

      // Build stable daily key
      const today = new Date();
      const dateKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
      const storageKey = `daily_guided_prompts_${user.id}_${dateKey}`;

      let chosenPrompts: string[] = [];
      try {
        const cached = await AsyncStorage.getItem(storageKey);
        if (cached) {
          const parsed = JSON.parse(cached);
          if (Array.isArray(parsed)) {
            // Keep only prompts that still exist
            chosenPrompts = parsed.filter((p: any) => typeof p === 'string' && allGuidedPrompts.includes(p)).slice(0, 3);
          }
        }
      } catch {}

      // If cache missing or insufficient, pick deterministically and save
      if (chosenPrompts.length < 3) {
        const needed = 3 - chosenPrompts.length;
        // Deterministic selection based on day-of-year and user id hash to avoid changing during the day
        const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
        const uid = user.id || '';
        const seed = Array.from(uid).reduce((acc, ch) => acc + ch.charCodeAt(0), 0) + dayOfYear;
        const remaining = allGuidedPrompts.filter(p => !chosenPrompts.includes(p));
        const picks: string[] = [];
        for (let i = 0; i < remaining.length && picks.length < needed; i++) {
          const idx = (seed + i * 7) % remaining.length; // step by 7 for dispersion
          const cand = remaining[idx];
          if (!picks.includes(cand)) { picks.push(cand); }
        }
        chosenPrompts = [...chosenPrompts, ...picks].slice(0, 3);
        try { await AsyncStorage.setItem(storageKey, JSON.stringify(chosenPrompts)); } catch {}
      }

      chosenPrompts.forEach((prompt, i) => {
        const isFree = freePrompts.includes(prompt);
        guidedQuestions.push({
          id: `guided-${dateKey}-${i}`,
          question: prompt,
          source: isFree ? 'Free Guided Prompt' : 'Guided Prompt',
          sourceType: 'guided',
          category: 'Guided',
          questionIndex: i + 1,
          questionKey: 'guidedPrompt',
          groupLabel: isFree ? 'Free Guided Prompt' : 'Guided Prompt',
          isFree: isFree, // Add the isFree property
        });
      });

      // Ensure seeker accounts have at least one free reflection question
      if (subscription?.tier === 'seeker' && freePrompts.length > 0) {
        const hasFreeQuestion = guidedQuestions.some(q => freePrompts.includes(q.question));
        if (!hasFreeQuestion && freePrompts.length > 0) {
          // Add the first free prompt as a guaranteed question
          guidedQuestions.unshift({
            id: `guided-${dateKey}-guaranteed`,
            question: freePrompts[0],
            source: 'Free Guided Prompt',
            sourceType: 'guided',
            category: 'Guided',
            questionIndex: 0,
            questionKey: 'guidedPrompt',
            groupLabel: 'Free Guided Prompt',
            isFree: true, // This is a guaranteed free prompt
          });
        }
      }

      // Limit to 10 total questions: 7 devotional questions + up to 3 guided prompts
      const devotionalQuestions = allQuestions.filter(q => q.sourceType === 'devotional');
      const selectedDevotional = devotionalQuestions.slice(0, 3);
      const remainingSlots = Math.max(0, 3 - selectedDevotional.length);
      const selectedGuided = guidedQuestions.slice(0, remainingSlots);
      setQuestions([...selectedDevotional, ...selectedGuided]);

    } catch (err) {
      const errorMessage = (err as Error)?.message || '';
      const isNetworkError = errorMessage.includes('network') ||
                            errorMessage.includes('connection') ||
                            errorMessage.includes('gateway');

      if (isNetworkError) {
        Logger.warn('Network error fetching reflection questions - will retry on next refresh', {
          component: 'ReflectionQuestionsCard',
          errorMessage,
        });
        setError('Network connection issue. Pull to refresh.');
      } else {
        Logger.error('Error fetching reflection questions', err as Error, { component: 'ReflectionQuestionsCard' });
        setError('Unable to load reflection questions');
      }
      setQuestions([]);
    } finally {
      // Mark initial load complete and stop showing skeletons on future refreshes
      if (initialLoadRef.current) {
        initialLoadRef.current = false;
        setHasLoaded(true);
      }
      setLoading(false);
    }
  }, [user, guidedPromptGating.freePrompts, guidedPromptGating.lockedPrompts, subscription?.tier]);

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

  // Listen to reflection saved event and remove devotional questions immediately
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('reflection_saved', (payload: { reflectionId?: string; type?: string; source?: string; devotionalId?: string; dayNumber?: number; questionNumber?: number }) => {
      // Only handle playbook reflections (which includes devotional questions) for immediate removal
      if (payload?.source === 'playbook') {
        // Remove the devotional question that was just answered
        setQuestions(prev => prev.filter(q => {
          // Match by devotional ID, day number, and question number
          if (q.sourceType !== 'devotional') {return true;}
          if (payload?.devotionalId && q.sourceId !== payload.devotionalId) {return true;}
          if (payload?.dayNumber !== undefined && q.dayNumber !== payload.dayNumber) {return true;}
          if (payload?.questionNumber !== undefined && q.questionIndex !== payload.questionNumber) {return true;}
          // If all criteria match, this is the question that was answered - remove it
          return false;
        }));
      }
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
  // Listen to mutation cache to only refetch when reflections are actually saved
  useEffect(() => {
    const handleReflectionChange = () => {
      // Defer to next tick to avoid setState during another component's render
      setTimeout(() => {
        fetchReflectionQuestions();
      }, 0);
    };

    // Listen for successful reflection mutations (create/update)
    const unsubscribe = queryClient.getMutationCache().subscribe((event) => {
      // Only refetch when a reflection mutation succeeds
      if (event?.type === 'updated' && event?.mutation?.state?.status === 'success') {
        const mutationKey = event?.mutation?.options?.mutationKey;
        // Check if this is a reflection-related mutation
        if (mutationKey && Array.isArray(mutationKey) && mutationKey[0] === 'createReflection') {
          handleReflectionChange();
        }
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
  // On iPad, use fixed width (~4 inches = 384 points) so adjacent cards are visible; phones use 80%
  const isTablet = screenWidth >= 768;
  const CARD_WIDTH = isTablet ? 384 : VISIBLE_WIDTH * 0.8;
  const CARD_SPACING = 8;
  const ITEM_WIDTH = CARD_WIDTH;
  const ITEM_SPACING = CARD_SPACING;
  const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
  // On iPad, start closer to the left edge (smaller inset); phones keep centered behavior
  const SIDE_INSET = Math.max(0, isTablet ? 24 : (VISIBLE_WIDTH - ITEM_WIDTH) / 2);
  // Precompute exact snap offsets for perfect centering
  const snapOffsets = React.useMemo(() => {
    return questions.map((_, i) => i * ITEM_SIZE);
  }, [questions, ITEM_SIZE]);
  const scrollX = React.useRef(new Animated.Value(0)).current;

  // Only show skeleton on the very first load
  if (loading && !hasLoaded) {
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
                {/* Lock icon in upper right corner */}
                {item.sourceType === 'guided' && (
                  <View style={styles.lockIconContainer}>
                    <GuidedPromptLockIcon
                      tier={subscription?.tier || 'seeker'}
                      usedPrompts={guidedPromptGating.usedPrompts}
                      context="inApp"
                      onLockTap={() => {
                        (navigation as any).navigate('OnboardingSalesOffer', {
                          source: 'guided_prompts_lock',
                          feature: 'guided_prompts',
                          tier: subscription?.tier || 'seeker',
                          upgradeMode: false,
                          skipNotificationPreference: true,
                        });
                      }}
                      size={20}
                      position="right"
                      prompt={item.question}
                      forceShow={item.sourceType === 'guided' && !item.isFree} // Show lock only for guided prompts that are not free
                    />
                  </View>
                )}

                <View style={styles.sectionHeader}>
                  <MaterialCommunityIcons name={getSourceIcon(item.sourceType)} size={20} color={Colors.textGray} style={styles.sectionIcon} />
                  <ThemedText weight="semiBold" style={styles.sectionLabel}>
                    {item.sourceType === 'guided' ? 'GUIDED PROMPT' : 'QUESTION TO PONDER'}
                  </ThemedText>
                </View>
                <ThemedText weight="bold" style={styles.questionText} numberOfLines={0}>{item.question}</ThemedText>
                <View style={styles.buttonRow}>
                  <TouchableOpacity
                    style={styles.reflectButton}
                    onPress={() => {
                      // Always allow opening the reflection editor to show the experience
                      // The lock and upgrade flow will be handled inside the editor
                      onQuestionPress?.(item);
                    }}
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
    // Don't center content - align to start
    justifyContent: 'flex-start',
    flexGrow: 1,
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
    justifyContent: 'flex-start',
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
    justifyContent: 'center',
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
    color: Colors.textGray,
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
    color: Colors.textGray,
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
  reflectButtonDisabled: {
    opacity: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  lockIconContainer: {
    position: 'absolute',
    top: 16,
    right: 16,
    zIndex: 10,
  },
});

export default ReflectionQuestionsCard;
