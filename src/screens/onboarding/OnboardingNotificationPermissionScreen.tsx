/**
 * OnboardingNotificationPermissionScreen.tsx
 * Phase 1.2: Notification Permission Request
 * Uses existing notification types from codebase
 */

import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
  StatusBar,
  Platform,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const OnboardingNotificationPermissionScreen: React.FC = () => {
  const navigation = useNavigation();
  const [isLoading, setIsLoading] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;

  useEffect(() => {
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  const handleEnableNotifications = async () => {
    setIsLoading(true);

    try {
      // Request notification permission (platform-specific)
      if (Platform.OS === 'ios') {
        // iOS permission request would go here
        console.log('📱 iOS notification permission requested');
      } else {
        // Android permission handling
        console.log('📱 Android notification permission requested');
      }

      // Simulate permission request
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Navigate to completion screen
      console.log('🔔 Notifications enabled, showing completion screen');
      navigation.navigate('OnboardingComplete' as any);
    } catch (error) {
      Alert.alert('Permission Error', 'Unable to request notification permission');
    } finally {
      setIsLoading(false);
    }
  };

  const handleMaybeLater = () => {
    // Navigate to completion screen without notifications
    console.log('🔕 Notifications skipped, showing completion screen');
    navigation.navigate('OnboardingComplete' as any);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="notifications-outline" size={80} color={Colors.white} />
        </View>

        {/* Title */}
        <Text style={styles.title}>Stay Connected to Your Spiritual Growth</Text>

        {/* Description */}
        <Text style={styles.description}>
          Get gentle reminders and encouragement to help you stay consistent in your faith journey.
        </Text>

        {/* Benefits list */}
        <View style={styles.benefitsList}>
          <View style={styles.benefitItem}>
            <Ionicons name="book-outline" size={20} color={Colors.lightBlue} />
            <Text style={styles.benefitText}>Daily devotional reminders</Text>
          </View>

          <View style={styles.benefitItem}>
            <Ionicons name="heart-outline" size={20} color={Colors.lightBlue} />
            <Text style={styles.benefitText}>Prayer time notifications</Text>
          </View>

          <View style={styles.benefitItem}>
            <Ionicons name="journal-outline" size={20} color={Colors.lightBlue} />
            <Text style={styles.benefitText}>Journal writing prompts</Text>
          </View>

          <View style={styles.benefitItem}>
            <Ionicons name="trophy-outline" size={20} color={Colors.lightBlue} />
            <Text style={styles.benefitText}>Progress celebrations</Text>
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleEnableNotifications}
            disabled={isLoading}
          >
            <Text style={styles.primaryButtonText}>
              {isLoading ? 'Requesting...' : 'Enable Notifications'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={handleMaybeLater}
            disabled={isLoading}
          >
            <Text style={styles.secondaryButtonText}>Maybe Later</Text>
          </TouchableOpacity>
        </View>

        {/* Progress indicator */}
        <View style={styles.progressContainer}>
          <View style={styles.progressDot} />
          <View style={[styles.progressDot, styles.progressDotActive]} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
          <View style={styles.progressDot} />
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
    justifyContent: 'space-between',
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 34,
  },
  description: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 24,
  },
  benefitsList: {
    marginBottom: 40,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 16,
  },
  benefitText: {
    fontSize: 16,
    color: Colors.white,
    marginLeft: 16,
    flex: 1,
  },
  buttonContainer: {
    marginBottom: 32,
  },
  primaryButton: {
    backgroundColor: Colors.white,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.anchorBlue,
  },
  secondaryButton: {
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textDecorationLine: 'underline',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  progressContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 4,
    opacity: 0.3,
  },
  progressDotActive: {
    opacity: 1,
    backgroundColor: Colors.white,
  },
});

export default OnboardingNotificationPermissionScreen;
