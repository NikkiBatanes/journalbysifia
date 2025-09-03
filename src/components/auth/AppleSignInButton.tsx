/**
 * Apple Sign-In Button Component
 * Enterprise-grade UI component with proper styling and accessibility
 */

import React from 'react';
import { TouchableOpacity, Text, View, StyleSheet, ActivityIndicator } from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';

interface AppleSignInButtonProps {
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  style?: any;
}

export const AppleSignInButton: React.FC<AppleSignInButtonProps> = ({
  onPress,
  loading = false,
  disabled = false,
  style,
}) => {
  return (
    <TouchableOpacity
      style={[styles.button, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={loading || disabled}
      accessibilityLabel="Continue with Apple"
      accessibilityRole="button"
      accessibilityState={{ disabled: loading || disabled }}
    >
      <View style={styles.content}>
        {loading ? (
          <ActivityIndicator size="small" color={Colors.hopeWhite} style={styles.icon} />
        ) : (
          <View style={styles.appleIcon}>
            <Text style={styles.appleIconText}>🍎</Text>
          </View>
        )}
        <Text style={styles.text}>
          {loading ? 'Signing in...' : 'Continue with Apple'}
        </Text>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    backgroundColor: Colors.darkerGray,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 20,
    marginVertical: 8,
    shadowColor: Colors.darkerGray,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  disabled: {
    opacity: 0.6,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    marginRight: 12,
  },
  appleIcon: {
    marginRight: 12,
  },
  appleIconText: {
    fontSize: 20,
  },
  text: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
});
