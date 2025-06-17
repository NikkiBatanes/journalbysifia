import React, { useEffect } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors } from '../theme/colors';

interface SuccessNotificationProps {
  message: string | null;
  onDismiss: () => void;
}

const SuccessNotification: React.FC<SuccessNotificationProps> = ({ message, onDismiss }) => {
  const fadeAnim = new Animated.Value(0);
  const slideAnim = new Animated.Value(-50);

  useEffect(() => {
    if (message) {
      // Reset animations
      fadeAnim.setValue(0);
      slideAnim.setValue(-50);

      // Slide in animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 20,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -50,
            duration: 300,
            useNativeDriver: true,
          }),
        ]).start(() => onDismiss());
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [message]);

  if (!message) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.notification}>
        <Text style={styles.text}>{message}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30,
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  notification: {
    backgroundColor: Colors.growthGreen,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 24,
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  text: {
    color: Colors.hopeWhite,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SuccessNotification;
