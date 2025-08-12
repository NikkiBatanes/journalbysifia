/**
 * DashboardHomeScreen.tsx
 * Enterprise-grade dashboard home screen with comprehensive faith-based features
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  StatusBar,
  Animated,
  RefreshControl,
  PanResponder,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { Colors } from '../theme/colors';
import { supabase } from '../services/supabaseClient';
import { checkDatabaseTables } from '../utils/databaseCheck';
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
  const { user } = useAuth();
  const { subscription, usage } = useSubscription();
  const [refreshing, setRefreshing] = useState(false);
  const [currentMotivationalText, setCurrentMotivationalText] = useState(0);

  const floatingButtonScale = useRef(new Animated.Value(1)).current;


  // Draggable floating button
  const pan = useRef(new Animated.ValueXY({ x: width - 76, y: height - 200 })).current;

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
        // Snap to edges
        const snapToEdge = (pan.x as any)._value > width / 2 ? width - 76 : 20;
        Animated.spring(pan.x, {
          toValue: snapToEdge,
          useNativeDriver: false,
        }).start();
      },
    })
  ).current;

  // Get user's first name
  const firstName = user?.user_metadata?.first_name ||
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

  // Floating button animation
  useEffect(() => {
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(floatingButtonScale, {
          toValue: 1.1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(floatingButtonScale, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );
    pulseAnimation.start();

    return () => pulseAnimation.stop();
  }, [floatingButtonScale]);

  const onRefresh = async () => {
    setRefreshing(true);
    // TODO: Refresh all dashboard data
    setTimeout(() => setRefreshing(false), 1000);
  };

  // Test Faith Points System (temporary)
  const handleTestFaithPoints = async () => {
    if (!user?.id) {
      console.log('❌ No user ID found!');
      return;
    }

    console.log('🧪 Testing Faith Points System...');
    console.log(`👤 User ID: ${user.id}`);

    try {
      // Step 0: Check database tables
      console.log('💾 Step 0: Checking database tables...');
      await checkDatabaseTables();

      // Step 1: Check if user profile exists
      console.log('🔍 Step 1: Checking user profile...');
      const { data: existingProfile, error: profileError } = await supabase
        .from('faith_points_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (profileError) {
        console.log('⚠️ Profile error:', profileError);
      } else {
        console.log('✅ Existing profile:', existingProfile);
      }

      // Step 2: Test faith points service directly
      console.log('🎯 Step 2: Testing faith points service...');
      const { faithPointsService } = await import('../services/faithPointsService');

      const profile = await faithPointsService.getUserProfile(user.id);
      console.log('📊 Current profile:', profile);

      // Step 3: Award test points
      console.log('🎆 Step 3: Awarding test points...');
      const awardResult = await faithPointsService.awardPoints(user.id, 'devotional_generated');
      console.log('🎉 Award result:', awardResult);

      // Step 4: Check updated profile
      console.log('🔄 Step 4: Checking updated profile...');
      const updatedProfile = await faithPointsService.getUserProfile(user.id);
      console.log('📊 Updated profile:', updatedProfile);

      // Step 5: Check database directly
      console.log('💾 Step 5: Checking database...');
      const { data: dbProfile } = await supabase
        .from('faith_points_profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();
      console.log('💾 Database profile:', dbProfile);

      const { data: transactions } = await supabase
        .from('faith_points_log')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5);
      console.log('📜 Recent transactions:', transactions);

    } catch (error) {
      console.error('❌ Test failed with error:', error);
    }
  };

  // Check Database Tables
  const handleCheckDatabase = async () => {
    console.log('💾 Checking Database Tables...');
    const result = await checkDatabaseTables();

    if (result.profilesTable && result.logTable) {
      console.log('✅ All faith points tables exist!');
    } else {
      console.log('❌ Missing tables detected!');
      console.log('📝 Please run the SQL in database/faith_points_minimal.sql');
      console.log('📝 Or check DATABASE_SETUP.md for instructions');
    }
  };

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
        >
          <Ionicons name="person-circle-outline" size={28} color={Colors.anchorBlue} />
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderGreeting = () => (
    <View style={styles.greetingSection}>
      <Text style={styles.greeting}>Hello, {firstName}</Text>
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
            { scale: floatingButtonScale },
          ],
        },
      ]}
      {...panResponder.panHandlers}
    >
      <TouchableOpacity
        style={styles.floatingButtonInner}
        onPress={() => navigation.navigate('UserInput')}
        activeOpacity={0.8}
      >
        <Text style={styles.floatingButtonText}>siFia</Text>
        <Ionicons name="sparkles" size={16} color={Colors.hopeWhite} />
      </TouchableOpacity>
    </Animated.View>
  );

  const renderTestButton = () => (
    <>
      <TouchableOpacity
        style={styles.testButton}
        onPress={handleTestFaithPoints}
        activeOpacity={0.8}
      >
        <Text style={styles.testButtonText}>Test Faith Points</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.testButton, styles.dbTestButton]}
        onPress={handleCheckDatabase}
        activeOpacity={0.8}
      >
        <Text style={styles.testButtonText}>Check DB</Text>
      </TouchableOpacity>
    </>
  );

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

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

      {renderFloatingButton()}
      {renderTestButton()}
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
    paddingVertical: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.anchorBlue,
    marginBottom: 0,
  },
  motivationalText: {
    fontSize: 14,
    color: Colors.darkerGray,
    opacity: 0.8,
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
    paddingTop: 40,
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
    left: 0,
    zIndex: 1000,
  },
  floatingButtonInner: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 28,
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.cardShadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    flexDirection: 'row',
    gap: 4,
  },
  floatingButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
  bottomSpacing: {
    height: 100,
  },
  testButton: {
    position: 'absolute',
    top: 100,
    right: 20,
    backgroundColor: Colors.spiritualPink,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  dbTestButton: {
    top: 140,
    backgroundColor: Colors.alertCoral,
  },
  testButtonText: {
    fontSize: 12,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
  },
});

export default DashboardHomeScreen;
