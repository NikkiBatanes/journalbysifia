import React, { useMemo, useState, useRef, useEffect } from 'react';
import { Logger } from '../utils/ProductionLogger';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import FontAwesome6 from 'react-native-vector-icons/FontAwesome6';
import { Pencil } from 'lucide-react-native';
import { View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle, Animated, Easing, DeviceEventEmitter } from 'react-native';

import { NavigationProp, useNavigation } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { SmartJournalingNavigation } from '../services/smartJournalingNavigation';
import SmartJournalingReflectionModal from '../screens/SmartJournalingReflectionModal';
import SmartJournalingGratitudeModal from '../screens/SmartJournalingGratitudeModal';
import SmartJournalingTimeBlockModal from '../screens/SmartJournalingTimeBlockModal';
import JournalTypeSelectorTooltip, { JournalType } from './JournalTypeSelectorTooltip';
import { toLocalDateString } from '../utils/date';
import { triggerLightHaptic, triggerSuccessHaptic } from '../utils/haptics';
import ThemedText from './common/ThemedText';

type SubTask = {
  id: string;
  text: string;
  completed: boolean;
  isExample?: boolean;
  detected_journal_type?: string;
  is_example?: boolean;
  example_interactive?: boolean;
  _protected?: boolean; // Protected flag for auto-checked subtasks
  wisdom_text?: string; // AI-generated wisdom for this action
};

type ActionStep = {
  id: string;
  title: string;
  description?: string;
  subTasks?: SubTask[];
  completed: boolean;
};

type ActionStepsCardProps = {
  steps?: ActionStep[];
  navigation?: NavigationProp<any>;
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  solidCardBackground?: boolean;
  checkboxColor?: string;
  stepCircleBackground?: string;
  // Smart Journaling Metadata
  playbookTitle?: string;
  playbookId?: string;
  playbookStatus?: string;
  // User Context for Personalized Christian Coaching
  userInput?: string; // User's original struggle/context when creating playbook
  // Date for reflection (from journal screen)
  selectedDate?: Date;
  // Onboarding-only: show "Example:" subtasks inline with regular subtasks
  showExampleSubtasksInline?: boolean;
  // Onboarding-only: force using prop steps to bypass context if it is out-of-sync
  preferPropSteps?: boolean;
  isOnboarding?: boolean;
  // Optional overrides for header title and icon
  titleOverride?: string;
  iconOverride?: string;
  expanded?: boolean;
  showCloseButton?: boolean;
  // Callback to collapse the card (for parent screens)
  onCollapse?: () => void;
  // Callback to handle subtask toggle mutations
  onToggleSubTaskMutation?: (stepId: string, subTaskId: string, completed: boolean) => Promise<void>;
};

import { useActionSteps } from '../context/ActionStepsContext';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useReflectionBySubtask } from '../services/hooks/useReflectionData';
import { ReflectionApi } from '../services/api/reflectionApi';
import { faithPointsService } from '../services/faithPointsService';
import { visibleStreakService } from '../services/visibleStreakService';
import HowToModal from './HowToModal';
import { getActionWisdom } from '../services/actionWisdomService';
import { NewSubscriptionService } from '../services/NewSubscriptionService';

// Smart Journaling - Unified Icon System
// All subtasks now show a single pencil icon that opens a tooltip selector

const cleanMarkdown = (text: string | undefined): string => {
  if (!text) {return '';}
  return text
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/~~/g, '')
    .trim();
};

const isExampleApostrophe = (text: string, index: number): boolean => {
  const char = text[index];
  if (char !== "'" && char !== '‘' && char !== '’') { return false; }
  return /[A-Za-z0-9]/.test(text[index - 1] || '') && /[A-Za-z0-9]/.test(text[index + 1] || '');
};

const stripBalancedExampleQuotes = (text: string): string => {
  let out = String(text || '')
    .trim()
    .replace(/"{2,}/g, '"')
    .replace(/“{2,}/g, '“')
    .replace(/”{2,}/g, '”');

  const quotePairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ['`', '`'],
    ['“', '”'],
    ['‘', '’'],
  ];

  let changed = true;
  while (changed) {
    changed = false;
    for (const [open, close] of quotePairs) {
      if (out.startsWith(open) && out.endsWith(close)) {
        out = out.slice(1, -1).trim();
        changed = true;
        break;
      }
    }
  }

  return out.replace(/,\s*([.!?])/g, '$1');
};

const cleanExampleItem = (text: string): string =>
  stripBalancedExampleQuotes(String(text || '')
    .trim()
    .replace(/^[,;]+/g, '')
    .replace(/[,;.!?]+$/g, '')
    .trim());

const stripContrastExampleBoundaryQuotes = (text: string): string =>
  stripBalancedExampleQuotes(String(text || '').trim())
    .replace(/^["“”]\s*/, '')
    .replace(/\s*["“”]\s*([.!?])$/, '$1')
    .replace(/\s*["“”]$/, '')
    .replace(/\s+/g, ' ')
    .trim();

const isLikelyContrastStatement = (text: string): boolean => {
  const cleaned = stripContrastExampleBoundaryQuotes(text);
  return cleaned.length >= 8 &&
    cleaned.length <= 180 &&
    /^(?:I|I'm|I’m|I'll|I’ll|I've|I’ve|We|We're|We’re|You|You're|You’re|My|This|That)\b/i.test(cleaned);
};

const normalizeQuotedContrastExample = (text: string): string | null => {
  const source = String(text || '').trim();
  const separatorMatch = source.match(/\s+(versus|vs\.?|instead of)\s+/i);
  if (!separatorMatch || separatorMatch.index === undefined) {
    return null;
  }

  const before = source.slice(0, separatorMatch.index).trim();
  const after = source.slice(separatorMatch.index + separatorMatch[0].length).trim();
  const hasBoundaryQuote =
    /^["“”]/.test(before) ||
    /["“”]$/.test(before) ||
    /^["“”]/.test(after) ||
    /["“”]$/.test(after);

  if (!before || !after) {
    return null;
  }

  const first = stripContrastExampleBoundaryQuotes(before);
  const second = stripContrastExampleBoundaryQuotes(after);
  if (!first || !second) {
    return null;
  }

  if (!hasBoundaryQuote && !(isLikelyContrastStatement(first) && isLikelyContrastStatement(second))) {
    return null;
  }

  const separator = /^vs/i.test(separatorMatch[1]) ? 'versus' : separatorMatch[1].toLowerCase();
  return `"${first}" ${separator} "${second}"`;
};

const extractStandaloneQuotedExampleItems = (text: string): string[] => {
  const source = String(text || '').trim();
  const items: string[] = [];
  let outside = '';

  for (let i = 0; i < source.length; i++) {
    const open = source[i];
    if ((open !== '"' && open !== "'" && open !== '“' && open !== '‘') || isExampleApostrophe(source, i)) {
      outside += open;
      continue;
    }

    const close = open === '“' ? '”' : open === '‘' ? '’' : open;
    let end = -1;
    for (let cursor = i + 1; cursor < source.length; cursor++) {
      if (source[cursor] === close && source[cursor - 1] !== '\\' && !isExampleApostrophe(source, cursor)) {
        end = cursor;
        break;
      }
    }

    if (end === -1) {
      outside += open;
      continue;
    }

    const item = cleanExampleItem(source.slice(i + 1, end));
    if (item) {
      items.push(`"${item}"`);
    }
    i = end;
  }

  const nonSeparatorText = outside
    .replace(/\b(?:and|or)\b/gi, '')
    .replace(/[,;\s]+/g, '')
    .trim();

  return items.length >= 2 && !nonSeparatorText ? items : [];
};

const cleanActionExampleText = (text: string): string => {
  const source = cleanMarkdown(String(text || ''))
    .replace(/^Example:\s*/i, '')
    .replace(/\\"/g, '"')
    .replace(/\\'/g, "'")
    .replace(/&quot;|&#34;/gi, '"')
    .trim();
  const quotedContrast = normalizeQuotedContrastExample(source);
  if (quotedContrast) {
    return quotedContrast;
  }

  const quotedItems = extractStandaloneQuotedExampleItems(source);
  return quotedItems.length >= 2 ? quotedItems.join('; ') : stripBalancedExampleQuotes(source);
};

const normalizeSubTasks = (subTasks: any[] | undefined, stepId?: string): SubTask[] => {
  if (!subTasks) {
    return [];
  }

  // Debug: Log input subtasks before normalization

  const normalized = subTasks.map((task, index) => ({
    id: typeof task === 'string'
      ? stepId ? `${stepId}-subtask-${index}` : `subtask-${index}`
      : task.id || (stepId ? `${stepId}-subtask-${index}` : `subtask-${index}`),
    text: cleanMarkdown(typeof task === 'string' ? task : task.text || task.toString()),
    completed: typeof task === 'string' ? false : Boolean(task.completed),
    detected_journal_type: typeof task === 'object' ? task.detected_journal_type : undefined,
    is_example: typeof task === 'object' ? task.is_example : false,
    example_interactive: typeof task === 'object' ? task.example_interactive : false,
    _protected: typeof task === 'object' ? task._protected : undefined,
  }));

  // Debug: Log normalized subtasks after normalization

  return normalized;
};

const processSteps = (steps: ActionStep[]): ActionStep[] => {
  return steps.map(step => ({
    ...step,
    subTasks: normalizeSubTasks(step.subTasks, step.id),
  }));
};

export default function ActionStepsCard({
  steps: propSteps = [],
  navigation,
  style,
  textColor = Colors.hopeWhite,
  solidCardBackground = false,
  checkboxColor,
  stepCircleBackground,
  playbookTitle,
  playbookId,
  playbookStatus,
  userInput: _userInput,
  selectedDate,
  showExampleSubtasksInline = false,
  preferPropSteps = false,
  isOnboarding = false,
  titleOverride,
  iconOverride,
  expanded = false,
  showCloseButton = true,
  onCollapse,
  onToggleSubTaskMutation,
}: ActionStepsCardProps) {
  const internalNavigation = useNavigation<NavigationProp<any>>();
  const nav = navigation ?? internalNavigation;

  const { user } = useAuth();
  const { actionSteps: contextSteps, handleToggleStep, handleAutoCompleteStep } = useActionSteps();
  const queryClient = useQueryClient();
  const [selectedSubtask, setSelectedSubtask] = useState<{ subTask: SubTask; stepInfo: { stepNumber: number; stepTitle: string; stepId?: string } } | null>(null);
  const [activeModal, setActiveModal] = useState<string | null>(null);
  const [_isGuidedPromptActive, _setIsGuidedPromptActive] = useState(false);
  const [selectedActionStep, setSelectedActionStep] = useState<{ stepNumber: number; stepTitle: string; stepId?: string } | null>(null);
  const [howToModalVisible, setHowToModalVisible] = useState(false);
  const [selectedActionForWisdom, setSelectedActionForWisdom] = useState<{ stepId: string; stepTitle: string } | null>(null);
  const [wisdomCount, setWisdomCount] = useState(0);
  const [wisdomLimit, setWisdomLimit] = useState(0);
  const [showHowToButtons] = useState(true);

  // Unified Journal Type Selector Tooltip State
  const [tooltipVisible, setTooltipVisible] = useState(false);
  const [tooltipSubtask, setTooltipSubtask] = useState<{ subTask: SubTask; stepInfo: { stepNumber: number; stepTitle: string; stepId?: string } } | null>(null);

  // Smart Journaling Helper Tooltip State
  const [showSmartTooltip, setShowSmartTooltip] = useState(false);
  const tooltipOpacity = useRef(new Animated.Value(0)).current;
  const tooltipTranslateY = useRef(new Animated.Value(10)).current;

  const completionAnim = React.useRef<Record<string, Animated.Value>>({});

  // Query for existing reflection when a subtask is selected (but not for example subtasks)
  const subtaskId = selectedSubtask?.subTask?.id ?? '';
  const isExampleSubtask = selectedSubtask?.subTask?.isExample || selectedSubtask?.subTask?.is_example ||
    (subtaskId && (subtaskId.startsWith('ex-') || subtaskId.startsWith('example-')));

  // Only call the hook if we have a valid, non-example subtask ID
  const { data: existingReflection, isLoading: isReflectionLoading, error: reflectionError } = useReflectionBySubtask(
    user?.id || '',
    !isExampleSubtask && subtaskId ? subtaskId : ''
  );

  // Toggle simplified insight for a specific step

  // Debug: Log reflection query results
  React.useEffect(() => {
    if (selectedSubtask) {

    }
  }, [selectedSubtask, existingReflection, isReflectionLoading, reflectionError, user?.id]);

  const steps = useMemo(() => {
    // In onboarding, we may prefer prop steps to avoid context race conditions
    const rawSteps = preferPropSteps
      ? (propSteps ?? [])
      : ((contextSteps && contextSteps.length > 0) ? contextSteps : (propSteps ?? []));

    // Debug: Log raw steps completion state before processing
    if (rawSteps && rawSteps.length > 0) {

    }

    if (!rawSteps || rawSteps.length === 0) {
      return [];
    }

    const processedSteps = processSteps(rawSteps).map(step => ({
      ...step,
      title: cleanMarkdown(step.title),
      description: step.description ? cleanMarkdown(step.description) : undefined,
      subTasks: step.subTasks?.map(subTask => ({
        ...subTask,
        text: cleanMarkdown(subTask.text),
        // CRITICAL: Preserve protected flag
        _protected: subTask._protected,
      })),
    }));

    // Debug: Log processed steps completion state after processing

    return processedSteps;
  }, [propSteps, contextSteps, preferPropSteps]);

  // Initialize animation values for each step after steps are computed
  React.useEffect(() => {
    (steps || []).forEach(s => {
      if (!completionAnim.current[s.id]) {
        completionAnim.current[s.id] = new Animated.Value(0);
      }
    });
  }, [steps]);

  const loadWisdomUsage = React.useCallback(() => {
    if (user?.id) {
      NewSubscriptionService.getUserSubscription(user.id).then(subscription => {
        const limits = NewSubscriptionService.getTierLimits(subscription.tier, subscription);
        setWisdomCount((subscription as any).wisdom_count || 0);
        setWisdomLimit(isOnboarding ? 1 : limits.wisdom_limit || 0);
      });
    }
  }, [isOnboarding, user?.id]);

  // Load wisdom counts
  React.useEffect(() => {
    loadWisdomUsage();
  }, [loadWisdomUsage]);

  React.useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('wisdomUsageReset', (payload?: { wisdomCount?: number; wisdomLimit?: number }) => {
      setWisdomCount(payload?.wisdomCount ?? 0);
      if (typeof payload?.wisdomLimit === 'number') {
        setWisdomLimit(payload.wisdomLimit);
      } else {
        loadWisdomUsage();
      }
    });

    return () => subscription.remove();
  }, [loadWisdomUsage]);

  // Debug: Track when ActionStepsCard re-renders
  React.useEffect(() => {
    if (steps && steps.length > 0) {
      // Completion states tracked for debugging if needed

    }
  }, [steps]);

  const onToggleSubTask = React.useCallback(async (stepId: string, subTaskId: string) => {

    // CRITICAL: Check if subtask is protected (auto-checked) - if so, do nothing
    const targetStep = steps.find(s => s.id === stepId);
    const targetSubTask = targetStep?.subTasks?.find(st => st.id === subTaskId);

    if (targetSubTask?._protected) {
      Logger.info('[ActionStepsCard] Blocked toggle of protected subtask', {
        component: 'ActionStepsCard',
        stepId,
        subTaskId,
      });
      return; // Exit early - no context update, no database mutation
    }

    // Light haptic for any toggle action
    triggerLightHaptic();

    // Determine if this toggle will complete the parent action step
    try {
      const step = steps.find(s => s.id === stepId);
      const sub = step?.subTasks?.find(st => st.id === subTaskId);
      if (step && sub) {
        const willBeCompleted = (() => {
          // Predict new completion state for the toggled subtask
          const nextSubCompleted = !sub.completed;
          const allOthersCompleted = (step.subTasks || [])
            .filter(st => st.id !== subTaskId)
            .every(st => st.completed);
          return nextSubCompleted && allOthersCompleted;
        })();

        if (!step.completed && willBeCompleted) {
          // Success haptic when an action step transitions to completed
          triggerSuccessHaptic();
          // Trigger success pulse animation on the step card
          const anim = completionAnim.current[stepId];
          if (anim) {
            Animated.sequence([
              Animated.timing(anim, {
                toValue: 1,
                duration: 160,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
              }),
              Animated.timing(anim, {
                toValue: 0,
                duration: 180,
                easing: Easing.inOut(Easing.ease),
                useNativeDriver: true,
              }),
            ]).start();
          }

          // Award faith points once per completed action step (idempotent via AsyncStorage)
          // ✅ FIX: Debounce to prevent rapid-fire transactions causing phone heating
          (async () => {
            try {
              if (!user?.id) { return; }
              const awardKey = `fp_awarded_action_step:${user.id}:${playbookId || 'unknown_playbook'}:${stepId}`;

              // ✅ FIX: Check AsyncStorage first to prevent race condition
              const alreadyAwarded = await AsyncStorage.getItem(awardKey);
              if (alreadyAwarded) {
                return;
              }

              // ✅ FIX: Set flag BEFORE awarding to prevent duplicate calls
              await AsyncStorage.setItem(awardKey, '1');

              // ✅ FIX: Add 500ms delay to debounce rapid completions
              await new Promise(resolve => setTimeout(resolve, 500));

              await faithPointsService.awardPoints(user.id, 'action_step_completed', {
                stepId,
                subTaskId,
                playbookId,
                source: 'ActionStepsCard.onToggleSubTask',
              });

              // Check if streak celebration should show for action step completion.
              // Fires when:
              //   a) All steps just became complete (playbook just finished), OR
              //   b) Playbook is already completed and user is completing an individual step.
              const allStepsComplete = (steps || []).every(s => s.completed === true);
              const isPlaybookCompleted = allStepsComplete || playbookStatus === 'completed';
              if (isPlaybookCompleted) {
                const shouldShowStreak = await visibleStreakService.shouldShowCelebration(user.id, 'action_step_completed');
                if (shouldShowStreak) {
                  await visibleStreakService.markShownToday(user.id);
                  (nav as any).navigate('StreakPlan', {
                    userId: user.id,
                    source: 'action_step_completed',
                  });
                }
              }

              // If that was the final incomplete step for this playbook, award a one-time playbook completion bonus
              try {
                if (playbookId) {
                  const allCompletedAfter = (steps || []).every(s => {
                    if (s.id === stepId) {
                      // This step becomes completed after this toggle
                      return true;
                    }
                    return s.completed === true;
                  });

                  if (allCompletedAfter) {
                    const playbookAwardKey = `fp_awarded_playbook_completed:${user.id}:${playbookId}`;
                    const playbookAlready = await AsyncStorage.getItem(playbookAwardKey);
                    if (!playbookAlready) {
                      // ✅ FIX: Set flag BEFORE awarding to prevent race condition
                      await AsyncStorage.setItem(playbookAwardKey, '1');

                      await faithPointsService.awardPoints(user.id, 'playbook_completed', {
                        playbookId,
                        stepId,
                        subTaskId,
                        source: 'ActionStepsCard.onToggleSubTask',
                      });
                    }
                  }
                }
              } catch (pbErr) {
                Logger.warn('[ActionStepsCard] Failed to award playbook completion bonus (non-fatal)', {
      component: 'ActionStepsCard',
      data: pbErr,
    });
              }
            } catch (err) {
              Logger.warn('[ActionStepsCard] Failed to award faith points', {
      component: 'ActionStepsCard',
      data: err,
    });
            }
          })();
        }
      }
    } catch (e) {
      // Non-fatal: haptic prediction failed; continue
      Logger.warn('[ActionStepsCard] Haptic prediction error', {
      component: 'ActionStepsCard',
      data: e,
    });
    }

    // Calculate new completed state BEFORE updating context
    const step = steps.find(s => s.id === stepId);
    const subTask = step?.subTasks?.find(st => st.id === subTaskId);
    const newCompletedState = subTask ? !subTask.completed : true;

    // Proceed with actual toggle update in context
    handleToggleStep(stepId, subTaskId);

    // Persist to database if mutation callback is provided
    if (onToggleSubTaskMutation) {
      try {
        await onToggleSubTaskMutation(stepId, subTaskId, newCompletedState);
      } catch (error) {
        Logger.error('[ActionStepsCard] Failed to persist subtask toggle', error as Error, {
          component: 'ActionStepsCard',
          data: { stepId, subTaskId },
        });
      }
    }

    // Invalidate queries immediately for dashboard sync
    queryClient.invalidateQueries({ queryKey: ['userPlaybooks'] });
    queryClient.invalidateQueries({ queryKey: ['playbookProgress'] });
    queryClient.invalidateQueries({ queryKey: ['playbooks'] });
    queryClient.invalidateQueries({ queryKey: ['actionSteps'] });

    // Trigger custom event for immediate dashboard sync
    DeviceEventEmitter.emit('playbookProgressUpdate', {
      stepId, subTaskId, type: 'playbook_detail_toggle',
    });
  }, [handleToggleStep, steps, user?.id, playbookId, playbookStatus, queryClient, onToggleSubTaskMutation, nav]);

  const onJournalTypePress = React.useCallback((journalType: string, subTask: SubTask, stepInfo?: { stepNumber: number; stepTitle: string; stepId?: string }) => {

    if (journalType === 'none') {

      return;
    }

    // Light haptic for journal action buttons
    triggerLightHaptic();

    // Handle reflection type with modal
    if (journalType === 'reflection') {

      // Check if this is an example subtask (synthetic subtask from examples)
      // Example subtasks have IDs that don't exist in the database, so we skip prefetch
      const isExampleSubtaskForReflection = subTask.isExample || subTask.is_example ||
        (subTask.id && (subTask.id.startsWith('ex-') || subTask.id.startsWith('example-')));

      // PERFORMANCE: Open modal immediately, prefetch in background
      const openModal = async () => {
        // Protect against logout during operation
        if ((globalThis as any).authMonitor) {
          (globalThis as any).authMonitor.startOperation();
        }

        const openedFromGuidedPrompt = !stepInfo;
        _setIsGuidedPromptActive(openedFromGuidedPrompt);

        // Create fallback stepInfo with explicit types
        const fallbackStepInfo: { stepNumber: number; stepTitle: string } = {
          stepNumber: subTask.isExample ? 0 : (stepInfo?.stepNumber ?? 0),
          stepTitle: subTask.isExample ? 'Suggestion' : (stepInfo?.stepTitle ?? ''),
        };

        setSelectedSubtask({ subTask, stepInfo: stepInfo || fallbackStepInfo });
        setSelectedActionStep(stepInfo || null);
        setActiveModal('reflection');

        // End operation protection after modal opens
        setTimeout(() => {
          if ((globalThis as any).authMonitor) {
            (globalThis as any).authMonitor.endOperation();
          }
        }, 1000);

        // PERFORMANCE: Prefetch in background after modal opens
        if (!isExampleSubtaskForReflection && user?.id && subTask.id) {
          // Don't await - prefetch in background
          queryClient.prefetchQuery({
            queryKey: ['reflections', 'subtask', user.id, subTask.id],
            queryFn: () => ReflectionApi.getReflectionBySubtask(user.id, subTask.id),
          }).catch(error => {
            Logger.warn('[ActionStepsCard] Background prefetch failed', {
              component: 'ActionStepsCard',
              data: error,
            });
          });
        }
      };

      openModal();
      return;
    }

    // Handle gratitude type with modal
    if (journalType === 'gratitude') {

      // Prefetch gratitude data and wait for it to complete before opening modal
      const openGratitudeModal = async () => {
        // Protect against logout during operation
        if ((globalThis as any).authMonitor) {
          (globalThis as any).authMonitor.startOperation();
        }

        if (user?.id && subTask.id) {

          try {
            await queryClient.prefetchQuery({
              queryKey: ['gratitude', user.id, toLocalDateString(new Date())],
              queryFn: () => {
                // This will prefetch today's gratitude entries
                // The actual API call will be handled by the modal
                return Promise.resolve([]);
              },
            });

          } catch (error) {
            Logger.warn('[ActionStepsCard] Gratitude prefetch failed, opening modal anyway', {
      component: 'ActionStepsCard',
      data: error,
    });
          }
        }

        setSelectedSubtask({ subTask, stepInfo: stepInfo || { stepNumber: 0, stepTitle: '' } });
        setSelectedActionStep(stepInfo || null);
        setActiveModal('gratitude');

        // End operation protection after modal opens
        setTimeout(() => {
          if ((globalThis as any).authMonitor) {
            (globalThis as any).authMonitor.endOperation();
          }
        }, 1000);
      };

      openGratitudeModal();
      return;
    }

    // Handle prayer type with modal
    if (journalType === 'prayer') {

      // Prefetch prayer data and wait for it to complete before opening modal
      // Navigate to Unified Prayer Selection Screen with metadata
      const metadata = {
        playbookId,
        playbookTitle,
        actionStepNumber: stepInfo?.stepNumber,
        actionStepTitle: stepInfo?.stepTitle,
        subtaskTitle: subTask.text,
        subtaskId: subTask.id,
        selectedDate: toLocalDateString(new Date()),
      };

      (nav as any).navigate('UnifiedPrayerSelection', {
        metadata,
      });
      return;
    }

    // Handle timeblock type with modal
    if (journalType === 'timeblock') {

      // Prefetch timeblock data and wait for it to complete before opening modal
      const openTimeBlockModal = async () => {
        // Protect against logout during operation
        if ((globalThis as any).authMonitor) {
          (globalThis as any).authMonitor.startOperation();
        }

        if (user?.id && subTask.id) {

          try {
            await queryClient.prefetchQuery({
              queryKey: ['timeBlocks', user.id, toLocalDateString(new Date())],
              queryFn: () => {
                // This will prefetch today's timeblock entries
                // The actual API call will be handled by the modal
                return Promise.resolve([]);
              },
            });

          } catch (error) {
            Logger.warn('[ActionStepsCard] TimeBlock prefetch failed, opening modal anyway', {
      component: 'ActionStepsCard',
      data: error,
    });
          }
        }

        setSelectedSubtask({ subTask, stepInfo: stepInfo || { stepNumber: 0, stepTitle: '' } });
        setSelectedActionStep(stepInfo || null);
        setActiveModal('timeblock');

        // End operation protection after modal opens
        setTimeout(() => {
          if ((globalThis as any).authMonitor) {
            (globalThis as any).authMonitor.endOperation();
          }
        }, 1000);
      };

      openTimeBlockModal();
      return;
    }

    // For other journal types, use navigation service
    if (!navigation) {
      Logger.warn('[ActionStepsCard] Navigation not available for journal type navigation', {
      component: 'ActionStepsCard',
    });
      return;
    }

    const navService = SmartJournalingNavigation.create(navigation);
    navService.navigateToJournaling(journalType as any);
  }, [navigation, nav, user?.id, queryClient, playbookId, playbookTitle]);

  // Long-press Handler - Show tooltip when subtask is long-pressed (iMessage-style)
  const handlePencilIconPress = React.useCallback((subTask: SubTask, stepInfo: { stepNumber: number; stepTitle: string; stepId?: string }) => {
    // Medium haptic for long-press confirmation (like iMessage)
    triggerLightHaptic();
    setTooltipSubtask({ subTask, stepInfo });
    setTooltipVisible(true);
  }, []);

  const handleTooltipClose = React.useCallback(() => {
    setTooltipVisible(false);
    setTimeout(() => setTooltipSubtask(null), 300); // Clear after animation
  }, []);

  const handleJournalTypeSelect = React.useCallback((journalType: JournalType) => {
    if (!tooltipSubtask) {return;}

    // Close tooltip
    setTooltipVisible(false);

    // Open corresponding modal with subtask info
    setTimeout(() => {
      onJournalTypePress(journalType, tooltipSubtask.subTask, tooltipSubtask.stepInfo);
      setTooltipSubtask(null);
    }, 200); // Small delay for smooth transition
  }, [tooltipSubtask, onJournalTypePress]);

  const autoCompleteSelectedFaithfulAction = React.useCallback(async () => {
    const stepId = selectedSubtask?.stepInfo?.stepId;
    const selectedSubTaskId = selectedSubtask?.subTask?.id;

    if (!stepId) {
      return;
    }

    handleAutoCompleteStep(stepId);

    const selectedStep = steps.find(step => step.id === stepId);
    const persistableSubTasks = (selectedStep?.subTasks || []).filter(subTask => {
      const subTaskId = subTask?.id;
      if (!subTaskId) {
        return false;
      }
      return !(
        subTask.isExample ||
        subTask.is_example ||
        (typeof subTask.text === 'string' && subTask.text.toLowerCase().startsWith('example:')) ||
        subTaskId.startsWith('ex-') ||
        subTaskId.startsWith('example-')
      );
    });

    try {
      if (persistableSubTasks.length > 0) {
        if (onToggleSubTaskMutation) {
          await Promise.all(
            persistableSubTasks.map(subTask =>
              onToggleSubTaskMutation(stepId, subTask.id, true)
            )
          );
        } else if (user?.id && playbookId) {
          const { updatePlaybookSubTask } = await import('../services/supabaseApiNormalized');
          await Promise.all(
            persistableSubTasks.map(subTask =>
              updatePlaybookSubTask(user.id, playbookId, stepId, subTask.id, true)
            )
          );
        }
      }

      const { updateActionStepCompleted } = await import('../services/supabaseApiNormalized');
      await updateActionStepCompleted(stepId);

      queryClient.invalidateQueries({ queryKey: ['userPlaybooks'] });
      queryClient.invalidateQueries({ queryKey: ['playbookProgress'] });
      queryClient.invalidateQueries({ queryKey: ['playbooks'] });
      queryClient.invalidateQueries({ queryKey: ['actionSteps'] });

      DeviceEventEmitter.emit('playbookProgressUpdate', {
        stepId,
        subTaskId: selectedSubTaskId,
        type: 'smart_journaling_save',
      });
    } catch (error) {
      Logger.error('[ActionStepsCard] Failed to persist smart journaling completion', error as Error, {
        component: 'ActionStepsCard',
        data: { stepId, subTaskId: selectedSubTaskId, playbookId },
      });
    }
  }, [handleAutoCompleteStep, onToggleSubTaskMutation, playbookId, queryClient, selectedSubtask, steps, user?.id]);

  // Modal handlers
  const handleReflectionSave = React.useCallback(async (_entry: any) => {

    // Protect against logout during save operation
    if ((globalThis as any).authMonitor) {
      (globalThis as any).authMonitor.startOperation();
    }

    try {
      // Invalidate the reflection query to refresh data immediately
      if (user?.id && selectedSubtask?.subTask?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['reflections', 'subtask', user.id, selectedSubtask.subTask.id],
        });

      }

      // Auto-check the subtask when reflection is saved (PROTECTED)
      await autoCompleteSelectedFaithfulAction();
    } finally {
      // End operation protection after save completes
      setTimeout(() => {
        if ((globalThis as any).authMonitor) {
          (globalThis as any).authMonitor.endOperation();
        }
      }, 2000); // Give time for modal animations
    }

    // Close the modal now that the step is committed
    setActiveModal(null);
    setSelectedSubtask(null);
    setSelectedActionStep(null);
  }, [queryClient, user?.id, selectedSubtask, autoCompleteSelectedFaithfulAction]);

  const handleReflectionCancel = React.useCallback(() => {

    // End operation protection when modal closes
    if ((globalThis as any).authMonitor) {
      (globalThis as any).authMonitor.endOperation();
    }

    setActiveModal(null);
    setSelectedSubtask(null);
    setSelectedActionStep(null);
  }, []);

  const handleGratitudeSave = React.useCallback(async (_entry: any) => {

    // Protect against logout during save operation
    if ((globalThis as any).authMonitor) {
      (globalThis as any).authMonitor.startOperation();
    }

    try {
      // Invalidate the gratitude query to refresh data immediately
      if (user?.id) {
        await queryClient.invalidateQueries({
          queryKey: ['gratitude', user.id, toLocalDateString(new Date())],
        });

      }

      // Auto-check the subtask when gratitude is saved (PROTECTED)
      await autoCompleteSelectedFaithfulAction();
    } finally {
      // End operation protection after save completes
      setTimeout(() => {
        if ((globalThis as any).authMonitor) {
          (globalThis as any).authMonitor.endOperation();
        }
      }, 2000); // Give time for modal animations
    }

    // Close the modal now that the step is committed
    setActiveModal(null);
    setSelectedSubtask(null);
    setSelectedActionStep(null);
  }, [queryClient, user?.id, autoCompleteSelectedFaithfulAction]);

  const handleGratitudeCancel = React.useCallback(() => {

    // End operation protection when modal closes
    if ((globalThis as any).authMonitor) {
      (globalThis as any).authMonitor.endOperation();
    }

    setActiveModal(null);
    setSelectedSubtask(null);
    setSelectedActionStep(null);
  }, []);


  const handleTimeBlockSave = React.useCallback(async (entry: any) => {

    // Protect against logout during save operation
    if ((globalThis as any).authMonitor) {
      (globalThis as any).authMonitor.startOperation();
    }

    try {
      // Invalidate the timeblock query to refresh data immediately
      if (user?.id && entry?.selected_date) {
        const savedDateStr = entry.selected_date; // Use the actual saved date
        await queryClient.invalidateQueries({
          queryKey: ['timeBlocks', 'byDate', user.id, savedDateStr],
        });
        // Also invalidate for today in case they're different
        const todayStr = toLocalDateString(new Date());
        if (savedDateStr !== todayStr) {
          await queryClient.invalidateQueries({
            queryKey: ['timeBlocks', 'byDate', user.id, todayStr],
          });
        }
        // Also invalidate broader timeblock queries as fallback
        await queryClient.invalidateQueries({
          queryKey: ['timeBlocks'],
        });

      }

      // Auto-check the subtask when a time block is saved (PROTECTED)
      await autoCompleteSelectedFaithfulAction();
    } finally {
      // End operation protection after save completes
      setTimeout(() => {
        if ((globalThis as any).authMonitor) {
          (globalThis as any).authMonitor.endOperation();
        }
      }, 2000); // Give time for modal animations
    }

    // Close the modal now that the step is committed
    setActiveModal(null);
    setSelectedSubtask(null);
    setSelectedActionStep(null);
  }, [queryClient, user?.id, autoCompleteSelectedFaithfulAction]);

  const handleTimeBlockCancel = React.useCallback(() => {

    // End operation protection when modal closes
    if ((globalThis as any).authMonitor) {
      (globalThis as any).authMonitor.endOperation();
    }

    setActiveModal(null);
    setSelectedSubtask(null);
    setSelectedActionStep(null);
  }, []);

  // Create dynamic styles based on props
  const dynamicStyles = useMemo(() => ({
    stepNumber: {
      ...styles.stepNumber,
      color: textColor || styles.stepNumber.color,
    },
    stepTitle: {
      ...styles.stepTitle,
      color: textColor || styles.stepTitle.color,
    },
    subTaskText: {
      ...styles.subTaskText,
      marginLeft: 8,
      color: textColor || styles.subTaskText.color,
    },
    exampleText: {
      ...styles.exampleText,
      fontStyle: 'italic' as const,  // Use 'as const' to ensure type is 'italic' literal
      color: solidCardBackground ? Colors.anchorBlue : styles.exampleText.color,
    },
    circle: {
      ...styles.circle,
      backgroundColor: stepCircleBackground || 'rgba(255, 255, 255, 0.1)',
    },
  }), [textColor, solidCardBackground, stepCircleBackground]);

  // Helper function to get checkbox color
  const getCheckboxColor = (completed: boolean) => ({
    color: completed ? Colors.faithGold : (checkboxColor || 'rgba(255,255,255,0.7)'),
  });

  // Animate tooltip in/out
  useEffect(() => {
    if (showSmartTooltip) {
      Animated.parallel([
        Animated.timing(tooltipOpacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipTranslateY, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(tooltipOpacity, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(tooltipTranslateY, {
          toValue: 10,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [showSmartTooltip, tooltipOpacity, tooltipTranslateY]);

  const handleInfoPress = () => {
    triggerLightHaptic();
    setShowSmartTooltip(!showSmartTooltip);
  };

  return (
    <>
      <View style={style}>
      <TouchableOpacity
        style={styles.headingContainer}
        onPress={() => {
          if (onCollapse && expanded) {
            triggerLightHaptic();
            onCollapse();
          }
        }}
        activeOpacity={onCollapse && expanded ? 0.7 : 1}
        disabled={!onCollapse || !expanded}
      >
        <View style={styles.headingContent}>
          <FontAwesome6
            name={iconOverride || 'list-check'}
            size={20}
            color={Colors.alertCoral}
            style={styles.icon}
          />
          <ThemedText
            weight="bold"
            style={[
              styles.heading,
              textColor ? { color: textColor } : {},
            ]}
          >
            {titleOverride ? titleOverride : 'Faithful Actions'}
          </ThemedText>
          {expanded && (
            <TouchableOpacity
              style={styles.infoButtonInline}
              onPress={handleInfoPress}
              activeOpacity={0.7}
            >
              <Pencil
                width={14}
                height={14}
                color={textColor ? textColor : 'rgba(255,255,255,0.8)'}
                strokeWidth={2.2}
              />
            </TouchableOpacity>
          )}
        </View>
        {expanded && showCloseButton && (
          <TouchableOpacity
            style={styles.closeButtonContainer}
            onPress={() => {
              if (onCollapse) {
                triggerLightHaptic();
                onCollapse();
              }
            }}
            activeOpacity={0.7}
          >
            <Ionicons
              name="close"
              size={18}
              color={textColor || Colors.hopeWhite}
              style={styles.closeButton}
            />
          </TouchableOpacity>
        )}
      </TouchableOpacity>

      <View>
        {steps.length === 0 ? (
          <View style={styles.stepsContainer}>
            <ThemedText weight="semiBold" style={[
              styles.stepTitle,
              styles.noStepsText,
              { color: textColor || Colors.hopeWhite },
            ]}>
              No faithful actions available.
            </ThemedText>
          </View>
        ) : (
          <View style={styles.stepsContainer}>
            {steps.map((step, index) => {
              // Handle examples from database (string) or from sub-tasks
              let examples: { id: string; text: string }[] = [];

              // Debug: Log step data

              // First, check if step has examples field from database
              if ((step as any).examples && typeof (step as any).examples === 'string') {
                // Split examples by legacy "Example:" markers and clean them up
                const exampleText = (step as any).examples;
                const exampleMatches = exampleText.split(/Example:\s*/i).filter((text: string) => text.trim().length > 0);
                examples = exampleMatches.map((ex: string, i: number) => ({
                  id: `ex-${i}`,
                  text: cleanActionExampleText(ex),
                }));
              } else if (Array.isArray((step as any).examples)) {
                // Handle array format (legacy)
                examples = (step as any).examples.map((ex: string, i: number) => ({
                  id: `ex-${i}`,
                  text: cleanActionExampleText(ex),
                }));
              } else {
                // Fallback: extract from sub-tasks that start with legacy "Example:"
                examples = (step.subTasks || [])
                  .filter((st) => typeof st.text === 'string' && st.text.toLowerCase().startsWith('example:'))
                  .map((st, i) => ({
                    id: st.id || `ex-${i}`,
                    text: cleanActionExampleText(st.text),
                  }));
              }

              // If we want examples inline (onboarding), merge examples into subtasks
              const originalSubtasks = step.subTasks || [];
              let subtasks = originalSubtasks.filter((st) => {
                if (typeof st.text !== 'string') {return false;}
                if (showExampleSubtasksInline) {return true;} // include everything inline
                return !st.text.toLowerCase().startsWith('example:');
              });

              // Debug logging for subtask filtering
              if (originalSubtasks.length !== subtasks.length) {
                Logger.info(`ActionStepsCard: Step "${step.title}" - Filtered ${originalSubtasks.length} → ${subtasks.length} subtasks`, {
                  original: originalSubtasks.map(st => st.text || st),
                  filtered: subtasks.map(st => st.text),
                  showExampleSubtasksInline,
                });
              }

              // If showExampleSubtasksInline and we have examples from database, add them as subtasks (as Suggestions)
              if (showExampleSubtasksInline && examples.length > 0) {
                const exampleSubtasks = examples.map((ex) => ({
                  id: ex.id,
                  text: `Suggestion: ${cleanActionExampleText(ex.text)}`,
                  completed: false,
                  isExample: true,
                  is_example: true,
                  example_interactive: false,
                  detected_journal_type: 'none',
                  _protected: undefined,
                }));
                subtasks = [...subtasks, ...exampleSubtasks];
                examples = []; // Clear to avoid duplication below
              } else if (showExampleSubtasksInline) {
                examples = [];
              }

              const stepAnim = completionAnim.current[step.id];
              const stepScale = stepAnim
                ? stepAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] })
                : 1 as any;

              return (
                <Animated.View
                  key={step.id}
                  style={[
                    solidCardBackground ? styles.solidStepCard : styles.stepCard,
                    step.completed && styles.completedCard,
                    { transform: [{ scale: stepScale }] },
                  ]}
                >
                  <View style={styles.stepHeader}>
                    <View style={styles.stepNumberContainer}>
                      <View
                        style={[
                          dynamicStyles.circle,
                          step.completed && styles.completedCircle,
                        ]}
                      >
                        <ThemedText weight="bold" style={dynamicStyles.stepNumber}>
                          {index + 1}
                        </ThemedText>
                      </View>
                    </View>
                    <View style={styles.titleContainer}>
                      <ThemedText
                        weight="semiBold"
                        style={[
                          dynamicStyles.stepTitle,
                          step.completed && styles.completedText,
                        ]}
                      >
                        {step.title}
                      </ThemedText>
                    </View>
                    {showHowToButtons && (
                      <TouchableOpacity
                        style={styles.actionHowToButton}
                        onPress={() => {
                          triggerLightHaptic();
                          setSelectedActionForWisdom({ stepId: step.id, stepTitle: step.title });
                          setHowToModalVisible(true);
                        }}
                        activeOpacity={0.8}
                      >
                        <ThemedText style={styles.actionHowToButtonText}>How to</ThemedText>
                      </TouchableOpacity>
                    )}
                  </View>

                  {subtasks.length > 0 && (
                    <View style={styles.subTasksList}>
                      {subtasks.map((subTask) => {
                        // Debug: Log subtask data for smart journaling

                        return (
                          <View
                            key={subTask.id}
                            style={styles.subTaskButton}
                          >
                            <TouchableOpacity
                              style={styles.checkboxContainer}
                              onPress={() => onToggleSubTask(step.id, subTask.id)}
                              activeOpacity={0.7}
                            >
                              <View>
                                <MaterialCommunityIcons
                                  name={
                                    subTask.completed
                                      ? 'checkbox-marked-circle'
                                      : 'checkbox-blank-circle-outline'
                                  }
                                  size={24}
                                  style={[
                                    styles.checkboxIcon,
                                    getCheckboxColor(subTask.completed),
                                  ]}
                                />
                              </View>
                            </TouchableOpacity>
                            <View style={styles.subTaskContent}>
                              {/* Long-press subtask text to show journal type selector (iMessage-style) */}
                              <TouchableOpacity
                                style={styles.subTaskTextContainer}
                                onLongPress={() => {
                                  handlePencilIconPress(subTask, { stepNumber: index + 1, stepTitle: step.title, stepId: step.id });
                                }}
                                delayLongPress={400}
                                activeOpacity={0.8}
                              >
                                <ThemedText
                                  style={[
                                    dynamicStyles.subTaskText,
                                    subTask.completed && styles.completedText,
                                  ]}
                                >
                                  {subTask.text}
                                </ThemedText>
                              </TouchableOpacity>

                              {subTask.wisdom_text && (
                                <View style={styles.wisdomContainer}>
                                  <Ionicons
                                    name="bulb"
                                    size={14}
                                    color={Colors.growthGreen}
                                    style={styles.wisdomIcon}
                                  />
                                  <ThemedText style={styles.wisdomText}>
                                    {subTask.wisdom_text}
                                  </ThemedText>
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {subtasks.length === 0 && step.description && (
                    <ThemedText weight="regular" style={styles.stepDescription}>
                      {step.description}
                    </ThemedText>
                  )}

                  {!showExampleSubtasksInline && examples.length > 0 && (
                    <View style={styles.examplesContainer}>
                      <View style={styles.examplesHeader}>
                        <Ionicons
                          name="chatbubble-ellipses-outline"
                          size={14}
                          color={solidCardBackground ? Colors.anchorBlue : 'rgba(255,255,255,0.8)'}
                          style={styles.examplesIcon}
                        />
                      </View>
                      {examples.map((example: { id: string; text: string }) => (
                        <TouchableOpacity
                          key={example.id}
                          activeOpacity={0.8}
                          onLongPress={() => {
                            // Treat example text as a synthetic subtask for journaling
                            const syntheticSubTask: SubTask = {
                              id: example.id,
                              text: example.text,
                              completed: false,
                            };
                            handlePencilIconPress(syntheticSubTask, {
                              stepNumber: index + 1,
                              stepTitle: step.title,
                              stepId: step.id,
                            });
                          }}
                        >
                          <ThemedText style={dynamicStyles.exampleText}>
                            {example.text}
                          </ThemedText>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}

                </Animated.View>
              );
            })}
          </View>
        )}
        </View>
      </View>

      {/* Smart Journaling Reflection Modal */}
      {activeModal === 'reflection' && (
        <SmartJournalingReflectionModal
          visible={true}
          subtaskTitle={selectedSubtask?.subTask?.text || ''}
          subtaskId={selectedSubtask?.subTask?.id}
          stepId={selectedActionStep?.stepId}
          playbookId={playbookId}
          playbookTitle={playbookTitle}
          actionStepNumber={selectedActionStep?.stepNumber}
          actionStepTitle={selectedActionStep?.stepTitle}
          existingReflection={existingReflection}
          selectedDate={selectedDate}
          isGuidedReflection={false} // Action steps are playbook context, not guided
          hideGuidedPromptButton={true} // Hide guided prompt button in playbook detail screen context
          isJournalCarousel={false} // This is from action steps, not journal carousel
          onSave={handleReflectionSave}
          onCancel={() => {
            setActiveModal(null);
            setSelectedSubtask(null);
            setSelectedActionStep(null);
            handleReflectionCancel();
          }}
        />
      )}
      {activeModal === 'gratitude' && (
        <SmartJournalingGratitudeModal
          visible={true}
          isActive={activeModal === 'gratitude'} // Only active when this modal is selected
          subtaskTitle={selectedSubtask?.subTask?.text || ''}
          subtaskId={selectedSubtask?.subTask?.id}
          stepId={selectedActionStep?.stepId}
          playbookId={playbookId}
          playbookTitle={playbookTitle}
          playbookStatus={(steps || []).every(s => s.completed === true) ? 'completed' : 'inProgress'}
          actionStepNumber={selectedActionStep?.stepNumber}
          actionStepTitle={selectedActionStep?.stepTitle}
          existingGratitude={null}
          onSave={handleGratitudeSave}
          onClose={() => {
            setActiveModal(null);
            setSelectedSubtask(null);
            setSelectedActionStep(null);
            handleGratitudeCancel();
          }}
        />
      )}
      {activeModal === 'timeblock' && (
        <SmartJournalingTimeBlockModal
          visible={true}
          subtaskTitle={selectedSubtask?.subTask?.text || ''}
          subtaskId={selectedSubtask?.subTask?.id}
          stepId={selectedActionStep?.stepId}
          playbookId={playbookId}
          playbookTitle={playbookTitle}
          playbookStatus={(steps || []).every(s => s.completed === true) ? 'completed' : 'inProgress'}
          actionStepNumber={selectedActionStep?.stepNumber}
          actionStepTitle={selectedActionStep?.stepTitle}
          existingTimeBlock={null}
          onSave={handleTimeBlockSave}
          onCancel={() => {
            setActiveModal(null);
            setSelectedSubtask(null);
            setSelectedActionStep(null);
            handleTimeBlockCancel();
          }}
        />
      )}

      {/* Unified Journal Type Selector Tooltip */}
      <JournalTypeSelectorTooltip
        visible={tooltipVisible}
        onSelect={handleJournalTypeSelect}
        onClose={handleTooltipClose}
        subtaskText={tooltipSubtask?.subTask?.text}
        showTimeBlock={true} // Show TimeBlock in action steps
      />

      {/* Smart Journaling Helper Tooltip */}
      {showSmartTooltip && (
        <TouchableOpacity
          style={styles.tooltipBackdrop}
          activeOpacity={1}
          onPress={() => setShowSmartTooltip(false)}
        >
          <Animated.View
            style={[
              styles.smartTooltip,
              {
                opacity: tooltipOpacity,
                transform: [{ translateY: tooltipTranslateY }],
              },
            ]}
            pointerEvents="box-none"
          >
            <ThemedText weight="semiBold" style={styles.tooltipKicker}>Smart Journaling</ThemedText>
            <ThemedText weight="semiBold" style={styles.tooltipTitle}>Long press any subtask or suggestion to open Smart Journaling.</ThemedText>
            <ThemedText weight="semiBold" style={styles.tooltipSubtitle}>You'll see the text in a focused bubble, then choose a journal type:</ThemedText>
            <View style={styles.tooltipList}>
              <View style={styles.tooltipItemRow}>
                <View style={[styles.tooltipIconCircle, { backgroundColor: Colors.reflectionBlue }]}>
                  <MaterialCommunityIcons name="head-lightbulb" size={20} color={Colors.hopeWhite} />
                </View>
                <ThemedText weight="semiBold" style={styles.tooltipItemText}>Reflection</ThemedText>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={[styles.tooltipIconCircle, { backgroundColor: Colors.prayerPurple }]}>
                  <MaterialCommunityIcons name="hands-pray" size={20} color={Colors.hopeWhite} />
                </View>
                <ThemedText weight="semiBold" style={styles.tooltipItemText}>Prayer</ThemedText>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={[styles.tooltipIconCircle, { backgroundColor: Colors.gratitudeRed }]}>
                  <MaterialCommunityIcons name="heart" size={20} color={Colors.hopeWhite} />
                </View>
                <ThemedText weight="semiBold" style={styles.tooltipItemText}>Gratitude</ThemedText>
              </View>
              <View style={styles.tooltipItemRow}>
                <View style={[styles.tooltipIconCircle, { backgroundColor: Colors.timeblockGreen }]}>
                  <MaterialCommunityIcons name="clock" size={20} color={Colors.hopeWhite} />
                </View>
                <ThemedText weight="semiBold" style={styles.tooltipItemText}>Time Block</ThemedText>
              </View>
            </View>
            <View style={styles.tooltipCaret} />
          </Animated.View>
        </TouchableOpacity>
      )}

      <HowToModal
        visible={howToModalVisible}
        actionTitle={selectedActionForWisdom?.stepTitle || ''}
        onDismiss={() => setHowToModalVisible(false)}
        onSubmit={async (question) => {
          try {
            const response = await getActionWisdom({
              playbookId: playbookId || '',
              userId: user?.id || '',
              userName: (user as any)?.user_metadata?.full_name?.split(' ')[0] || (user as any)?.email?.split('@')[0] || '',
              actionId: selectedActionForWisdom?.stepId || '',
              actionTitle: selectedActionForWisdom?.stepTitle || '',
              actionBody: '',
              userQuestion: question,
              truthSummary: '',
              truthInLove: '',
              isOnboarding,
            });

            if (response.success && response.wisdom) {
              setWisdomCount(response.wisdomCount || wisdomCount + 1);
              triggerSuccessHaptic();
            }

            return response;
          } catch (error) {
            return {
              success: false,
              error: 'ERROR',
              message: 'Something went wrong. Please try again.',
            };
          }
        }}
        wisdomCount={wisdomCount}
        wisdomLimit={wisdomLimit}
        hideUsageCounter={isOnboarding}
      />
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 10,
    elevation: 4,
  },
  solidCard: {
    backgroundColor: Colors.hopeWhite,
  },
  solidStepCard: {
    backgroundColor: Colors.actionBackground,
    borderRadius: 24,
    padding: 22,
    marginBottom: 20,
    width: '100%',
    alignSelf: 'center',
  },
  subTasksList: {
    marginTop: 8,
    marginLeft: 0,
  },
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  headingContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 8,
  },
  heading: {
    ...Typography.interBold,
    fontSize: 20,
    color: Colors.hopeWhite,
    marginLeft: 4,
  },
  infoButtonInline: {
    marginLeft: 8,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoButtonContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
  closeButtonContainer: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButton: {
    opacity: 0.7,
  },
  stepsContainer: {
    width: '100%',
  },
  stepCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    width: '100%',
    maxWidth: '100%',
    alignSelf: 'center',
  },
  completedCard: {
    opacity: 0.7,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    width: '100%',
    justifyContent: 'space-between',
  },
  stepNumberContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedCircle: {
    backgroundColor: Colors.faithGold,
  },
  stepNumber: {
    ...Typography.interBold,
    fontSize: 14,
    color: Colors.hopeWhite,
  },
  stepTitle: {
    // Typography handled by ThemedText weight="semiBold"
    fontSize: 15,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    flexShrink: 1,
    flexWrap: 'wrap',
    textTransform: 'uppercase',
    paddingRight: 8,
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  subTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    width: '100%',
  },
  checkboxContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    flexShrink: 0,
  },
  checkboxIcon: {
    // Size will be controlled by the container
  },
  subTaskText: {
    color: 'white',
    fontSize: 15,
    flexShrink: 1,
    lineHeight: 22,
    paddingRight: 12,
    // fontWeight handled by ThemedText weight="regular"
    flexWrap: 'wrap',
  },
  subTaskContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0, // Prevent flex children from overflowing
  },
  journalTypesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 8,
  },
  journalTypeIndicator: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
  },
  journalTypeIndicatorSpaced: {
    marginLeft: 4,
  },
  journalIcon: {
    // Icon styling handled by MaterialCommunityIcons
  },
  subTaskTextContainer: {
    flex: 1,
    paddingRight: 12,
  },
  exampleText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 2,
  },
  examplesContainer: {
    marginTop: 8,
    marginLeft: 28,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.2)',
    paddingLeft: 12,
  },
  examplesTitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    // fontWeight handled by ThemedText weight="semiBold"
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  examplesHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  examplesIcon: {
    // Visual spacing if we later decide to add a label next to the icon
    marginRight: 4,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
    minWidth: 0,
  },
  insightsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: 8,
  },
  insightsButtonText: {
    ...Typography.interRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  insightPlaceholder: {
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    marginTop: 8,
  },
  insightPlaceholderText: {
    opacity: 0.7,
  },
  insightsContainer: {
    marginTop: 12,
    marginLeft: 28,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255,255,255,0.2)',
    paddingLeft: 12,
  },
  questionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  questionButtonText: {
    ...Typography.interSemiBold,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginLeft: 4,
  },
  loadingContainer: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  loadingText: {
    ...Typography.interRegular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
    fontStyle: 'italic',
  },
  biblicalText: {
    ...Typography.interSemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 215, 0, 0.9)',
    fontStyle: 'italic',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 8,
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: 'rgba(255, 215, 0, 0.5)',
  },
  listItem: {
    ...Typography.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 4,
    paddingLeft: 8,
  },
  userQuestionText: {
    ...Typography.interSemiBold,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.8)',
    fontStyle: 'italic',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
  },
  questionInputContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  questionInput: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
    padding: 12,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  questionActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  submitButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  submitButtonText: {
    ...Typography.interSemiBold,
    fontSize: 13,
    color: Colors.white,
  },
  cancelButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
  },
  cancelButtonText: {
    ...Typography.interSemiBold,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  accessRequiredContainer: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
  },
  accessRequiredText: {
    ...Typography.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  upgradeButtonText: {
    ...Typography.interSemiBold,
    fontSize: 14,
    color: Colors.white,
  },
  // Streamlined Single-Insight UI Styles
  streamlinedInsightContainer: {
    marginTop: 12,
  },
  focusedInsightCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.faithGold,
  },
  insightIcon: {
    fontSize: 20,
    marginBottom: 8,
  },
  focusedInsightText: {
    ...Typography.interRegular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  scriptureQuote: {
    ...Typography.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.faithGold,
    fontStyle: 'italic',
    marginBottom: 12,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: 'rgba(255, 215, 0, 0.3)',
  },
  actionStepContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  actionStepLabel: {
    ...Typography.interSemiBold,
    fontSize: 12,
    color: Colors.faithGold,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionStepText: {
    ...Typography.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.hopeWhite,
  },
  followUpContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  // Smart Journaling Helper Tooltip Styles
  tooltipBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  smartTooltip: {
    position: 'absolute',
    top: 60,
    left: 16,
    maxWidth: 280,
    backgroundColor: Colors.alertCoral,
    borderRadius: 12,
    padding: 12,
    zIndex: 10000,
  },
  tooltipKicker: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 15,
    lineHeight: 20,
    marginBottom: 4,
    textAlign: 'center',
  },
  tooltipTitle: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 6,
  },
  tooltipSubtitle: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 2,
  },
  tooltipList: {
    gap: 8,
    marginTop: 6,
    marginBottom: 6,
  },
  tooltipItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tooltipIconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  tooltipItemText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },
  tooltipCaret: {
    position: 'absolute',
    right: 70,
    top: -6,
    width: 12,
    height: 12,
    backgroundColor: Colors.alertCoral,
    transform: [{ rotate: '45deg' }],
    borderRadius: 3,
  },
  wisdomContainer: {
    marginTop: 8,
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: 'rgba(46, 204, 113, 0.1)',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(46, 204, 113, 0.2)',
  },
  wisdomIcon: {
    marginRight: 8,
    marginTop: 2,
  },
  wisdomText: {
    ...Typography.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(255, 255, 255, 0.85)',
    flex: 1,
  },
  stepDescription: {
    ...Typography.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.7)',
    marginTop: 8,
  },
  noStepsText: {
    opacity: 0.6,
  },
  actionHowToButton: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actionHowToButtonText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
});
