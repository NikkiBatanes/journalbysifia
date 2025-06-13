import { useRef, useCallback, useState, useEffect, useMemo, createRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Alert,
  SectionList,
  Animated,
  SafeAreaView,
  Pressable,
  Button,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';

import { RectButton, Swipeable } from 'react-native-gesture-handler';

import PlaybookCard from '../components/PlaybookCard';
import { Colors, Fonts } from '../theme';
import type { Playbook } from '../interfaces/playbook';
import { getPlaybooks, deletePlaybook } from '../services/supabaseApi';
import { useUser } from '../context/UserContext';

// Import gesture handler at the top level
import 'react-native-gesture-handler'; // This is needed for gesture handling

interface TaskStats {
  completed: number;
  total: number;
}

// Calculate completed and total tasks for a playbook
const calculateTaskStats = (playbook: Playbook): TaskStats => {
  let completed = 0;
  let total = 0;

  playbook.actionSteps.forEach((step) => {
    if (step.subTasks && step.subTasks.length > 0) {
      // Count sub-tasks for steps that have them
      const completedSubTasks = step.subTasks.filter(st => st.completed).length;
      completed += completedSubTasks;
      total += step.subTasks.length;
    } else {
      // Count regular steps that don't have sub-tasks
      if (step.completed) {
        completed++;
      }
      total++;
    }
  });

  return { completed, total };
};

// Calculate progress based on completed action steps and sub-tasks
function calculateProgress(playbook: Playbook): number {
  const { completed, total } = calculateTaskStats(playbook);
  return total > 0 ? completed / total : 0;
}


/**
 * Formats a date into a human-readable month and year string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string in 'Month YYYY' format (e.g., 'June 2023')
 */
const formatDate = (date: Date): string => {
  return format(date, 'MMMM yyyy');
};

const PlaybookListScreen = ({ navigation }: { navigation: any }) => {
  // State for playbooks data
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'completed'>('ongoing');
  const [isLoading, setIsLoading] = useState(true);

  // Refs
  const animatedValues = useRef<Animated.Value[]>([]);
  const rowRefs = useRef<{ [key: string]: any }>({});

  // Get user info
  const { id: userId } = useUser();

  // Initialize animation values
  const initAnimations = (count: number) => {
    const initialValues = Array(count).fill(0).map(() => new Animated.Value(0));
    animatedValues.current = initialValues;

    // Start animations after a small delay
    setTimeout(() => {
      const animations = initialValues.map((value, index) =>
        Animated.spring(value, {
          toValue: 1,
          useNativeDriver: true,
          delay: index * 100,
        })
      );
      Animated.stagger(100, animations).start();
    }, 100);

    return initialValues;
  };

  // Reset animations and set filter to 'ongoing' when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      // Set filter to 'ongoing' when screen comes into focus
      setFilter('ongoing');
      // Reset all animations
      animatedValues.current.forEach(value => value.setValue(0));
      // Start animations after a small delay to ensure screen is ready
setTimeout(() => {
        if (playbooks.length > 0) {
          initAnimations(playbooks.length);
        }
      }, 150);
    });

    return unsubscribe;
  }, [navigation, playbooks.length]);

  // Load playbooks function
  const loadPlaybooks = useCallback(async () => {
    setIsLoading(true);
    if (!userId) {
      setPlaybooks([]);
      setIsLoading(false);
      return;
    }
    try {
      const localPlaybooks = await getPlaybooks(userId);

      // Normalize keys for UI and ensure all required fields are present
      const normalized: Playbook[] = localPlaybooks.map((pb: any) => {
        // Ensure directChallenge is properly formatted
        let directChallenge: string | { text: string; summary: string } = '';
        if (pb.direct_challenge || pb.directChallenge) {
          const challenge = pb.direct_challenge || pb.directChallenge;
          directChallenge = typeof challenge === 'string'
            ? challenge
            : { text: challenge?.text || '', summary: challenge?.summary || '' };
        }

        // Ensure truthInLove has the correct structure
        const truthInLove = pb.truth_in_love || pb.truthInLove || { text: '', summary: '' };

        // Ensure bibleVerse has the correct structure
        const bibleVerse = pb.bible_verse || pb.bibleVerse || { text: '', reference: '' };

        return {
          id: pb.id,
          title: pb.title || 'Untitled Playbook',
          user_id: pb.user_id || pb.userId || '',
          userInput: pb.user_input ?? pb.userInput ?? '',
          truthInLove,
          actionSteps: Array.isArray(pb.action_steps) ? pb.action_steps : [],
          affirmations: Array.isArray(pb.daily_affirmations)
            ? pb.daily_affirmations
            : (Array.isArray(pb.affirmations) ? pb.affirmations : []),
          bibleVerse,
          directChallenge,
          challengeCta: pb.challenge_cta ?? pb.challengeCta ?? '',
          profileImage: pb.profile_image ?? pb.profileImage,
          progress: pb.progress ?? 0,
          totalTasks: pb.total_tasks ?? pb.totalTasks ?? 0,
          createdAt: pb.created_at ?? pb.createdAt,
          updatedAt: pb.updated_at ?? pb.updatedAt,
        };
      });

      setPlaybooks(normalized);

      // Initialize animations after state is updated
      if (normalized.length > 0) {
        initAnimations(normalized.length);
      }
    } catch (error) {
      console.error('Error loading playbooks:', error);
    } finally {
      setIsLoading(false);
    }
  }, [userId]);

  // Load playbooks on mount and when userId changes
  useEffect(() => {
    loadPlaybooks();

    const unsubscribe = navigation.addListener('focus', loadPlaybooks);
    return unsubscribe;
  }, [loadPlaybooks, navigation]);

  // Group playbooks by month/year
  const groupPlaybooksByMonth = useCallback((playbooksList: Playbook[]) => {
    const groups: { [key: string]: Playbook[] } = {};

    playbooksList.forEach((pb) => {
      try {
        // Ensure createdAt exists and is a valid date string
        if (!pb.createdAt) {
          return;
        }

        const date = new Date(pb.createdAt);
        if (isNaN(date.getTime())) {
          return; // Skip invalid dates
        }

        const key = formatDate(date);
        if (!groups[key]) {groups[key] = [];}
        groups[key].push(pb);
      } catch (error) {
        console.warn('Error processing playbook date:', pb.id, error);
      }
    });

    // Sort months descending (most recent first)
    return Object.entries(groups)
      .sort((a, b) => {
        try {
          const dateA = new Date(a[1][0].createdAt || 0);
          const dateB = new Date(b[1][0].createdAt || 0);
          return dateB.getTime() - dateA.getTime();
        } catch (error) {
          return 0;
        }
      })
      .map(([title, data]) => ({
        title,
        data: data.sort((a, b) => {
          try {
            const dateA = new Date(a.createdAt || 0);
            const dateB = new Date(b.createdAt || 0);
            return dateB.getTime() - dateA.getTime();
          } catch (error) {
            return 0;
          }
        }),
      }));
  }, []);

  // Filter playbooks by completion status
  const filteredPlaybooks = playbooks.filter((playbook: Playbook) => {
    if (filter === 'all') {
      return true;
    }
    const progress = calculateProgress(playbook);
    if (filter === 'ongoing') {
      return progress < 1; // Include both not-started (0%) and in-progress (1-99%)
    }
    if (filter === 'completed') {
      return progress === 1;
    }
    return false;
  });

  const sections = useMemo(() => groupPlaybooksByMonth(filteredPlaybooks), [filteredPlaybooks, groupPlaybooksByMonth]);

  const handleDelete = async (id: string) => {
    if (!userId) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    Alert.alert(
      'Delete Playbook',
      'Are you sure you want to delete this playbook?',
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // Optimistically update local state for immediate UI feedback
              setPlaybooks(prev => prev.filter(playbook => playbook.id !== id));
              // Delete from Supabase and AsyncStorage (background)
              deletePlaybook(id, userId)
                .then(() => {
                  // Remove the deleted playbook from the list
                  setPlaybooks(prev => prev.filter(pb => pb.id !== id));
                })
                .catch(async (error) => {
                  console.error('Error deleting playbook:', error);
                  // If there was an error, reload the playbooks to restore the correct state
                  const reloadedPlaybooks = await getPlaybooks(userId);
                  setPlaybooks(reloadedPlaybooks);
                  Alert.alert('Error', 'Failed to delete playbook. Please try again.');
                });
            } catch (error) {
              console.error('Error deleting playbook:', error);
              // If there was an error, reload the playbooks to restore the correct state
              const reloadedPlaybooks = await getPlaybooks(userId);
              setPlaybooks(reloadedPlaybooks);
              Alert.alert('Error', 'Failed to delete playbook. Please try again.');
            }
          },
        },
      ]
    );
  };

  // Move handleCardPress outside of renderItem
  const handleCardPress = useCallback((playbook: Playbook) => {
    navigation.navigate('PlaybookDetail', { playbook });
  }, [navigation]);

  const renderItem = ({ item, index }: { item: Playbook; index: number }) => {
    // Ensure a persistent ref for each row
    if (!rowRefs.current[item.id]) {
      rowRefs.current[item.id] = createRef();
    }

    const translateY = animatedValues.current[index]?.interpolate({
      inputRange: [0, 1],
      outputRange: [50, 0],
    });

    const opacity = animatedValues.current[index] || 0;

    return (
      <Animated.View
        style={[
          styles.swipeableContainer,
          {
            opacity,
            transform: [{ translateY }],
          },
        ]}
      >
        <Swipeable
          ref={rowRefs.current[item.id]}
          renderRightActions={() => (
            <RectButton
              style={styles.deleteButton}
              onPress={() => handleDelete(item.id)}
            >
              <Ionicons name="trash-outline" size={24} color="white" />
            </RectButton>
          )}
          rightThreshold={40}
          friction={2}
          overshootRight={false}
          containerStyle={styles.swipeableContainer}
        >
          <PlaybookCard
            playbook={item}
            onPress={() => handleCardPress(item)}
            style={styles.card}
          />
        </Swipeable>
      </Animated.View>
    );
  };

  const loadingStyles = StyleSheet.create({
    safeArea: {
      ...styles.safeArea,
      backgroundColor: 'white',
    },
    container: {
      ...styles.container,
      flex: 1,
      backgroundColor: 'white',
    },
  });

  if (isLoading) {
    return (
      <SafeAreaView style={loadingStyles.safeArea}>
        <View style={loadingStyles.container} />
      </SafeAreaView>
    );
  }

  if (playbooks.length === 0) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.header}>Playbooks</Text>
          <Text>No playbooks found. Pull to refresh or create a new playbook.</Text>
          <Button
            title="Refresh"
            onPress={() => {
              // Force reload playbooks
              loadPlaybooks();
            }}
          />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Playbooks</Text>
        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {(['all', 'ongoing', 'completed'] as const).map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.filterTab,
                filter === tab && (
                  tab === 'completed'
                    ? styles.filterTabActiveCompleted
                    : tab === 'ongoing'
                      ? styles.filterTabActiveOngoing
                      : styles.filterTabActive
                ),
              ]}
              onPress={() => setFilter(tab)}
            >
              <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
                {tab === 'all' ? 'All' : tab === 'ongoing' ? 'In Progress' : 'Completed'}
              </Text>
            </Pressable>
          ))}
        </View>
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.sectionHeader}><Text style={styles.sectionHeaderText}>{title}</Text></View>
          )}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled
          showsVerticalScrollIndicator={false}
        />
      </View>
    </SafeAreaView>
  );
};

export default PlaybookListScreen;

const styles = StyleSheet.create({
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  swipeableContainer: {
    width: '100%',
    marginBottom: 8,
    borderRadius: 16,
    overflow: 'hidden',
    height: 88, // Fixed height to match card
    backgroundColor: Colors.anchorBlue, // Match card background color
  },
  cardTouchable: {
    width: '100%',
  },
  deleteButton: {
    width: 60,
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 8,
    height: '100%',
    borderTopRightRadius: 16, // Match card's border radius
    borderBottomRightRadius: 16, // Match card's border radius
  },
  safeArea: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
    padding: 16,
  },
  header: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.anchorBlue,
    marginBottom: 20,
    marginTop: 10,
    letterSpacing: 0.5,
    fontWeight: '800',
  },
  listContent: {
    paddingBottom: 20,
  },
  filterTabs: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    marginBottom: 12,
    gap: 2,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 18,
    borderRadius: 6,
    backgroundColor: '#e8edf6',
    marginHorizontal: 2,
  },
  filterTabActive: {
    backgroundColor: Colors.anchorBlue,
  },
  filterTabActiveCompleted: {
    backgroundColor: Colors.growthGreen,
  },
  filterTabActiveOngoing: {
    backgroundColor: Colors.alertCoral,
  },
  filterTabText: {
    fontFamily: Fonts.semiBold,
    fontSize: 13,
    color: Colors.anchorBlue,
    letterSpacing: 0.2,
    fontWeight: '400',
  },
  filterTabTextActive: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
  },
  sectionHeader: {
    backgroundColor: '#f6f8fa',
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    marginTop: 12,
    marginBottom: 2,
  },
  sectionHeaderText: {
    fontFamily: Fonts.bold,
    fontSize: 12,
    color: Colors.anchorBlue,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    fontWeight: 'bold',
  },
  card: {
    marginBottom: 12,
  },
  cardContent: {
    flex: 1,
    width: '100%',
    alignSelf: 'stretch',
    paddingVertical: 2,
  },
  title: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    lineHeight: 24,
    paddingVertical: 1,
    fontWeight: '700',
    flexShrink: 1,
  },
  date: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: 'rgba(255, 255, 255, 0.8)',
    letterSpacing: 0.8,
    lineHeight: 14,
    marginBottom: 2,
    textTransform: 'uppercase',
  },


});
