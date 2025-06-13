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
import { usePlaybookStore } from '../store/usePlaybookStore';
import { useUser } from '../context/UserContext';

// Import gesture handler at the top level
import 'react-native-gesture-handler'; // This is needed for gesture handling

interface TaskStats {
  completed: number;
  total: number;
}

// Calculate completed and total tasks for a playbook's action steps (optimized)
export const calculateTaskStats = (actionSteps: any[] = []): TaskStats => {
  try {
    // Early return for empty or invalid input
    if (!Array.isArray(actionSteps) || actionSteps.length === 0) {
      return { completed: 0, total: 0 };
    }

    let completed = 0;
    let total = 0;
    const chunkSize = 100; // Process in chunks to avoid blocking

    for (let i = 0; i < actionSteps.length; i += chunkSize) {
      const chunk = actionSteps.slice(i, i + chunkSize);

      for (const step of chunk) {
        if (!step) {continue;}

        if (Array.isArray(step.subTasks) && step.subTasks.length > 0) {
          // Count sub-tasks for steps that have them
          let subCompleted = 0;
          for (const subTask of step.subTasks) {
            if (subTask?.completed) {subCompleted++;}
          }
          completed += subCompleted;
          total += step.subTasks.length;
        } else {
          // Count regular steps that don't have sub-tasks
          if (step.completed) {completed++;}
          total++;
        }
      }
    }

    return { completed, total };
  } catch (error) {
    console.error('Error in calculateTaskStats:', error);
    return { completed: 0, total: 0 };
  }
};

// Calculate progress based on completed action steps and sub-tasks
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const calculateProgress = (playbook: Playbook): number => {
  const { completed, total } = calculateTaskStats(playbook.actionSteps);
  return total > 0 ? Math.round((completed / total) * 100) : 0;
};

/**
 * Formats a date into a human-readable month and year string
 * @param {Date} date - The date to format
 * @returns {string} Formatted date string in 'Month YYYY' format (e.g., 'June 2023')
 */
const formatDate = (date: Date): string => {
  return format(date, 'MMMM yyyy');
};

const PlaybookListScreen = ({ navigation }: { navigation: any }) => {
  // Zustand global state for playbooks
  const { playbooks, isLoading, loadPlaybooks, removePlaybook } = usePlaybookStore();
  // Set filter to 'all' by default to ensure all playbooks are visible
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'completed'>('all');

  // Refs
  const animatedValues = useRef<Animated.Value[]>([]);
  const rowRefs = useRef<{ [key: string]: any }>({});

  // Get user info
  const { id: userId } = useUser();

  // Initialize animation values
  const initAnimations = (count: number) => {
    try {
      // Clear any existing animations
      if (animatedValues.current) {
        animatedValues.current.forEach(value => {
          if (value && typeof value.stopAnimation === 'function') {
            value.stopAnimation();
          }
        });
      }

      // Create new animated values
      const initialValues = Array(Math.max(0, count)).fill(0).map(() => new Animated.Value(0));
      animatedValues.current = initialValues;

      // Only start animations if we have values to animate
      if (initialValues.length > 0) {
        // Start animations after a small delay
        const timer = setTimeout(() => {
          const animations = initialValues.map((value, index) =>
            Animated.spring(value, {
              toValue: 1,
              useNativeDriver: true,
              delay: index * 100,
            })
          );
          Animated.stagger(100, animations).start();
        }, 100);

        return () => clearTimeout(timer);
      }

      return () => {}; // No-op cleanup function
    } catch (error) {
      console.error('Error initializing animations:', error);
      return () => {}; // Ensure we always return a cleanup function
    }
  };

  // Load playbooks using Zustand store
  const loadPlaybooksCallback = useCallback(async () => {
    if (!userId) {
      return;
    }
    await loadPlaybooks(userId);
  }, [userId, loadPlaybooks]);

  // Initialize animations on mount and when playbooks change
  useEffect(() => {
    if (playbooks.length > 0) {
      initAnimations(playbooks.length);
    }
  }, [playbooks.length]);

  // Reset animations and set filter to 'ongoing' when screen comes into focus
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setFilter('ongoing');

      // Safely reset animation values if they exist
      if (animatedValues.current && Array.isArray(animatedValues.current)) {
        animatedValues.current.forEach(value => {
          if (value && typeof value.setValue === 'function') {
            value.setValue(0);
          }
        });
      }

      // Reinitialize animations after a short delay
      const timer = setTimeout(() => {
        if (playbooks.length > 0) {
          initAnimations(playbooks.length);
        }
        // Always reload playbooks on focus
        loadPlaybooksCallback();
      }, 150);

      return () => clearTimeout(timer);
    });

    return () => {
      unsubscribe();
    };
  }, [navigation, playbooks.length, loadPlaybooksCallback]);

  // Ensure playbooks are loaded when userId changes
  useEffect(() => {
    if (userId) {
      loadPlaybooks(userId);
    }
  }, [userId, loadPlaybooks]);

  // Filter and sort playbooks by completion status (optimized)
  const filteredPlaybooks = useMemo(() => {
    try {
      // Early return for empty playbooks
      if (!Array.isArray(playbooks) || playbooks.length === 0) {
        return [];
      }

      // Process in chunks to avoid blocking the JS thread
      const chunkSize = 50;
      let result: Playbook[] = [];

      // Process filtering in chunks
      for (let i = 0; i < playbooks.length; i += chunkSize) {
        const chunk = playbooks.slice(i, i + chunkSize);

        const filteredChunk = chunk.filter((playbook) => {
          if (!playbook?.actionSteps) {return false;}

          const { completed, total } = calculateTaskStats(playbook.actionSteps);
          const allStepsCompleted = total > 0 && completed === total;
          const completedAt = playbook.completedAt ? new Date(playbook.completedAt).getTime() : 0;
          const hasValidCompletedAt = !isNaN(completedAt);

          switch (filter) {
            case 'all':
              return true;
            case 'ongoing':
              return !allStepsCompleted || !hasValidCompletedAt;
            case 'completed':
              return allStepsCompleted && hasValidCompletedAt;
            default:
              return false;
          }
        });

        result = [...result, ...filteredChunk];
      }

      // Sort based on filter
      if (filter === 'completed') {
        console.log('Sorting completed playbooks...');

        // Log all playbooks with their dates before sorting
        result.forEach(pb => {
          console.log(`Playbook: ${pb.title}`);
          console.log(`- completedAt: ${pb.completedAt}`);
          console.log(`- updatedAt: ${pb.updatedAt}`);
          console.log(`- createdAt: ${pb.createdAt}`);
        });

        result.sort((a, b) => {
          // For completed playbooks, sort by completedAt in descending order (newest first)
          // If completedAt is not available, fall back to updatedAt or createdAt
          const getSortableDate = (pb: Playbook) => {
            if (pb.completedAt) {
              const date = new Date(pb.completedAt).getTime();
              if (!isNaN(date)) {return { date, priority: 1, source: 'completedAt' };}
            }
            if (pb.updatedAt) {
              const date = new Date(pb.updatedAt).getTime();
              if (!isNaN(date)) {return { date, priority: 2, source: 'updatedAt' };}
            }
            if (pb.createdAt) {
              const date = new Date(pb.createdAt).getTime();
              if (!isNaN(date)) {return { date, priority: 3, source: 'createdAt' };}
            }
            return { date: 0, priority: 4, source: 'none' };
          };

          const dateA = getSortableDate(a);
          const dateB = getSortableDate(b);

          // Log comparison for debugging
          console.log(`Comparing: ${a.title} (${new Date(dateA.date).toISOString()}, ${dateA.source}) vs ${b.title} (${new Date(dateB.date).toISOString()}, ${dateB.source})`);

          // First sort by date in descending order (newest first)
          if (dateA.date !== dateB.date) {
            return dateB.date - dateA.date;
          }

          // If dates are equal, sort by priority (prefer completedAt over updatedAt over createdAt)
          return dateA.priority - dateB.priority;
        });

        // Log the final order after sorting
        console.log('Final order after sorting:');
        result.forEach((pb, index) => {
          console.log(`${index + 1}. ${pb.title} (${pb.completedAt || 'no completedAt'})`);
        });
      } else if (filter === 'ongoing') {
        result.sort((a, b) => {
          const getSortableDate = (pb: Playbook) => {
            if (pb.updatedAt) {
              const updatedAt = new Date(pb.updatedAt).getTime();
              if (!isNaN(updatedAt)) {return updatedAt;}
            }
            if (pb.createdAt) {
              const createdAt = new Date(pb.createdAt).getTime();
              if (!isNaN(createdAt)) {return createdAt;}
            }
            return 0;
          };

          return getSortableDate(b) - getSortableDate(a);
        });
      }

      return result;

    } catch (error) {
      console.error('Error filtering playbooks:', error);
      return [];
    }
  }, [playbooks, filter]);

  // (Remove any other filteredPlaybooks declarations below this point)

  // Group playbooks by month/year (optimized)
  const groupPlaybooksByMonth = useCallback((playbooksList: Playbook[] = []) => {
    try {
      const groups: { [key: string]: Playbook[] } = {};

      // Early return for empty or invalid input
      if (!Array.isArray(playbooksList) || playbooksList.length === 0) {
        return [];
      }

      // Process playbooks in chunks to avoid blocking
      const chunkSize = 50;
      for (let i = 0; i < playbooksList.length; i += chunkSize) {
        const chunk = playbooksList.slice(i, i + chunkSize);

        for (const pb of chunk) {
          // Skip invalid items
          if (!pb?.createdAt) {continue;}

          const date = new Date(pb.createdAt);
          if (isNaN(date.getTime())) {continue;}

          const key = formatDate(date);
          if (!groups[key]) {
            groups[key] = [];
          }
          groups[key].push(pb);
        }
      }

      // Helper function to get the most relevant date for sorting
      const getSortDate = (pb: Playbook) => {
        if (filter === 'completed' && pb.completedAt) {
          return new Date(pb.completedAt).getTime();
        }
        if (pb.updatedAt) {
          return new Date(pb.updatedAt).getTime();
        }
        return new Date(pb.createdAt || 0).getTime();
      };

      // Process in smaller chunks to avoid blocking
      return Object.entries(groups)
        .map(([title, data]) => {
          // Sort playbooks within each section
          const sortedData = [...data].sort((a, b) => {
            return getSortDate(b) - getSortDate(a);
          });

          return { title, data: sortedData };
        })
        .sort((a, b) => {
          // Sort sections by the most recent date in each section
          const getMostRecentDate = (items: Playbook[]) => {
            if (!items.length) {return 0;}
            return Math.max(...items.map(pb => getSortDate(pb)));
          };

          return getMostRecentDate(b.data) - getMostRecentDate(a.data);
        });
    } catch (error) {
      console.error('Error in groupPlaybooksByMonth:', error);
      return [];
    }
  }, [filter]);

  const sections = useMemo(() => {
    // Ensure filteredPlaybooks is an array before passing to groupPlaybooksByMonth
    const safeFilteredPlaybooks = Array.isArray(filteredPlaybooks) ? filteredPlaybooks : [];
    return groupPlaybooksByMonth(safeFilteredPlaybooks);
  }, [filteredPlaybooks, groupPlaybooksByMonth]);

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
              removePlaybook(id); // Optimistically update UI
              await deletePlaybook(id, userId)
                .catch(async (error) => {
                  console.error('Error deleting playbook:', error);
                  // If there was an error, reload the playbooks to restore the correct state
                  await loadPlaybooks(userId);
                  Alert.alert('Error', 'Failed to delete playbook. Please try again.');
                });
            } catch (error) {
              console.error('Error deleting playbook:', error);
              // If there was an error, reload the playbooks to restore the correct state
              await loadPlaybooks(userId);
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
    // Safety check for item
    if (!item || typeof item !== 'object') {
      console.warn('Invalid item in renderItem:', item);
      return null;
    }

    // Ensure a persistent ref for each row
    if (item.id && !rowRefs.current[item.id]) {
      rowRefs.current[item.id] = createRef();
    }

    // Safely handle cases where animatedValues.current might not be initialized yet
    const currentAnimatedValue = Array.isArray(animatedValues.current) ? animatedValues.current[index] : null;
    const translateY = currentAnimatedValue?.interpolate?.({
      inputRange: [0, 1],
      outputRange: [50, 0],
    }) || new Animated.Value(0);

    const opacity = currentAnimatedValue || 0;

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

  // Show empty state only when we're not loading and there are no playbooks
  if (playbooks.length === 0 && !isLoading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={[styles.container, styles.centered]}>
          <Text style={styles.header}>Playbooks</Text>
          <Text>No playbooks found. Pull to refresh or create a new playbook.</Text>
          <Button
            title="Refresh"
            onPress={() => {
              if (userId) {
                loadPlaybooks(userId);
              }
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
