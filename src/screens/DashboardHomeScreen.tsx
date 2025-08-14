/**
 * DashboardHomeScreen.tsx
 * Enterprise-grade dashboard home screen with comprehensive faith-based features
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  Animated,
  RefreshControl,
  PanResponder,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme';
import { dashboardNavigation } from '../services/NavigationManager';

import DailyAffirmationCard from '../components/dashboard/DailyAffirmationCard';
import DailyBibleVerseCard from '../components/dashboard/DailyBibleVerseCard';
import PlaybookCarousel from '../components/dashboard/PlaybookCarousel';
import DevotionalCarousel from '../components/dashboard/DevotionalCarousel';
import ActionStepsCard from '../components/dashboard/ActionStepsCard';

import QuickActionCard from '../components/dashboard/QuickActionCard';
import StreakTracker from '../components/dashboard/StreakTracker';
import WeeklyInsights from '../components/dashboard/WeeklyInsights';
import AIInsights from '../components/dashboard/AIInsights';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useScreenStatusBar } from '../hooks/useScreenStatusBar';

const { width, height } = Dimensions.get('window');

// Motivational texts that rotate
const MOTIVATIONAL_TEXTS = [
  "Let's grow in faith today",
  'Grow closer to God today with faith in action',
  'Transform your faith into action today',
  'Walk boldly in His purpose for you',
  'Let His love guide your steps today',
  'Embrace His grace in every moment',
  'Find strength in His promises today',
  'Let faith be your compass today',
  'Discover His plan through prayer and action',
  'Trust His timing, embrace His calling',
];

interface DashboardHomeScreenProps {
  navigation: any;
}

const DashboardHomeScreen: React.FC<DashboardHomeScreenProps> = ({ navigation }) => {
  // Limit FAB visibility to at most 2 shows across sessions
  const [showFab, setShowFab] = useState(false);
  const FAB_SHOW_KEY = 'dashboard_fab_shown_count';

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      (async () => {
        try {
          const raw = await AsyncStorage.getItem(FAB_SHOW_KEY);
          const count = raw ? parseInt(raw, 10) : 0;
          if (count < 2) {
            if (isActive) {setShowFab(true);}
            await AsyncStorage.setItem(FAB_SHOW_KEY, String(count + 1));
          } else {
            if (isActive) {setShowFab(false);}
          }
        } catch (e) {
          // On error, default to hiding the FAB to avoid over-showing
          if (isActive) {setShowFab(false);}
        }
      })();
      return () => {
        isActive = false;
      };
    }, [])
  );
  const { user } = useAuth();
  const { subscription, usage } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [currentMotivationalText, setCurrentMotivationalText] = useState(0);

  // Status bar: auto-detect from background
  useScreenStatusBar('auto', '#F2F5F7');

  const floatingButtonScale = useRef(new Animated.Value(1)).current;
  const floatingButtonOpacity = useRef(new Animated.Value(0)).current;

  // Collapsing Playbook label
  const playbookWidth = useRef(new Animated.Value(0)).current;
  const [playbookMeasuredWidth, setPlaybookMeasuredWidth] = useState(0);

  // Simple expandable button
  const buttonWidth = useRef(new Animated.Value(56)).current;
  const textOpacity = useRef(new Animated.Value(0)).current;
  const hasExpanded = useRef(false);


  // Draggable floating button
  const pan = useRef(new Animated.ValueXY({ x: -20, y: height - 200 })).current;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        pan.setOffset({
          x: (pan.x as any)._value,
          y: (pan.y as any)._value,
        });
      },
      onPanResponderMove: Animated.event(
        [null, { dx: pan.x, dy: pan.y }],
        { useNativeDriver: false }
      ),
      onPanResponderRelease: () => {
        pan.flattenOffset();
        // Snap to edges (adjusted for right-anchored container)
        const currentX = (pan.x as any)._value;
        const snapToEdge = currentX < -width / 2 ? -width + 76 : -20;
        Animated.spring(pan.x, {
          toValue: snapToEdge,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Get user's first name with robust fallbacks
  const firstName =
    (user as any)?.firstName ||
    user?.user_metadata?.first_name ||
    (user?.user_metadata?.full_name ? String(user.user_metadata.full_name).trim().split(/\s+/)[0] : undefined) ||
    (user as any)?.displayName?.split?.(' ')?.[0] ||
    user?.user_metadata?.given_name ||
    user?.email?.split('@')[0] ||
    'Friend';

  // Set daily motivational text based on current date
  useEffect(() => {
    const today = new Date();
    const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / (1000 * 60 * 60 * 24));
    const textIndex = dayOfYear % MOTIVATIONAL_TEXTS.length;
    setCurrentMotivationalText(textIndex);
  }, []);

  // Animate when screen is focused (dashboard opened)
  // Expandable animation that repeats
  const expandButton = useCallback(() => {
    let animationCount = 0;
    const maxAnimations = 3; // Animate 3 times

    const runAnimation = () => {
      if (animationCount >= maxAnimations) {return;}
      animationCount++;

      // Expand to show text
      Animated.parallel([
        Animated.timing(buttonWidth, {
          toValue: 220,
          duration: 400,
          useNativeDriver: false,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 300,
          delay: 150,
          useNativeDriver: false,
        }),
      ]).start(() => {
        // Hold for 2.5 seconds then collapse
        setTimeout(() => {
          Animated.parallel([
            Animated.timing(textOpacity, {
              toValue: 0,
              duration: 250,
              useNativeDriver: false,
            }),
            Animated.timing(buttonWidth, {
              toValue: 56,
              duration: 350,
              useNativeDriver: false,
            }),
          ]).start(() => {
            // Wait 3 seconds before next animation
            if (animationCount < maxAnimations) {
              setTimeout(() => {
                runAnimation();
              }, 3000);
            }
          });
        }, 2500);
      });
    };

    runAnimation();
  }, [buttonWidth, textOpacity]);

  useFocusEffect(
    useCallback(() => {
      // Reset state
      floatingButtonOpacity.setValue(0);
      floatingButtonScale.setValue(1);
      buttonWidth.setValue(56);
      textOpacity.setValue(0);

      // Simple entrance: just fade in
      Animated.timing(floatingButtonOpacity, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start(() => {
        // Wait a moment then expand
        setTimeout(() => {
          expandButton();
        }, 1000);
      });

      // Collapsing Playbook label
      if (playbookMeasuredWidth > 0) {
        playbookWidth.setValue(playbookMeasuredWidth);
        Animated.timing(playbookWidth, { toValue: 0, duration: 400, useNativeDriver: false }).start();
      }
    }, [
      playbookMeasuredWidth,
      floatingButtonOpacity,
      floatingButtonScale,
      playbookWidth,
      buttonWidth,
      textOpacity,
      expandButton,
    ])
  );



  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Refresh all dashboard data
    setTimeout(() => setRefreshing(false), 1000);
  };

  // (Removed) Test Faith Points and DB check helpers

  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerRight}>
        {/* Subscription Status */}
        <TouchableOpacity
          style={styles.subscriptionBadge}
          onPress={() => navigation.navigate('UserProfile')}
        >
          <Text style={styles.subscriptionText}>
            {(() => {
              const tier = subscription?.tier || 'basic';
              if (tier === 'basic') {return 'BASIC';}
              if (tier === 'free_trial') {return 'TRIAL';}
              return 'PREMIUM';
            })()}
          </Text>
        </TouchableOpacity>

        {/* Playbook Counter - hide entirely when unlimited */}
        {(() => {
          const limit = subscription?.limits?.playbooks;
          const used = usage?.playbooks_generated || 0;
          const isUnlimited = !limit || limit === -1;
          if (isUnlimited) { return null; }
          const remaining = Math.max(0, limit - used);
          return (
            <TouchableOpacity
              style={styles.counterBadge}
              onPress={() => navigation.navigate('Playbooks')}
            >
              <Ionicons name="book-outline" size={16} color={Colors.anchorBlue} />
              <Text style={styles.counterText}>{remaining}</Text>
            </TouchableOpacity>
          );
        })()}

        {/* Devotional Counter - hide entirely when unlimited */}
        {(() => {
          const limit = subscription?.limits?.devotionals;
          const used = usage?.devotionals_generated || 0;
          const isUnlimited = !limit || limit === -1;
          if (isUnlimited) { return null; }
          const remaining = Math.max(0, limit - used);
          return (
            <TouchableOpacity
              style={styles.counterBadge}
              onPress={() => navigation.navigate('Devotionals')}
            >
              <Ionicons name="heart-outline" size={16} color={Colors.devotionalPurple} />
              <Text style={styles.counterText}>{remaining}</Text>
            </TouchableOpacity>
          );
        })()}

        {/* Notifications */}
        <TouchableOpacity style={styles.iconButton}>
          <Ionicons name="notifications-outline" size={24} color={Colors.anchorBlue} />
          <View style={styles.notificationBadge}>
            <Text style={styles.notificationCount}>3</Text>
          </View>
        </TouchableOpacity>

        {/* User Profile */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('UserProfile')}
          activeOpacity={0.7}
        >
          {user?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: user.user_metadata.avatar_url }}
              style={styles.profileImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.initialAvatar}>
              <Text style={styles.initialLetter}>{(() => {
                const meta: any = (user as any)?.user_metadata || {};
                const displayName =
                  (user as any)?.displayName ||
                  meta.full_name ||
                  [meta.first_name, meta.last_name].filter(Boolean).join(' ').trim() ||
                  (user as any)?.email ||
                  'User';
                return (displayName || 'U').trim().charAt(0).toUpperCase();
              })()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGreeting = () => (
    <View style={styles.greetingSection}>
      <Text style={styles.greeting} numberOfLines={1} ellipsizeMode="tail">Hello, {firstName}</Text>
      <Text style={styles.motivationalText}>
        {MOTIVATIONAL_TEXTS[currentMotivationalText]}
      </Text>
    </View>
  );

  const renderPlaceholderCard = (title: string, subtitle: string, icon: string) => (
    <View style={styles.placeholderCard}>
      <View style={styles.cardHeader}>
        <Ionicons name={icon as any} size={24} color={Colors.anchorBlue} />
        <Text style={styles.cardTitle}>{title}</Text>
      </View>
      <Text style={styles.cardSubtitle}>{subtitle}</Text>
      <View style={styles.comingSoonBadge}>
        <Text style={styles.comingSoonText}>Coming Soon</Text>
      </View>
    </View>
  );

  const renderFloatingButton = () => (
    <Animated.View
      style={[
        styles.floatingButton,
        {
          transform: [
            { translateX: pan.x },
            { translateY: pan.y },
          ],
          opacity: floatingButtonOpacity,
        },
      ]}
      {...panResponder.panHandlers}
    >
      <Animated.View style={[styles.expandableButton, { width: buttonWidth }]}>
        <TouchableOpacity
          style={styles.expandableButtonTouchable}
          onPress={() => navigation.navigate('UserInput')}
          activeOpacity={0.8}
        >
          <View style={styles.crystalIconBackground}>
  <Image
    source={require('../../assets/icons/siFiaHeartWhiteTransparent.png')}
    style={styles.floatingButtonIcon}
    resizeMode="contain"
    accessibilityLabel="siFia"
  />
</View>
          <Animated.Text
            style={[styles.expandText, { opacity: textOpacity }]}
            numberOfLines={1}
          >
            Create a Playbook
          </Animated.Text>
        </TouchableOpacity>
      </Animated.View>
    </Animated.View>
  );

  // (Removed) Test buttons UI

  return (
    <View style={styles.container}>

      {renderHeader()}
      {renderGreeting()}

      <View style={styles.content}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          showsVerticalScrollIndicator={false}
        >
        {/* Row 1: Inspiration Cards */}
        <View style={styles.row}>
          <DailyAffirmationCard onRefresh={() => setRefreshing(true)} />
          <DailyBibleVerseCard onRefresh={() => setRefreshing(true)} />
        </View>

        {/* Row 2: Progress Carousels */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Journey</Text>
        </View>

        <DailyBibleVerseCard onVersePress={(verse) => dashboardNavigation.toVerseDetail(verse)} />
        <StreakTracker onStreakPress={(streak) => dashboardNavigation.toStreakDetail(streak.type)} />
        <WeeklyInsights onInsightPress={() => dashboardNavigation.toAnalytics()} />

        {/* AI Insights */}
        <AIInsights
          onInsightPress={() => dashboardNavigation.toAIInsights()}
          onActionPress={() => dashboardNavigation.toAIInsights()}
        />

        {/* Collapsing Playbook label */}
        <View style={styles.playbookLabelContainer}>
          <Animated.View
            style={[styles.playbookLabelClip, { width: playbookWidth }]}
          >
            <Text
              onLayout={(e) => {
                const w = e.nativeEvent.layout.width;
                if (w !== playbookMeasuredWidth) {
                  setPlaybookMeasuredWidth(w);
                }
              }}
              style={styles.playbookLabel}
            >
              Playbook
            </Text>
          </Animated.View>
        </View>

        <PlaybookCarousel
          onPlaybookPress={(playbook) => dashboardNavigation.toPlaybook(playbook.id)}
          onViewAll={() => {
            // Navigate to playbooks list
            console.log('Navigate to playbooks list');
          }}
        />
        <DevotionalCarousel
          onDevotionalPress={(devotional) => {
            // Navigate to devotional detail screen
            console.log('Navigate to devotional:', devotional.title);
          }}
          onViewAll={() => {
            // Navigate to devotionals list
            console.log('Navigate to devotionals list');
          }}
        />

        {/* Row 3: Action Items */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Today's Actions</Text>
        </View>

        <ActionStepsCard
          onStepPress={(step) => {
            // Navigate to step detail or playbook
            console.log('Navigate to step:', step.title);
          }}
          onViewAll={() => {
            // Navigate to all action steps
            console.log('Navigate to all action steps');
          }}
        />
        {renderPlaceholderCard('Reflection Questions', 'Guided spiritual growth', 'bulb')}

        {/* Row 4: Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.row}>
          <QuickActionCard
            title="Journal"
            description="Capture your thoughts"
            icon="journal"
            onPress={() => {
              // Navigate to journal screen
              console.log('Navigate to journal');
            }}
            accentColor={Colors.faithGold}
          />
          <QuickActionCard
            title="Prayer"
            description="Connect with God"
            icon="hands-up"
            onPress={() => {
              // Navigate to prayer screen
              console.log('Navigate to prayer');
            }}
            accentColor={Colors.spiritualPink}
          />
        </View>

        {/* Bottom spacing for floating button */}
        <View style={styles.bottomSpacing} />
        </ScrollView>
      </View>

      {showFab ? renderFloatingButton() : null}
      {/* Removed test buttons */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 0,
    backgroundColor: Colors.hopeWhite,
  },
  greetingSection: {
    backgroundColor: Colors.hopeWhite,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: Colors.anchorBlue,
    marginTop: 10,
    marginBottom: 0,
  },
  motivationalText: {
    fontSize: 14,
    color: Colors.darkerGray,
    opacity: 0.8,
    marginTop: 0,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  subscriptionBadge: {
    backgroundColor: Colors.faithGold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  subscriptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.hopeWhite,
    textTransform: 'uppercase',
  },
  counterBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.lightGray,
  },
  counterText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.darkerGray,
  },
  iconButton: {
    position: 'relative',
    padding: 4,
  },
  notificationBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.alertCoral,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notificationCount: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  profileButton: {
    padding: 2,
  },
  profileImage: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  initialAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.alertCoral,
    justifyContent: 'center',
    alignItems: 'center',
  },
  initialLetter: {
    color: Colors.hopeWhite,
    fontSize: 12,
    fontWeight: '700' as const,
  },
  content: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 120,
    paddingTop: 16,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  placeholderCard: {
    flex: 1,
    backgroundColor: Colors.cardBackground,
    borderRadius: 12,
    padding: 20,
    marginBottom: 20,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.darkerGray,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.mediumGray,
    marginBottom: 12,
  },
  comingSoonBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.anchorBlueLight,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  comingSoonText: {
    fontSize: 10,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  floatingButton: {
    position: 'absolute',
    top: 0,
    right: 0, // Changed from left: 0 to right: 0 for rightward anchoring
    zIndex: 1000,
  },
  expandableButton: {
    backgroundColor: Colors.hopeWhite, // Crystal glassy background
    borderRadius: 28,
    height: 56,
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    alignSelf: 'flex-end', // Anchor to right so it expands left
  },
  expandableButtonTouchable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center', // Center contents for proper icon centering when collapsed
    paddingLeft: 8, // Slightly less left padding to center icon better
    paddingRight: -8, // Normal right padding
    minWidth: 56, // Ensure touchable area is always a circle when collapsed
  },
  expandText: {
    color: Colors.anchorBlue,
    fontFamily: Fonts.medium,
    fontSize: 14, // Increased from 12 to 14
    fontWeight: '700',
    marginLeft: 8, // Space between icon and text (icon comes before text)
    letterSpacing: 0.3,
    flex: 1, // Take up available space
  },
  floatingButtonIcon: {
    width: 40,
    height: 40,
    alignSelf: 'center',
  },
  crystalIconBackground: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSpacing: {
    height: 100,
  },
  playbookLabelContainer: {
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  playbookLabelClip: {
    overflow: 'hidden',
  },
  playbookLabel: {
    color: Colors.hopeWhite,
    fontFamily: Fonts.bold,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  // (Removed) styles for test buttons
});

export default DashboardHomeScreen;
