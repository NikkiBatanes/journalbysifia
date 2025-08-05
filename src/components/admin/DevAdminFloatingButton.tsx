import React from 'react';
import { TouchableOpacity, StyleSheet, View, Platform } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';

interface DevAdminFloatingButtonProps {
  onPress: () => void;
  visible?: boolean;
}

const DevAdminFloatingButton: React.FC<DevAdminFloatingButtonProps> = ({ onPress, visible = true }) => {
  if (!visible) {return null;}
  
  const handlePress = () => {
    console.log('🔴 DevAdminFloatingButton pressed!');
    onPress();
  };
  
  return (
    <View pointerEvents="box-none" style={styles.container}>
      <TouchableOpacity
        onPress={handlePress}
        style={styles.button}
        activeOpacity={0.8}
        accessibilityLabel="Open Onboarding Admin Panel"
      >
        <Ionicons name="settings" size={28} color="#fff" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 40 : 24,
    right: 24,
    zIndex: 1000,
    elevation: 10,
    pointerEvents: 'box-none',
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
});

export default DevAdminFloatingButton;
