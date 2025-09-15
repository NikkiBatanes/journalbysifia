/**
 * Enhanced Action Step Card Component
 *
 * Integrates export functionality and tier-based access control.
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import {
  // Animated, // unused
  LayoutAnimation,
  Platform,
  UIManager,
} from 'react-native';
import { ExportOptionsModal } from './ExportOptionsModal';
import { useFeatureAccess } from '../hooks/useFeatureAccess';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface ActionStep {
  id: string;
  text: string;
  completed: boolean;
  orderIndex: number;
  examples?: string;
  subtasks?: SubTask[];
}

interface SubTask {
  id: string;
  text: string;
  completed: boolean;
  orderIndex: number;
}

interface EnhancedActionStepCardProps {
  actionStep: ActionStep;
  playbookId: string;
  playbookTitle: string;
  userId: string;
  onToggleComplete: (stepId: string) => void;
  onToggleSubtaskComplete: (stepId: string, subtaskId: string) => void;
  onUpgrade?: () => void;
}

export const EnhancedActionStepCard: React.FC<EnhancedActionStepCardProps> = ({
  actionStep,
  playbookId: _playbookId,
  playbookTitle,
  userId,
  onToggleComplete,
  onToggleSubtaskComplete,
  onUpgrade,
}) => {
  const [showExportModal, setShowExportModal] = useState(false);
  const [expandedSubtasks, setExpandedSubtasks] = useState(false);



  const toggleSubtasks = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedSubtasks(!expandedSubtasks);
  };

  const handleExportStep = async () => {
    // Export functionality temporarily disabled due to service refactoring
    setShowExportModal(true);
  };

  const generateStepExportContent = (): string => {
    let content = `# ${playbookTitle}\n\n## Action Step ${actionStep.orderIndex + 1}\n\n${actionStep.text}\n\n`;

    if (actionStep.examples) {
      content += `### Examples\n${actionStep.examples}\n\n`;
    }

    if (actionStep.subtasks && actionStep.subtasks.length > 0) {
      content += '### Subtasks\n';
      actionStep.subtasks.forEach((subtask, index) => {
        content += `${index + 1}. ${subtask.text}\n`;
      });
      content += '\n';
    }

    content += '### Completion Status\n';
    content += `- Main Step: ${actionStep.completed ? '✅ Completed' : '⏳ In Progress'}\n`;

    if (actionStep.subtasks) {
      actionStep.subtasks.forEach((subtask) => {
        content += `- ${subtask.text}: ${subtask.completed ? '✅ Completed' : '⏳ In Progress'}\n`;
      });
    }

    return content;
  };


  return (
    <View style={styles.container}>
      {/* Main Action Step */}
      <View style={styles.stepCard}>
        <View style={styles.stepHeader}>
          <TouchableOpacity
            style={styles.checkbox}
            onPress={() => onToggleComplete(actionStep.id)}
          >
            <Ionicons
              name={actionStep.completed ? 'checkmark-circle' : 'ellipse-outline'}
              size={24}
              color={actionStep.completed ? Colors.growthGreen : Colors.textGray}
            />
          </TouchableOpacity>

          <Text style={[
            styles.stepText,
            actionStep.completed && styles.completedText,
          ]}>
            {actionStep.text}
          </Text>


          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            {/* Expounding icon-only button removed */}

            {/* Export Button */}
            <TouchableOpacity
              style={styles.actionButton}
              onPress={handleExportStep}
            >
              <Ionicons name="download-outline" size={20} color={Colors.contemplationGray} />
            </TouchableOpacity>

            {/* Subtasks Toggle */}
            {actionStep.subtasks && actionStep.subtasks.length > 0 && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={toggleSubtasks}
              >
                <Ionicons
                  name={expandedSubtasks ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color={Colors.textGray}
                />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Examples */}
        {actionStep.examples && (
          <View style={styles.examplesContainer}>
            <Text style={styles.examplesLabel}>Examples:</Text>
            <Text style={styles.examplesText}>{actionStep.examples}</Text>
          </View>
        )}

        {/* Subtasks */}
        {expandedSubtasks && actionStep.subtasks && (
          <View style={styles.subtasksContainer}>
            <Text style={styles.subtasksLabel}>Subtasks:</Text>
            {actionStep.subtasks.map((subtask) => (
              <SubtaskItem
                key={subtask.id}
                subtask={subtask}
                onToggleComplete={() => onToggleSubtaskComplete(actionStep.id, subtask.id)}
              />
            ))}
          </View>
        )}

      </View>

      {/* Export Modal */}
      <ExportOptionsModal
        visible={showExportModal}
        exportData={{
          id: actionStep.id,
          title: `Action Step: ${actionStep.text}`,
          content: generateStepExportContent(),
          type: 'playbook',
          metadata: {
            createdAt: new Date().toISOString(),
            category: 'Action Step',
          },
        }}
        onClose={() => setShowExportModal(false)}
        onUpgrade={onUpgrade}
      />
    </View>
  );
};

interface SubtaskItemProps {
  subtask: SubTask;
  onToggleComplete: () => void;
}

const SubtaskItem: React.FC<SubtaskItemProps> = ({
  subtask,
  onToggleComplete,
}) => (
  <View style={styles.subtaskItem}>
    <TouchableOpacity
      style={styles.subtaskCheckbox}
      onPress={onToggleComplete}
    >
      <Ionicons
        name={subtask.completed ? 'checkmark-circle' : 'ellipse-outline'}
        size={20}
        color={subtask.completed ? Colors.growthGreen : Colors.textGray}
      />
    </TouchableOpacity>

    <Text style={[
      styles.subtaskText,
      subtask.completed && styles.completedText,
    ]}>
      {subtask.text}
    </Text>

  </View>
);

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  stepCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.contemplationGray,
    overflow: 'hidden',
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
  },
  checkbox: {
    marginRight: 12,
    marginTop: 2,
  },
  stepText: {
    flex: 1,
    fontSize: 16,
    lineHeight: 24,
    color: Colors.black,
    marginRight: 12,
  },
  completedText: {
    textDecorationLine: 'line-through',
    color: Colors.contemplationGray,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: Colors.sanctuaryWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeActionButton: {
    backgroundColor: '#EEF2FF',
  },
  examplesContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  examplesLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 8,
  },
  examplesText: {
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
  },
  subtasksContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  subtasksLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  subtaskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: 8,
  },
  subtaskCheckbox: {
    marginRight: 12,
  },
  subtaskText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#374151',
  },
  subtaskActionButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: '#EEF2FF',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
});

export default EnhancedActionStepCard;
