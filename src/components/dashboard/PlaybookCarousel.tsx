/**
 * PlaybookCarousel.tsx
 * Displays user's playbooks in a horizontal carousel with progress indicators
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = width * 0.7;
const CARD_MARGIN = 12;

interface Playbook {
  id: string;
  title: string;
  description?: string;
  content?: any;
  progress: number; // 0-100
  totalSteps: number;
  completedSteps: number;
  lastAccessed?: string;
  category?: string;
  estimatedTime?: string;
  difficulty?: string;
  tags?: string[];
}

interface PlaybookCarouselProps {
  onPlaybookPress?: (playbook: Playbook) => void;
  onViewAll?: () => void;
}



const PlaybookCarousel: React.FC<PlaybookCarouselProps> = ({
  onPlaybookPress,
  onViewAll,
}) => {
  const { user } = useAuth();
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlaybooks = async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Fetch playbooks
      const { data: playbooksData, error: playbooksError } = await supabase
        .from('playbooks')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (playbooksError) {
        console.error('Error fetching playbooks:', playbooksError);
        return;
      }

      // Fetch progress data for each playbook
      const playbooksWithProgress = await Promise.all(
        playbooksData.map(async (playbook) => {
          try {
            // Get user progress for this playbook
            const { data: progressData } = await supabase
              .from('user_progress')
              .select('*')
              .eq('user_id', user.id)
              .eq('content_type', 'playbook')
              .eq('content_id', playbook.id)
              .single();

            // Parse playbook content to get total steps
            let totalSteps = 0;
            let completedSteps = 0;

            try {
              const content = playbook.content
                ? (typeof playbook.content === 'string'
                    ? JSON.parse(playbook.content)
                    : playbook.content)
                : null;

              if (content && content.actionSteps && Array.isArray(content.actionSteps)) {
                totalSteps = content.actionSteps.length;
              } else if (content && content.steps && Array.isArray(content.steps)) {
                totalSteps = content.steps.length;
              } else if (content && content.sections && Array.isArray(content.sections)) {
                totalSteps = content.sections.length;
              } else {
                totalSteps = 1; // Default to 1 if structure is unclear
              }
            } catch (parseError) {
              console.warn('Error parsing playbook content:', parseError);
              totalSteps = 1;
            }

            // Calculate completed steps from progress data
            if (progressData && progressData.progress_data) {
              try {
                const progress = typeof progressData.progress_data === 'string'
                  ? JSON.parse(progressData.progress_data)
                  : progressData.progress_data;

                completedSteps = progress.completedSteps || 0;
              } catch (parseError) {
                completedSteps = 0;
              }
            }

            const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

            return {
              id: playbook.id,
              title: playbook.title,
              description: playbook.description,
              content: playbook.content,
              progress: progressPercentage,
              totalSteps,
              completedSteps,
              lastAccessed: progressData?.updated_at,
              category: playbook.category || 'Personal Growth',
            };
          } catch (err) {
            console.warn('Error processing playbook:', err);
            return {
              id: playbook.id,
              title: playbook.title,
              description: playbook.description,
              content: playbook.content,
              progress: 0,
              totalSteps: 1,
              completedSteps: 0,
              category: 'Personal Growth',
            };
          }
        })
      );

      setPlaybooks(playbooksWithProgress);

    } catch (err) {
      console.error('Error fetching playbooks:', err);
      setError('Unable to load playbooks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlaybooks();
  }, [user]);

  const getProgressColor = (progress: number) => {
    if (progress === 0) {return Colors.lightGray;}
    if (progress < 30) {return Colors.error;}
    if (progress < 70) {return Colors.faithGold;}
    return Colors.successGreen;
  };

  const getProgressText = (progress: number) => {
    if (progress === 0) {return 'Not Started';}
    if (progress === 100) {return 'Complete';}
    return `${progress}% Complete`;
  };

  const renderPlaybookCard = (playbook: Playbook, index: number) => (
    <TouchableOpacity
      key={playbook.id}
      style={[
        styles.playbookCard,
        { marginLeft: index === 0 ? 16 : CARD_MARGIN },
      ]}
      onPress={() => onPlaybookPress?.(playbook)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{playbook.category}</Text>
        </View>
        <View style={[styles.progressBadge, { backgroundColor: getProgressColor(playbook.progress) }]}>
          <Text style={styles.progressBadgeText}>{playbook.progress}%</Text>
        </View>
      </View>

      <Text style={styles.playbookTitle} numberOfLines={2}>
        {playbook.title}
      </Text>

      {playbook.description && (
        <Text style={styles.playbookDescription} numberOfLines={3}>
          {playbook.description}
        </Text>
      )}

      <View style={styles.progressSection}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              {
                width: `${playbook.progress}%`,
                backgroundColor: getProgressColor(playbook.progress),
              },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {getProgressText(playbook.progress)}
        </Text>
      </View>

      <View style={styles.stepInfo}>
        <Text style={styles.stepText}>
          {playbook.completedSteps} of {playbook.totalSteps} steps
        </Text>
        {playbook.lastAccessed && (
          <Text style={styles.lastAccessedText}>
            Last accessed: {new Date(playbook.lastAccessed).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="library-outline" size={48} color={Colors.lightGray} />
      <Text style={styles.emptyTitle}>No Playbooks Yet</Text>
      <Text style={styles.emptyDescription}>
        Create your first playbook to start your spiritual journey
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={onViewAll}>
        <Text style={styles.createButtonText}>Explore Playbooks</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="library" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Your Playbooks</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.alertCoral} />
          <Text style={styles.loadingText}>Loading playbooks...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="library" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Your Playbooks</Text>
        {playbooks.length > 0 && (
          <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.alertCoral} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchPlaybooks} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : playbooks.length === 0 ? (
        renderEmptyState()
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContainer}
          decelerationRate="fast"
          snapToInterval={CARD_WIDTH + CARD_MARGIN}
          snapToAlignment="start"
        >
          {playbooks.map(renderPlaybookCard)}
          <View style={styles.scrollPadding} />
        </ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
  },
  viewAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.alertCoral,
    fontWeight: '500',
  },
  scrollContainer: {
    paddingRight: 16,
  },
  scrollPadding: {
    width: 16,
  },
  playbookCard: {
    width: CARD_WIDTH,
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    padding: 16,
    marginRight: CARD_MARGIN,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    backgroundColor: Colors.lightGray,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 10,
    color: Colors.mediumGray,
    fontWeight: '500',
    textTransform: 'uppercase',
  },
  progressBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  progressBadgeText: {
    fontSize: 10,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  playbookTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
    lineHeight: 22,
  },
  playbookDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  progressSection: {
    marginBottom: 12,
  },
  progressBar: {
    height: 6,
    backgroundColor: Colors.lightGray,
    borderRadius: 3,
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    color: Colors.mediumGray,
    fontWeight: '500',
  },
  stepInfo: {
    gap: 2,
  },
  stepText: {
    fontSize: 12,
    color: Colors.hopeWhite,
    fontWeight: '500',
  },
  lastAccessedText: {
    fontSize: 10,
    color: Colors.lightGray,
  },
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  loadingText: {
    fontSize: 14,
    color: Colors.mediumGray,
    fontStyle: 'italic',
  },
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
  },
  emptyDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
  },
  createButton: {
    backgroundColor: Colors.alertCoral,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
  errorContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  errorText: {
    fontSize: 14,
    color: Colors.error,
    textAlign: 'center',
  },
  retryButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: Colors.alertCoral,
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    fontWeight: '600',
  },
});

export default PlaybookCarousel;
