import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors, Fonts } from '../theme';

type SubTask = {
  id: string;
  text: string;
  completed: boolean;
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
  onToggleStep?: (stepId: string, subTaskId?: string) => void;
  style?: StyleProp<ViewStyle>;
};

export default function ActionStepsCard({ steps, onToggleStep, style }: ActionStepsCardProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const toggleStep = (id: string) => {
    setExpandedStep(expandedStep === id ? null : id);
  };

  const handleToggleSubTask = (stepId: string, subTaskId: string) => {
    onToggleStep?.(stepId, subTaskId);
  };

  return (
    <View style={style}>
      <View style={styles.headingContainer}>
        <MaterialCommunityIcons 
          name="playlist-check" 
          size={24} 
          color={Colors.faithGold} 
          style={styles.icon}
        />
        <Text style={styles.heading}>{steps.length} Action steps</Text>
      </View>
      
      <View style={styles.stepsContainer}>
        {steps.map((step, index) => {
          const isExpanded = expandedStep === step.id;
          // Only show description if present and no subTasks
          const hasSubTasks = step.subTasks && step.subTasks.length > 0;
          const displayText = step.description
            ? (isExpanded
                ? step.description
                : step.description.length > 60
                  ? step.description.substring(0, 60) + '...'
                  : step.description)
            : '';

          return (
            <TouchableOpacity 
              key={step.id} 
              style={[styles.stepCard, step.completed && styles.completedCard]}
              onPress={() => toggleStep(step.id)}
              activeOpacity={0.8}
            >
              <View style={styles.stepHeader}>
                <View style={styles.stepNumberContainer}>
                  {!hasSubTasks ? (
                    step.completed ? (
                      <TouchableOpacity 
                        onPress={() => onToggleStep?.(step.id)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons 
                          name="checkbox-marked-circle" 
                          size={24} 
                          color={Colors.faithGold} 
                        />
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity 
                        onPress={() => onToggleStep?.(step.id)}
                        activeOpacity={0.7}
                      >
                        <MaterialCommunityIcons 
                          name="checkbox-blank-circle-outline" 
                          size={24} 
                          color="#FFFFFF" 
                        />
                      </TouchableOpacity>
                    )
                  ) : (
                    <View style={[styles.circle, step.completed && styles.completedCircle]}>
                      <Text style={styles.stepNumber}>{index + 1}</Text>
                    </View>
                  )}
                </View>
                <View style={styles.titleContainer}>
                  <Text style={[styles.stepTitle, step.completed && styles.completedText]}>
                    {step.title}
                  </Text>
                </View>
              </View>
              {/* Render subTasks checklist if present */}
              {hasSubTasks ? (
                <View style={{marginTop: 8}}>
                  {step.subTasks!.map((subTask) => (
                    <View key={subTask.id} style={styles.subTaskContainer}>
                      <TouchableOpacity 
                        onPress={() => handleToggleSubTask(step.id, subTask.id)}
                        activeOpacity={0.7}
                        style={styles.subTaskButton}
                      >
                        <MaterialCommunityIcons
                          name={subTask.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                          size={20}
                          color={subTask.completed ? Colors.faithGold : 'rgba(255,255,255,0.7)'}
                          style={styles.checkboxIcon}
                        />
                        <Text style={[styles.subTaskText, subTask.completed && styles.completedText]}>
                          {subTask.text}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : step.description ? (
                <Text style={styles.stepDescription}>{displayText}</Text>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 8, // Add horizontal padding for better edge spacing
  },
  icon: {
    marginRight: 12,
  },
  heading: {
    fontFamily: 'Inter-Black',
    fontSize: 20,
    color: Colors.hopeWhite,
    fontWeight: '900',
    letterSpacing: 0.5,
    flexShrink: 1, // Ensure text wraps properly
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
    fontFamily: 'Inter-Bold',
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '800',
  },
  stepTitle: {
    fontFamily: 'System',
    fontWeight: '600',
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
    marginBottom: 4,
    marginLeft: 4,
    width: '100%',
  },
  subTaskButton: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingVertical: 4,
    width: '100%',
  },
  checkboxIcon: {
    marginRight: 8,
    flexShrink: 0, // Prevent icon from shrinking
  },
  subTaskText: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    flexShrink: 1,
    lineHeight: 20,
    paddingRight: 8, // Add padding to prevent text from touching the edge
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
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    paddingHorizontal: 4, // Reduced padding for better space usage
    width: '100%',
  },
});
