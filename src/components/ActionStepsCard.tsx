import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Fonts } from '../theme';
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
  steps: ActionStep[];
  style?: StyleProp<ViewStyle>;
  textColor?: string;
  solidCardBackground?: boolean;
  checkboxColor?: string;
  stepCircleBackground?: string;
};

import { useActionSteps } from '../context/ActionStepsContext';

// Helper function to clean markdown formatting from text
const cleanMarkdown = (text: string | undefined): string => {
  if (!text) return '';
  // Remove markdown formatting like **bold**, __bold__, *italic*, _italic_, ~~strikethrough~~, etc.
  return text
    .replace(/\*\*|__/g, '') // Remove ** and __ used for bold
    .replace(/\*|_/g, '')    // Remove * and _ used for italics
    .replace(/~~/g, '')       // Remove ~~ used for strikethrough
    .trim();
};

// Helper function to normalize subtasks to the expected format
const normalizeSubTasks = (subTasks: any[] | undefined): SubTask[] => {
  if (!subTasks) return [];
  return subTasks.map((task, index) => {
    if (typeof task === 'string') {
      return {
        id: `subtask-${index}-${Date.now()}`,
        text: cleanMarkdown(task),
        completed: false
      };
    }
    // If it's already an object but missing required fields
    return {
      id: task.id || `subtask-${index}-${Date.now()}`,
      text: cleanMarkdown(task.text) || cleanMarkdown(task.toString()),
      completed: Boolean(task.completed)
    };
  });
};

// Helper function to check if a step has subtasks
const hasSubTasks = (step: ActionStep): boolean => {
  return Array.isArray(step.subTasks) && step.subTasks.length > 0;
};

// Process steps to ensure proper format
const processSteps = (steps: ActionStep[]): ActionStep[] => {
  return steps.map(step => ({
    ...step,
    subTasks: normalizeSubTasks(step.subTasks)
  }));
};

export default function ActionStepsCard({ style, textColor, solidCardBackground, checkboxColor, stepCircleBackground }: ActionStepsCardProps) {
  const { actionSteps, handleToggleStep } = useActionSteps();

  // Clean markdown for display only
  const cleanedSteps = useMemo(() => {
    return actionSteps.map(step => ({
      ...step,
      title: cleanMarkdown(step.title),
      description: step.description ? cleanMarkdown(step.description) : undefined,
      subTasks: step.subTasks?.map(subTask => ({
        ...subTask,
        text: cleanMarkdown(subTask.text)
      }))
    }));
  }, [actionSteps]);

  return (
    <View style={style}> 
      <View style={styles.headingContainer}>
        <MaterialCommunityIcons
          name="playlist-check"
          size={24}
          color={Colors.faithGold}
          style={styles.icon}
        />
        <Text style={[styles.heading, !!textColor && { color: textColor }]}>{steps.length} Action steps</Text>
      </View>

      <View>
        {steps.length === 0 ? (
          <View style={styles.stepsContainer}>
            <Text style={[styles.stepTitle, { color: textColor || Colors.hopeWhite, textAlign: 'center', opacity: 0.7 }]}> 
              No action steps available.
            </Text>
          </View>
        ) : (
          <View style={styles.stepsContainer}>
            {steps.map((step, index) => {
              // Normalize examples: look for step.examples or subtasks with isExample/text starting with 'Example:'
              const examples = Array.isArray((step as any).examples)
                ? (step as any).examples.map((ex: string, i: number) => ({ id: `ex-${i}`, text: ex }))
                : (step.subTasks || []).filter(st => typeof st.text === 'string' && st.text.toLowerCase().startsWith('example:')).map((st, i) => ({ id: st.id || `ex-${i}`, text: st.text.replace(/^Example:/i, '').trim() }));
              const subtasks = (step.subTasks || []).filter(st => typeof st.text === 'string' && !st.text.toLowerCase().startsWith('example:'));

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
                      <View style={[
                        styles.circle,
                        { backgroundColor: stepCircleBackground || 'rgba(255, 255, 255, 0.1)' },
                        step.completed && styles.completedCircle,
                      ]}>
                        <Text style={[styles.stepNumber, !!textColor && { color: textColor }]}>{index + 1}</Text>
                      </View>
                    </View>
                    <View style={styles.titleContainer}>
                      <Text style={[
                        styles.stepTitle,
                        step.completed && styles.completedText,
                        !!textColor && { color: textColor },
                      ]}>
                        {cleanMarkdown(step.title)}
                      </Text>
                    </View>
                  </View>

                  {/* Subtasks checklist */}
                  {subtasks.length > 0 && (
  <View style={styles.subTasksList}>
    {subtasks.map((subTask) => (
      <View key={subTask.id} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <TouchableOpacity
          style={styles.checkboxContainer}
          onPress={() => handleToggleStep(step.id, subTask.id)}
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <MaterialCommunityIcons
            name={subTask.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
            size={24}
            color={subTask.completed ? Colors.faithGold : (checkboxColor || 'rgba(255,255,255,0.7)')}
            style={styles.checkboxIcon}
          />
        </TouchableOpacity>
        <Text style={[
          styles.subTaskText,
          { marginLeft: 8 }, // Add margin so text aligns with step title (not number)
          subTask.completed && styles.completedText,
          !!textColor && { color: textColor },
        ]}>
          {cleanMarkdown(subTask.text)}
        </Text>
      </View>
    ))}
  </View>
)}

                  {/* Step description if no subtasks */}
                  {subtasks.length === 0 && step.description && (
                    <Text style={styles.stepDescription}>{cleanMarkdown(step.description)}</Text>
                  )}

                  {/* Examples block */}
                  {examples.length > 0 && (
                    <View style={styles.examplesContainer}>
                      <Text style={[
                        styles.examplesTitle,
                        solidCardBackground && { color: Colors.anchorBlue }
                      ]}>
                        {examples.length === 1 ? 'EXAMPLE:' : 'EXAMPLES:'}
                      </Text>
                      {examples.map((example: {id: string, text: string}) => (
                        <Text 
                          key={example.id} 
                          style={[
                            styles.exampleText, 
                            { 
                              fontStyle: 'italic',
                              color: solidCardBackground ? Colors.anchorBlue : styles.exampleText.color
                            }
                          ]}>
                          {cleanMarkdown(example.text)}
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
    backgroundColor: '#d9dfe7', // Light blue-gray for step container
    borderRadius: 24,          // More rounded corners
    padding: 22,               // Comfortable padding
    marginBottom: 20,          // More space between steps
    width: '100%',
    alignSelf: 'center',
  },
  subTasksList: {
    marginTop: 8,
    marginLeft: 0, // Remove left margin so checkbox aligns with step number
  },
  exampleBox: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 6,
  },

  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8, // Match TruthInLoveCard
  },
  icon: {
    marginRight: 8, // Match TruthInLoveCard's heart icon margin
  },
  heading: {
    ...Typography.interBold, // Match TruthInLoveCard
    fontSize: 20,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    textTransform: 'none', // Match TruthInLoveCard
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
    flexShrink: 0, // Prevent shrinking
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
    fontSize: 14,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    flexShrink: 1,
    flexWrap: 'wrap',
    textTransform: 'uppercase',
    paddingRight: 8, // Add padding to prevent text from touching the edge
  },
  completedText: {
    textDecorationLine: 'line-through',
    opacity: 0.7,
  },
  subTaskContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    marginLeft: 16,
    marginRight: 8,
    padding: 12,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
    elevation: 2,
  },
  subTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
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
    color: 'white', // Brighter text for better visibility
    fontSize: 16, // Slightly larger font
    flexShrink: 1,
    lineHeight: 22,
    paddingRight: 12,
    fontWeight: '500', // Slightly bolder
    flex: 1, // Take up available space
  },
  exampleText: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    lineHeight: 18,
    fontStyle: 'italic',
    marginTop: 2,
  },
  examplesContainer: {
    marginTop: 8,
    marginLeft: 28, // Align with subtasks
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
  exampleContainer: {
    marginBottom: 6,
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8,
    justifyContent: 'center',
    minWidth: 0, // Allow text to shrink properly
  },
  chevron: {
    opacity: 0.7,
    marginLeft: 'auto', // Push chevron to the right
  },
  stepDescription: {
    ...Typography.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    paddingHorizontal: 4, // Reduced padding for better space usage
    width: '100%',
  },
});
