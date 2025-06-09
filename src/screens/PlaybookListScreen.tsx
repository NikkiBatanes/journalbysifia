import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SectionList,
  TouchableOpacity,
  Animated,
  Alert,
  SafeAreaView,
  StatusBar,
  Pressable,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
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

const SwipeableRow = forwardRef(({ item, onDelete, children, onSwipeableOpen }: { item: Playbook; onDelete: (id: string) => void; children: React.ReactNode; onSwipeableOpen?: (ref: any) => void }, ref) => {
  const swipeableRef = useRef<any>(null);
  useImperativeHandle(ref, () => ({
    close: () => swipeableRef.current?.close(),
  }));
  // iOS-style: Animate delete button as swipe closes
  const renderRightActions = (progress: any, dragX: any) => {
    // Animate opacity and scale based on progress
    const opacity = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
      extrapolate: 'clamp',
    });
    const scale = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [0.7, 1],
      extrapolate: 'clamp',
    });
    const translateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [32, 0],
      extrapolate: 'clamp',
    });
    // Animate the entire delete action with translateX instead of width
    const DELETE_WIDTH = 128;
    const bgTranslateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [DELETE_WIDTH, 0],
      extrapolate: 'clamp',
    });
    const contentOpacity = progress.interpolate({
      inputRange: [0, 0.3, 1],
      outputRange: [0, 0.7, 1],
      extrapolate: 'clamp',
    });
    const contentTranslateX = progress.interpolate({
      inputRange: [0, 1],
      outputRange: [DELETE_WIDTH / 2, 0],
      extrapolate: 'clamp',
    });
    return (
      <View style={styles.iosRightActionContainer}>
        <Animated.View
          style={[
            styles.iosDeleteButton,
            { transform: [{ translateX: bgTranslateX }] },
          ]}
        >
          <RectButton
            style={styles.iosDeleteButtonInner}
            onPress={() => onDelete(item.id)}
            rippleColor="rgba(255,255,255,0.15)"
          >
            <Animated.View
              style={[
                styles.iosDeleteContent,
                {
                  opacity: contentOpacity,
                  transform: [{ translateX: contentTranslateX }],
                },
              ]}
            >
              <Ionicons name="trash-outline" size={32} color="white" style={styles.deleteIcon} />
            </Animated.View>
          </RectButton>
        </Animated.View>
      </View>
    );
  };

  return (
    <Swipeable
      ref={swipeableRef}
      renderRightActions={renderRightActions}
      rightThreshold={40}
      friction={1.5}
      overshootRight={true}
      containerStyle={styles.swipeableContainer}
      onSwipeableWillOpen={() => onSwipeableOpen?.(swipeableRef.current)}
    >
      {children}
    </Swipeable>
  );
});

export default function PlaybookListScreen() {
  // Store refs for all rows
  const rowRefs = useRef<{ [key: string]: any }>({});
  const navigation = useNavigation<PlaybookListScreenNavigationProp>();
  const { id: userId } = useUser();
  const [playbooks, setPlaybooks] = React.useState<Playbook[]>([]);
  const [filter, setFilter] = React.useState<'all' | 'ongoing' | 'accomplished'>('all');
  const [refreshing, setRefreshing] = React.useState(false);
  const openSwipeableRef = useRef<any>(null);

  // Load playbooks on focus
  React.useEffect(() => {
    const load = async () => {
      if (!userId) return;
      const localPlaybooks = await getPlaybooks(userId);
      // Normalize keys for UI
      const normalized = localPlaybooks.map(pb => ({
        ...pb,
        id: pb.id,
        title: pb.title,
        userInput: pb.user_input ?? pb.userInput,
        truthInLove: pb.truth_in_love ?? pb.truthInLove,
        // DEBUG: Log action_steps from Supabase
        // eslint-disable-next-line no-console
        ...(() => { console.log('[DEBUG] pb.action_steps:', pb.action_steps); return {}; })(),
        actionSteps: (() => {
          let steps;
          if (Array.isArray(pb.action_steps)) {
            steps = pb.action_steps;
          } else if (typeof pb.action_steps === 'string') {
            try {
              steps = JSON.parse(pb.action_steps);
            } catch (e) {
              console.error('[DEBUG] Failed to parse pb.action_steps:', pb.action_steps, e);
              steps = [];
            }
          } else {
            steps = pb.actionSteps ?? [];
          }
          // eslint-disable-next-line no-console
          console.log('[DEBUG] Normalized actionSteps:', steps);
          return steps;
        })(),
        dailyAffirmations: pb.daily_affirmations ?? pb.dailyAffirmations ?? [],
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
    const formattedDate = format(new Date(item.createdAt || ''), 'EEEE, MMM d, yyyy').toUpperCase();
    const completedSteps = item.actionSteps.filter(step => step.completed).length;
    const totalSteps = item.actionSteps.length;
    const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;

    // Ensure a persistent ref for each row
    if (!rowRefs.current[item.id]) {
      rowRefs.current[item.id] = React.createRef();
    }
    return (
      <SwipeableRow
        ref={rowRefs.current[item.id]}
        item={item}
        onDelete={handleDelete}

      >
      <TouchableOpacity
        style={styles.card}
        onPress={() => navigation.navigate('PlaybookDetail', { playbook: item })}
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          <View style={styles.titleContainer}>
            <Text style={styles.date}>
              {formattedDate}
            </Text>
            <View style={styles.titleRow}>
              <Text style={styles.title} numberOfLines={1}>
                {item.title}
              </Text>
            </View>
          </View>
          <View style={progressBarStyles.container}>
            <View style={progressBarStyles.row}>
              <View style={progressBarStyles.progressWrapper}>
                <View style={progressBarStyles.barBg}>
                  <View
                    style={[
                      progressBarStyles.barFill,
                      { width: `${progress}%` },
                    ]}
                  />
                </View>
              </View>
              <View style={progressBarStyles.textContainer}>
                <Text style={progressBarStyles.text}>
                  {completedSteps}/{totalSteps} tasks
                </Text>
              </View>
            </View>
          </View>
        </View>
      </TouchableOpacity>
      </SwipeableRow>
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
}

const styles = StyleSheet.create({
  swipeableContainer: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 20,
    marginBottom: 12,
    overflow: 'hidden',
    flexDirection: 'row',
  },
  // iOS-style swipe action
  iosRightActionContainer: {
    width: 128,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'flex-end',
    backgroundColor: 'transparent',
    position: 'relative',
    right: 0,
    top: 0,
    bottom: 0,
  },
  iosDeleteButton: {
    backgroundColor: Colors.alertCoral,
    height: '100%',
    width: 128,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
    overflow: 'hidden',
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
  },
  iosDeleteButtonInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderTopRightRadius: 20,
    borderBottomRightRadius: 20,
    backgroundColor: 'transparent',
  },
  iosDeleteContent: {
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  iosDeleteText: {
    color: 'white',
    fontSize: 13,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
    marginTop: 2,
    letterSpacing: 0.5,
  },
  deleteIcon: {
    marginBottom: 2,
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
    backgroundColor: Colors.anchorBlue,
    borderRadius: 0,
    padding: 16,
    flex: 1,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
    width: '100%',
    alignSelf: 'stretch',
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
