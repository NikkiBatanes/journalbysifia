// =====================================================
// SIMPLE FEATURE LOCK COMPONENT
// =====================================================
// A simple overlay to lock premium features after trial

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import { Colors } from '../theme/colors';
import { useUpgradePrompts } from '../hooks/useSimpleTrialAccess';

interface SimpleFeatureLockProps {
  isLocked: boolean;
  feature: string;
  onUpgradePress?: () => void;
  children: React.ReactNode;
  style?: any;
}

export const SimpleFeatureLock: React.FC<SimpleFeatureLockProps> = ({
  isLocked,
  feature,
  onUpgradePress,
  children,
  style,
}) => {
  const { getUpgradePrompt } = useUpgradePrompts();

  if (!isLocked) {
    return <>{children}</>;
  }

  const prompt = getUpgradePrompt(feature);

  return (
    <View style={[styles.container, style]}>
      {/* Blurred/disabled content */}
      <View style={styles.lockedContent}>
        {children}
      </View>

      {/* Lock overlay */}
      <View style={styles.overlay}>
        <View style={styles.lockCard}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.title}>{prompt.title}</Text>
          <Text style={styles.message}>{prompt.message}</Text>

          <TouchableOpacity
            style={styles.upgradeButton}
            onPress={onUpgradePress}
          >
            <Text style={styles.upgradeText}>Upgrade Now</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

interface SimpleFeatureLockCardProps {
  feature: string;
  onUpgradePress?: () => void;
  style?: any;
}

export const SimpleFeatureLockCard: React.FC<SimpleFeatureLockCardProps> = ({
  feature,
  onUpgradePress,
  style,
}) => {
  const { getUpgradePrompt } = useUpgradePrompts();
  const prompt = getUpgradePrompt(feature);

  return (
    <View style={[styles.lockCard, styles.standaloneCard, style]}>
      <Text style={styles.lockIcon}>🔒</Text>
      <Text style={styles.title}>{prompt.title}</Text>
      <Text style={styles.message}>{prompt.message}</Text>

      <TouchableOpacity
        style={styles.upgradeButton}
        onPress={onUpgradePress}
      >
        <Text style={styles.upgradeText}>Upgrade Now</Text>
      </TouchableOpacity>
    </View>
  );
};

interface UpgradeModalProps {
  visible: boolean;
  feature: string;
  onClose: () => void;
  onUpgradePress?: () => void;
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  visible,
  feature,
  onClose,
  onUpgradePress,
}) => {
  const { getUpgradePrompt } = useUpgradePrompts();
  const prompt = getUpgradePrompt(feature);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalIcon}>🚀</Text>
          <Text style={styles.modalTitle}>{prompt.title}</Text>
          <Text style={styles.modalMessage}>{prompt.message}</Text>

          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={styles.modalCancelButton}
              onPress={onClose}
            >
              <Text style={styles.modalCancelText}>Maybe Later</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalUpgradeButton}
              onPress={onUpgradePress}
            >
              <Text style={styles.modalUpgradeText}>Upgrade Now</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  lockedContent: {
    opacity: 0.3,
    pointerEvents: 'none',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  lockCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
    maxWidth: 300,
  },
  standaloneCard: {
    margin: 16,
    borderWidth: 1,
    borderColor: Colors.contemplationGray,
  },
  lockIcon: {
    fontSize: 32,
    marginBottom: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.darkerGray,
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: Colors.guidanceText,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  upgradeButton: {
    backgroundColor: Colors.devotionalPurple,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 120,
  },
  upgradeText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    maxWidth: 340,
    width: '100%',
  },
  modalIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.darkerGray,
    textAlign: 'center',
    marginBottom: 12,
  },
  modalMessage: {
    fontSize: 16,
    color: Colors.guidanceText,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.contemplationGray,
  },
  modalCancelText: {
    color: Colors.guidanceText,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  modalUpgradeButton: {
    flex: 1,
    backgroundColor: Colors.devotionalPurple,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  modalUpgradeText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default SimpleFeatureLock;
