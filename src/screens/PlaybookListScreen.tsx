import React, { useRef, useImperativeHandle, forwardRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  RefreshControl,
  SectionList,
  Pressable,
  SafeAreaView,
  ScrollView,
  Animated,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';

import { RectButton, Swipeable } from 'react-native-gesture-handler';
import PlaybookCard from '../components/PlaybookCard';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Fonts } from '../theme';
import type { Playbook } from '../interfaces/playbook';
import { getPlaybooks, deletePlaybook } from '../services/supabaseApi';
import { useUser } from '../context/UserContext';
import { progressBarStyles } from '../styles/ProgressBarStyles';

// Import gesture handler at the top level
import 'react-native-gesture-handler';

// Define the navigation param types
declare global {
  namespace ReactNavigation {
    interface RootParamList extends RootStackParamList {}
  }
}

// Update the navigation prop type to match the expected params
type PlaybookListScreenNavigationProp = StackNavigationProp<RootStackParamList, 'PlaybookDetail'> & {
  navigate: (screen: 'PlaybookDetail', params: { playbook: Playbook }) => void;
};

// Calculate progress based on completed action steps and sub-tasks
function calculateProgress(playbook: Playbook): number {
  if (!playbook.actionSteps.length) {return 0;}

  let totalCompleted = 0;
  let totalTasks = 0;

  playbook.actionSteps.forEach(step => {
    if (step.subTasks && step.subTasks.length > 0) {
      // Count sub-tasks for steps that have them
      const completedSubTasks = step.subTasks.filter(st => st.completed).length;
      totalCompleted += completedSubTasks;
      totalTasks += step.subTasks.length;
    } else {
      // Count regular steps that don't have sub-tasks
      if (step.completed) {totalCompleted++;}
      totalTasks++;
    }
  });

  return totalTasks > 0 ? totalCompleted / totalTasks : 0;
}

// Format progress text
function formatProgress(playbook: Playbook): string {
  let totalCompleted = 0;
  let totalTasks = 0;

  playbook.actionSteps.forEach(step => {
    if (step.subTasks && step.subTasks.length > 0) {
      // Count sub-tasks for steps that have them
      const completedSubTasks = step.subTasks.filter(st => st.completed).length;
      totalCompleted += completedSubTasks;
      totalTasks += step.subTasks.length;
    } else {
      // Count regular steps that don't have sub-tasks
      if (step.completed) {totalCompleted++;}
      totalTasks++;
    }
  });

  return `${totalCompleted}/${totalTasks} Tasks`;
}

// Format date to a readable format
const formatDate = () => {
  const date = new Date();
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

interface SwipeableRowProps {
  item: Playbook;
  onDelete: (id: string) => void;
  children: React.ReactNode;
  onSwipeableOpen?: (ref: any) => void;
}

const SwipeableRow = forwardRef<any, SwipeableRowProps>(({ item, onDelete, children, onSwipeableOpen }, ref) => {
  const swipeableRef = useRef<any>(null);
  const openSwipeableRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    close: () => swipeableRef.current?.close(),
  }));
  // Modern delete button with scale animation
  const renderRightActions = (progress: Animated.AnimatedInterpolation<number>) => {
    // Close any open swipeable when a new one is opened
    const handlePress = () => {
      if (openSwipeableRef.current && openSwipeableRef.current !== swipeableRef.current) {
        openSwipeableRef.current.close();
      }
      openSwipeableRef.current = swipeableRef.current;
      onDelete(item.id);
    };

    // Fade in the delete button as user swipes
    const fadeAnim = progress.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0, 0, 1],
      extrapolate: 'clamp',
    });

    // Scale animation for the press effect
    const scaleAnim = progress.interpolate({
      inputRange: [0, 0.7, 1],
      outputRange: [0.8, 0.8, 1],
      extrapolate: 'clamp',
    });

    return (
      <Animated.View 
        style={[
          styles.deleteButtonContainer,
          { opacity: fadeAnim }
        ]}
      >
        <RectButton
          style={styles.deleteButton}
          onPress={handlePress}
          rippleColor="rgba(0,0,0,0.1)"
        >
          <Animated.View style={[
            styles.deleteButtonContent,
            { transform: [{ scale: scaleAnim }] }
          ]}>
            <Ionicons 
              name="trash-outline" 
              size={24} 
              color="white" 
              style={styles.deleteIcon} 
            />
          </Animated.View>
        </RectButton>
      </Animated.View>
    );
  };

  return (
    <View style={styles.swipeableContainer}>
      <Swipeable
        ref={swipeableRef}
        renderRightActions={renderRightActions}
        rightThreshold={40}
        friction={1.5}
        overshootRight={false}
        containerStyle={styles.swipeableInnerContainer}
        onSwipeableWillOpen={() => onSwipeableOpen?.(swipeableRef.current)}
      >
        <View style={styles.swipeableChild}>
          {children}
        </View>
      </Swipeable>
    </View>
  );
});

const PlaybookListScreen = ({ navigation }: { navigation: any }) => {
  // Store refs for all rows
  const rowRefs = useRef<{ [key: string]: any }>({});
  const [filter, setFilter] = useState<'all' | 'ongoing' | 'accomplished'>('ongoing');
  const { id: userId } = useUser();
  const [playbooks, setPlaybooks] = React.useState<Playbook[]>([]);
  const [refreshing, setRefreshing] = React.useState(false);
  const openSwipeableRef = useRef<any>(null);

  // Load playbooks on focus
  React.useEffect(() => {
    const load = async (): Promise<void> => {
      if (!userId) return;
      try {
        const localPlaybooks = await getPlaybooks(userId);
        // Normalize keys for UI
        const normalized = localPlaybooks.map((pb: any) => ({
          id: pb.id,
          title: pb.title,
          userInput: pb.user_input ?? pb.userInput,
          truthInLove: pb.truth_in_love ?? pb.truthInLove,
          actionSteps: Array.isArray(pb.action_steps) ? pb.action_steps : [],
          affirmations: pb.daily_affirmations ?? pb.affirmations ?? [],
          bibleVerse: pb.bible_verse ?? pb.bibleVerse,
          directChallenge: pb.direct_challenge ?? pb.directChallenge,
          createdAt: pb.created_at ?? pb.createdAt,
          updatedAt: pb.updated_at ?? pb.updatedAt,
          userId: pb.user_id ?? pb.userId,
          progress: pb.progress,
          totalTasks: pb.total_tasks ?? pb.totalTasks,
          challengeCta: pb.challenge_cta ?? pb.challengeCta,
          profileImage: pb.profile_image ?? pb.profileImage,
        }));
        
        setPlaybooks(normalized);
      } catch (error) {
        console.error('Error loading playbooks:', error);
      }
    };

    const unsubscribe = navigation.addListener('focus', load);
    load(); // also load on mount
    return unsubscribe;
  }, [navigation, userId]);

  // Group playbooks by month/year
  function groupPlaybooksByMonth(playbooks: Playbook[]) {
    const groups: { [key: string]: Playbook[] } = {};

    playbooks.forEach(pb => {
      try {
        // Ensure createdAt exists and is a valid date string
        if (!pb.createdAt) {return;}

        const date = new Date(pb.createdAt);
        if (isNaN(date.getTime())) {return;} // Skip invalid dates

        const key = format(date, 'MMMM yyyy');
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
  }

  // Filter playbooks by completion status
  const filteredPlaybooks = React.useMemo(() => {
    if (filter === 'all') {return playbooks;}
    if (filter === 'ongoing') {return playbooks.filter(pb => pb.actionSteps.some(step => !step.completed));}
    if (filter === 'accomplished') {return playbooks.filter(pb => pb.actionSteps.length > 0 && pb.actionSteps.every(step => step.completed));}
    return playbooks;
  }, [playbooks, filter]);

  const sections = React.useMemo(() => groupPlaybooksByMonth(filteredPlaybooks), [filteredPlaybooks]);




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
                  console.log('Playbook deleted successfully');
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

  const renderItem = ({ item }: { item: Playbook }) => {
    // Ensure a persistent ref for each row
    if (!rowRefs.current[item.id]) {
      rowRefs.current[item.id] = React.createRef();
    }
    
    // Handle card press
    const handleCardPress = useCallback(() => {
      console.log('Card pressed, navigating to PlaybookDetail with:', item.id);
      navigation.navigate('PlaybookDetail', { playbook: item });
    }, [item, navigation]);
    
    return (
      <View style={styles.swipeableContainer}>
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
            onPress={handleCardPress}
            style={styles.card}
          />
        </Swipeable>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>Playbooks</Text>
        {/* Filter Tabs */}
        <View style={styles.filterTabs}>
          {['all', 'ongoing', 'accomplished'].map((tab) => (
            <Pressable
              key={tab}
              style={[
                styles.filterTab,
                filter === tab && (
                  tab === 'accomplished'
                    ? styles.filterTabActiveCompleted
                    : tab === 'ongoing'
                      ? styles.filterTabActiveOngoing
                      : styles.filterTabActive
                ),
              ]}
              onPress={() => setFilter(tab as any)}
            >
              <Text style={[styles.filterTabText, filter === tab && styles.filterTabTextActive]}>
                {tab === 'all' ? 'All' : tab === 'ongoing' ? 'Ongoing' : 'Completed'}
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
  swipeableContainer: {
    width: '100%',
    marginBottom: 12,
  },
  cardTouchable: {
    width: '100%',
  },
  swipeableInnerContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 16,
    overflow: 'hidden',
  },
  swipeableChild: {
    width: '100%',
  },
  deleteButtonContainer: {
    width: 80,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingRight: 8,
  },
  deleteButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f87171',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteIcon: {
    opacity: 0.9,
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
  titleContainer: {
    marginBottom: 10,
    width: '100%',
  },
  subtitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginTop: 2,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginTop: 1,
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
