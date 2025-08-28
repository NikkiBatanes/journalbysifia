/**
 * ActionStepsCard.tsx
 * Displays unfinished action steps from user's playbooks
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import ThemedText from '../common/ThemedText';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { triggerLightHaptic } from '../../utils/haptics';
import { rankSteps } from '../../services/nextBestStep';
import DashboardActionStepsSkeleton from '../SkeletonLoader/DashboardActionStepsSkeleton';

interface ActionStep {
  id: string;
  title: string;
  description?: string;
  playbookTitle: string;
  playbookId: string;
  stepIndex: number;
  isCompleted: boolean;
  dueDate?: string;
  priority?: 'high' | 'medium' | 'low';
  estimatedMinutes?: number;
  difficulty?: number | null;
  impactScore?: number | null;
  dependsOnStepId?: string | null;
  blockers?: string | null;
  coachTip?: string;
}

interface ActionStepsCardProps {
  onStepPress?: (step: ActionStep) => void;
  onViewAll?: () => void;
  onCountChange?: (count: number) => void;
}



const ActionStepsCard: React.FC<ActionStepsCardProps> = ({ onStepPress, onViewAll: _onViewAll, onCountChange }) => {
  const { user } = useAuth();
  const [actionSteps, setActionSteps] = useState<ActionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(3);
  // Example modal removed per request; keep UI simple and non-interactive

  const logEvent = useCallback(async (event_type: string, payload: { playbook_id?: string; step_id?: string; [k: string]: any } = {}) => {
    if (!user) {return;}
    try {
      await supabase.from('user_behavior_events').insert({
        user_id: user.id,
        event_type,
        playbook_id: payload.playbook_id,
        step_id: payload.step_id,
        metadata: payload,
      });
    } catch (e) {
      // Non-blocking analytics error
      console.warn('Failed to log user_behavior_event', e);
    }
  }, [user]);

  // Notify parent when count changes
  useEffect(() => {
    try { onCountChange?.(actionSteps.length); } catch {}
  }, [actionSteps.length, onCountChange]);

  // Track which steps have already fired view_step to avoid duplicates
  const viewedStepIdsRef = useRef<Set<string>>(new Set());

  // Fire view_step when an item becomes sufficiently visible
  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: Array<{ item: ActionStep; isViewable: boolean }> }) => {
    viewableItems.forEach(({ item, isViewable }) => {
      if (isViewable && item && !viewedStepIdsRef.current.has(item.id)) {
        viewedStepIdsRef.current.add(item.id);
        logEvent('view_step', { playbook_id: item.playbookId, step_id: item.id, title: item.title });
      }
    });
  });

  const viewabilityConfig = { itemVisiblePercentThreshold: 60, minimumViewTime: 400 };

  const fetchActionSteps = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Fetch user's playbooks
      const { data: __progressData, error: progressError } = await supabase
        .from('playbook_action_steps')
        .select(`
          *,
          playbook:playbooks(*)
        `)
        .eq('completed', false)
        .order('order_index', { ascending: true })
        .limit(10);

      if (progressError) {
        console.error('Error fetching action steps:', progressError);
        throw progressError;
      }

      if (!__progressData || __progressData.length === 0) {
        setActionSteps([]);
        return;
      }

      // Transform the data to match ActionStep interface
      const transformedSteps: ActionStep[] = __progressData.map((step: any) => ({
        id: step.id,
        title: step.text || 'Untitled Step',
        description: step.examples || undefined,
        playbookTitle: step.playbook?.title || 'Unknown Playbook',
        playbookId: step.playbook_id,
        stepIndex: step.order_index ?? 0,
        isCompleted: step.completed || false,
        dueDate: step.due_date,
        priority: step.priority || 'medium',
        estimatedMinutes: step.estimated_minutes ?? undefined,
        difficulty: step.difficulty ?? null,
        impactScore: step.impact_score ?? null,
        dependsOnStepId: step.depends_on_step_id ?? null,
        blockers: step.blockers ?? null,
      }));

      // Rank steps by scoring (no coach tips)
      const ranked = rankSteps(transformedSteps);

      setActionSteps(ranked);

    } catch (fetchError) {
      console.error('Error fetching action steps:', fetchError);
      setError('Failed to load action steps');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchActionSteps();
  }, [fetchActionSteps, user]);

  // Keep visibleCount within bounds when list size changes
  useEffect(() => {
    setVisibleCount((prev) => {
      const min = 3;
      const max = actionSteps.length > 0 ? actionSteps.length : min;
      return Math.min(Math.max(prev, min), max);
    });
  }, [actionSteps.length]);

  // priority color/icon helpers removed (no priority chip shown)

  // no due-date formatting needed (due chip removed)

  const markStepDone = useCallback(async (step: ActionStep) => {
    if (!user) {return;}
    try {
      setCompletingId(step.id);
      // 1) Update the action step as completed
      const { error: updateError } = await supabase
        .from('playbook_action_steps')
        .update({ completed: true })
        .eq('id', step.id);
      if (updateError) { throw updateError; }

      // 2) Log to faith_points_log so StreakTracker can count it
      await supabase.from('faith_points_log').insert({
        user_id: user.id,
        activity_type: 'action_step_completed',
        points: 1,
        metadata: { playbook_id: step.playbookId, step_id: step.id, title: step.title },
      });

      // 2b) Analytics event: complete_step
      logEvent('complete_step', { playbook_id: step.playbookId, step_id: step.id, title: step.title });

      // 3) Show brief success checkmark before removing the item
      triggerLightHaptic();
      setCompletedId(step.id);
      setTimeout(() => {
        setActionSteps(prev => prev.filter(s => s.id !== step.id));
        setCompletedId(null);
      }, 500);
    } catch (e) {
      console.error('Failed to mark step as done:', e);
      setError('Failed to complete step. Please try again.');
    } finally {
      setCompletingId(null);
    }
  }, [user, logEvent]);

  // Example viewing and analytics removed

  // removed snooze functionality per request

  // No example modal handlers

  // priority icon helper removed

  // Indent example line to start under the first letter of the title
  // Adjusted to keep title closer to the icon: padding(2) + icon(18) + gap(6)
  const TITLE_LEFT_OFFSET = 2 + 18 + 6;

  // Memoized dynamic left offset style to avoid inline object in JSX
  const leftOffsetStyle = useMemo(() => ({ marginLeft: TITLE_LEFT_OFFSET }), [TITLE_LEFT_OFFSET]);

  // Remove simple markdown emphasis markers from titles (e.g., **bold**, *italic*)
  const stripMarkdownEmphasis = (s: string) => {
    if (!s) {return '';}
    return s
      .replace(/\*\*(.+?)\*\*/g, '$1')
      .replace(/\*(.+?)\*/g, '$1')
      .trim();
  };

  const renderExampleWithBubble = (text: string) => {
    const trimmed = (text || '').trim();
    if (!trimmed) {return null;}
    const parts = trimmed.split(/\s+/);
    const first = parts.shift() || '';
    const rest = parts.join(' ');
    return (
      <View style={[styles.exampleRow, leftOffsetStyle]}>
        <Ionicons name="chatbubble-ellipses-outline" size={14} color={Colors.alertCoral} />
        <ThemedText weight="regular" style={[styles.stepDescription, styles.exampleDescription]} numberOfLines={3}>
          {first}{rest ? ' ' + rest : ''}
        </ThemedText>
      </View>
    );
  };

  // Pagination logic (match Todos pattern, adjusted to 3 at a time)
  const visibleSteps = actionSteps.slice(0, visibleCount);
  const hasMore = actionSteps.length > visibleCount;
  const canShowLess = visibleCount > 3 && actionSteps.length > 3;

  const loadMore = () => {
    setVisibleCount((prev) => Math.min(prev + 3, actionSteps.length));
  };

  const showLess = () => {
    setVisibleCount(3);
  };

  const renderActionStep = ({ item }: { item: ActionStep }) => (
    <TouchableOpacity
      style={styles.stepItem}
      onPress={() => {
        triggerLightHaptic();
        logEvent('start_step', { playbook_id: item.playbookId, step_id: item.id, title: item.title });
        onStepPress?.(item);
      }}
      activeOpacity={0.8}
    >
      {/* Priority chip removed per request */}

      <View style={styles.stepHeader}>
        <TouchableOpacity
          onPress={() => markStepDone(item)}
          disabled={completingId === item.id}
          style={styles.completeButtonTouch}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          accessibilityLabel="Mark step as done"
          accessibilityRole="button"
        >
          {completingId === item.id ? (
            <ActivityIndicator size="small" color={Colors.faithGold} style={styles.smallIndicator}
            />
          ) : completedId === item.id ? (
            <Ionicons name={'checkmark-circle'} size={18} color={Colors.successGreen} />
          ) : (
            <Ionicons name={'ellipse-outline'} size={18} color={Colors.faithGold} />
          )}
        </TouchableOpacity>
        <ThemedText weight="semiBold" style={styles.stepTitle} numberOfLines={2}>
          {stripMarkdownEmphasis(item.title)}
        </ThemedText>
      </View>

      {item.description && renderExampleWithBubble(item.description)}
      <View style={[styles.fromRow, leftOffsetStyle]}>
        <View style={styles.fromDivider} />
        <View style={styles.fromTextContainer}>
          <ThemedText weight="semiBold" style={styles.fromLabel}>
            FROM PLAYBOOK
          </ThemedText>
          <ThemedText weight="semiBold" style={styles.fromTitle}>
            {item.playbookTitle}
          </ThemedText>
        </View>
      </View>

      {/* Context chips */}
      <View style={styles.chipsRow}>
        {typeof item.estimatedMinutes === 'number' && (
          <View style={styles.chip}><ThemedText weight="regular" style={styles.chipText}>{item.estimatedMinutes} min</ThemedText></View>
        )}
      </View>

      {/* Coach tip removed per request */}
    </TouchableOpacity>
  );
  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="checkmark-circle" size={32} color={Colors.successGreen} />
      <ThemedText weight="semiBold" style={styles.emptyTitle}>All Caught Up!</ThemedText>
      <ThemedText weight="regular" style={styles.emptyDescription}>
        You've completed all your action steps. Great work!
      </ThemedText>
    </View>
  );

  if (loading) {
    return <DashboardActionStepsSkeleton />;
  }

  return (
    <View style={styles.card}>

      {error ? (
        <View style={styles.errorContainer}>
          <ThemedText weight="semiBold" style={styles.errorText}>{error}</ThemedText>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              fetchActionSteps();
            }}
            style={styles.retryButton}
          >
            <ThemedText weight="semiBold" style={styles.retryText}>Try Again</ThemedText>
          </TouchableOpacity>
        </View>
      ) : actionSteps.length === 0 ? (
        renderEmptyState()
      ) : (
        <>
          <FlatList
            data={visibleSteps}
            renderItem={renderActionStep}
            keyExtractor={(item) => item.id}
            showsVerticalScrollIndicator={false}
            scrollEnabled={false}
            onViewableItemsChanged={onViewableItemsChanged.current}
            viewabilityConfig={viewabilityConfig}
          />

          {/* Show more / Show less controls matching Todos */}
          {actionSteps.length > 0 && (
            <View style={styles.paginationContainer}>
              <View style={styles.paginationButtonGroup}>
                {hasMore && (
                  <TouchableOpacity
                    style={[styles.paginationButton, styles.showMoreButton]}
                    onPress={() => { triggerLightHaptic(); loadMore(); }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel={`Show more steps. ${actionSteps.length - visibleCount} remaining`}
                    accessibilityHint="Loads 3 more action steps"
                  >
                    <Ionicons name="chevron-down" size={12} color={Colors.alertCoral} />
                    <ThemedText weight="semiBold" style={[styles.paginationButtonText, styles.showMoreText]}>Show more</ThemedText>
                  </TouchableOpacity>
                )}
                {canShowLess && (
                  <TouchableOpacity
                    style={[styles.paginationButton, styles.showLessButton]}
                    onPress={() => { triggerLightHaptic(); showLess(); }}
                    activeOpacity={0.7}
                    accessibilityRole="button"
                    accessibilityLabel="Show less steps"
                    accessibilityHint="Collapses the list to show only the first 3 steps"
                  >
                    <Ionicons name="chevron-up" size={12} color={Colors.mediumGray} />
                    <ThemedText weight="semiBold" style={[styles.paginationButtonText, styles.showLessText]}>Show less</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </>
      )}

      {/* Example modal removed */}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 120,
  },
  titleText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 14,
  },
  subtitleText: {
    fontSize: 12,
    color: Colors.mediumGray,
    textAlign: 'center',
    marginTop: -6,
    marginBottom: 12,
  },
  ctaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 8,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
  },
  ctaText: {
    color: Colors.hopeWhite,
    fontSize: 13,
  },
  secondaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.alertCoral,
  },
  secondaryText: {
    color: Colors.alertCoral,
    fontSize: 13,
  },
  // Example modal styles removed
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 16,
    color: Colors.hopeWhite,
    flex: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.alertCoral,
  },
  stepItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
    // Allow text inside this row to properly shrink/wrap on Android
    minWidth: 0,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    color: Colors.hopeWhite,
  },
  stepTitle: {
    fontSize: 14,
    color: Colors.hopeWhite,
    flex: 1,
    // Ensure long titles wrap instead of overflowing/clipping
    flexShrink: 1,
    paddingRight: 4,
  },
  playbookName: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 12,
    color: Colors.lightGray,
    lineHeight: 16,
  },
  exampleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 2,
    minWidth: 0,
  },
  exampleDescription: {
    marginLeft: 6,
    flex: 1,
    flexShrink: 1,
    paddingRight: 8,
  },
  coachTip: {
    marginTop: 4,
    fontSize: 12,
    color: Colors.faithGold,
    fontStyle: 'italic',
  },
  completeButtonTouch: {
    padding: 2,
  },
  smallIndicator: {
    width: 18,
    height: 18,
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
  emptyContainer: {
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
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
  // Pagination styles (aligned with Gratitude list)
  paginationContainer: {
    width: '100%',
    paddingVertical: 1,
  },
  paginationButtonGroup: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 0,
    paddingTop: 10,
  },
  paginationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    gap: 6,
  },
  paginationButtonText: {
    marginLeft: 2,
    fontSize: 11,
    lineHeight: 14,
  },
  fromRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    marginBottom: 2,
  },
  fromDivider: {
    width: 1,
    height: 28,
    backgroundColor: Colors.mediumGray,
    borderRadius: 2,
    marginRight: 8,
  },
  fromTextContainer: {
    flex: 1,
  },
  fromLabel: {
    fontSize: 10,
    color: Colors.mediumGray,
    letterSpacing: 1,
  },
  fromTitle: {
    fontSize: 11,
    color: Colors.mediumGray,
  },
  showMoreButton: {
    backgroundColor: 'rgba(255, 107, 107, 0.1)',
  },
  showLessButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  showMoreText: {
    color: Colors.alertCoral,
  },
  showLessText: {
    color: Colors.mediumGray,
  },
});

export default ActionStepsCard;
