/**
 * Step-by-Step Expounding Component
 *
 * Displays progressive spiritual insights for action steps
 * with tier-based access control and user question support.
 */

import React, { useState, useEffect } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { enhancedExpoundingService, StepExpounding, UserQuestionResponse } from '../services/enhancedExpoundingService';
import { useExpoundingAccess } from '../hooks/useFeatureAccess';
import { FeatureLockOverlay } from './FeatureLockOverlay';

interface StepByStepExpoundingProps {
  actionStepId: string;
  actionStepText: string;
  subtaskId?: string;
  subtaskText?: string;
  userId: string;
  onUpgrade?: () => void;
}

export const StepByStepExpounding: React.FC<StepByStepExpoundingProps> = ({
  actionStepId,
  actionStepText,
  subtaskId,
  subtaskText,
  userId,
  onUpgrade,
}) => {
  const { canAccessExpounding, expoundingAccessResult, isLoading: accessLoading } = useExpoundingAccess();

  const [steps, setSteps] = useState<StepExpounding[]>([]);
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showQuestionModal, setShowQuestionModal] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [questionResponse, setQuestionResponse] = useState<UserQuestionResponse | null>(null);
  const [isAskingQuestion, setIsAskingQuestion] = useState(false);
  const [showLockOverlay, setShowLockOverlay] = useState(false);

  useEffect(() => {
    if (canAccessExpounding) {
      loadStepExpounding();
    }
  }, [canAccessExpounding, actionStepId, subtaskId]);

  const loadStepExpounding = async () => {
    setIsLoading(true);
    try {
      const existingSteps = await enhancedExpoundingService.getStepExpounding(
        userId,
        actionStepId,
        subtaskId
      );

      if (existingSteps.length > 0) {
        setSteps(existingSteps);
      } else {
        // Generate new step-by-step expounding
        await generateStepExpounding();
      }
    } catch (error) {
      console.error('Error loading step expounding:', error);
      Alert.alert('Error', 'Failed to load expounding content');
    } finally {
      setIsLoading(false);
    }
  };

  const generateStepExpounding = async () => {
    setIsGenerating(true);
    try {
      const newSteps = await enhancedExpoundingService.generateStepByStepExpounding(
        userId,
        actionStepId,
        actionStepText,
        subtaskId,
        subtaskText
      );
      setSteps(newSteps);
    } catch (error) {
      console.error('Error generating step expounding:', error);
      Alert.alert('Error', 'Failed to generate expounding content');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!userQuestion.trim()) {return;}

    setIsAskingQuestion(true);
    try {
      const response = await enhancedExpoundingService.answerUserQuestion(
        userId,
        userQuestion,
        actionStepId,
        subtaskId,
        currentStep
      );

      setQuestionResponse(response);
      setUserQuestion('');
    } catch (error) {
      console.error('Error asking question:', error);
      Alert.alert('Error', 'Failed to get answer to your question');
    } finally {
      setIsAskingQuestion(false);
    }
  };

  const handleStepNavigation = (stepNumber: number) => {
    if (stepNumber >= 1 && stepNumber <= steps.length) {
      setCurrentStep(stepNumber);
    }
  };

  const handleAccessRestriction = () => {
    setShowLockOverlay(true);
  };

  if (accessLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6366F1" />
        <Text style={styles.loadingText}>Checking access...</Text>
      </View>
    );
  }

  if (!canAccessExpounding) {
    return (
      <View style={styles.restrictedContainer}>
        <TouchableOpacity
          style={styles.restrictedButton}
          onPress={handleAccessRestriction}
        >
          <Ionicons name="lock-closed" size={20} color="#6366F1" />
          <Text style={styles.restrictedText}>Unlock Deeper Insights</Text>
        </TouchableOpacity>

        <FeatureLockOverlay
          visible={showLockOverlay}
          feature="expounding_content"
          onClose={() => setShowLockOverlay(false)}
          onUpgrade={onUpgrade}
        />
      </View>
    );
  }

  const currentStepData = steps.find(step => step.stepNumber === currentStep);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Deeper Insights</Text>
        <TouchableOpacity
          style={styles.questionButton}
          onPress={() => setShowQuestionModal(true)}
        >
          <Ionicons name="help-circle-outline" size={24} color="#6366F1" />
        </TouchableOpacity>
      </View>

      {/* Step Navigation */}
      {steps.length > 0 && (
        <View style={styles.stepNavigation}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            {steps.map((step) => (
              <TouchableOpacity
                key={step.stepNumber}
                style={[
                  styles.stepTab,
                  currentStep === step.stepNumber && styles.activeStepTab,
                ]}
                onPress={() => handleStepNavigation(step.stepNumber)}
              >
                <Text
                  style={[
                    styles.stepTabText,
                    currentStep === step.stepNumber && styles.activeStepTabText,
                  ]}
                >
                  {step.stepNumber}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading || isGenerating ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#6366F1" />
            <Text style={styles.loadingText}>
              {isGenerating ? 'Generating insights...' : 'Loading...'}
            </Text>
          </View>
        ) : currentStepData ? (
          <StepContent step={currentStepData} />
        ) : (
          <View style={styles.emptyContainer}>
            <Ionicons name="bulb-outline" size={48} color="#9CA3AF" />
            <Text style={styles.emptyText}>No insights available yet</Text>
            <TouchableOpacity
              style={styles.generateButton}
              onPress={generateStepExpounding}
            >
              <Text style={styles.generateButtonText}>Generate Insights</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Question Response */}
        {questionResponse && (
          <QuestionResponseCard
            response={questionResponse}
            onRate={(isHelpful) => enhancedExpoundingService.rateQuestionResponse(
              userId,
              questionResponse.id,
              isHelpful
            )}
            onDismiss={() => setQuestionResponse(null)}
          />
        )}
      </ScrollView>

      {/* Question Modal */}
      <Modal
        visible={showQuestionModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowQuestionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.questionModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Ask a Question</Text>
              <TouchableOpacity
                onPress={() => setShowQuestionModal(false)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.questionInput}
              placeholder="What would you like to know about this step?"
              value={userQuestion}
              onChangeText={setUserQuestion}
              multiline
              maxLength={500}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowQuestionModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.askButton]}
                onPress={handleAskQuestion}
                disabled={!userQuestion.trim() || isAskingQuestion}
              >
                {isAskingQuestion ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.askButtonText}>Ask Question</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

interface StepContentProps {
  step: StepExpounding;
}

const StepContent: React.FC<StepContentProps> = ({ step }) => (
  <View style={styles.stepContent}>
    <LinearGradient
      colors={getStepGradient(step.contentType)}
      style={styles.stepHeader}
    >
      <Text style={styles.stepTitle}>{step.stepTitle}</Text>
      <Text style={styles.stepType}>{formatContentType(step.contentType)}</Text>
    </LinearGradient>

    <View style={styles.stepBody}>
      <Text style={styles.stepText}>{step.content}</Text>

      {step.scriptureReferences && step.scriptureReferences.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scripture References</Text>
          {step.scriptureReferences.map((ref, index) => (
            <Text key={index} style={styles.scriptureRef}>• {ref}</Text>
          ))}
        </View>
      )}

      {step.practicalSteps && step.practicalSteps.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Practical Steps</Text>
          {step.practicalSteps.map((stepText, index) => (
            <Text key={index} style={styles.practicalStep}>
              {index + 1}. {stepText}
            </Text>
          ))}
        </View>
      )}

      {step.reflectionQuestions && step.reflectionQuestions.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reflection Questions</Text>
          {step.reflectionQuestions.map((question, index) => (
            <Text key={index} style={styles.reflectionQuestion}>• {question}</Text>
          ))}
        </View>
      )}
    </View>
  </View>
);

interface QuestionResponseCardProps {
  response: UserQuestionResponse;
  onRate: (isHelpful: boolean) => void;
  onDismiss: () => void;
}

const QuestionResponseCard: React.FC<QuestionResponseCardProps> = ({
  response,
  onRate,
  onDismiss,
}) => (
  <View style={styles.responseCard}>
    <View style={styles.responseHeader}>
      <Text style={styles.responseTitle}>Your Question</Text>
      <TouchableOpacity onPress={onDismiss}>
        <Ionicons name="close-circle" size={20} color="#9CA3AF" />
      </TouchableOpacity>
    </View>

    <Text style={styles.userQuestion}>{response.userQuestion}</Text>
    <Text style={styles.aiResponse}>{response.aiResponse}</Text>

    <View style={styles.responseActions}>
      <Text style={styles.ratingLabel}>Was this helpful?</Text>
      <View style={styles.ratingButtons}>
        <TouchableOpacity
          style={styles.ratingButton}
          onPress={() => onRate(true)}
        >
          <Ionicons name="thumbs-up" size={16} color="#059669" />
          <Text style={styles.ratingButtonText}>Yes</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.ratingButton}
          onPress={() => onRate(false)}
        >
          <Ionicons name="thumbs-down" size={16} color="#DC2626" />
          <Text style={styles.ratingButtonText}>No</Text>
        </TouchableOpacity>
      </View>
    </View>
  </View>
);

// Helper functions
const getStepGradient = (contentType: string): string[] => {
  const gradients: Record<string, string[]> = {
    spiritual_insight: ['#6366F1', '#8B5CF6'],
    practical_guidance: ['#059669', '#10B981'],
    biblical_context: ['#DC2626', '#EF4444'],
    reflection_questions: ['#D97706', '#F59E0B'],
  };
  return gradients[contentType] || ['#6B7280', '#9CA3AF'];
};

const formatContentType = (contentType: string): string => {
  const typeMap: Record<string, string> = {
    spiritual_insight: 'Spiritual Insight',
    practical_guidance: 'Practical Guidance',
    biblical_context: 'Biblical Context',
    reflection_questions: 'Reflection Questions',
    step_breakdown: 'Step Breakdown',
  };
  return typeMap[contentType] || contentType;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  questionButton: {
    padding: 8,
  },
  stepNavigation: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  stepTab: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  activeStepTab: {
    backgroundColor: '#6366F1',
  },
  stepTabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6B7280',
  },
  activeStepTabText: {
    color: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  restrictedContainer: {
    padding: 16,
  },
  restrictedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: '#EEF2FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  restrictedText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '600',
    color: '#6366F1',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    marginTop: 16,
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  generateButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#6366F1',
    borderRadius: 8,
  },
  generateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  stepContent: {
    marginBottom: 24,
  },
  stepHeader: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stepType: {
    fontSize: 14,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  stepBody: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
  },
  stepText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#374151',
    marginBottom: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  scriptureRef: {
    fontSize: 14,
    color: '#6366F1',
    marginBottom: 4,
  },
  practicalStep: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  reflectionQuestion: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
    fontStyle: 'italic',
  },
  responseCard: {
    backgroundColor: '#EEF2FF',
    padding: 16,
    borderRadius: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#C7D2FE',
  },
  responseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  responseTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  userQuestion: {
    fontSize: 14,
    color: '#6B7280',
    fontStyle: 'italic',
    marginBottom: 8,
  },
  aiResponse: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  responseActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ratingLabel: {
    fontSize: 14,
    color: '#6B7280',
  },
  ratingButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  ratingButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#FFFFFF',
  },
  ratingButtonText: {
    marginLeft: 4,
    fontSize: 12,
    color: '#374151',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  questionModal: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1F2937',
  },
  closeButton: {
    padding: 4,
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    marginBottom: 16,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
    fontWeight: '600',
  },
  askButton: {
    backgroundColor: '#6366F1',
  },
  askButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
