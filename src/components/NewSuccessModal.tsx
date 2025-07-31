import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { Colors } from '../theme';

export interface SuccessModalConfig {
  title: string;
  message: string;
  showEditButton?: boolean;
}

interface NewSuccessModalProps {
  visible: boolean;
  config: SuccessModalConfig | null;
  onDone: () => void;
  onEdit?: () => void;
}

const NewSuccessModal: React.FC<NewSuccessModalProps> = ({
  visible,
  config,
  onDone,
  onEdit,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (visible && config) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, config, fadeAnim]);

  if (!visible || !config) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onDone}
    >
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.modalContainer,
            { opacity: fadeAnim },
          ]}
        >
          <View style={styles.modalContent}>
            <Text style={styles.title}>{config.title}</Text>
            <Text style={styles.message}>{config.message}</Text>

            <View style={styles.buttonContainer}>
              {config.showEditButton && onEdit && (
                <TouchableOpacity
                  style={[styles.button, styles.editButton]}
                  onPress={onEdit}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.doneButton]}
                onPress={onDone}
              >
                <Text style={styles.doneButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
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
  },
  modalContainer: {
    width: '80%',
    maxWidth: 320,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.textDark,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.textGray,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 80,
  },
  editButton: {
    backgroundColor: Colors.hopeWhite,
    borderWidth: 1,
    borderColor: Colors.trustGrey,
  },
  doneButton: {
    backgroundColor: Colors.anchorBlue,
  },
  editButtonText: {
    color: Colors.textDark,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  doneButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default NewSuccessModal;
