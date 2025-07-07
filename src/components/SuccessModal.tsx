import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Colors } from '../theme/colors';

interface SuccessModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttonText?: string;
  onDismiss: () => void;
  onEdit?: () => void;
  animationDuration?: number;
}

const SuccessModal: React.FC<SuccessModalProps> = ({
  visible,
  title,
  message,
  buttonText = 'Done',
  onDismiss,
  onEdit,
  animationDuration = 300,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.8)).current;

  React.useEffect(() => {
    if (visible) {
      // Reset animations
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.8);
      
      // Start animations
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: animationDuration,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 5,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim, animationDuration]);

  if (!visible) return null;

  return (
    <Modal
      transparent
      visible={visible}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <Animated.View 
          style={[
            styles.modalContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.checkmarkCircle}>
            <Text style={styles.checkmark}>✓</Text>
          </View>
          
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.message}>{message}</Text>
          
          <View style={styles.buttonContainer}>
            <TouchableOpacity 
              style={[styles.button, styles.editButton]}
              onPress={onEdit}
              activeOpacity={0.8}
            >
              <Text style={[styles.buttonText, styles.editButtonText]}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.button, styles.doneButton]}
              onPress={onDismiss}
              activeOpacity={0.8}
            >
              <Text style={styles.buttonText}>{buttonText}</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: Colors.hopeWhite,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  checkmarkCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(76, 184, 144, 0.1)', // 10% opacity growthGreen
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  checkmark: {
    fontSize: 40,
    color: Colors.growthGreen,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: '600',
    color: Colors.darkGray, // Using darkGray from Colors
    marginBottom: 12,
    textAlign: 'center',
    fontFamily: 'System',
  },
  message: {
    fontSize: 16,
    color: Colors.mediumGray, // Using mediumGray from Colors
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
    fontFamily: 'System',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    width: '100%',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    minWidth: 100,
    alignItems: 'center',
  },
  doneButton: {
    backgroundColor: Colors.growthGreen,
  },
  editButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.mediumGray,
  },
  editButtonText: {
    color: Colors.mediumGray,
  },
  buttonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: 'System',
  },
});

export default SuccessModal;
