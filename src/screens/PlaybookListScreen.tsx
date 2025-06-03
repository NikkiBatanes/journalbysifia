import React, { useRef, useImperativeHandle, forwardRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  Animated, 
  Alert,
  SafeAreaView,
  StatusBar 
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { format } from 'date-fns';
import { RectButton, Swipeable } from 'react-native-gesture-handler';
import { StackNavigationProp } from '@react-navigation/stack';
import { RootStackParamList } from '../navigation/types';
import { Colors, Fonts } from '../theme';
import { mockPlaybooks } from '../mocks/playbookMocks';
import type { Playbook } from '../interfaces/playbook';

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

// Calculate progress based on completed action steps
function calculateProgress(playbook: Playbook): number {
  if (!playbook.actionSteps.length) return 0;
  const completed = playbook.actionSteps.filter(step => step.completed).length;
  return completed / playbook.actionSteps.length;
}

// Format progress text
function formatProgress(playbook: Playbook): string {
  const completed = playbook.actionSteps.filter(step => step.completed).length;
  return `${completed}/${playbook.actionSteps.length} Steps`;
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
            { transform: [{ translateX: bgTranslateX }] }
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
  const openRowRef = useRef<any>(null);

  const handleSwipeableOpen = (ref: any) => {
    if (openRowRef.current && openRowRef.current !== ref && openRowRef.current.close) {
      openRowRef.current.close();
    }
    openRowRef.current = ref;
  };

  const navigation = useNavigation<PlaybookListScreenNavigationProp>();
  const [playbooks, setPlaybooks] = React.useState([...mockPlaybooks]);
  
  // Sort playbooks by creation date (newest first)
  const sortedPlaybooks = [...playbooks].sort((a, b) => 
    new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  );

  const handleDelete = (id: string) => {
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
          onPress: () => {
            setPlaybooks(prev => prev.filter(playbook => playbook.id !== id));
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
        onSwipeableOpen={handleSwipeableOpen}
      >
      <TouchableOpacity 
        style={styles.card}
        onPress={() => navigation.navigate('PlaybookDetail', { playbook: item })}
        activeOpacity={0.8}
      >
        <View style={styles.cardContent}>
          <View style={styles.titleContainer}>
            {(() => {
              // Split title at first colon followed by space for two-line display
              const titleMatch = item.title.match(/^(.+?)(?::\s|$)([^:]*)$/);
              const firstLine = titleMatch ? titleMatch[1] + (titleMatch[2] ? ':' : '') : item.title;
              const secondLine = titleMatch ? titleMatch[2].trim() : '';
              
              return (
                <>
                  <Text style={styles.title} numberOfLines={1}>
                    {firstLine}
                  </Text>
                  {secondLine ? (
                    <Text style={styles.subtitle} numberOfLines={1}>
                      {secondLine}
                    </Text>
                  ) : null}
                </>
              );
            })()}
          </View>
          <Text style={styles.date}>
            {formattedDate}
          </Text>
          <View style={styles.progressContainer}>
            <View style={styles.progressBarBg}>
              <View 
                style={[
                  styles.progressBarFill, 
                  { width: `${progress}%` }
                ]} 
              />
            </View>
            <Text style={styles.progressText}>
              {completedSteps} of {totalSteps} steps completed
            </Text>
          </View>
        </View>
      </TouchableOpacity>
      </SwipeableRow>
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.header}>My Playbooks</Text>
        <FlatList
          data={sortedPlaybooks}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
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
  },
  listContent: {
    paddingBottom: 20,
  },
  card: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 0,
    padding: 16,
    flex: 1,
    borderTopLeftRadius: 20,
    borderBottomLeftRadius: 20,
  },
  cardContent: {
    flex: 1,
  },
  titleContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    lineHeight: 24,
    paddingBottom: 2,
    fontWeight: '800',

  },
  subtitle: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.95)',
    lineHeight: 20,
    paddingTop: 0,
    paddingBottom: 4,
    fontWeight: '500',
  },
  date: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 12,
    letterSpacing: 0.2,
    lineHeight: 16,
  },
  progressContainer: {
    marginTop: 4,
  },
  progressBarBg: {
    height: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 4,
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.8)',
  },

});
