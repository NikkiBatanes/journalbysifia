import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme';
import { Typography } from '../theme/typography';
import {
  simplifiedExpoundingService,
  CardType,
  CardInsight,
  QuestionResponse,
  FollowUpOption,
} from '../services/simplifiedExpoundingService';
import { insightBookmarkService } from '../services/insightBookmarkService';
import { spiritualProgressService } from '../services/spiritualProgressService';

interface SimplifiedCardInsightProps {
  userId: string;
  cardType: CardType;
  cardContent: string;
  playbookTitle: string;
  userOriginalInput?: string;
  hasAccess: boolean;
}

export const SimplifiedCardInsight: React.FC<SimplifiedCardInsightProps> = ({
  userId,
  cardType,
  cardContent,
  playbookTitle,
  userOriginalInput,
  hasAccess = true,
}) => {
  const [insight, setInsight] = useState<CardInsight | null>(null);
  const [questionResponse, setQuestionResponse] = useState<QuestionResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showQuestionInput, setShowQuestionInput] = useState(false);
  const [userQuestion, setUserQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState<Array<{id: string, question: string, answer: string, timestamp: string}>>([]);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isBookmarking, setIsBookmarking] = useState(false);
  const [isAnswering, setIsAnswering] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateInsight = async () => {
    if (!userId || isGenerating || !hasAccess) {return;}

    setIsGenerating(true);
    setError(null);

    try {
      const generatedInsight = await simplifiedExpoundingService.generateCardInsight(
        userId,
        cardType,
        cardContent,
        playbookTitle,
        userOriginalInput
      );
      setInsight(generatedInsight);
    } catch (error) {
      console.error('[SimplifiedCardInsight] Error generating insight:', error);
      setError('Unable to generate insight. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleFollowUpQuestion = async (followUpPrompt: string) => {
    if (isAnswering) {return;}

    setIsAnswering(true);
    try {
      const response = await simplifiedExpoundingService.answerCardQuestion(
        userId,
        cardType,
        cardContent,
        followUpPrompt,
        playbookTitle,
        userOriginalInput
      );
      setQuestionResponse(response);
    } catch (error) {
      console.error('Error answering follow-up:', error);
    } finally {
      setIsAnswering(false);
    }
  };

  const handleUserQuestion = async () => {
    if (!userQuestion.trim() || !userId || isAnswering || !hasAccess) {return;}

    setIsAnswering(true);
    setError(null);

    try {
      const response = await simplifiedExpoundingService.answerCardQuestion(
        userId,
        cardType,
        cardContent,
        userQuestion.trim(),
        playbookTitle,
        userOriginalInput
      );

      const newChatEntry = {
        id: `chat_${Date.now()}`,
        question: userQuestion.trim(),
        answer: response.aiResponse,
        timestamp: new Date().toLocaleTimeString(),
      };

      setChatHistory(prev => [...prev, newChatEntry]);
      setUserQuestion('');
      setQuestionResponse(null);

      // Track question for personalized progress (no caching)
      await spiritualProgressService.trackProgress(
        userId,
        'questions_asked',
        1,
        { playbookTitle, cardType }
      );
    } catch (error) {
      console.error('[SimplifiedCardInsight] Error answering question:', error);
      setError('Unable to answer question. Please try again.');
    } finally {
      setIsAnswering(false);
    }
  };

  const handleBookmarkInsight = async () => {
    if (!insight || !userId || isBookmarking || !hasAccess) {return;}
    setIsBookmarking(true);

    try {
      await insightBookmarkService.bookmarkInsight(
        userId,
        cardType,
        cardContent,
        insight.insight,
        playbookTitle,
        userOriginalInput
      );

      setIsBookmarked(true);
      console.log('[SimplifiedCardInsight] Insight bookmarked successfully');

      // Track bookmark for personalized progress
      await spiritualProgressService.trackProgress(
        userId,
        'bookmarks_saved',
        1,
        { playbookTitle, cardType }
      );
    } catch (error) {
      console.error('[SimplifiedCardInsight] Error bookmarking insight:', error);
      setError('Unable to save insight. Please try again.');
    } finally {
      setIsBookmarking(false);
    }
  };

  const followUpOptions = simplifiedExpoundingService.getFollowUpOptions(cardType);

  const getCardTypeIcon = (type: CardType): string => {
    const icons = {
      truth: 'heart',
      action: 'checkmark-circle',
      affirmation: 'star',
      bible: 'book',
      challenge: 'trophy',
    };
    return icons[type] || 'information-circle';
  };

  const getCardTypeColor = (type: CardType): string => {
    const colors = {
      truth: '#E74C3C',
      action: '#2ECC71',
      affirmation: '#F39C12',
      bible: '#9B59B6',
      challenge: '#3498DB',
    };
    return colors[type] || Colors.faithGold;
  };

  return (
    <View style={styles.container}>
      {/* Access Required Message */}
      {!hasAccess && (
        <View style={styles.accessRequiredContainer}>
          <Text style={styles.accessRequiredText}>
            Upgrade to access AI-powered spiritual insights and personalized guidance.
          </Text>
          <TouchableOpacity style={styles.upgradeButton}>
            <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Generate Insight Button */}
      {hasAccess && !insight && !isGenerating && (
        <TouchableOpacity style={styles.generateButton} onPress={generateInsight}>
          <Icon
            name="bulb-outline"
            size={16}
            color={getCardTypeColor(cardType)}
          />
          <Text style={styles.generateButtonText}>Get Insight</Text>
        </TouchableOpacity>
      )}

      {/* Loading State */}
      {isGenerating && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.faithGold} />
          <Text style={styles.loadingText}>Generating insight...</Text>
        </View>
      )}

      {/* Insight Display */}
      {insight && (
        <View style={styles.insightContainer}>
          <View style={styles.insightHeader}>
            <Icon
              name="close"
              size={16}
              color={Colors.textGray}
            />
            <Text style={styles.insightTitle}>
              {cardType.charAt(0).toUpperCase() + cardType.slice(1)} Insight
            </Text>
          </View>

          <Text style={styles.insightText}>{insight.insight}</Text>

          {/* Follow-up Buttons */}
          <View style={styles.followUpContainer}>
            {followUpOptions.map((option) => (
              <TouchableOpacity
                key={option.id}
                style={styles.followUpButton}
                onPress={() => {
                  setUserQuestion(option.prompt);
                  setShowQuestionInput(true);
                }}
              >
                <Text style={styles.followUpButtonText}>{option.label}</Text>
              </TouchableOpacity>
            ))}

            {/* Bookmark Button */}
            <TouchableOpacity
              style={[styles.followUpButton, styles.bookmarkButton]}
              onPress={handleBookmarkInsight}
              disabled={isBookmarking}
            >
              {isBookmarking ? (
                <ActivityIndicator size="small" color={Colors.faithGold} />
              ) : (
                <>
                  <Icon
                    name={isBookmarked ? 'bookmark' : 'bookmark-outline'}
                    size={14}
                    color={Colors.faithGold}
                  />
                  <Text style={[styles.followUpButtonText, styles.bookmarkButtonText]}>
                    {isBookmarked ? 'Saved' : 'Save'}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          {/* Ask Question Button */}
          <TouchableOpacity
            style={styles.askQuestionButton}
            onPress={() => setShowQuestionInput(!showQuestionInput)}
          >
            <Icon name="help-circle-outline" size={16} color={Colors.faithGold} />
            <Text style={styles.askQuestionButtonText}>Ask a question</Text>
          </TouchableOpacity>

          {/* Question Input */}
          {showQuestionInput && (
            <View style={styles.questionInputContainer}>
              <TextInput
                style={styles.questionInput}
                placeholder="Ask anything about this card..."
                placeholderTextColor="rgba(255, 255, 255, 0.5)"
                value={userQuestion}
                onChangeText={setUserQuestion}
                multiline
                maxLength={200}
              />
              <View style={styles.questionActions}>
                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setShowQuestionInput(false);
                    setUserQuestion('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.submitButton, !userQuestion.trim() && styles.submitButtonDisabled]}
                  onPress={handleUserQuestion}
                  disabled={!userQuestion.trim() || isAnswering}
                >
                  {isAnswering ? (
                    <ActivityIndicator size="small" color={Colors.hopeWhite} />
                  ) : (
                    <Text style={styles.submitButtonText}>Ask</Text>
                  )}
                </TouchableOpacity>
              </View>
            </View>
          )}
        </View>
      )}

      {/* Chat History */}
      {chatHistory.length > 0 && (
        <View style={styles.chatContainer}>
          <View style={styles.chatHeader}>
            <Icon name="chatbubbles" size={16} color={Colors.faithGold} />
            <Text style={styles.chatTitle}>Conversation</Text>
            <TouchableOpacity
              style={styles.clearChatButton}
              onPress={() => setChatHistory([])}
            >
              <Text style={styles.clearChatText}>Clear</Text>
            </TouchableOpacity>
          </View>

          {chatHistory.map((chat) => (
            <View key={chat.id} style={styles.chatEntry}>
              <View style={styles.questionBubble}>
                <Text style={styles.questionText}>Q: {chat.question}</Text>
                <Text style={styles.timestampText}>{chat.timestamp}</Text>
              </View>
              <View style={styles.answerBubble}>
                <Text style={styles.answerText}>{chat.answer}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 12,
  },
  generateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  generateButtonText: {
    ...Typography.interSemiBold,
    fontSize: 14,
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  loadingText: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    marginLeft: 8,
  },
  insightContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    borderLeftWidth: 3,
    borderLeftColor: Colors.faithGold,
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  insightTitle: {
    ...Typography.interSemiBold,
    fontSize: 15,
    color: Colors.hopeWhite,
    marginLeft: 8,
  },
  insightText: {
    ...Typography.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 16,
  },
  followUpContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  followUpButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  followUpButtonText: {
    ...Typography.interRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  askQuestionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
    marginTop: 8,
  },
  askQuestionButtonText: {
    ...Typography.interSemiBold,
    fontSize: 13,
    color: Colors.faithGold,
    marginLeft: 6,
  },
  questionInputContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 8,
  },
  questionInput: {
    ...Typography.interRegular,
    fontSize: 14,
    color: Colors.hopeWhite,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 6,
    padding: 12,
    minHeight: 60,
    textAlignVertical: 'top',
    marginBottom: 12,
  },
  questionActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  cancelButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  cancelButtonText: {
    ...Typography.interRegular,
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  submitButton: {
    backgroundColor: Colors.faithGold,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 60,
    alignItems: 'center',
  },
  submitButtonDisabled: {
    backgroundColor: 'rgba(255, 215, 0, 0.3)',
  },
  submitButtonText: {
    ...Typography.interSemiBold,
    fontSize: 13,
    color: Colors.darkBackground,
  },
  responseContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.08)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.2)',
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  responseTitle: {
    ...Typography.interSemiBold,
    fontSize: 14,
    color: Colors.faithGold,
    marginLeft: 8,
  },
  responseText: {
    ...Typography.interRegular,
    fontSize: 14,
    lineHeight: 20,
    color: Colors.hopeWhite,
    marginBottom: 12,
  },
  clearResponseButton: {
    alignSelf: 'flex-end',
    paddingVertical: 6,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 6,
  },
  clearResponseButtonText: {
    ...Typography.interRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  accessRequiredContainer: {
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 8,
    alignItems: 'center',
  },
  accessRequiredText: {
    ...Typography.interRegular,
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 12,
  },
  upgradeButton: {
    backgroundColor: Colors.faithGold,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  upgradeButtonText: {
    ...Typography.interSemiBold,
    fontSize: 13,
    color: Colors.darkBackground,
  },
  // Chat styles
  chatContainer: {
    marginTop: 12,
    backgroundColor: 'rgba(255, 215, 0, 0.05)',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 215, 0, 0.15)',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  chatTitle: {
    ...Typography.interSemiBold,
    fontSize: 14,
    color: Colors.faithGold,
    marginLeft: 8,
    flex: 1,
  },
  clearChatButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  clearChatText: {
    ...Typography.interRegular,
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.6)',
  },
  chatEntry: {
    marginBottom: 12,
  },
  questionBubble: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    padding: 10,
    borderRadius: 8,
    marginBottom: 6,
    alignSelf: 'flex-end',
    maxWidth: '80%',
  },
  questionText: {
    ...Typography.interRegular,
    fontSize: 13,
    color: Colors.hopeWhite,
  },
  timestampText: {
    ...Typography.interRegular,
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.5)',
    marginTop: 4,
    textAlign: 'right',
  },
  answerBubble: {
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    padding: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
    maxWidth: '85%',
  },
  answerText: {
    ...Typography.interRegular,
    fontSize: 13,
    lineHeight: 18,
    color: Colors.hopeWhite,
  },
  bookmarkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 215, 0, 0.1)',
    borderColor: Colors.faithGold,
    borderWidth: 1,
  },
  bookmarkButtonText: {
    color: Colors.faithGold,
    marginLeft: 4,
  },
});
