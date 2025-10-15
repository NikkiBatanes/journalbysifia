/**
 * ENTERPRISE IMPROVEMENT: Purchase Loading Modal
 * 
 * Explanation: This modal provides clear feedback during payment processing.
 * Benefits:
 * - Shows user what's happening (not a black screen)
 * - Multi-step progress indication
 * - Prevents confusion and anxiety
 * - Can't be dismissed during critical operations
 * - Required for enterprise-grade UX
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Animated,
  Dimensions,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../theme/ThemeContext';

const { width } = Dimensions.get('window');

interface PurchaseLoadingModalProps {
  visible: boolean;
  step: 'processing' | 'validating' | 'activating' | 'completing';
}

export const PurchaseLoadingModal: React.FC<PurchaseLoadingModalProps> = ({
  visible,
  step,
}) => {
  const theme = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (visible) {
      // Fade in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.1,
            duration: 1000,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 1000,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      fadeAnim.setValue(0);
      pulseAnim.setValue(1);
    }
  }, [visible]);

  const getStepInfo = () => {
    const steps = {
      processing: {
        title: 'Processing Payment',
        description: 'Securely processing your payment with Apple...',
        icon: 'card-outline',
        color: '#4ECDC4',
        progress: 25,
      },
      validating: {
        title: 'Validating Receipt',
        description: 'Verifying your purchase with Apple servers...',
        icon: 'shield-checkmark-outline',
        color: '#95E1D3',
        progress: 50,
      },
      activating: {
        title: 'Activating Subscription',
        description: 'Setting up your account and benefits...',
        icon: 'checkmark-circle-outline',
        color: '#FFD93D',
        progress: 75,
      },
      completing: {
        title: 'Almost Done',
        description: 'Finalizing your subscription...',
        icon: 'rocket-outline',
        color: '#FF6B6B',
        progress: 90,
      },
    };

    return steps[step] || steps.processing;
  };

  const stepInfo = getStepInfo();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            {
              backgroundColor: '#1a3c6d', // Correct anchor blue from theme
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Animated Icon */}
          <Animated.View
            style={[
              styles.iconContainer,
              {
                backgroundColor: '#FF6B6B' + '20', // Alert coral with transparency
                transform: [{ scale: pulseAnim }],
              },
            ]}
          >
            <Ionicons name={stepInfo.icon} size={48} color="#FF6B6B" />
          </Animated.View>

          {/* Title */}
          <Text style={[styles.title, { color: '#F8F9FA' }]}>
            {stepInfo.title}
          </Text>

          {/* Description */}
          <Text style={[styles.description, { color: '#F8F9FA' }]}>
            {stepInfo.description}
          </Text>

          {/* Progress Bar */}
          <View style={[styles.progressBarContainer, { backgroundColor: 'rgba(248, 249, 250, 0.2)' }]}>
            <Animated.View
              style={[
                styles.progressBar,
                {
                  backgroundColor: stepInfo.color,
                  width: `${stepInfo.progress}%`,
                },
              ]}
            />
          </View>

          {/* Progress Percentage */}
          <Text style={[styles.progressText, { color: '#F8F9FA' }]}>
            {stepInfo.progress}% Complete
          </Text>

          {/* Spinner */}
          <ActivityIndicator
            size="large"
            color="#FF6B6B"
            style={styles.spinner}
          />

          {/* Security Notice */}
          <View style={styles.securityNotice}>
            <Ionicons name="lock-closed" size={14} color="#4CAF50" />
            <Text style={styles.securityText}>
              Secure transaction protected by Apple
            </Text>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: width - 60,
    maxWidth: 360,
    borderRadius: 30,
    padding: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 22,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 20,
  },
  spinner: {
    marginBottom: 20,
  },
  securityNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(76, 175, 80, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  securityText: {
    fontSize: 12,
    color: '#4CAF50',
    marginLeft: 6,
    fontWeight: '500',
  },
});
