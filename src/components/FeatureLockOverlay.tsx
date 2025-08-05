import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useUpgradePrompts } from '../hooks/useTrialAccess';
import { useNavigation } from '@react-navigation/native';

interface FeatureLockOverlayProps {
  visible: boolean;
  feature: string;
  onClose: () => void;
  onUpgrade?: () => void;
}

export const FeatureLockOverlay: React.FC<FeatureLockOverlayProps> = ({
  visible,
  feature,
  onClose,
  onUpgrade
}) => {
  const { getUpgradePrompt } = useUpgradePrompts();
  const navigation = useNavigation();
  
  const prompt = getUpgradePrompt(feature);

  const handleUpgrade = () => {
    onClose();
    if (onUpgrade) {
      onUpgrade();
    } else {
      navigation.navigate('Subscription' as never, { 
        recommendedTier: prompt.recommendedTier 
      });
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-closed" size={32} color="#6366F1" />
            </View>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Ionicons name="close" size={24} color="#666" />
            </TouchableOpacity>
          </View>
          
          <Text style={styles.title}>{prompt.title}</Text>
          <Text style={styles.message}>{prompt.message}</Text>
          
          <View style={styles.trialInfo}>
            <Text style={styles.trialText}>
              Your 3-day trial has ended. Upgrade to continue enjoying premium features.
            </Text>
          </View>
          
          <View style={styles.actions}>
            <TouchableOpacity style={styles.upgradeButton} onPress={handleUpgrade}>
              <Text style={styles.upgradeButtonText}>Upgrade Now</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

interface FeatureLockCardProps {
  feature: string;
  children: React.ReactNode;
  isLocked: boolean;
  onUnlockPress?: () => void;
}

export const FeatureLockCard: React.FC<FeatureLockCardProps> = ({
  feature,
  children,
  isLocked,
  onUnlockPress
}) => {
  const { getUpgradePrompt } = useUpgradePrompts();
  const navigation = useNavigation();
  
  const prompt = getUpgradePrompt(feature);

  const handleUnlock = () => {
    if (onUnlockPress) {
      onUnlockPress();
    } else {
      navigation.navigate('Subscription' as never, { 
        recommendedTier: prompt.recommendedTier 
      });
    }
  };

  if (!isLocked) {
    return <>{children}</>;
  }

  return (
    <View style={styles.lockedCard}>
      <View style={styles.lockedOverlay}>
        <Ionicons name="lock-closed" size={24} color="#6366F1" />
        <Text style={styles.lockedTitle}>{prompt.title}</Text>
        <Text style={styles.lockedMessage}>{prompt.message}</Text>
        <TouchableOpacity style={styles.unlockButton} onPress={handleUnlock}>
          <Text style={styles.unlockButtonText}>Unlock Feature</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.blurredContent}>
        {children}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Modal styles
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButton: {
    padding: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: '#6B7280',
    lineHeight: 24,
    marginBottom: 16,
  },
  trialInfo: {
    backgroundColor: '#F9FAFB',
    padding: 12,
    borderRadius: 8,
    marginBottom: 24,
  },
  trialText: {
    fontSize: 14,
    color: '#374151',
    textAlign: 'center',
  },
  actions: {
    gap: 12,
  },
  upgradeButton: {
    backgroundColor: '#6366F1',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  upgradeButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontSize: 16,
  },
  
  // Card styles
  lockedCard: {
    position: 'relative',
    borderRadius: 12,
    overflow: 'hidden',
  },
  lockedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    zIndex: 10,
  },
  blurredContent: {
    opacity: 0.3,
  },
  lockedTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  lockedMessage: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  unlockButton: {
    backgroundColor: '#6366F1',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  unlockButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
