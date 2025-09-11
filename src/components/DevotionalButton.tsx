import React from 'react';
import { TouchableOpacity, Text, StyleSheet, View } from 'react-native';
import { Colors } from '../theme/colors';
import { Fonts } from '../theme/fonts';
import ThemedText from './common/ThemedText';

interface DevotionalButtonProps {
  onPress: () => void;
  visible: boolean;
}

const DevotionalButton: React.FC<DevotionalButtonProps> = ({ onPress, visible }) => {
  if (!visible) {return null;}

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.button}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <ThemedText weight="semiBold" style={styles.buttonText}>Create a Devotional</ThemedText>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    alignItems: 'center',
    zIndex: 100,
  },
  button: {
    // Match onboarding Playbook Ready button styling
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    height: 56,
    marginHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    paddingVertical: 16,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    // Typography handled by ThemedText weight="semiBold"
  },
});

export default DevotionalButton;
