/**
 * DashboardHomeScreen.tsx
 * Enterprise-grade dashboard home screen with comprehensive faith-based features
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  PanResponder,
  Dimensions,
  Alert,
  RefreshControl,
  Platform,
  StyleSheet,
  Image,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { useSubscription } from '../hooks/useSubscription';
import { useTheme } from '../hooks/useTheme';
import { intelligenceService } from '../services/intelligenceService';
import { subscriptionService } from '../services/subscriptionService';

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
  const theme = useTheme();
  const Colors = theme.colors;
  const Fonts = theme.typography;

  // Create styles using theme values
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
      paddingBottom: 12,
      backgroundColor: Colors.hopeWhite,
    },
    headerLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: Colors.primary,
    },
    subscriptionBadge: {
      backgroundColor: Colors.faithGold,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 16,
      marginLeft: 12,
    },
    subscriptionText: {
      color: Colors.hopeWhite,
      fontSize: 12,
      fontWeight: '600',
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    profileButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.lightGray,
      justifyContent: 'center',
      alignItems: 'center',
    },
    scrollContainer: {
      flex: 1,
    },
    content: {
      flex: 1,
      backgroundColor: Colors.anchorBlue,
      borderTopLeftRadius: 32,
      borderTopRightRadius: 32,
      overflow: 'hidden',
      // Increase overlap so rounded corners are clearly visible
      marginTop: -20,
      paddingTop: 0,
      position: 'relative',
      zIndex: 2,
      // subtle top elevation so corners are visible
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: -2 },
      shadowOpacity: 0.06,
      shadowRadius: 6,
    },
    sectionHeader: {
      marginTop: 24,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.text,
    },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    playbookLabelContainer: {
      marginTop: 24,
      marginBottom: 16,
      overflow: 'hidden',
    },
    playbookLabelClip: {
      overflow: 'hidden',
    },
    playbookLabel: {
      fontSize: 20,
      fontWeight: 'bold',
      color: Colors.text,
    },
    bottomSpacing: {
      height: 100,
    },
    floatingButton: {
      position: 'absolute',
      bottom: 30,
      right: 20,
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: Colors.spiritualPink,
      justifyContent: 'center',
      alignItems: 'center',
      shadowColor: Colors.primary,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 8,
    },
    floatingButtonText: {
      color: Colors.hopeWhite,
      fontSize: 24,
      fontWeight: '700',
      letterSpacing: 0.5,
    },
    counterBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: Colors.hopeWhite,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
      gap: 4,
      // Remove elevation/shadow; use subtle border instead
      borderWidth: 1,
      borderColor: Colors.faithGold,
    },
    counterText: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.anchorBlue,
    },
    iconButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationBadge: {
      position: 'absolute',
      top: -2,
      right: -2,
      backgroundColor: Colors.alertCoral,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notificationCount: {
      fontSize: 12,
      fontWeight: '600',
      color: Colors.hopeWhite,
    },
    profileImage: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.lightGray,
    },
    initialAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.alertCoral,
      justifyContent: 'center',
      alignItems: 'center',
    },
    initialLetter: {
      fontSize: 16,
      fontWeight: '600',
      color: Colors.hopeWhite,
    },
    greetingSection: {
      backgroundColor: Colors.hopeWhite,
      paddingHorizontal: 20,
      paddingTop: 0,
      paddingBottom: 16,
    },
    greeting: {
      fontSize: 24,
      fontWeight: '800',
      letterSpacing: 0.5,
      color: Colors.anchorBlue,
      marginTop: 0,
      marginBottom: 2,
    },
    motivationalText: {
      fontSize: 14,
      color: Colors.anchorBlue,
      fontWeight: '600',
      opacity: 1,
      marginTop: 0,
      marginBottom: 12,
    },
    placeholderCard: {
      backgroundColor: Colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      shadowColor: Colors.cardShadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
      borderWidth: 1,
      borderColor: Colors.cardBorder,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 12,
      gap: 8,
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: Colors.text,
    },
    cardSubtitle: {
      fontSize: 14,
      color: Colors.secondary,
      marginBottom: 8,
    },
    comingSoonBadge: {
      backgroundColor: Colors.faithGold,
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 12,
    },
    comingSoonText: {
      fontSize: 10,
      fontWeight: '600',
      color: Colors.hopeWhite,
    },
    scrollView: {
      flex: 1,
      backgroundColor: 'transparent',
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 0,
      paddingTop: 0,
    },
    expandableButton: {
      backgroundColor: Colors.cardBackground,
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
    },
    expandableButtonTouchable: {
      borderRadius: 12,
    },
    crystalIconBackground: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: Colors.spiritualPink,
      justifyContent: 'center',
      alignItems: 'center',
    },
    floatingButtonIcon: {
      width: 24,
      height: 24,
      tintColor: Colors.hopeWhite,
    },
    expandText: {
      fontSize: 14,
      color: Colors.text,
      fontWeight: '600',
    },
  });

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
  const { subscription, usage, loading: subscriptionLoading } = useSubscription();
  const queryClient = useQueryClient();
  
  // Add direct subscription fetch for debugging
  const [directSubscription, setDirectSubscription] = useState<any>(null);
  
  useEffect(() => {
    const fetchDirectSubscription = async () => {
      if (user?.id) {
        try {
          const { subscriptionService } = await import('../services/subscriptionService');
          const directData = await subscriptionService.getUserSubscription(user.id);
          setDirectSubscription(directData);
          console.log('🔄 Direct subscription fetch:', {
            directTier: directData?.tier,
            directStatus: directData?.status,
            cachedTier: subscription?.tier,
            cachedStatus: subscription?.status,
            dataMatch: directData?.tier === subscription?.tier,
            timestamp: new Date().toISOString()
          });
          
          // If data doesn't match, invalidate React Query cache
          if (directData?.tier !== subscription?.tier && subscription?.tier) {
            console.log('🔄 Cache mismatch detected, invalidating React Query cache');
            queryClient.invalidateQueries({ queryKey: ['subscription', user.id] });
          }
        } catch (error) {
          console.error('Direct subscription fetch failed:', error);
        }
      }
    };
    fetchDirectSubscription();
  }, [user?.id, subscription?.tier, queryClient]); // Re-run when cached subscription changes
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
      {/* Right side - Subscription and Profile */}
      <View style={styles.headerRight}>
        {/* Subscription Status */}
        <TouchableOpacity
          style={styles.subscriptionBadge}
          onPress={() => navigation.navigate('UserProfile')}
        >
          <Text style={styles.subscriptionText}>
            {(() => {
              // Use direct subscription if available and different from cached
              const activeSubscription = (directSubscription && directSubscription.tier !== subscription?.tier) 
                ? directSubscription 
                : subscription;
              
              const tier = activeSubscription?.tier || 'seeker';
              const status = activeSubscription?.status || 'active';
              const tierBase = tier.replace(/_annual$/, '');
              
              // Test all possible tier combinations
              const tierMappings = {
                // Free tier
                'free_trial': 'TRIAL',
                
                // Seeker (free forever)
                'seeker': 'SEEKER',
                'basic': 'SEEKER',
                
                // Spark (entry paid)
                'spark': 'SPARK',
                'spark_annual': 'SPARK',
                'starter': 'SPARK',
                'starter_annual': 'SPARK',
                
                // Growth (mid tier)
                'growth': 'GROWTH',
                'growth_annual': 'GROWTH',
                
                // Transformation (premium)
                'transformation': 'TRANSFORMATION',
                'transformation_annual': 'TRANSFORMATION',
                
                // Family (top tier)
                'family': 'FAMILY',
                'family_annual': 'FAMILY'
              };
              
              const displayName = tierMappings[tier as keyof typeof tierMappings] || tierMappings[tierBase as keyof typeof tierMappings];
              
              if (displayName) {
                console.log(`✅ Dashboard: Mapped ${tier} -> ${displayName} (using ${directSubscription && directSubscription.tier !== subscription?.tier ? 'direct' : 'cached'} data)`);
                return displayName;
              }
              
              // Fallback with debug info
              console.log('⚠️ Dashboard: Unknown tier, falling back to PREMIUM:', { tier, tierBase });
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
              <MaterialCommunityIcons name="clipboard-text-play" size={18} color={Colors.faithGold} />
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
              <MaterialCommunityIcons name="book" size={18} color={Colors.faithGold} />
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

        {/* Profile Avatar with Notification */}
        <TouchableOpacity
          style={styles.profileButton}
          onPress={() => navigation.navigate('UserProfile')}
        >
          {user?.user_metadata?.avatar_url ? (
            <Image
              source={{ uri: user.user_metadata.avatar_url }}
              style={styles.profileImage}
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
          contentInsetAdjustmentBehavior="never"
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

        {/* Row 2: Progress Tracking */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Your Journey</Text>
        </View>

        <StreakTracker onStreakPress={(streak) => navigation.navigate('StreakDetail', { type: streak.type })} />
        <WeeklyInsights onInsightPress={() => navigation.navigate('Analytics')} />

        {/* AI Insights */}
        <AIInsights
          onInsightPress={() => navigation.navigate('AIInsights')}
          onActionPress={() => navigation.navigate('AIInsights')}
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
          onPlaybookPress={(playbook) => navigation.navigate('Playbook', { id: playbook.id })}
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
        
        {/* Reflection Questions Card */}
        {renderPlaceholderCard('Reflection Questions', 'Guided spiritual growth', 'bulb-outline')}
        
        {/* Prayer Requests Section */}
        {renderPlaceholderCard('Prayer Requests', 'Share and track prayers', 'heart-outline')}
        
        {/* Community Section */}
        {renderPlaceholderCard('Faith Community', 'Connect with others', 'people-outline')}

        {/* Row 4: Quick Actions */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.row}>
          <QuickActionCard
            title="Journal"
            description="Capture your thoughts"
            icon="journal"
            onPress={() => navigation.navigate('Journal')}
            accentColor={Colors.faithGold}
          />
          <QuickActionCard
            title="Prayer"
            description="Connect with God"
            icon="hands-up"
            onPress={() => navigation.navigate('Prayer')}
            accentColor={Colors.spiritualPink}
          />
        </View>

        <View style={styles.row}>
          <QuickActionCard
            title="Scripture"
            description="Read and study"
            icon="book-outline"
            onPress={() => navigation.navigate('Scripture')}
            accentColor={Colors.anchorBlue}
          />
          <QuickActionCard
            title="Worship"
            description="Songs and praise"
            icon="musical-notes-outline"
            onPress={() => navigation.navigate('Worship')}
            accentColor={Colors.devotionalPurple}
          />
        </View>

        {/* Growth Tracking Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Growth & Progress</Text>
        </View>

        {renderPlaceholderCard('Faith Milestones', 'Track your spiritual journey', 'trophy-outline')}
        {renderPlaceholderCard('Reading Plan', 'Bible reading progress', 'library-outline')}
        
        {/* Community & Sharing */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Community</Text>
        </View>

        {renderPlaceholderCard('Prayer Circle', 'Join prayer groups', 'people-circle-outline')}
        {renderPlaceholderCard('Testimonies', 'Share your story', 'megaphone-outline')}

        {/* Bottom spacing for floating button (only when visible) */}
        {showFab ? <View style={styles.bottomSpacing} /> : null}
        </ScrollView>
      </View>

      {showFab ? renderFloatingButton() : null}
    </View>
  );
};

export default DashboardHomeScreen;
