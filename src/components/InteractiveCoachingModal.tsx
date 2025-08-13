/**
 * Phase 3: Interactive Spiritual Coaching Modal
 * Provides conversational AI spiritual director interface
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { InteractiveCoachingService } from '../services/interactiveCoachingService';
import {
  ConversationThread,
  ConversationMessage,
  ConversationResponse,
  FollowUpQuestion,
} from '../interfaces/conversationTypes';

interface InteractiveCoachingModalProps {
  visible: boolean;
  onClose: () => void;
  userId: string;
  playbookId: string;
  stepId: string;
  stepText: string;
  userOriginalInput: string;
  playbookTitle: string;
  subtaskId?: string;
}

export const InteractiveCoachingModal: React.FC<InteractiveCoachingModalProps> = ({
  visible,
  onClose,
  userId,
  playbookId,
  stepId,
  stepText,
  userOriginalInput,
  playbookTitle,
  subtaskId,
}) => {
  const [thread, setThread] = useState<ConversationThread | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [selectedFollowUp, setSelectedFollowUp] = useState<FollowUpQuestion | null>(null);

  const scrollViewRef = useRef<ScrollView>(null);
  const coachingService = new InteractiveCoachingService();

  useEffect(() => {
    if (visible && !thread) {
      startConversation();
    }
  }, [visible]);

  useEffect(() => {
    // Auto-scroll to bottom when new messages arrive
    if (thread?.messages.length) {
      setTimeout(() => {
        scrollViewRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [thread?.messages.length]);

  const startConversation = async () => {
    setIsStarting(true);
    try {
      const newThread = await coachingService.startConversation(
        userId,
        playbookId,
        stepId,
        stepText,
        userOriginalInput,
        playbookTitle,
        subtaskId
      );
      setThread(newThread);
    } catch (error) {
      console.error('Error starting conversation:', error);
      Alert.alert('Error', 'Unable to start coaching conversation. Please try again.');
    } finally {
      setIsStarting(false);
    }
  };

  const sendMessage = async (message?: string) => {
    if (!thread || (!currentMessage.trim() && !message)) {return;}

    const messageToSend = message || currentMessage.trim();
    setCurrentMessage('');
    setIsLoading(true);
    setSelectedFollowUp(null);

    try {
      const response = await coachingService.continueConversation(
        thread.id,
        messageToSend,
        detectEmotionalTone(messageToSend)
      );

      // Refresh thread to get updated messages
      const updatedThread = await coachingService.getConversationThread(thread.id);
      if (updatedThread) {
        setThread(updatedThread);
      }
    } catch (error) {
      console.error('Error sending message:', error);
      Alert.alert('Error', 'Unable to send message. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const detectEmotionalTone = (message: string): 'struggling' | 'hopeful' | 'confused' | 'grateful' | 'seeking' => {
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('thank') || lowerMessage.includes('grateful') || lowerMessage.includes('appreciate')) {
      return 'grateful';
    }
    if (lowerMessage.includes('hope') || lowerMessage.includes('excited') || lowerMessage.includes('better')) {
      return 'hopeful';
    }
    if (lowerMessage.includes('struggle') || lowerMessage.includes('hard') || lowerMessage.includes('difficult')) {
      return 'struggling';
    }
    if (lowerMessage.includes('confused') || lowerMessage.includes('don\'t understand') || lowerMessage.includes('unclear')) {
      return 'confused';
    }

    return 'seeking';
  };

  const handleFollowUpQuestion = (question: FollowUpQuestion) => {
    setSelectedFollowUp(question);
    setCurrentMessage(question.question);
  };

  const renderMessage = (message: ConversationMessage, index: number) => {
    const isUser = message.type === 'user';
    const isLastAiMessage = !isUser && index === thread!.messages.length - 1;

    return (
      <View key={message.id} style={[styles.messageContainer, isUser ? styles.userMessage : styles.aiMessage]}>
        <View style={[styles.messageBubble, isUser ? styles.userBubble : styles.aiBubble]}>
          <Text style={[styles.messageText, isUser ? styles.userText : styles.aiText]}>
            {message.content}
          </Text>
          <Text style={styles.timestamp}>
            {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </Text>
        </View>

        {/* Show follow-up questions for the last AI message */}
        {isLastAiMessage && renderFollowUpQuestions()}
      </View>
    );
  };

  const renderFollowUpQuestions = () => {
    // In a real implementation, you'd get these from the AI response
    const sampleQuestions: FollowUpQuestion[] = [
      {
        id: 'q1',
        question: 'What feels most challenging about this step?',
        purpose: 'clarification',
        priority: 'high',
      },
      {
        id: 'q2',
        question: 'How do you sense God might be inviting you to grow here?',
        purpose: 'spiritual_growth',
        priority: 'medium',
      },
    ];

    return (
      <View style={styles.followUpContainer}>
        <Text style={styles.followUpLabel}>You might ask:</Text>
        {sampleQuestions.map((question) => (
          <TouchableOpacity
            key={question.id}
            style={styles.followUpButton}
            onPress={() => handleFollowUpQuestion(question)}
          >
            <Text style={styles.followUpText}>{question.question}</Text>
          </TouchableOpacity>
        ))}
      </View>
    );
  };

  const renderTypingIndicator = () => (
    <View style={[styles.messageContainer, styles.aiMessage]}>
      <View style={[styles.messageBubble, styles.aiBubble, styles.typingBubble]}>
        <ActivityIndicator size="small" color="#666" />
        <Text style={styles.typingText}>Coach is typing...</Text>
      </View>
    </View>
  );

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Ionicons name="close" size={24} color="#333" />
          </TouchableOpacity>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>Spiritual Coaching</Text>
            <Text style={styles.headerSubtitle}>{stepText.substring(0, 40)}...</Text>
          </View>
          <View style={styles.headerRight}>
            <Ionicons name="heart" size={20} color="#D4AF37" />
          </View>
        </View>

        {/* Messages */}
        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
        >
          {isStarting ? (
            <View style={styles.startingContainer}>
              <ActivityIndicator size="large" color="#D4AF37" />
              <Text style={styles.startingText}>Starting your coaching session...</Text>
            </View>
          ) : (
            <>
              {thread?.messages.map((message, index) => renderMessage(message, index))}
              {isLoading && renderTypingIndicator()}
            </>
          )}
        </ScrollView>

        {/* Input Area */}
        <View style={styles.inputContainer}>
          <TextInput
            style={styles.textInput}
            value={currentMessage}
            onChangeText={setCurrentMessage}
            placeholder="Share what's on your heart..."
            multiline
            maxLength={500}
            editable={!isLoading && !isStarting}
          />
          <TouchableOpacity
            style={[styles.sendButton, (!currentMessage.trim() || isLoading) && styles.sendButtonDisabled]}
            onPress={() => sendMessage()}
            disabled={!currentMessage.trim() || isLoading}
          >
            <Ionicons
              name="send"
              size={20}
              color={(!currentMessage.trim() || isLoading) ? '#ccc' : '#fff'}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    paddingTop: Platform.OS === 'ios' ? 50 : 12,
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
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    paddingBottom: 20,
  },
  startingContainer: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: 40,
  },
  startingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center' as const,
  },
  messageContainer: {
    marginBottom: 16,
  },
  userMessage: {
    alignItems: 'flex-end' as const,
  },
  aiMessage: {
    alignItems: 'flex-start' as const,
  },
  messageBubble: {
    maxWidth: '80%' as const,
    padding: 12,
    borderRadius: 18,
  },
  userBubble: {
    backgroundColor: '#D4AF37',
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  typingBubble: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  messageText: {
    fontSize: 16,
    lineHeight: 22,
  },
  userText: {
    color: '#fff',
  },
  aiText: {
    color: '#333',
  },
  typingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic' as const,
  },
  timestamp: {
    fontSize: 11,
    color: '#999',
    marginTop: 4,
    textAlign: 'right' as const,
  },
  followUpContainer: {
    marginTop: 12,
    marginLeft: 8,
  },
  followUpLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 8,
    fontStyle: 'italic' as const,
  },
  followUpButton: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  followUpText: {
    fontSize: 14,
    color: '#555',
  },
  inputContainer: {
    flexDirection: 'row' as const,
    alignItems: 'flex-end' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e1e5e9',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#e1e5e9',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    maxHeight: 100,
    backgroundColor: '#f8f9fa',
  },
  sendButton: {
    marginLeft: 12,
    backgroundColor: '#D4AF37',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
  sendButtonDisabled: {
    backgroundColor: '#e0e0e0',
  },
};
