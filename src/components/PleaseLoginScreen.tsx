import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';

interface PleaseLoginScreenProps {
  onLoginPress: () => void;
  message?: string;
}

const PleaseLoginScreen: React.FC<PleaseLoginScreenProps> = ({
  onLoginPress,
  message = 'Please sign in to continue using siFia',
}) => {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconContainer}>
          <Ionicons name="person-circle-outline" size={80} color={Colors.faithGold} />
        </View>

        <Text style={styles.title}>Authentication Required</Text>
        <Text style={styles.message}>{message}</Text>

        <TouchableOpacity style={styles.loginButton} onPress={onLoginPress}>
          <Text style={styles.loginButtonText}>Sign In</Text>
        </TouchableOpacity>

        <Text style={styles.footerText}>
          Your session helps us provide a personalized experience
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.hopeWhite,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },
  iconContainer: {
    marginBottom: 30,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 15,
  },
  message: {
    fontSize: 16,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 40,
  },
  loginButton: {
    backgroundColor: Colors.faithGold,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 40,
    marginBottom: 30,
  },
  loginButtonText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontWeight: '600',
  },
  footerText: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    fontStyle: 'italic',
  },
});

export default PleaseLoginScreen;
