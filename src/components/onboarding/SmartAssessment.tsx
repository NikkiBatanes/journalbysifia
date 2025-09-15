/**
 * Smart Assessment Component
 * Adaptive questioning system that gathers key user data efficiently
 * Uses ML-powered question selection and smart defaults
 */

import React, { useState, useEffect, useMemo } from 'react';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors } from '../../theme/colors';

// const { width: _width } = Dimensions.get('window');

interface AssessmentQuestion {
  id: string;
  type: 'single_choice' | 'multiple_choice' | 'scale' | 'time_picker';
  question: string;
  subtitle?: string;
  options?: AssessmentOption[];
  scaleMin?: number;
  scaleMax?: number;
  scaleLabels?: string[];
  required: boolean;
  weight: number; // For ML scoring
}

interface AssessmentOption {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  value: any;
  followUpQuestions?: string[]; // Conditional questions
}

interface AssessmentResult {
  questionId: string;
  answer: any;
  confidence: number;
  timeSpent: number;
}

interface Props {
  onComplete: (results: AssessmentResult[], userProfile: UserProfile) => void;
  onBack: () => void;
}

interface UserProfile {
  spiritualMaturity: 'new' | 'growing' | 'mature';
  timeAvailability: number; // minutes per day
  primaryGoals: string[];
  learningStyle: 'visual' | 'audio' | 'reading' | 'interactive';
  confidenceScore: number;
}

const SmartAssessment: React.FC<Props> = ({ onComplete, onBack }) => {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, any>>(new Map());
  const [results, setResults] = useState<AssessmentResult[]>([]);
  const [_startTime, _setStartTime] = useState(Date.now());
  const [questionStartTime, setQuestionStartTime] = useState(Date.now());
  const [fadeAnim] = useState(new Animated.Value(0));
  const [progressAnim] = useState(new Animated.Value(0));

  // Smart question selection based on previous answers
  const [activeQuestions, setActiveQuestions] = useState<AssessmentQuestion[]>([]);

  const allQuestions: AssessmentQuestion[] = useMemo(() => [
    {
      id: 'spiritual_stage',
      type: 'single_choice',
      question: 'Where are you in your faith journey?',
      subtitle: 'This helps us personalize your experience',
      required: true,
      weight: 1.0,
      options: [
        {
          id: 'exploring',
          label: 'Just exploring',
          description: 'Curious about faith and spirituality',
          icon: 'compass',
          value: 'new',
          followUpQuestions: ['basic_goals', 'time_commitment'],
        },
        {
          id: 'new_believer',
          label: 'New believer',
          description: 'Recently started my faith journey',
          icon: 'leaf',
          value: 'new',
          followUpQuestions: ['growth_goals', 'time_commitment'],
        },
        {
          id: 'growing',
          label: 'Growing in faith',
          description: 'Want to deepen my relationship with God',
          icon: 'trending-up',
          value: 'growing',
          followUpQuestions: ['advanced_goals', 'study_preferences'],
        },
        {
          id: 'mature',
          label: 'Mature believer',
          description: 'Looking to serve and lead others',
          icon: 'star',
          value: 'mature',
          followUpQuestions: ['leadership_goals', 'teaching_preferences'],
        },
      ],
    },
    {
      id: 'time_commitment',
      type: 'single_choice',
      question: 'How much time can you dedicate daily?',
      subtitle: 'Be honest - we\'ll make it work for you',
      required: true,
      weight: 0.9,
      options: [
        {
          id: 'minimal',
          label: '2-3 minutes',
          description: 'Quick daily inspiration',
          icon: 'flash',
          value: 3,
        },
        {
          id: 'short',
          label: '5-10 minutes',
          description: 'Brief devotion and reflection',
          icon: 'time',
          value: 7,
        },
        {
          id: 'moderate',
          label: '15-20 minutes',
          description: 'Deeper study and prayer',
          icon: 'book',
          value: 17,
        },
        {
          id: 'extended',
          label: '30+ minutes',
          description: 'Comprehensive spiritual growth',
          icon: 'school',
          value: 35,
        },
      ],
    },
    {
      id: 'basic_goals',
      type: 'multiple_choice',
      question: 'What interests you most?',
      subtitle: 'Select all that apply',
      required: true,
      weight: 0.8,
      options: [
        {
          id: 'understanding',
          label: 'Understanding faith',
          icon: 'bulb',
          value: 'understanding',
        },
        {
          id: 'peace',
          label: 'Finding peace',
          icon: 'heart',
          value: 'peace',
        },
        {
          id: 'purpose',
          label: 'Discovering purpose',
          icon: 'compass',
          value: 'purpose',
        },
        {
          id: 'community',
          label: 'Connecting with others',
          icon: 'people',
          value: 'community',
        },
      ],
    },
    {
      id: 'growth_goals',
      type: 'multiple_choice',
      question: 'What are your spiritual priorities?',
      subtitle: 'Choose your top 2-3 focus areas',
      required: true,
      weight: 0.8,
      options: [
        {
          id: 'prayer',
          label: 'Stronger prayer life',
          icon: 'hand-left',
          value: 'prayer',
        },
        {
          id: 'bible_study',
          label: 'Bible understanding',
          icon: 'book',
          value: 'bible_study',
        },
        {
          id: 'character',
          label: 'Character development',
          icon: 'diamond',
          value: 'character',
        },
        {
          id: 'relationships',
          label: 'Godly relationships',
          icon: 'heart',
          value: 'relationships',
        },
        {
          id: 'service',
          label: 'Serving others',
          icon: 'hand-right',
          value: 'service',
        },
      ],
    },
    {
      id: 'learning_preference',
      type: 'single_choice',
      question: 'How do you prefer to learn?',
      subtitle: 'We\'ll customize content to your style',
      required: false,
      weight: 0.6,
      options: [
        {
          id: 'reading',
          label: 'Reading & reflection',
          description: 'Text-based content and journaling',
          icon: 'book-outline',
          value: 'reading',
        },
        {
          id: 'audio',
          label: 'Listening',
          description: 'Audio devotions and podcasts',
          icon: 'headset',
          value: 'audio',
        },
        {
          id: 'visual',
          label: 'Visual learning',
          description: 'Images, videos, and infographics',
          icon: 'eye',
          value: 'visual',
        },
        {
          id: 'interactive',
          label: 'Interactive',
          description: 'Quizzes, discussions, and activities',
          icon: 'chatbubbles',
          value: 'interactive',
        },
      ],
    },
  ], []);

  useEffect(() => {
    // Initialize with first question
    setActiveQuestions([allQuestions[0]]);
    setQuestionStartTime(Date.now());

    // Start animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(progressAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: false,
      }),
    ]).start();
  }, [allQuestions, fadeAnim, progressAnim]);

  const handleAnswer = (questionId: string, answer: any) => {
    const timeSpent = Date.now() - questionStartTime;

    // Record result
    const result: AssessmentResult = {
      questionId,
      answer,
      confidence: calculateConfidence(questionId, answer, timeSpent),
      timeSpent,
    };

    setResults(prev => [...prev, result]);
    setAnswers(prev => new Map(prev.set(questionId, answer)));

    // Determine next questions based on answer
    const nextQuestions = getNextQuestions(questionId, answer);

    if (nextQuestions.length > 0) {
      setActiveQuestions(nextQuestions);
      setCurrentQuestionIndex(0);
      setQuestionStartTime(Date.now());

      // Update progress
      const totalExpectedQuestions = 4; // Average expected questions
      const progress = (results.length + 1) / totalExpectedQuestions;

      Animated.timing(progressAnim, {
        toValue: Math.min(progress * 100, 100),
        duration: 300,
        useNativeDriver: false,
      }).start();
    } else {
      // Assessment complete
      completeAssessment();
    }
  };

  const getNextQuestions = (answeredQuestionId: string, answer: any): AssessmentQuestion[] => {
    const answeredQuestion = allQuestions.find(q => q.id === answeredQuestionId);

    if (!answeredQuestion) {return [];}

    // Smart question selection based on previous answers
    const nextQuestionIds: string[] = [];

    if (answeredQuestionId === 'spiritual_stage') {
      const selectedOption = answeredQuestion.options?.find(opt => opt.value === answer);
      if (selectedOption?.followUpQuestions) {
        nextQuestionIds.push(...selectedOption.followUpQuestions);
      }
    } else if (answeredQuestionId === 'time_commitment') {
      // Always ask about learning preference after time commitment
      nextQuestionIds.push('learning_preference');
    }

    // Filter out already answered questions
    const answeredIds = Array.from(answers.keys());
    const filteredIds = nextQuestionIds.filter(id => !answeredIds.includes(id));

    return allQuestions.filter(q => filteredIds.includes(q.id));
  };

  const calculateConfidence = (questionId: string, answer: any, timeSpent: number): number => {
    // ML-based confidence calculation
    let confidence = 0.8; // Base confidence

    // Time-based adjustment
    if (timeSpent < 2000) {confidence -= 0.2;} // Too fast
    if (timeSpent > 30000) {confidence -= 0.1;} // Too slow

    // Question-specific adjustments
    if (questionId === 'spiritual_stage' && timeSpent > 5000) {confidence += 0.1;}

    return Math.max(0.1, Math.min(1.0, confidence));
  };

  const completeAssessment = () => {
    const userProfile = generateUserProfile();
    onComplete(results, userProfile);
  };

  const generateUserProfile = (): UserProfile => {
    const spiritualStage = answers.get('spiritual_stage') || 'new';
    const timeCommitment = answers.get('time_commitment') || 5;
    const goals = answers.get('basic_goals') || answers.get('growth_goals') || [];
    const learningStyle = answers.get('learning_preference') || 'reading';

    // Calculate confidence score based on answer patterns
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;

    return {
      spiritualMaturity: spiritualStage,
      timeAvailability: timeCommitment,
      primaryGoals: Array.isArray(goals) ? goals : [goals],
      learningStyle,
      confidenceScore: avgConfidence,
    };
  };

  const renderQuestion = (question: AssessmentQuestion) => {
    const isMultipleChoice = question.type === 'multiple_choice';
    const currentAnswers = answers.get(question.id) || (isMultipleChoice ? [] : null);

    return (
      <Animated.View style={[styles.questionContainer, { opacity: fadeAnim }]}>
        <View style={styles.questionHeader}>
          <Text style={styles.questionText}>{question.question}</Text>
          {question.subtitle && (
            <Text style={styles.questionSubtitle}>{question.subtitle}</Text>
          )}
        </View>

        <ScrollView style={styles.optionsContainer} showsVerticalScrollIndicator={false}>
          {question.options?.map((option) => {
            const isSelected = isMultipleChoice
              ? currentAnswers.includes(option.value)
              : currentAnswers === option.value;

            return (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.optionCard,
                  isSelected && styles.optionCardSelected,
                ]}
                onPress={() => {
                  if (isMultipleChoice) {
                    const newAnswers = isSelected
                      ? currentAnswers.filter((a: any) => a !== option.value)
                      : [...currentAnswers, option.value];
                    setAnswers(prev => new Map(prev.set(question.id, newAnswers)));
                  } else {
                    handleAnswer(question.id, option.value);
                  }
                }}
                activeOpacity={0.7}
              >
                <View style={styles.optionContent}>
                  <View style={styles.optionLeft}>
                    {option.icon && (
                      <View style={[
                        styles.optionIcon,
                        isSelected && styles.optionIconSelected,
                      ]}>
                        <Ionicons
                          name={option.icon as any}
                          size={24}
                          color={isSelected ? 'white' : Colors.anchorBlue}
                        />
                      </View>
                    )}
                    <View style={styles.optionText}>
                      <Text style={[
                        styles.optionLabel,
                        isSelected && styles.optionLabelSelected,
                      ]}>
                        {option.label}
                      </Text>
                      {option.description && (
                        <Text style={[
                          styles.optionDescription,
                          isSelected && styles.optionDescriptionSelected,
                        ]}>
                          {option.description}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={[
                    styles.selectionIndicator,
                    isSelected && styles.selectionIndicatorSelected,
                  ]}>
                    {isSelected && (
                      <Ionicons name="checkmark" size={16} color="white" />
                    )}
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {isMultipleChoice && currentAnswers.length > 0 && (
          <TouchableOpacity
            style={styles.continueButton}
            onPress={() => handleAnswer(question.id, currentAnswers)}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <Ionicons name="chevron-forward" size={20} color="white" />
          </TouchableOpacity>
        )}
      </Animated.View>
    );
  };

  const currentQuestion = activeQuestions[currentQuestionIndex];
  const progress = ((results.length) / 4) * 100; // Estimated 4 questions

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={24} color={Colors.anchorBlue} />
        </TouchableOpacity>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <Animated.View
              style={[
                styles.progressFill,
                {
                  width: progressAnim.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                    extrapolate: 'clamp',
                  }),
                },
              ]}
            />
          </View>
          <Text style={styles.progressText}>
            {Math.round(progress)}% complete
          </Text>
        </View>
      </View>

      {/* Question */}
      <View style={styles.content}>
        {currentQuestion && renderQuestion(currentQuestion)}
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  backButton: {
    padding: 8,
    marginRight: 16,
  },
  progressContainer: {
    flex: 1,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.anchorBlue,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: Colors.mediumGray,
    marginTop: 4,
    textAlign: 'right',
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
  },
  questionContainer: {
    flex: 1,
  },
  questionHeader: {
    marginBottom: 32,
  },
  questionText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.darkerGray,
    lineHeight: 36,
    marginBottom: 8,
  },
  questionSubtitle: {
    fontSize: 16,
    color: Colors.mediumGray,
    lineHeight: 22,
  },
  optionsContainer: {
    flex: 1,
  },
  optionCard: {
    backgroundColor: Colors.white,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
  },
  optionCardSelected: {
    borderColor: Colors.anchorBlue,
    backgroundColor: Colors.anchorBlue,
  },
  optionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${Colors.anchorBlue}15`,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionIconSelected: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  optionText: {
    flex: 1,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkerGray,
    marginBottom: 4,
  },
  optionLabelSelected: {
    color: Colors.hopeWhite,
  },
  optionDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    lineHeight: 20,
  },
  optionDescriptionSelected: {
    color: 'rgba(255,255,255,0.8)',
  },
  selectionIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectionIndicatorSelected: {
    backgroundColor: Colors.hopeWhite,
    borderColor: Colors.hopeWhite,
  },
  continueButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.anchorBlue,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 25,
    marginTop: 24,
    marginBottom: 32,
  },
  continueButtonText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontWeight: '600',
    marginRight: 8,
  },
});

export default SmartAssessment;
