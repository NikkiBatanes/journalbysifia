import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../theme';
import { Typography } from '../theme/typography';

type SubTask = {
  id: string;
  text: string;
  completed: boolean;
  isExample?: boolean;
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
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  solidCardBackground?: boolean;
  checkboxColor?: string;
  stepCircleBackground?: string;
};

import { useActionSteps } from '../context/ActionStepsContext';

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
  style,
  textColor,
  solidCardBackground,
  checkboxColor,
  stepCircleBackground,
}: ActionStepsCardProps) {
  const { actionSteps: contextSteps, handleToggleStep } = useActionSteps();

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
    handleToggleStep(stepId, subTaskId);
  }, [handleToggleStep]);

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
    <View style={style}>
      <View style={styles.headingContainer}>
        <MaterialCommunityIcons
          name="playlist-check"
          size={24}
          color={Colors.faithGold}
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
              const examples = Array.isArray((step as any).examples)
                ? (step as any).examples.map((ex: string, i: number) => ({
                    id: `ex-${i}`,
                    text: ex,
                  }))
                : (step.subTasks || [])
                    .filter((st) => typeof st.text === 'string' && st.text.toLowerCase().startsWith('example:'))
                    .map((st, i) => ({
                      id: st.id || `ex-${i}`,
                      text: st.text.replace(/^Example:/i, '').trim(),
                    }));
              const subtasks = (step.subTasks || []).filter(
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
                      {subtasks.map((subTask) => (
                        <TouchableOpacity
                          key={subTask.id}
                          style={styles.subTaskButton}
                          onPress={() => onToggleSubTask(step.id, subTask.id)}
                          activeOpacity={0.7}
                        >
                          <View style={styles.checkboxContainer}>
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
                          <Text
                            style={[
                              dynamicStyles.subTaskText,
                              subTask.completed && styles.completedText,
                            ]}
                          >
                            {subTask.text}
                          </Text>
                        </TouchableOpacity>
                      ))}
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
});
