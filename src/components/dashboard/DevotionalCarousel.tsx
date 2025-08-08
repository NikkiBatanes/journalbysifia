/**
 * DevotionalCarousel.tsx
 * Displays user's devotionals in a horizontal carousel with completion status
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
const CARD_WIDTH = width * 0.75;
const CARD_MARGIN = 12;

interface Devotional {
  id: string;
  title: string;
  description?: string;
  content: any;
  isCompleted: boolean;
  completedAt?: string;
  lastAccessed?: string;
  estimatedDuration?: number; // in minutes
  category?: string;
  verse?: {
    text: string;
    reference: string;
  } | null;
  tags?: string[];
}

// Fallback data for when database is empty


interface DevotionalCarouselProps {
  onDevotionalPress?: (devotional: Devotional) => void;
  onViewAll?: () => void;
}



const DevotionalCarousel: React.FC<DevotionalCarouselProps> = ({
  onDevotionalPress,
  onViewAll,
}) => {
  const { user } = useAuth();
  const [devotionals, setDevotionals] = useState<Devotional[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDevotionals = async () => {
    if (!user) {return;}

    try {
      setLoading(true);
      setError(null);

      // Fetch devotionals
      const { data: devotionalsData, error: devotionalsError } = await supabase
        .from('devotionals')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(10);

      if (devotionalsError) {
        console.error('Error fetching devotionals:', devotionalsError);
        return;
      }

      // Fetch completion data for each devotional
      const devotionalsWithStatus = await Promise.all(
        devotionalsData.map(async (devotional) => {
          try {
            // Get user progress for this devotional
            const { data: progressData } = await supabase
              .from('user_progress')
              .select('*')
              .eq('user_id', user.id)
              .eq('content_type', 'devotional')
              .eq('content_id', devotional.id)
              .single();

            // Parse devotional content
            let verse = null;
            let estimatedDuration = 5; // default 5 minutes

            try {
              const content = devotional.content
                ? (typeof devotional.content === 'string'
                    ? JSON.parse(devotional.content)
                    : devotional.content)
                : null;

              // Extract verse information
              if (content && content.verse) {
                verse = {
                  text: content.verse.text || content.verse,
                  reference: content.verse.reference || 'Scripture',
                };
              }

              // Estimate duration based on content length
              if (content && (content.reflection || content.content)) {
                const textLength = (content.reflection || content.content).length;
                estimatedDuration = Math.max(3, Math.ceil(textLength / 200)); // ~200 chars per minute reading
              }
            } catch (parseError) {
              console.warn('Error parsing devotional content:', parseError);
            }

            // Check completion status
            let isCompleted = false;
            let completedAt = null;
            let lastAccessed = null;

            if (progressData && progressData.progress_data) {
              try {
                const progress = typeof progressData.progress_data === 'string'
                  ? JSON.parse(progressData.progress_data)
                  : progressData.progress_data;

                isCompleted = progress.completed || false;
                completedAt = progress.completedAt;
                lastAccessed = progressData.updated_at;
              } catch (parseError) {
                console.warn('Error parsing progress data:', parseError);
              }
            }

            return {
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted,
              completedAt,
              lastAccessed,
              estimatedDuration,
              category: devotional.category || 'Daily Devotion',
              verse,
            };
          } catch (err) {
            console.warn('Error processing devotional:', err);
            return {
              id: devotional.id,
              title: devotional.title,
              description: devotional.description,
              content: devotional.content,
              isCompleted: false,
              estimatedDuration: 5,
              category: 'Daily Devotion',
            };
          }
        })
      );

      // Sort: incomplete first, then by last accessed/updated
      const sortedDevotionals = devotionalsWithStatus.sort((a, b) => {
        if (a.isCompleted !== b.isCompleted) {
          return a.isCompleted ? 1 : -1; // incomplete first
        }
        const aDate = new Date(a.lastAccessed || a.completedAt || 0);
        const bDate = new Date(b.lastAccessed || b.completedAt || 0);
        return bDate.getTime() - aDate.getTime(); // most recent first
      });

      setDevotionals(sortedDevotionals);

    } catch (err) {
      console.error('Error fetching devotionals:', err);
      setError('Unable to load devotionals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevotionals();
  }, [user]);

  const getStatusColor = (isCompleted: boolean) => {
    return isCompleted ? Colors.successGreen : Colors.devotionalPurple;
  };

  const getStatusIcon = (isCompleted: boolean) => {
    return isCompleted ? 'checkmark-circle' : 'time-outline';
  };

  const getStatusText = (devotional: Devotional) => {
    if (devotional.isCompleted) {
      return devotional.completedAt
        ? `Completed ${new Date(devotional.completedAt).toLocaleDateString()}`
        : 'Completed';
    }
    return `${devotional.estimatedDuration} min read`;
  };

  const renderDevotionalCard = (devotional: Devotional, index: number) => (
    <TouchableOpacity
      key={devotional.id}
      style={[
        styles.devotionalCard,
        {
          marginLeft: index === 0 ? 16 : CARD_MARGIN,
          opacity: devotional.isCompleted ? 0.8 : 1,
        },
      ]}
      onPress={() => onDevotionalPress?.(devotional)}
      activeOpacity={0.8}
    >
      <View style={styles.cardHeader}>
        <View style={styles.categoryBadge}>
          <Text style={styles.categoryText}>{devotional.category}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(devotional.isCompleted) }]}>
          <Ionicons
            name={getStatusIcon(devotional.isCompleted)}
            size={12}
            color={Colors.hopeWhite}
          />
        </View>
      </View>

      <Text style={styles.devotionalTitle} numberOfLines={2}>
        {devotional.title}
      </Text>

      {devotional.verse && (
        <View style={styles.versePreview}>
          <Text style={styles.verseText} numberOfLines={2}>
            "{devotional.verse.text}"
          </Text>
          <Text style={styles.verseReference}>- {devotional.verse.reference}</Text>
        </View>
      )}

      {devotional.description && (
        <Text style={styles.devotionalDescription} numberOfLines={2}>
          {devotional.description}
        </Text>
      )}

      <View style={styles.statusSection}>
        <View style={styles.statusInfo}>
          <Ionicons
            name={getStatusIcon(devotional.isCompleted)}
            size={16}
            color={getStatusColor(devotional.isCompleted)}
          />
          <Text style={[styles.statusText, { color: getStatusColor(devotional.isCompleted) }]}>
            {getStatusText(devotional)}
          </Text>
        </View>

        {devotional.lastAccessed && !devotional.isCompleted && (
          <Text style={styles.lastAccessedText}>
            Last read: {new Date(devotional.lastAccessed).toLocaleDateString()}
          </Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <Ionicons name="book-outline" size={48} color={Colors.lightGray} />
      <Text style={styles.emptyTitle}>No Devotionals Yet</Text>
      <Text style={styles.emptyDescription}>
        Start your daily devotional practice with inspiring content
      </Text>
      <TouchableOpacity style={styles.createButton} onPress={onViewAll}>
        <Text style={styles.createButtonText}>Explore Devotionals</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <Ionicons name="book" size={24} color={Colors.alertCoral} />
          <Text style={styles.title}>Daily Devotionals</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.alertCoral} />
          <Text style={styles.loadingText}>Loading devotionals...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Ionicons name="book" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Daily Devotionals</Text>
        {devotionals.length > 0 && (
          <TouchableOpacity onPress={onViewAll} style={styles.viewAllButton}>
            <Text style={styles.viewAllText}>View All</Text>
            <Ionicons name="chevron-forward" size={16} color={Colors.alertCoral} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={fetchDevotionals} style={styles.retryButton}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : devotionals.length === 0 ? (
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
          {devotionals.map(renderDevotionalCard)}
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
  devotionalCard: {
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
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  devotionalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 12,
    lineHeight: 22,
  },
  versePreview: {
    backgroundColor: Colors.lightPurple,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  verseText: {
    fontSize: 13,
    color: Colors.darkerGray,
    fontStyle: 'italic',
    lineHeight: 18,
    marginBottom: 4,
  },
  verseReference: {
    fontSize: 11,
    color: Colors.alertCoral,
    fontWeight: '600',
    textAlign: 'right',
  },
  devotionalDescription: {
    fontSize: 14,
    color: Colors.mediumGray,
    lineHeight: 20,
    marginBottom: 16,
  },
  statusSection: {
    gap: 4,
  },
  statusInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusText: {
    fontSize: 12,
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

export default DevotionalCarousel;
