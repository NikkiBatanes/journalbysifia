import React from 'react';
import { Modal, StyleSheet, View, Platform } from 'react-native';
import { OnboardingAdminPanel } from './OnboardingAdminPanel';

interface DevAdminPanelModalProps {
  visible: boolean;
  onClose: () => void;
}

const DevAdminPanelModal: React.FC<DevAdminPanelModalProps> = ({ visible, onClose }) => {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      presentationStyle={Platform.OS === 'ios' ? 'formSheet' : 'overFullScreen'}
    >
      <View style={styles.overlay}>
        <View style={styles.panelContainer}>
          <OnboardingAdminPanel isVisible={visible} />
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.18)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  panelContainer: {
    width: '96%',
    height: '94%',
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 12,
  },
});

export default DevAdminPanelModal;
