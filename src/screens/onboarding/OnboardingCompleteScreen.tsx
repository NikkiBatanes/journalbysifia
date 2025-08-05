/**
 * OnboardingCompleteScreen.tsx
 * Final screen that transitions users to the main app
 */

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../theme/colors';

const OnboardingCompleteScreen: React.FC = () => {
  const navigation = useNavigation();

  useEffect(() => {
    // Auto-navigate to main app after 2 seconds
    const timer = setTimeout(() => {
      // Reset navigation stack and go to main app
      navigation.reset({
        index: 0,
        routes: [{ name: 'MainTabs' as never }],
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigation]);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />

      <View style={styles.content}>
        <Ionicons name="checkmark-circle" size={80} color={Colors.lightBlue} />
        <Text style={styles.title}>Welcome to siFia!</Text>
        <Text style={styles.subtitle}>
          Your spiritual growth journey begins now
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.white,
    marginTop: 24,
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },
});

export default OnboardingCompleteScreen;
