import React, { useContext, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { DevotionalContext } from '../context/DevotionalContext';
import { Colors } from '../theme/colors';

const AppNotification: React.FC = () => {
  const { successMessage, clearSuccessMessage } = useContext(DevotionalContext);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-20)).current;

  useEffect(() => {
    if (successMessage) {
      // Reset animations
      fadeAnim.setValue(0);
      slideAnim.setValue(-20);

      // Slide in animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();

      // Auto-dismiss after 3 seconds
      const timer = setTimeout(() => {
        Animated.parallel([
          Animated.timing(fadeAnim, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(slideAnim, {
            toValue: -20,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(clearSuccessMessage);
      }, 3000);

      return () => clearTimeout(timer);
    }
  }, [successMessage, clearSuccessMessage, fadeAnim, slideAnim]);

  if (!successMessage) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
      pointerEvents="box-none"
    >
      <View style={styles.notification}>
        <Text style={styles.text}>{successMessage}</Text>
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
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

export default AppNotification;
