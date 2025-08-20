import React from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
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
  const timersRef = React.useRef<number[]>([]);

  const hapticOptions = React.useMemo(() => ({
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  }), []);

  const triggerLightHaptic = React.useCallback(() => {
    try { ReactNativeHapticFeedback.trigger('impactLight', hapticOptions); } catch {}
  }, [hapticOptions]);

  const triggerSuccessHaptic = React.useCallback(() => {
    try { ReactNativeHapticFeedback.trigger('notificationSuccess', hapticOptions); } catch {}
  }, [hapticOptions]);

  const startBurstHaptics = React.useCallback(() => {
    // Clear any existing timers before starting
    timersRef.current.forEach(id => clearTimeout(id));
    timersRef.current = [];
    const schedule = [0, 250, 500, 750];
    schedule.forEach(delay => {
      const id = setTimeout(() => {
        ReactNativeHapticFeedback.trigger('impactLight', hapticOptions);
      }, delay) as unknown as number;
      timersRef.current.push(id);
    });
  }, [hapticOptions]);

  React.useEffect(() => {
    if (visible && config) {
      // Visual fade-in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Haptics: success + 4 light pulses
      triggerSuccessHaptic();
      startBurstHaptics();
    } else {
      // Visual fade-out
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // Cleanup timers when hiding
      timersRef.current.forEach(id => clearTimeout(id));
      timersRef.current = [];
    }
    return () => {
      timersRef.current.forEach(id => clearTimeout(id));
      timersRef.current = [];
    };
  }, [visible, config, fadeAnim, triggerSuccessHaptic, startBurstHaptics]);

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
                  onPress={() => { triggerLightHaptic(); onEdit(); }}
                >
                  <Text style={styles.editButtonText}>Edit</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.doneButton]}
                onPress={() => { triggerLightHaptic(); onDone(); }}
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
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalContent: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    padding: 28,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderRadius: 12,
    minWidth: 100,
    marginHorizontal: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  editButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  doneButton: {
    backgroundColor: Colors.alertCoral,
  },
  editButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
  doneButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
  },
});

export default NewSuccessModal;
