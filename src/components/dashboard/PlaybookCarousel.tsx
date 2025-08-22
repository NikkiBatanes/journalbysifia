/**
 * PlaybookCarousel.tsx
 * Displays user's playbooks in a horizontal carousel with progress indicators
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Animated,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';
import { useAuth } from '../../context/IndustryStandardAuthContext';
import { supabase } from '../../services/supabaseClient';
import { triggerLightHaptic } from '../../utils/haptics';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useFocusEffect, useNavigation } from '@react-navigation/native';

const { width } = Dimensions.get('window');
// Match onboarding carousel sizing
// Tighter spacing between cards
const ITEM_SPACING = 2;
// Make cards smaller for better balance
const ITEM_WIDTH = Math.round(width * 0.75);
const ITEM_SIZE = ITEM_WIDTH + ITEM_SPACING;
const SIDE_PADDING = Math.round((width - ITEM_WIDTH) / 2);

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
  const navigation = useNavigation<any>();
  const scrollX = useRef(new Animated.Value(0)).current;
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const playbookIdsRef = useRef<Set<string>>(new Set());
  const refetchTimeoutRef = useRef<any>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const fetchPlaybooks = useCallback(async () => {
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
            // Prefer authoritative counts from playbook_action_steps
            // Total steps
            const { count: totalStepsCount, error: totalErr } = await supabase
              .from('playbook_action_steps')
              .select('id', { count: 'exact', head: true })
              .eq('playbook_id', playbook.id);

            if (totalErr) { console.warn('Error counting total steps', totalErr); }

            // Completed steps
            const { count: completedStepsCount, error: completedErr } = await supabase
              .from('playbook_action_steps')
              .select('id', { count: 'exact', head: true })
              .eq('playbook_id', playbook.id)
              .eq('completed', true);

            if (completedErr) { console.warn('Error counting completed steps', completedErr); }

            let totalSteps = totalStepsCount ?? 0;
            let completedSteps = completedStepsCount ?? 0;

            // Fallback to parsing content if table has no rows
            if (totalSteps === 0) {
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
                  totalSteps = 1;
                }
              } catch (parseError) {
                console.warn('Error parsing playbook content:', parseError);
                totalSteps = 1;
              }
            }

            // Optionally read last accessed from user_progress if available
            let lastAccessed: string | undefined;
            try {
              const { data: progressData } = await supabase
                .from('user_progress')
                .select('*')
                .eq('user_id', user.id)
                .eq('content_type', 'playbook')
                .eq('content_id', playbook.id)
                .single();
              lastAccessed = progressData?.updated_at;
            } catch {}

            const progressPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

            return {
              id: playbook.id,
              title: playbook.title,
              description: playbook.description,
              content: playbook.content,
              progress: progressPercentage,
              totalSteps,
              completedSteps,
              lastAccessed,
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
      // Track current playbook IDs for realtime filtering
      playbookIdsRef.current = new Set(playbooksWithProgress.map((p) => p.id));

    } catch (err) {
      console.error('Error fetching playbooks:', err);
      setError('Unable to load playbooks');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  // Also refetch whenever the screen regains focus (returning from details)
  useFocusEffect(
    useCallback(() => {
      fetchPlaybooks();
      return () => {};
    }, [fetchPlaybooks])
  );

  // Debounced refetch to avoid rapid consecutive updates
  const scheduleRefetch = useCallback(() => {
    if (refetchTimeoutRef.current) {
      clearTimeout(refetchTimeoutRef.current);
    }
    refetchTimeoutRef.current = setTimeout(() => {
      fetchPlaybooks();
    }, 150);
  }, [fetchPlaybooks]);

  // Realtime subscription: update when playbook_action_steps or user_progress change
  useEffect(() => {
    // Skip if not logged in
    if (!user?.id) return;

    const channel = supabase.channel('dashboard-playbook-progress');

    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playbook_action_steps' },
      (payload: any) => {
        const affectedId = (payload.new?.playbook_id ?? payload.old?.playbook_id) as string | undefined;
        if (affectedId && playbookIdsRef.current.has(affectedId)) {
          scheduleRefetch();
        }
      }
    );

    // Some flows update progress in user_progress rather than toggling the step row
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'user_progress' },
      (payload: any) => {
        const contentType = payload.new?.content_type ?? payload.old?.content_type;
        const contentId = (payload.new?.content_id ?? payload.old?.content_id) as string | undefined;
        if ((contentType === 'playbook' || contentType === 'playbook_action_step') && contentId && playbookIdsRef.current.has(contentId)) {
          scheduleRefetch();
        }
      }
    );

    // Optional: also listen for playbooks updates (e.g., content changes)
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'playbooks' },
      (payload: any) => {
        const id = (payload.new?.id ?? payload.old?.id) as string | undefined;
        if (id && playbookIdsRef.current.has(id)) {
          scheduleRefetch();
        }
      }
    );

    channel.subscribe();
    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        try { channelRef.current.unsubscribe(); } catch {}
        channelRef.current = null;
      }
      if (refetchTimeoutRef.current) {
        clearTimeout(refetchTimeoutRef.current);
        refetchTimeoutRef.current = null;
      }
    };
  }, [user?.id, scheduleRefetch]);

  const getProgressColor = (progress: number) => {
    // Match empty progress bar background for 0%
    if (progress === 0) { return 'rgba(255, 255, 255, 0.16)'; }
    if (progress === 100) { return Colors.successGreen; }
    // Incomplete (1-99%) should be alert coral
    return Colors.alertCoral;
  };

  const getProgressText = (progress: number) => {
    if (progress === 0) {return 'Not started';}
    if (progress === 100) {return 'Complete';}
    return `${progress}% Complete`;
  };

  const renderPlaybookCard = (playbook: Playbook, index: number) => {
    const inputRange = [
      (index - 1) * ITEM_SIZE,
      index * ITEM_SIZE,
      (index + 1) * ITEM_SIZE,
    ];
    const scale = scrollX.interpolate({
      inputRange,
      outputRange: [0.94, 1, 0.94],
      extrapolate: 'clamp',
    });
    const opacity = scrollX.interpolate({
      inputRange,
      outputRange: [0.85, 1, 0.85],
      extrapolate: 'clamp',
    });
    const translateY = scrollX.interpolate({
      inputRange,
      outputRange: [8, 0, 8],
      extrapolate: 'clamp',
    });
    const zIndex = scrollX.interpolate({
      inputRange,
      outputRange: [0, 2, 0],
      extrapolate: 'clamp',
    });

    return (
    <TouchableOpacity
      key={playbook.id}
      style={styles.cardTouch}
      onPress={() => {
        triggerLightHaptic();
        onPlaybookPress?.(playbook);
      }}
      activeOpacity={0.85}
    >
      <Animated.View
        style={[
          styles.playbookCard,
          { width: ITEM_WIDTH, marginRight: ITEM_SPACING },
          // Shift only the first card left to reduce initial left spacing without breaking centering
          index === 0 ? { marginLeft: -(SIDE_PADDING - 16) } : null,
          { transform: [{ scale }, { translateY }], opacity, zIndex },
        ]}
      >
      <View style={styles.badgeContainer}>
        <View style={[styles.progressBadge, { backgroundColor: getProgressColor(playbook.progress) }]}>
          <Text style={styles.progressBadgeText}>{playbook.progress}%</Text>
        </View>
      </View>

      <Text style={styles.playbookTitle}>
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
        <Text
          style={[
            styles.progressText,
            {
              color:
                playbook.progress === 0
                  ? Colors.mediumGray
                  : playbook.progress === 100
                  ? Colors.successGreen
                  : Colors.alertCoral,
            },
          ]}
        >
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
      </Animated.View>
    </TouchableOpacity>
  );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <MaterialCommunityIcons
        name="clipboard-text-play"
        size={32}
        color="rgba(255,255,255,0.8)"
      />
      <Text style={styles.emptyTitle}>Create a New Playbook</Text>
      <Text style={styles.emptyDescription}>
        Share what you're going through in detail. The more context, the better we can help.
      </Text>
      <TouchableOpacity
        style={styles.createButton}
        onPress={() => {
          triggerLightHaptic();
          // Navigate to UserInput screen (configured as presentation modal in navigator)
          try { navigation.navigate('UserInput'); } catch {}
        }}
      >
        <Text style={styles.createButtonText}>Create a Playbook</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <MaterialCommunityIcons name="clipboard-text-play" size={24} color={Colors.alertCoral} />
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
        <MaterialCommunityIcons name="clipboard-text-play" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Your Playbooks</Text>
        {playbooks.length > 0 && (
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              onViewAll?.();
            }}
            style={styles.viewAllButton}
          >
            <Text style={styles.viewAllText}>VIEW ALL</Text>
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity
            onPress={() => {
              triggerLightHaptic();
              fetchPlaybooks();
            }}
            style={styles.retryButton}
          >
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : playbooks.length === 0 ? (
        renderEmptyState()
      ) : (
        <Animated.ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={[styles.scrollContainer, { paddingHorizontal: SIDE_PADDING }]}
          decelerationRate="fast"
          snapToInterval={ITEM_SIZE}
          snapToAlignment="center"
          onScroll={Animated.event(
            [{ nativeEvent: { contentOffset: { x: scrollX } } }],
            { useNativeDriver: true }
          )}
          scrollEventThrottle={16}
          bounces={false}
          removeClippedSubviews={false}
          style={{ overflow: 'visible' }}
        >
          {playbooks.map((pb, i) => renderPlaybookCard(pb, i))}
        </Animated.ScrollView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
    overflow: 'visible',
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
    fontSize: 11,
    color: Colors.alertCoral,
    fontWeight: '500',
  },
  scrollContainer: {
    paddingVertical: 4,
    overflow: 'visible',
  },
  playbookCard: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  cardTouch: {
    // touchable wrapper for proper activeOpacity without affecting animated styles
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
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
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    // Reserve space on the right so long titles don't run under the percentage badge
    paddingRight: 64,
    lineHeight: 22,
  },
  badgeContainer: {
    position: 'absolute',
    top: 12,
    right: 12,
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
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 3,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
  firstCard: {
    // no longer used (kept for backward compatibility)
  },
  otherCard: {
    // no longer used (kept for backward compatibility)
  },
});

export default PlaybookCarousel;
