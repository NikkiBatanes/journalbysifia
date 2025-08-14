/**
 * Phase 4: Multi-Modal Content Player
 * Handles audio, video, interactive exercises, and adaptive content delivery
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Modal,
  ActivityIndicator,
  Dimensions,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { ContentItem, InteractiveStep } from '../interfaces/contentCurationTypes';
import { useTheme } from '../theme/ThemeContext';

interface MultiModalContentPlayerProps {
  visible: boolean;
  onClose: () => void;
  contentItem: ContentItem;
  onComplete: (feedback: ContentFeedback) => void;
  onProgress: (progress: number) => void;
}

interface ContentFeedback {
  helpful: boolean;
  timing: 'perfect' | 'good' | 'poor';
  relevance: number; // 1-5 scale
  comments?: string;
  completionRate: number;
  timeSpent: number; // in seconds
}

export const MultiModalContentPlayer: React.FC<MultiModalContentPlayerProps> = ({
  visible,
  onClose,
  contentItem,
  onComplete,
  onProgress,
}) => {
  const theme = useTheme();
  const styles = createStyles(theme);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [userInput, setUserInput] = useState('');
  const [startTime] = useState(Date.now());
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);

  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const { width: screenWidth } = Dimensions.get('window');

  useEffect(() => {
    if (visible) {
      initializeContent();
    }
    return () => {
      cleanup();
    };
  }, [visible, contentItem]);

  useEffect(() => {
    onProgress(progress);
  }, [progress, onProgress]);

  const initializeContent = async () => {
    setCurrentStep(0);
    setProgress(0);
    setUserInput('');

    if (contentItem.type === 'audio' && contentItem.mediaUrl) {
      await loadAudio();
    }

    if (contentItem.type === 'interactive') {
      startInteractiveExperience();
    }
  };

  const loadAudio = async () => {
    try {
      const { sound: audioSound } = await Audio.Sound.createAsync(
        { uri: contentItem.mediaUrl! },
        { shouldPlay: false }
      );
      setSound(audioSound);

      audioSound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded) {
          const progressPercent = status.durationMillis ?
            (status.positionMillis || 0) / status.durationMillis * 100 : 0;
          setProgress(progressPercent);

          if (status.didJustFinish) {
            handleContentComplete();
          }
        }
      });
    } catch (error) {
      console.error('Error loading audio:', error);
      Alert.alert('Error', 'Unable to load audio content');
    }
  };

  const startInteractiveExperience = () => {
    if (contentItem.interactiveConfig?.steps.length) {
      startProgressTracking();
    }
  };

  const startProgressTracking = () => {
    const totalSteps = contentItem.interactiveConfig?.steps.length || 1;
    const stepDuration = (contentItem.metadata.duration || 10) * 60 / totalSteps; // seconds per step

    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        const newProgress = Math.min(prev + (100 / (stepDuration * 10)), 100);
        if (newProgress >= 100) {
          handleContentComplete();
        }
        return newProgress;
      });
    }, 100);
  };

  const handlePlayPause = async () => {
    if (!sound) {return;}

    try {
      if (isPlaying) {
        await sound.pauseAsync();
      } else {
        await sound.playAsync();
      }
      setIsPlaying(!isPlaying);
    } catch (error) {
      console.error('Error controlling audio playback:', error);
    }
  };

  const handleNextStep = () => {
    const totalSteps = contentItem.interactiveConfig?.steps.length || 1;
    if (currentStep < totalSteps - 1) {
      setCurrentStep(currentStep + 1);
      setProgress(((currentStep + 1) / totalSteps) * 100);
    } else {
      handleContentComplete();
    }
  };

  const handleContentComplete = () => {
    cleanup();
    setShowFeedback(true);
  };

  const submitFeedback = (feedback: Partial<ContentFeedback>) => {
    const timeSpent = (Date.now() - startTime) / 1000;
    const completeFeedback: ContentFeedback = {
      helpful: feedback.helpful || true,
      timing: feedback.timing || 'good',
      relevance: feedback.relevance || 4,
      comments: feedback.comments,
      completionRate: progress,
      timeSpent,
    };

    onComplete(completeFeedback);
    setShowFeedback(false);
    onClose();
  };

  const cleanup = () => {
    if (progressInterval.current) {
      clearInterval(progressInterval.current);
      progressInterval.current = null;
    }

    if (sound) {
      sound.unloadAsync();
      setSound(null);
    }

    setIsPlaying(false);
  };

  const renderTextContent = () => (
    <ScrollView style={styles.contentContainer}>
      <Text style={styles.contentTitle}>{contentItem.title}</Text>
      <Text style={styles.contentText}>{contentItem.content}</Text>

      {contentItem.metadata.scriptureReferences && (
        <View style={styles.scriptureContainer}>
          <Text style={styles.scriptureTitle}>Scripture References:</Text>
          {contentItem.metadata.scriptureReferences.map((ref, index) => (
            <Text key={index} style={styles.scriptureText}>• {ref}</Text>
          ))}
        </View>
      )}

      <TouchableOpacity style={styles.completeButton} onPress={handleContentComplete}>
        <Text style={styles.completeButtonText}>Complete Reading</Text>
      </TouchableOpacity>
    </ScrollView>
  );

  const renderAudioContent = () => (
    <View style={styles.audioContainer}>
      <Text style={styles.contentTitle}>{contentItem.title}</Text>
      <Text style={styles.contentDescription}>{contentItem.content}</Text>

      <View style={styles.audioControls}>
        <TouchableOpacity style={styles.playButton} onPress={handlePlayPause}>
          <Ionicons
            name={isPlaying ? 'pause' : 'play'}
            size={40}
            color="#fff"
          />
        </TouchableOpacity>
      </View>

      <View style={styles.progressContainer}>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressText}>{Math.round(progress)}%</Text>
      </View>
    </View>
  );

  const renderInteractiveContent = () => {
    const steps = contentItem.interactiveConfig?.steps || [];
    const currentStepData = steps[currentStep];

    if (!currentStepData) {return null;}

    return (
      <View style={styles.interactiveContainer}>
        <Text style={styles.contentTitle}>{contentItem.title}</Text>

        <View style={styles.stepIndicator}>
          <Text style={styles.stepText}>
            Step {currentStep + 1} of {steps.length}
          </Text>
        </View>

        <View style={styles.stepContent}>
          <Text style={styles.stepInstruction}>{currentStepData.instruction}</Text>

          {currentStepData.userInput && (
            <View style={styles.inputContainer}>
              <Text style={styles.inputPrompt}>{currentStepData.userInput.prompt}</Text>
              {/* Input handling would be implemented based on type */}
            </View>
          )}

          {currentStepData.backgroundElement && (
            <View style={styles.backgroundElement}>
              <Text style={styles.backgroundText}>
                {currentStepData.backgroundElement.content}
              </Text>
            </View>
          )}
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>{Math.round(progress)}%</Text>
        </View>

        <TouchableOpacity style={styles.nextButton} onPress={handleNextStep}>
          <Text style={styles.nextButtonText}>
            {currentStep < steps.length - 1 ? 'Next Step' : 'Complete'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderFeedbackModal = () => (
    <Modal visible={showFeedback} transparent animationType="fade">
      <View style={styles.feedbackOverlay}>
        <View style={styles.feedbackContainer}>
          <Text style={styles.feedbackTitle}>How was this content?</Text>

          <View style={styles.feedbackButtons}>
            <TouchableOpacity
              style={[styles.feedbackButton, styles.positiveButton]}
              onPress={() => submitFeedback({ helpful: true, relevance: 5, timing: 'perfect' })}
            >
              <Ionicons name="thumbs-up" size={24} color="#fff" />
              <Text style={styles.feedbackButtonText}>Helpful</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.feedbackButton, styles.neutralButton]}
              onPress={() => submitFeedback({ helpful: true, relevance: 3, timing: 'good' })}
            >
              <Ionicons name="thumbs-down" size={24} color="#fff" />
              <Text style={styles.feedbackButtonText}>Not Helpful</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.skipFeedbackButton}
            onPress={() => submitFeedback({})}
          >
            <Text style={styles.skipFeedbackText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  const renderContent = () => {
    switch (contentItem.type) {
      case 'audio':
        return renderAudioContent();
      case 'interactive':
        return renderInteractiveContent();
      case 'text':
      default:
        return renderTextContent();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Spiritual Content</Text>
            <Text style={styles.headerSubtitle}>
              {contentItem.metadata.duration} min • {contentItem.metadata.difficulty}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <Ionicons name="heart" size={20} color={theme.colors.goldAccent} />
          </View>
        </View>

        {/* Content */}
        {renderContent()}

        {/* Feedback Modal */}
        {renderFeedbackModal()}
      </View>
    </Modal>
  );
};

// Convert to dynamic styles function that uses theme
const createStyles = (theme: any) => ({
  container: {
    flex: 1,
    backgroundColor: theme.colors.lightBackground,
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.white,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderLight,
    paddingTop: 50,
  },
  closeButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center' as const,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  headerRight: {
    padding: 8,
  },
  contentContainer: {
    flex: 1,
    padding: 20,
  },
  contentTitle: {
    fontSize: 24,
    fontWeight: 'bold' as const,
    color: '#333',
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    marginBottom: 20,
  },
  contentDescription: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center' as const,
    marginBottom: 30,
  },
  scriptureContainer: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37',
  },
  scriptureTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 8,
  },
  scriptureText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  audioContainer: {
    flex: 1,
    padding: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  audioControls: {
    marginVertical: 40,
  },
  playButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#D4AF37',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  interactiveContainer: {
    flex: 1,
    padding: 20,
  },
  stepIndicator: {
    alignItems: 'center' as const,
    marginBottom: 20,
  },
  stepText: {
    fontSize: 14,
    color: '#666',
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  stepContent: {
    flex: 1,
    justifyContent: 'center' as const,
  },
  stepInstruction: {
    fontSize: 18,
    lineHeight: 26,
    color: '#333',
    textAlign: 'center' as const,
    marginBottom: 30,
  },
  inputContainer: {
    marginVertical: 20,
  },
  inputPrompt: {
    fontSize: 16,
    color: '#555',
    marginBottom: 10,
  },
  backgroundElement: {
    backgroundColor: '#f8f9fa',
    padding: 16,
    borderRadius: 12,
    marginTop: 20,
  },
  backgroundText: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic' as const,
    textAlign: 'center' as const,
  },
  progressContainer: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginVertical: 20,
  },
  progressBar: {
    flex: 1,
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginRight: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D4AF37',
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: '#666',
    minWidth: 40,
  },
  completeButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 20,
  },
  completeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  nextButton: {
    backgroundColor: '#D4AF37',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center' as const,
    marginTop: 20,
  },
  nextButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600' as const,
  },
  feedbackOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  feedbackContainer: {
    backgroundColor: '#fff',
    padding: 24,
    borderRadius: 16,
    width: '80%',
    alignItems: 'center' as const,
  },
  feedbackTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 20,
  },
  feedbackButtons: {
    flexDirection: 'row' as const,
    gap: 16,
    marginBottom: 16,
  },
  feedbackButton: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  positiveButton: {
    backgroundColor: '#4CAF50',
  },
  neutralButton: {
    backgroundColor: '#FF9800',
  },
  feedbackButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600' as const,
  },
  skipFeedbackButton: {
    paddingVertical: 8,
  },
  skipFeedbackText: {
    color: '#666',
    fontSize: 14,
  },
};
