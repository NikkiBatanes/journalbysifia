import React, { useMemo, useState, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle, Animated } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { NavigationProp } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import { SmartJournalingNavigation } from '../services/smartJournalingNavigation';
import SmartJournalingReflectionModal from '../screens/SmartJournalingReflectionModal';

type SubTask = {
  id: string;
  text: string;
  completed: boolean;
  isExample?: boolean;
  detected_journal_type?: string;
  is_example?: boolean;
  example_interactive?: boolean;
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
};

import { useActionSteps } from '../context/ActionStepsContext';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useReflectionBySubtask } from '../services/hooks/useReflectionData';

// Smart Journaling Helper Functions
const getJournalTypeIcon = (journalType?: string): string => {
  switch (journalType) {
    case 'prayer': return 'hands-pray';
    case 'reflection': return 'head-lightbulb';
    case 'gratitude': return 'heart';
    case 'win': return 'trophy';
    case 'timeblock': return 'clock';
    case 'todos': return 'checkbox-marked-circle';
    case 'focus': return 'target';
    case 'financial_budgeting': return 'currency-usd';
    case 'financial_tithing': return 'gift';
    case 'financial_debt': return 'credit-card-minus';
    case 'none': return '';
    default: return '';
  }
};

const getJournalTypeColor = (journalType?: string): string => {
  switch (journalType) {
    case 'prayer': return '#9B59B6'; // Purple
    case 'reflection': return '#3498DB'; // Blue
    case 'gratitude': return '#E74C3C'; // Red/Pink
    case 'win': return '#F39C12'; // Orange/Gold
    case 'timeblock': return '#2ECC71'; // Green
    case 'todos': return '#1ABC9C'; // Teal
    case 'focus': return '#E67E22'; // Orange
    case 'financial_budgeting': return '#27AE60'; // Green
    case 'financial_tithing': return '#8E44AD'; // Purple
    case 'financial_debt': return '#C0392B'; // Dark Red
    case 'none': return 'transparent';
    default: return 'transparent';
  }
};

const shouldShowJournalIcon = (journalType?: string): boolean => {
  return journalType !== 'none' && journalType !== undefined && journalType !== '';
};

const parseJournalTypes = (journalType?: string): string[] => {
  if (!journalType || journalType === 'none') {
    return [];
  }
  return journalType.split(',').map(type => type.trim()).filter(type => type && type !== 'none');
};

const cleanMarkdown = (text: string | undefined): string => {
  if (!text) {return '';}
  return text
    .replace(/\*\*|__/g, '')
    .replace(/\*|_/g, '')
    .replace(/~~/g, '')
    .trim();
};

const normalizeSubTasks = (subTasks: any[] | undefined, stepId?: string): SubTask[] => {
  if (!subTasks) {
    return [];
  }
  return subTasks.map((task, index) => ({
    id: typeof task === 'string'
      ? stepId ? `${stepId}-subtask-${index}` : `subtask-${index}`
      : task.id || (stepId ? `${stepId}-subtask-${index}` : `subtask-${index}`),
    text: cleanMarkdown(typeof task === 'string' ? task : task.text || task.toString()),
    completed: typeof task === 'string' ? false : Boolean(task.completed),
    detected_journal_type: typeof task === 'object' ? task.detected_journal_type : undefined,
    is_example: typeof task === 'object' ? task.is_example : false,
    example_interactive: typeof task === 'object' ? task.example_interactive : false,
  }));
};

const processSteps = (steps: ActionStep[]): ActionStep[] => {
  return steps.map(step => ({
    ...step,
    subTasks: normalizeSubTasks(step.subTasks, step.id),
  }));
};

export default function ActionStepsCard({
  steps: propSteps,
  navigation,
  style,
  textColor,
  solidCardBackground,
  checkboxColor,
  stepCircleBackground,
  playbookTitle,
  playbookId,
}: ActionStepsCardProps) {
  const { actionSteps: contextSteps, handleToggleStep } = useActionSteps();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Smart Journaling Modal State
  const [reflectionModalVisible, setReflectionModalVisible] = useState(false);
  const [selectedSubtask, setSelectedSubtask] = useState<SubTask | null>(null);
  const [selectedActionStep, setSelectedActionStep] = useState<{ stepNumber: number; stepTitle: string; stepId?: string } | null>(null);

  // Query for existing reflection when a subtask is selected
  const { data: existingReflection, isLoading: isReflectionLoading, error: reflectionError } = useReflectionBySubtask(
    user?.id || '',
    selectedSubtask?.id || ''
  );

  // Debug: Log reflection query results
  React.useEffect(() => {
    if (selectedSubtask) {
      console.log('[ActionStepsCard] Reflection query debug:', {
        userId: user?.id,
        subtaskId: selectedSubtask?.id,
        existingReflection,
        isLoading: isReflectionLoading,
        error: reflectionError,
      });
    }
  }, [selectedSubtask, existingReflection, isReflectionLoading, reflectionError, user?.id]);

  // Animation for subtask completion
  const animatedValues = useRef<Map<string, Animated.Value>>(new Map()).current;

  const getAnimatedValue = React.useCallback((subtaskId: string) => {
    if (!animatedValues.has(subtaskId)) {
      animatedValues.set(subtaskId, new Animated.Value(0));
    }
    return animatedValues.get(subtaskId)!;
  }, [animatedValues]);

  const steps = useMemo(() => {
    const rawSteps = (propSteps && propSteps.length > 0) ? propSteps : contextSteps;
    if (!rawSteps || rawSteps.length === 0) {
      return [];
    }
    return processSteps(rawSteps).map(step => ({
      ...step,
      title: cleanMarkdown(step.title),
      description: step.description ? cleanMarkdown(step.description) : undefined,
      subTasks: step.subTasks?.map(subTask => ({
        ...subTask,
        text: cleanMarkdown(subTask.text),
      })),
    }));
  }, [propSteps, contextSteps]);

  const onToggleSubTask = React.useCallback((stepId: string, subTaskId: string) => {
    console.log('[ActionStepsCard] Toggling subtask:', { stepId, subTaskId });

    // Get the animated value for this subtask
    const animatedValue = getAnimatedValue(subTaskId);

    // Animate the completion
    Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start();

    handleToggleStep(stepId, subTaskId);
  }, [handleToggleStep, getAnimatedValue]);

  const onJournalTypePress = React.useCallback((journalType: string, subTask: SubTask, stepInfo?: { stepNumber: number; stepTitle: string; stepId?: string }) => {
    console.log('[ActionStepsCard] Journal type pressed:', {
      journalType,
      subTask,
      subtaskId: subTask.id,
      subtaskIdType: typeof subTask.id,
      subtaskIdLength: subTask.id?.length,
    });

    if (journalType === 'none') {
      console.log('[ActionStepsCard] No journaling needed for this task');
      return;
    }

    // Handle reflection type with modal
    if (journalType === 'reflection') {
      console.log('[ActionStepsCard] Opening reflection modal for:', {
        subtaskText: subTask.text,
        subtaskId: subTask.id,
        subtaskCompleted: subTask.completed,
        userId: user?.id,
      });
      setSelectedSubtask(subTask);
      setSelectedActionStep(stepInfo || null);
      setReflectionModalVisible(true);
      return;
    }

    // For other journal types, use navigation service
    if (!navigation) {
      console.warn('[ActionStepsCard] Navigation not available for journal type navigation');
      return;
    }

    const navService = SmartJournalingNavigation.create(navigation);
    navService.navigateToJournaling(journalType as any, subTask);
  }, [navigation, user?.id]);

  // Modal handlers
  const handleReflectionSave = React.useCallback(async (entry: any) => {
    console.log('[ActionStepsCard] Reflection saved:', entry);

    // Invalidate the reflection query to refresh data immediately
    if (user?.id && selectedSubtask?.id) {
      await queryClient.invalidateQueries({
        queryKey: ['reflections', 'subtask', user.id, selectedSubtask.id],
      });
      console.log('[ActionStepsCard] Reflection query invalidated for immediate refresh');
    }

    // Modal will close automatically after showing success
  }, [queryClient, user?.id, selectedSubtask?.id]);

  const handleReflectionCancel = React.useCallback(() => {
    console.log('[ActionStepsCard] Reflection modal cancelled');
    setReflectionModalVisible(false);
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

  return (
    <>
      <View style={style}>
      <View style={styles.headingContainer}>
        <MaterialCommunityIcons
          name="playlist-check"
          size={24}
          color={Colors.alertCoral}
          style={styles.icon}
        />
        <Text style={[styles.heading, textColor ? { color: textColor } : {}]}>
          {steps.length} Action steps
        </Text>
      </View>

      <View>
        {steps.length === 0 ? (
          <View style={styles.stepsContainer}>
            <Text style={[
              styles.stepTitle,
              styles.noStepsText,
              { color: textColor || Colors.hopeWhite },
            ]}>
              No action steps available.
            </Text>
          </View>
        ) : (
          <View style={styles.stepsContainer}>
            {steps.map((step, index) => {
              // Handle examples from database (string) or from sub-tasks
              let examples: { id: string; text: string }[] = [];

              // Debug: Log step data
              console.log(`[ActionStepsCard] Step ${index}:`, {
                id: step.id,
                title: step.title,
                examples: (step as any).examples,
                examplesType: typeof (step as any).examples,
                hasExamples: !!(step as any).examples,
              });

              // First, check if step has examples field from database
              if ((step as any).examples && typeof (step as any).examples === 'string') {
                // Split examples by "Example:" and clean them up
                const exampleText = (step as any).examples;
                const exampleMatches = exampleText.split(/Example:\s*/i).filter((text: string) => text.trim().length > 0);
                examples = exampleMatches.map((ex: string, i: number) => ({
                  id: `ex-${i}`,
                  text: ex.trim(),
                }));
              } else if (Array.isArray((step as any).examples)) {
                // Handle array format (legacy)
                examples = (step as any).examples.map((ex: string, i: number) => ({
                  id: `ex-${i}`,
                  text: ex,
                }));
              } else {
                // Fallback: extract from sub-tasks that start with "Example:"
                examples = (step.subTasks || [])
                  .filter((st) => typeof st.text === 'string' && st.text.toLowerCase().startsWith('example:'))
                  .map((st, i) => ({
                    id: st.id || `ex-${i}`,
                    text: st.text.replace(/^Example:/i, '').trim(),
                  }));
              }
              const subtasks = (step.subTasks || [])
                .filter(
                  (st) => typeof st.text === 'string' && !st.text.toLowerCase().startsWith('example:')
                );

              return (
                <View
                  key={step.id}
                  style={[
                    solidCardBackground ? styles.solidStepCard : styles.stepCard,
                    step.completed && styles.completedCard,
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
                        <Text style={dynamicStyles.stepNumber}>
                          {index + 1}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.titleContainer}>
                      <Text
                        style={[
                          dynamicStyles.stepTitle,
                          step.completed && styles.completedText,
                        ]}
                      >
                        {step.title}
                      </Text>
                    </View>
                  </View>

                  {subtasks.length > 0 && (
                    <View style={styles.subTasksList}>
                      {subtasks.map((subTask) => {
                        // Debug: Log subtask data for smart journaling
                        console.log('[ActionStepsCard] Subtask debug:', {
                          text: subTask.text?.substring(0, 30) + '...',
                          detected_journal_type: subTask.detected_journal_type,
                          completed: subTask.completed,
                          shouldShow: shouldShowJournalIcon(subTask.detected_journal_type),
                          parsedTypes: parseJournalTypes(subTask.detected_journal_type),
                        });

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
                              <Animated.View
                                style={{
                                  transform: [{
                                    scale: getAnimatedValue(subTask.id).interpolate({
                                      inputRange: [0, 1],
                                      outputRange: [1, 1.3],
                                    }),
                                  }],
                                }}
                              >
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
                              </Animated.View>
                            </TouchableOpacity>
                            <View style={styles.subTaskContent}>
                              <View style={styles.textContainer}>
                                <Animated.Text
                                  style={[
                                    dynamicStyles.subTaskText,
                                    subTask.completed && styles.completedText,
                                    {
                                      opacity: getAnimatedValue(subTask.id).interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [1, 0.7],
                                      }),
                                    },
                                  ]}
                                >
                                  {subTask.text}
                                </Animated.Text>
                                {/* Animated strikethrough overlay */}
                                <Animated.View
                                  style={[
                                    styles.strikethroughLine,
                                    {
                                      width: getAnimatedValue(subTask.id).interpolate({
                                        inputRange: [0, 1],
                                        outputRange: ['0%', '100%'],
                                      }),
                                      opacity: getAnimatedValue(subTask.id).interpolate({
                                        inputRange: [0, 0.5, 1],
                                        outputRange: [0, 1, 1],
                                      }),
                                    },
                                  ]}
                                />
                              </View>
                              {subTask.detected_journal_type && subTask.detected_journal_type !== 'none' && (
                              <View style={styles.journalTypesContainer}>
                                {/* Debug: Log journal types */}
                                {(() => {
                                  console.log('[ActionStepsCard] Rendering journal types for subtask:', {
                                    subtaskText: subTask.text,
                                    detectedType: subTask.detected_journal_type,
                                    parsedTypes: parseJournalTypes(subTask.detected_journal_type),
                                  });
                                  return null;
                                })()}
                                  {parseJournalTypes(subTask.detected_journal_type).map((journalType, typeIndex) => (
                                    <TouchableOpacity
                                      key={`${journalType}-${typeIndex}`}
                                      style={[
                                        styles.journalTypeIndicator,
                                        typeIndex > 0 && styles.journalTypeIndicatorSpaced,
                                      ]}
                                      onPress={() => onJournalTypePress(journalType, subTask, { stepNumber: index + 1, stepTitle: step.title, stepId: step.id })}
                                      activeOpacity={0.7}
                                    >
                                      <MaterialCommunityIcons
                                        name={getJournalTypeIcon(journalType)}
                                        size={16}
                                        color={getJournalTypeColor(journalType)}
                                        style={styles.journalIcon}
                                      />
                                    </TouchableOpacity>
                                  ))}
                                </View>
                              )}
                            </View>
                          </View>
                        );
                      })}
                    </View>
                  )}

                  {subtasks.length === 0 && step.description && (
                    <Text style={styles.stepDescription}>
                      {step.description}
                    </Text>
                  )}

                  {examples.length > 0 && (
                    <View style={styles.examplesContainer}>
                      <Text
                        style={[
                          styles.examplesTitle,
                          solidCardBackground && { color: Colors.anchorBlue },
                        ]}
                      >
                        {examples.length === 1 ? 'EXAMPLE:' : 'EXAMPLES:'}
                      </Text>
                      {examples.map((example: { id: string; text: string }) => (
                        <Text
                          key={example.id}
                          style={dynamicStyles.exampleText}
                        >
                          {example.text}
                        </Text>
                      ))}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}
        </View>
      </View>

      {/* Smart Journaling Reflection Modal */}
      <SmartJournalingReflectionModal
        visible={reflectionModalVisible}
        subtaskTitle={selectedSubtask?.text || ''}
        subtaskId={selectedSubtask?.id}
        stepId={selectedActionStep?.stepId}
        playbookId={playbookId}
        playbookTitle={playbookTitle}
        actionStepNumber={selectedActionStep?.stepNumber}
        actionStepTitle={selectedActionStep?.stepTitle}
        existingReflection={existingReflection}
        onSave={handleReflectionSave}
        onCancel={handleReflectionCancel}
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
    backgroundColor: '#d9dfe7',
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
    marginBottom: 8,
  },
  icon: {
    marginRight: 8,
  },
  heading: {
    ...Typography.interBold,
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none',
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
    ...Typography.interSemiBold,
    fontSize: 15,
    fontWeight: '600',
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
    marginBottom: 6,
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
    fontWeight: '400',
    flex: 1,
  },
  subTaskContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    fontWeight: '600',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
    minWidth: 0,
  },
  stepDescription: {
    ...Typography.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    paddingHorizontal: 4,
    width: '100%',
  },
  noStepsText: {
    textAlign: 'center',
    opacity: 0.7,
  },
  textContainer: {
    position: 'relative',
    flex: 1,
  },
  strikethroughLine: {
    position: 'absolute',
    top: '50%',
    left: 0,
    height: 1.5,
    backgroundColor: Colors.hopeWhite,
    transform: [{ translateY: -0.75 }],
  },
});
