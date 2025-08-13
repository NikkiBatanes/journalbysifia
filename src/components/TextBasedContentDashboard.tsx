/**
 * Phase 4 Revised: Text-Based Content Dashboard
 * Simplified for current app capabilities - text content only
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { TextBasedContentCuration, TextContentItem, TextContentRecommendation } from '../services/textBasedContentCuration';
import { SpiritualProfile } from '../interfaces/spiritualProfile';
import { ConversationThread } from '../interfaces/conversationTypes';

interface TextBasedContentDashboardProps {
  userId: string;
  spiritualProfile: SpiritualProfile;
  recentConversations: ConversationThread[];
  onContentEngagement: (contentId: string, feedback: any) => void;
}

export const TextBasedContentDashboard: React.FC<TextBasedContentDashboardProps> = ({
  userId,
  spiritualProfile,
  recentConversations,
  onContentEngagement,
}) => {
  const [recommendations, setRecommendations] = useState<TextContentRecommendation[]>([]);
  const [selectedContent, setSelectedContent] = useState<TextContentItem | null>(null);
  const [showContentModal, setShowContentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [readingProgress, setReadingProgress] = useState(0);

  const contentCuration = new TextBasedContentCuration();

  useEffect(() => {
    loadRecommendations();
  }, [userId, spiritualProfile, recentConversations]);

  const loadRecommendations = async () => {
    setIsLoading(true);
    try {
      const newRecommendations = await contentCuration.generateTextRecommendations(
        userId,
        spiritualProfile,
        recentConversations
      );
      setRecommendations(newRecommendations);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      Alert.alert('Error', 'Unable to load content recommendations');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRecommendations();
    setRefreshing(false);
  };

  const handleContentSelect = (contentItem: TextContentItem) => {
    setSelectedContent(contentItem);
    setShowContentModal(true);
    setReadingProgress(0);
  };

  const handleContentComplete = () => {
    if (selectedContent) {
      const feedback = {
        helpful: true,
        completionRate: readingProgress,
        timeSpent: 300, // 5 minutes average
      };
      onContentEngagement(selectedContent.id, feedback);
    }
    setShowContentModal(false);
    setSelectedContent(null);
  };

  const generateQuickContent = async (type: 'devotional' | 'exercise' | 'scripture') => {
    setIsLoading(true);
    try {
      let content: TextContentItem;

      switch (type) {
        case 'devotional':
          content = await contentCuration.generatePersonalizedDevotional(
            spiritualProfile,
            recentConversations
          );
          break;
        case 'exercise':
          content = await contentCuration.generateTextBasedExercise(
            'prayer',
            'seeking',
            10,
            spiritualProfile
          );
          break;
        case 'scripture':
          content = await contentCuration.generateContextualScriptureStudy(
            spiritualProfile,
            recentConversations
          );
          break;
      }

      handleContentSelect(content);
    } catch (error) {
      console.error('Error generating content:', error);
      Alert.alert('Error', 'Unable to generate content');
    } finally {
      setIsLoading(false);
    }
  };

  const renderRecommendationCard = (recommendation: TextContentRecommendation, index: number) => {
    const { contentItem, relevanceScore, reasoning, personalizedElements } = recommendation;

    return (
      <TouchableOpacity
        key={contentItem.id}
        style={[styles.recommendationCard, index === 0 && styles.topRecommendation]}
        onPress={() => handleContentSelect(contentItem)}
      >
        <View style={styles.cardHeader}>
          <View style={styles.contentTypeIcon}>
            <Ionicons
              name={getContentTypeIcon(contentItem.type)}
              size={20}
              color="#D4AF37"
            />
          </View>
          <View style={styles.cardHeaderText}>
            <Text style={styles.contentTitle}>{contentItem.title}</Text>
            <Text style={styles.contentMeta}>
              {contentItem.metadata.readingTime} min read • {contentItem.metadata.difficulty}
            </Text>
          </View>
          <View style={styles.relevanceScore}>
            <Text style={styles.scoreText}>{Math.round(relevanceScore)}%</Text>
          </View>
        </View>

        <Text style={styles.personalizedIntro} numberOfLines={2}>
          {personalizedElements.customizedIntro}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.themes}>
            {contentItem.metadata.spiritualThemes.slice(0, 2).map((theme, idx) => (
              <View key={idx} style={styles.themeTag}>
                <Text style={styles.themeText}>{theme}</Text>
              </View>
            ))}
          </View>
        </View>

        <Text style={styles.reasoning}>{reasoning}</Text>
      </TouchableOpacity>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => generateQuickContent('devotional')}
        disabled={isLoading}
      >
        <Ionicons name="book-outline" size={20} color="#D4AF37" />
        <Text style={styles.quickActionText}>Daily Devotional</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => generateQuickContent('exercise')}
        disabled={isLoading}
      >
        <Ionicons name="heart-outline" size={20} color="#D4AF37" />
        <Text style={styles.quickActionText}>Spiritual Exercise</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.quickActionButton}
        onPress={() => generateQuickContent('scripture')}
        disabled={isLoading}
      >
        <Ionicons name="library-outline" size={20} color="#D4AF37" />
        <Text style={styles.quickActionText}>Scripture Study</Text>
      </TouchableOpacity>
    </View>
  );

  const renderContentModal = () => {
    if (!selectedContent) {return null;}

    return (
      <Modal visible={showContentModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowContentModal(false)} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#333" />
            </TouchableOpacity>
            <View style={styles.modalHeaderContent}>
              <Text style={styles.modalHeaderTitle}>{selectedContent.title}</Text>
              <Text style={styles.modalHeaderSubtitle}>
                {selectedContent.metadata.readingTime} min read
              </Text>
            </View>
            <TouchableOpacity onPress={handleContentComplete} style={styles.completeButton}>
              <Ionicons name="checkmark" size={24} color="#D4AF37" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent} showsVerticalScrollIndicator={false}>
            {/* Main Content */}
            <Text style={styles.contentText}>{selectedContent.content}</Text>

            {/* Scripture References */}
            {selectedContent.metadata.scriptureReferences.length > 0 && (
              <View style={styles.scriptureSection}>
                <Text style={styles.sectionTitle}>Scripture References</Text>
                {selectedContent.metadata.scriptureReferences.map((ref, index) => (
                  <Text key={index} style={styles.scriptureText}>• {ref}</Text>
                ))}
              </View>
            )}

            {/* Interactive Elements */}
            {selectedContent.interactiveElements && (
              <>
                {/* Reflection Questions */}
                {selectedContent.interactiveElements.reflectionQuestions.length > 0 && (
                  <View style={styles.interactiveSection}>
                    <Text style={styles.sectionTitle}>Reflection Questions</Text>
                    {selectedContent.interactiveElements.reflectionQuestions.map((question, index) => (
                      <Text key={index} style={styles.questionText}>
                        {index + 1}. {question}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Prayer Points */}
                {selectedContent.interactiveElements.prayerPoints.length > 0 && (
                  <View style={styles.interactiveSection}>
                    <Text style={styles.sectionTitle}>Prayer Points</Text>
                    {selectedContent.interactiveElements.prayerPoints.map((point, index) => (
                      <Text key={index} style={styles.prayerText}>• {point}</Text>
                    ))}
                  </View>
                )}

                {/* Practical Steps */}
                {selectedContent.interactiveElements.practicalSteps.length > 0 && (
                  <View style={styles.interactiveSection}>
                    <Text style={styles.sectionTitle}>Practical Steps</Text>
                    {selectedContent.interactiveElements.practicalSteps.map((step, index) => (
                      <Text key={index} style={styles.stepText}>
                        {index + 1}. {step}
                      </Text>
                    ))}
                  </View>
                )}

                {/* Journaling Prompts */}
                {selectedContent.interactiveElements.journalingPrompts.length > 0 && (
                  <View style={styles.interactiveSection}>
                    <Text style={styles.sectionTitle}>Journaling Prompts</Text>
                    {selectedContent.interactiveElements.journalingPrompts.map((prompt, index) => (
                      <Text key={index} style={styles.promptText}>• {prompt}</Text>
                    ))}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </Modal>
    );
  };

  const getContentTypeIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      'devotional': 'book-outline',
      'scripture_study': 'library-outline',
      'reflection_prompt': 'heart-outline',
      'prayer_guide': 'chatbubble-outline',
      'spiritual_insight': 'bulb-outline',
    };
    return iconMap[type] || 'document-text-outline';
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Spiritual Content</Text>
          <Text style={styles.headerSubtitle}>
            Personalized text-based content for your journey
          </Text>
        </View>

        {/* Quick Actions */}
        {renderQuickActions()}

        {/* Recommendations */}
        <View style={styles.recommendationsSection}>
          <Text style={styles.sectionTitle}>Recommended for You</Text>
          {isLoading ? (
            <View style={styles.loadingContainer}>
              <Text style={styles.loadingText}>Finding perfect content for you...</Text>
            </View>
          ) : (
            recommendations.map((recommendation, index) =>
              renderRecommendationCard(recommendation, index)
            )
          )}
        </View>
      </ScrollView>

      {/* Content Modal */}
      {renderContentModal()}
    </View>
  );
};

const styles = {
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#fff',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold' as const,
    color: '#333',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#666',
  },
  quickActions: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    marginVertical: 20,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'column' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  quickActionText: {
    fontSize: 12,
    color: '#333',
    fontWeight: '500' as const,
    textAlign: 'center' as const,
  },
  recommendationsSection: {
    paddingHorizontal: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 40,
    alignItems: 'center' as const,
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center' as const,
  },
  recommendationCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  topRecommendation: {
    borderWidth: 2,
    borderColor: '#D4AF37',
  },
  cardHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  contentTypeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f8ff',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    marginRight: 12,
  },
  cardHeaderText: {
    flex: 1,
  },
  contentTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 2,
  },
  contentMeta: {
    fontSize: 12,
    color: '#666',
  },
  relevanceScore: {
    backgroundColor: '#D4AF37',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600' as const,
  },
  personalizedIntro: {
    fontSize: 14,
    color: '#555',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardFooter: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    marginBottom: 8,
  },
  themes: {
    flexDirection: 'row' as const,
    gap: 6,
  },
  themeTag: {
    backgroundColor: '#f0f0f0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  themeText: {
    fontSize: 11,
    color: '#666',
  },
  reasoning: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic' as const,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'space-between' as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e1e5e9',
    paddingTop: 50,
  },
  closeButton: {
    padding: 8,
  },
  modalHeaderContent: {
    flex: 1,
    alignItems: 'center' as const,
  },
  modalHeaderTitle: {
    fontSize: 16,
    fontWeight: '600' as const,
    color: '#333',
    textAlign: 'center' as const,
  },
  modalHeaderSubtitle: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  completeButton: {
    padding: 8,
  },
  modalContent: {
    flex: 1,
    padding: 20,
  },
  contentText: {
    fontSize: 16,
    lineHeight: 24,
    color: '#333',
    marginBottom: 24,
  },
  scriptureSection: {
    backgroundColor: '#f0f8ff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#D4AF37',
  },
  scriptureText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  interactiveSection: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  questionText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 20,
  },
  prayerText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
  },
  stepText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 8,
    lineHeight: 20,
  },
  promptText: {
    fontSize: 14,
    color: '#555',
    marginBottom: 4,
    fontStyle: 'italic' as const,
  },
};
