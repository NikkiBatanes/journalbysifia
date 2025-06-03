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
  completed?: boolean;
};

type ActionStepsCardProps = {
  steps: ActionStep[];
  onToggleStep?: (stepId: string) => void;
  style?: StyleProp<ViewStyle>;
};

export default function ActionStepsCard({ steps, onToggleStep, style }: ActionStepsCardProps) {
  const [expandedStep, setExpandedStep] = useState<string | null>(null);

  const toggleStep = (id: string) => {
    setExpandedStep(expandedStep === id ? null : id);
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
                  {step.completed ? (
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
                  )}
                </View>
                <View style={styles.titleContainer}>
                  <Text style={styles.stepTitle}>
                    {index + 1}. {step.title}
                  </Text>
                </View>
              </View>
              {/* Render subTasks checklist if present */}
              {hasSubTasks ? (
                <View style={{marginTop: 8}}>
                  {step.subTasks!.map((subTask) => (
                    <View key={subTask.id} style={{flexDirection: 'row', alignItems: 'center', marginBottom: 4, marginLeft: 4}}>
                      <MaterialCommunityIcons
                        name={subTask.completed ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'}
                        size={20}
                        color={subTask.completed ? Colors.faithGold : '#FFFFFF'}
                        style={{marginRight: 8}}
                      />
                      <Text style={{color: 'rgba(255,255,255,0.85)', fontSize: 13, flexShrink: 1}}>{subTask.text}</Text>
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
  },
  stepsContainer: {
    // flex: 1 removed to avoid layout delay and pop-in effect
  },
  stepCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  completedCard: {
    opacity: 0.7,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  stepNumberContainer: {
    width: 28,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  circle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.faithGold,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepNumber: {
    fontFamily: 'Inter-Bold',
    fontSize: 12,
    color: Colors.anchorBlue,
    fontWeight: '800',
  },
  titleContainer: {
    flex: 1,
    marginLeft: 12,
    marginRight: 8, // Add right margin to prevent text from touching the chevron
    justifyContent: 'center',
  },
  stepTitle: {
    fontFamily: 'System',
    fontWeight: '600',
    fontSize: 14,
    color: Colors.hopeWhite,
    letterSpacing: 0.5,
    flexShrink: 1,
    flexWrap: 'wrap', // Allow text to wrap if needed
    textTransform: 'uppercase',
  },
  chevron: {
    opacity: 0.7,
  },
  stepDescription: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 8,
    paddingHorizontal: 12,
  },
});
