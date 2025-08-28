/**
 * Phase 4: Smart Content Recommendation Dashboard
 * Displays personalized content recommendations with intelligent timing
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IntelligentContentCuration } from '../services/intelligentContentCuration';
import { MultiModalContentPlayer } from './MultiModalContentPlayer';
import {
  ContentRecommendation,
  ContentItem,
  LearningPath,
} from '../interfaces/contentCurationTypes';
import { SpiritualProfile } from '../interfaces/spiritualProfile';
import { ConversationThread } from '../interfaces/conversationTypes';

interface SmartContentDashboardProps {
  userId: string;
  spiritualProfile: SpiritualProfile;
  recentConversations: ConversationThread[];
  onContentEngagement: (contentId: string, feedback: any) => void;
}

export const SmartContentDashboard: React.FC<SmartContentDashboardProps> = ({
  userId,
  spiritualProfile,
  recentConversations,
  onContentEngagement,
}) => {
  const [recommendations, setRecommendations] = useState<ContentRecommendation[]>([]);
  const [learningPath, setLearningPath] = useState<LearningPath | null>(null);
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [showContentPlayer, setShowContentPlayer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const contentCuration = useMemo(() => new IntelligentContentCuration(), []);

  const loadRecommendations = useCallback(async () => {
    setIsLoading(true);
    try {
      const newRecommendations = await contentCuration.generateRecommendations(
        userId,
        spiritualProfile,
        recentConversations
      );
      setRecommendations(newRecommendations);

      // Generate learning path based on recommendations
      const path = await contentCuration.generateLearningPath(
        userId,
        spiritualProfile,
        newRecommendations
      );
      setLearningPath(path);
    } catch (error) {
      console.error('Error loading recommendations:', error);
      Alert.alert('Error', 'Failed to load content recommendations');
    } finally {
      setIsLoading(false);
    }
  }, [userId, spiritualProfile, recentConversations, contentCuration]);

  useEffect(() => {
    loadRecommendations();
  }, [loadRecommendations]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadRecommendations();
    setRefreshing(false);
  };

  const handleContentSelect = (contentItem: ContentItem) => {
    setSelectedContent(contentItem);
    setShowContentPlayer(true);
  };

  const handleContentComplete = (feedback: any) => {
    if (selectedContent) {
      onContentEngagement(selectedContent.id, feedback);
    }
    setShowContentPlayer(false);
    setSelectedContent(null);
  };

  const createLearningPath = async () => {
    try {
      const focusAreas = spiritualProfile.currentStruggles || ['faith', 'prayer'];
      const newPath = await contentCuration.createAdaptiveLearningPath(
        userId,
        spiritualProfile,
        focusAreas,
        'moderate'
      );
      setLearningPath(newPath);
      Alert.alert('Success', 'Your personalized learning path has been created!');
    } catch (error) {
      console.error('Error creating learning path:', error);
      Alert.alert('Error', 'Unable to create learning path');
    }
  };

  const generateInteractiveExercise = async () => {
    try {
      const dominantTheme = recentConversations[0]?.insights.keyThemes[0] || 'prayer';
      const emotionalState = 'seeking'; // Could be detected from recent conversations

      const exercise = await contentCuration.generateInteractiveExercise(
        dominantTheme,
        emotionalState,
        10, // 10 minutes
        spiritualProfile
      );

      handleContentSelect(exercise);
    } catch (error) {
      console.error('Error generating exercise:', error);
      Alert.alert('Error', 'Unable to generate interactive exercise');
    }
  };

  const renderRecommendationCard = (recommendation: ContentRecommendation, index: number) => {
    const { contentItem, relevanceScore, reasoning, optimalTiming } = recommendation;

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
              {contentItem.metadata.duration} min • {contentItem.metadata.difficulty}
            </Text>
          </View>
          <View style={styles.relevanceScore}>
            <Text style={styles.scoreText}>{Math.round(relevanceScore)}%</Text>
          </View>
        </View>

        <Text style={styles.contentDescription} numberOfLines={2}>
          {contentItem.content}
        </Text>

        <View style={styles.cardFooter}>
          <View style={styles.themes}>
            {contentItem.metadata.spiritualThemes.slice(0, 2).map((theme, idx) => (
              <View key={idx} style={styles.themeTag}>
                <Text style={styles.themeText}>{theme}</Text>
              </View>
            ))}
          </View>

          <View style={styles.timing}>
            <Ionicons name="time-outline" size={12} color="#666" />
            <Text style={styles.timingText}>{optimalTiming.preferredTime}</Text>
          </View>
        </View>

        <Text style={styles.reasoning}>{reasoning}</Text>
      </TouchableOpacity>
    );
  };

  const renderLearningPathCard = () => {
    if (!learningPath) {
      return (
        <TouchableOpacity style={styles.learningPathPrompt} onPress={createLearningPath}>
          <Ionicons name="map-outline" size={24} color="#D4AF37" />
          <Text style={styles.learningPathTitle}>Create Your Learning Path</Text>
          <Text style={styles.learningPathDescription}>
            Get a personalized spiritual growth journey tailored to your needs
          </Text>
        </TouchableOpacity>
      );
    }

    return (
      <View style={styles.learningPathCard}>
        <View style={styles.learningPathHeader}>
          <Ionicons name="map" size={24} color="#D4AF37" />
          <View style={styles.learningPathInfo}>
            <Text style={styles.learningPathTitle}>{learningPath.title}</Text>
            <Text style={styles.learningPathProgress}>
              Stage {learningPath.currentStage} of {learningPath.totalStages}
            </Text>
          </View>
        </View>

        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${(learningPath.currentStage / learningPath.totalStages) * 100}%` },
            ]}
          />
        </View>

        <Text style={styles.learningPathDescription}>
          {learningPath.description}
        </Text>
      </View>
    );
  };

  const renderQuickActions = () => (
    <View style={styles.quickActions}>
      <TouchableOpacity style={styles.quickActionButton} onPress={generateInteractiveExercise}>
        <Ionicons name="fitness-outline" size={20} color="#D4AF37" />
        <Text style={styles.quickActionText}>Quick Exercise</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.quickActionButton} onPress={handleRefresh}>
        <Ionicons name="refresh-outline" size={20} color="#D4AF37" />
        <Text style={styles.quickActionText}>Refresh</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.quickActionButton}>
        <Ionicons name="analytics-outline" size={20} color="#D4AF37" />
        <Text style={styles.quickActionText}>Insights</Text>
      </TouchableOpacity>
    </View>
  );

  const getContentTypeIcon = (type: string): string => {
    const iconMap: Record<string, string> = {
      'text': 'document-text-outline',
      'audio': 'headset-outline',
      'video': 'play-circle-outline',
      'interactive': 'fitness-outline',
      'scripture': 'book-outline',
      'prayer': 'heart-outline',
    };
    return iconMap[type] || 'document-outline';
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
          <Text style={styles.headerTitle}>Your Spiritual Content</Text>
          <Text style={styles.headerSubtitle}>
            Personalized recommendations based on your journey
          </Text>
        </View>

        {/* Learning Path */}
        {renderLearningPathCard()}

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

      {/* Content Player Modal */}
      {selectedContent && (
        <MultiModalContentPlayer
          visible={showContentPlayer}
          onClose={() => setShowContentPlayer(false)}
          contentItem={selectedContent}
          onComplete={handleContentComplete}
          onProgress={() => {}} // Progress tracking handled internally
        />
      )}
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
  learningPathPrompt: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    alignItems: 'center' as const,
    borderWidth: 2,
    borderColor: '#D4AF37',
    borderStyle: 'dashed' as const,
  },
  learningPathCard: {
    margin: 20,
    padding: 20,
    backgroundColor: '#fff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  learningPathHeader: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    marginBottom: 12,
  },
  learningPathInfo: {
    marginLeft: 12,
    flex: 1,
  },
  learningPathTitle: {
    fontSize: 18,
    fontWeight: '600' as const,
    color: '#333',
    marginBottom: 4,
  },
  learningPathProgress: {
    fontSize: 14,
    color: '#666',
  },
  learningPathDescription: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#e0e0e0',
    borderRadius: 2,
    marginVertical: 12,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#D4AF37',
    borderRadius: 2,
  },
  quickActions: {
    flexDirection: 'row' as const,
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  quickActionButton: {
    flex: 1,
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    gap: 8,
  },
  quickActionText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500' as const,
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
  contentDescription: {
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
  timing: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: 4,
  },
  timingText: {
    fontSize: 11,
    color: '#666',
  },
  reasoning: {
    fontSize: 12,
    color: '#888',
    fontStyle: 'italic' as const,
  },
};
