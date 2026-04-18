/**
 * StreakPlanScreen.tsx
 * Displays a celebration screen after completing a playbook
 * Shows streak animation, messaging, and weekly streak visual
 */

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, ScrollView, Animated } from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { Colors } from '../theme/colors';
import Ionicons from 'react-native-vector-icons/Ionicons';
import WeeklyStreakRow, { DayState } from '../components/WeeklyStreakRow';
import { triggerLightHaptic } from '../utils/haptics';

interface RouteParams {
  playbookId?: string;
  userId?: string;
  source?: string;
}

const StreakPlanScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const theme = useTheme();
  const font = { fontFamily: theme.fontFamily };
  const params = route.params as RouteParams;

  // Animation values
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideUpAnim = useRef(new Animated.Value(30)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Entrance animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 100,
        useNativeDriver: true,
      }),
      Animated.timing(slideUpAnim, {
        toValue: 0,
        duration: 600,
        delay: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        delay: 300,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // Mock streak data - in production, fetch from streak tracking service
  const getDayStates = (): DayState[] => {
    // For demo: show today as completed, some past days completed/missed
    return ['completed', 'completed', 'missed', 'completed', 'completed', 'today', 'future'];
  };

  const handleContinue = () => {
    try { triggerLightHaptic(); } catch {}
    
    // Navigate to appropriate screen based on source
    const source = params?.source;
    if (source === 'user_input') {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: { routes: [{ name: 'Home' }], index: 0 },
          },
        ],
      });
    } else {
      navigation.reset({
        index: 0,
        routes: [
          {
            name: 'MainTabs',
            state: { routes: [{ name: 'Home' }, { name: 'PlaybookList' }], index: 1 },
          },
        ],
      });
    }
  };

  const handleProcessAnotherMoment = () => {
    try { triggerLightHaptic(); } catch {}
    navigation.navigate('UserInputScreen' as never);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: Colors.anchorBlue }]}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Streak animation / celebration icon */}
        <Animated.View style={[styles.iconContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
          <View style={styles.iconCircle}>
            <Ionicons name="flame" size={48} color={Colors.faithGold} />
          </View>
        </Animated.View>

        {/* Hero text */}
        <Animated.View style={[styles.textContainer, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          <Text style={[styles.heroText, font]}>1 Day of Faithfulness</Text>
          <Text style={[styles.subText, font]}>
            You took a faithful step today. Keep bringing your moments to God.
          </Text>
        </Animated.View>

        {/* Weekly streak visual */}
        <Animated.View style={[styles.streakContainer, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          <WeeklyStreakRow
            weekStart="Sunday" // In production, fetch from user preferences
            dayStates={getDayStates()}
          />
        </Animated.View>

        {/* Action buttons */}
        <Animated.View style={[styles.buttonsContainer, { opacity: fadeAnim, transform: [{ translateY: slideUpAnim }] }]}>
          <TouchableOpacity
            style={[styles.primaryButton]}
            onPress={handleContinue}
            activeOpacity={0.85}
          >
            <Text style={[styles.primaryButtonText, font]}>Continue</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton]}
            onPress={handleProcessAnotherMoment}
            activeOpacity={0.85}
          >
            <Text style={[styles.secondaryButtonText, font]}>Process Another Moment</Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: 'rgba(250, 190, 88, 0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.faithGold,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 20,
    elevation: 8,
  },
  textContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  heroText: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 0.5,
  },
  subText: {
    fontSize: 16,
    fontWeight: '400',
    color: 'rgba(255, 255, 255, 0.85)',
    textAlign: 'center',
    lineHeight: 24,
    paddingHorizontal: 16,
  },
  streakContainer: {
    width: '100%',
    marginBottom: 48,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 20,
    padding: 16,
  },
  buttonsContainer: {
    width: '100%',
    gap: 16,
  },
  primaryButton: {
    backgroundColor: Colors.faithGold,
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.faithGold,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.hopeWhite,
  },
});

export default StreakPlanScreen;
