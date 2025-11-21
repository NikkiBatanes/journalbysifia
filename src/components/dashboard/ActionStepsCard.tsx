/**
 * ActionStepsCard.tsx
 * Displays unfinished action steps from user's playbooks
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Animated,
  DeviceEventEmitter,
  Alert
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Pencil, AlertCircle } from 'lucide-react-native';
import { Colors } from '../../theme/colors';
import { supabase } from '../../services/supabaseClient';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { triggerLightHaptic } from '../../utils/haptics';
import { faithPointsService } from '../../services/faithPointsService';
import { rankSteps } from '../../services/nextBestStep';
import DashboardActionStepsSkeleton from '../SkeletonLoader/DashboardActionStepsSkeleton';
import ThemedText from '../common/ThemedText';

interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  is_example?: boolean;
  example_interactive?: boolean;
}

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
  subTasks?: SubTask[];
  completedSubTasks?: number;
  totalSubTasks?: number;
  shouldAutoComplete?: boolean;
}

interface ActionStepsCardProps {
  onStepPress?: (step: ActionStep) => void;
  onViewAll?: () => void;
  onCountChange?: (count: number) => void;
}

const ActionStepsCard: React.FC<ActionStepsCardProps> = ({ onStepPress, onViewAll: _onViewAll, onCountChange }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionSteps, setActionSteps] = useState<ActionStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_completingStepId, setCompletingStepId] = useState<string | null>(null);
  const [completedStepId, setCompletedStepId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(3);
  const stepAnimations = useRef<{[stepId: string]: Animated.Value}>({}).current;
  // Example modal removed per request; keep UI simple and non-interactive

  const handleSmartJournalingInfo = () => {
    triggerLightHaptic();
    Alert.alert(
      'Smart Journaling',
      [
        'Long press any subtask or suggestion to open Smart Journaling.',
        '',
        'You\'ll see the text in a focused bubble, then choose a journal type:',
        '💡 Reflection',
        '🙏 Prayer',
        '❤️ Gratitude',
        '⏰ Time Block',
      ].join('\n'),
    );
  };

  const logEvent = useCallback(async () => {
    try {
      // Simple console log for now - can be enhanced later

    } catch (analyticsError) {
      Logger.error('Analytics error', analyticsError as Error, {
  component: 'ActionStepsCard',
});
    }
  }, []);

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
        logEvent();
      }
    });
  });

  const viewabilityConfig = { itemVisiblePercentThreshold: 60, minimumViewTime: 400 };

  // Auto-complete main step when all subtasks are done
  const checkAndCompleteStep = useCallback(async (stepId: string) => {
    // Get fresh step data from current state
    setActionSteps(currentSteps => {
      const step = currentSteps.find(s => s.id === stepId);
      if (!step || !step.subTasks || step.subTasks.length === 0 || !user) {
        return currentSteps;
      }

      const allSubTasksCompleted = step.subTasks.every(subTask => subTask.completed);
      if (allSubTasksCompleted && !step.isCompleted) {

        // Perform async operations
        (async () => {
          try {
            setCompletingStepId(stepId);

            // Initialize animation if not exists
            if (!stepAnimations[stepId]) {
              stepAnimations[stepId] = new Animated.Value(1);
            }

            // Update main step as completed
            const { error: updateError } = await supabase
              .from('playbook_action_steps')
              .update({ completed: true })
              .eq('id', stepId);
            if (updateError) {throw updateError;}

            // Award faith points for step completion
            await faithPointsService.awardPoints(
              user.id,
              'action_step_completed',
              { playbook_id: step.playbookId, step_id: step.id, title: step.title }
            );

            logEvent();

            // Force immediate refetch for all related queries
            await queryClient.invalidateQueries({ queryKey: ['playbooks'] });
            await queryClient.invalidateQueries({ queryKey: ['actionSteps'] });
            await queryClient.invalidateQueries({ queryKey: ['playbook', step.playbookId] });
            await Promise.all([
              queryClient.invalidateQueries({ queryKey: ['userPlaybooks'] }),
              queryClient.invalidateQueries({ queryKey: ['playbookProgress'] }),
            ]);

            // Emit event for PlaybookCarousel to update
            DeviceEventEmitter.emit('playbookProgressUpdate', { stepId, playbookId: step.playbookId });

            setCompletedStepId(stepId);
            setTimeout(() => setCompletedStepId(null), 2000);
          } catch (catchError) {
            Logger.error('Error completing step', catchError as Error, {
  component: 'ActionStepsCard',
});
          } finally {
            setCompletingStepId(null);
          }
        })();

        // Return updated state showing step as completed
        return currentSteps.map(s =>
          s.id === stepId ? { ...s, isCompleted: true } : s
        );
      }

      return currentSteps;
    });
  }, [user, queryClient, stepAnimations, logEvent]);

  const fetchActionSteps = useCallback(async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Fetch user's playbooks with subtasks
      const { data: __progressData, error: progressError } = await supabase
        .from('playbook_action_steps')
        .select(`
          *,
          playbook:playbooks(*),
          playbook_sub_tasks(
            id,
            text,
            completed,
            is_example,
            example_interactive,
            order_index
          )
        `)
        .eq('completed', false)
        .order('order_index', { ascending: true })
        .limit(10);

      if (progressError) {
        Logger.error('Error fetching action steps', progressError as Error, {
  component: 'ActionStepsCard',
});
        throw progressError;
      }

      if (!__progressData || __progressData.length === 0) {
        setActionSteps([]);
        return;
      }

      // Transform the data to match ActionStep interface
      const transformedSteps: ActionStep[] = __progressData.map((step: any) => {
        const subTasks = (step.playbook_sub_tasks || []).map((subTask: any) => ({
          id: subTask.id,
          text: subTask.text || '',
          completed: subTask.completed || false,
          is_example: subTask.is_example,
          example_interactive: subTask.example_interactive,
        }));

        const completedSubTasks = subTasks.filter((st: SubTask) => st.completed).length;
        const totalSubTasks = subTasks.length;

        // Check if all subtasks are completed but main step isn't
        const allSubTasksCompleted = totalSubTasks > 0 && completedSubTasks === totalSubTasks;
        const shouldAutoComplete = allSubTasksCompleted && !step.completed;

        return {
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
          subTasks,
          completedSubTasks,
          totalSubTasks,
          shouldAutoComplete,
        };
      });

      // Rank steps by scoring (no coach tips)
      const ranked = rankSteps(transformedSteps);

      setActionSteps(ranked);

      // Store steps that need auto-completion for later processing
      const stepsToAutoComplete = ranked.filter(step => step.shouldAutoComplete);
      if (stepsToAutoComplete.length > 0) {

        // Process auto-completion after state is set
        setTimeout(() => {
          stepsToAutoComplete.forEach(step => {

            checkAndCompleteStep(step.id);
          });
        }, 200);
      }

    } catch (fetchError) {
      Logger.error('Error fetching action steps', fetchError as Error, {
  component: 'ActionStepsCard',
});
      setError('Failed to load action steps');
    } finally {
      setLoading(false);
    }
  }, [user, checkAndCompleteStep]);

  useEffect(() => {
    fetchActionSteps();
  }, [fetchActionSteps, user]);

  // Set up real-time subscription for changes from other screens
  useEffect(() => {
    if (!user) {return;}

    const channelName = `action_steps_realtime_${user.id}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'playbook_action_steps' },
        (_payload) => {

          fetchActionSteps();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'playbook_sub_tasks',
        },
        () => {
          // Refetch when subtasks change
          fetchActionSteps();
        }
      )
      .subscribe();

    return () => {
      try {
        channel.unsubscribe();
        supabase.removeChannel(channel);
      } catch {}
    };
  }, [user, fetchActionSteps]);

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

  const handleStepPress = useCallback(async (step: ActionStep) => {

    onStepPress?.(step);
  }, [onStepPress]);

  const markSubTaskDone = useCallback(async (stepId: string, subTaskId: string) => {
    if (!user) {return;}

    try {
      // Update subtask completion in database
      const { error: updateError } = await supabase
        .from('playbook_sub_tasks')
        .update({ completed: true })
        .eq('id', subTaskId);

      if (updateError) {throw updateError;}

      // No faith points for individual subtasks - only on full step completion

      // Update local state
      setActionSteps(prev => prev.map(step => {
        if (step.id === stepId) {
          const updatedSubTasks = step.subTasks?.map(subTask =>
            subTask.id === subTaskId ? { ...subTask, completed: true } : subTask
          ) || [];
          const completedSubTasks = updatedSubTasks.filter((st: SubTask) => st.completed).length;

          return {
            ...step,
            subTasks: updatedSubTasks,
            completedSubTasks,
          };
        }
        return step;
      }));

      // Force immediate refetch for playbook carousel sync
      queryClient.invalidateQueries({ queryKey: ['userPlaybooks'] });
      queryClient.invalidateQueries({ queryKey: ['playbookProgress'] });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });

      // Trigger a custom event for immediate carousel update
      DeviceEventEmitter.emit('playbookProgressUpdate', {
        stepId, subTaskId, type: 'subtask',
      });

      triggerLightHaptic();

      // Check if step should be auto-completed
      setTimeout(() => checkAndCompleteStep(stepId), 100);
    } catch (e) {
      Logger.error('Failed to mark subtask as done', e as Error, { component: 'ActionStepsCard' });
      setError('Failed to complete subtask. Please try again.');
    }
  }, [user, checkAndCompleteStep, queryClient]);

  // markStepDone removed - steps auto-complete when all subtasks are done

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

  const renderSubTask = (subTask: SubTask, stepId: string) => (
    <View key={subTask.id} style={styles.subTaskItem}>
      <TouchableOpacity
        onPress={() => !subTask.completed && markSubTaskDone(stepId, subTask.id)}
        disabled={subTask.completed}
        style={styles.subTaskCheckbox}
        hitSlop={{ top: 4, bottom: 4, left: 4, right: 4 }}
      >
        <Ionicons
          name={subTask.completed ? 'checkmark-circle' : 'ellipse-outline'}
          size={20}
          color={subTask.completed ? Colors.growthGreen : Colors.textGray}
        />
      </TouchableOpacity>
      <ThemedText
        weight="regular"
        style={[
          styles.subTaskText,
          subTask.completed && styles.subTaskTextCompleted,
        ]}
        numberOfLines={2}
      >
        {subTask.text}
      </ThemedText>
    </View>
  );

  const renderActionStep = ({ item }: { item: ActionStep }) => (
    <TouchableOpacity
      style={styles.stepItem}
      onPress={() => {
        triggerLightHaptic();
        logEvent();
        handleStepPress(item);
      }}
      activeOpacity={0.8}
    >
      {/* Priority chip removed per request */}

      <View style={styles.stepHeaderMain}>
        {/* Step number badge - not clickable, with animation */}
        <View style={styles.stepNumberContainer}>
          <Animated.View style={[
            styles.stepNumberBadge,
            (item.isCompleted || completedStepId === item.id) && styles.stepNumberBadgeCompleted,
            {
              transform: [{
                scale: stepAnimations[item.id] || 1,
              }],
            },
          ]}>
          <ThemedText weight="semiBold" style={[
            styles.stepNumberText,
            (item.isCompleted || completedStepId === item.id) && styles.stepNumberTextCompleted,
          ]}>
            {item.stepIndex + 1}
          </ThemedText>
          </Animated.View>
        </View>
        <View style={styles.stepTitleContainer}>
          <ThemedText weight="semiBold" style={styles.stepTitle} numberOfLines={2}>
            {stripMarkdownEmphasis(item.title)}
          </ThemedText>
          {/* Progress indicator */}
          {item.subTasks && item.subTasks.length > 0 && (
            <ThemedText weight="regular" style={styles.progressText}>
              {item.completedSubTasks}/{item.totalSubTasks} completed
            </ThemedText>
          )}
        </View>
      </View>

      {/* Subtasks */}
      {item.subTasks && item.subTasks.length > 0 && (
        <View style={[styles.subTasksContainer, leftOffsetStyle]}>
          {item.subTasks.map(subTask => renderSubTask(subTask, item.id))}
        </View>
      )}

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
      <Ionicons name="checkmark-circle" size={32} color={Colors.growthGreen} />
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
          <View style={styles.header}>
            <ThemedText weight="semiBold" style={styles.titleText}>
              Action Steps
            </ThemedText>
            <View style={styles.headerRight}>
              <TouchableOpacity
                style={styles.smartJournalHelperButton}
                onPress={handleSmartJournalingInfo}
                activeOpacity={0.7}
              >
                <Pencil
                  width={14}
                  height={14}
                  color={'rgba(255,255,255,0.85)'}
                  strokeWidth={2.2}
                />
              </TouchableOpacity>
              {_onViewAll && (
                <TouchableOpacity style={styles.viewAllButton} onPress={() => { triggerLightHaptic(); _onViewAll(); }}>
                  <ThemedText weight="semiBold" style={styles.viewAllText}>
                    View all
                  </ThemedText>
                  <Ionicons name="chevron-forward" size={14} color={Colors.alertCoral} />
                </TouchableOpacity>
              )}
            </View>
          </View>

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
                    <Ionicons name="chevron-up" size={12} color={Colors.textGray} />
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
    color: Colors.textGray,
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
    marginBottom: 12,
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  smartJournalHelperButton: {
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  stepHeaderMain: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    overflow: 'visible',
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
    borderBottomColor: Colors.lightOverlay,
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
    backgroundColor: Colors.subtleOverlay,
    borderColor: Colors.lightBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  chipText: {
    fontSize: 11,
    color: Colors.hopeWhite,
  },
  stepTitleContainer: {
    flex: 1,
    flexShrink: 1,
    paddingRight: 4,
  },
  stepNumberContainer: {
    marginRight: 12,
    overflow: 'visible',
    zIndex: 10,
    width: 40, // Even wider to accommodate 1.3x scale (24 * 1.3 = 31.2)
    height: 40, // Even taller to accommodate 1.3x scale
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.faithGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumberBadgeCompleted: {
    backgroundColor: Colors.growthGreen,
  },
  stepNumberText: {
    fontSize: 12,
    color: Colors.hopeWhite, // Changed to hopeWhite as requested
    fontWeight: '700',
  },
  stepNumberTextCompleted: {
    color: Colors.hopeWhite,
  },
  stepTitle: {
    fontSize: 16, // Increased from 14
    color: Colors.hopeWhite,
    // Ensure long titles wrap instead of overflowing/clipping
    flexShrink: 1,
  },
  progressText: {
    fontSize: 11,
    color: Colors.textGray,
    marginTop: 2,
  },
  subTasksContainer: {
    marginTop: 8,
    marginBottom: 4,
  },
  subTaskItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    paddingRight: 8,
  },
  subTaskCheckbox: {
    marginRight: 8,
    marginTop: 0,
  },
  subTaskText: {
    fontSize: 14, // Increased from 12
    color: Colors.lightGray,
    flex: 1,
    lineHeight: 18, // Increased from 16
  },
  subTaskTextCompleted: {
    color: Colors.textGray,
    textDecorationLine: 'line-through',
    textDecorationStyle: 'solid',
    textDecorationColor: Colors.textGray,
  },
  playbookName: {
    fontSize: 12,
    color: Colors.textGray,
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
    color: Colors.textGray,
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
    color: Colors.textGray,
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
    backgroundColor: Colors.mediumOverlay,
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
    backgroundColor: Colors.textGray,
    borderRadius: 2,
    marginRight: 8,
  },
  fromTextContainer: {
    flex: 1,
  },
  fromLabel: {
    fontSize: 10,
    color: Colors.textGray,
    letterSpacing: 1,
  },
  fromTitle: {
    fontSize: 11,
    color: Colors.textGray,
  },
  showMoreButton: {
    backgroundColor: Colors.lightOverlay,
  },
  showLessButton: {
    backgroundColor: Colors.restfulShadow,
  },
  showMoreText: {
    color: Colors.alertCoral,
  },
  showLessText: {
    color: Colors.textGray,
  },
});

export default ActionStepsCard;
