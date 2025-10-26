import React from 'react';
import { Modal, View, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ReactNativeHapticFeedback from 'react-native-haptic-feedback';
import { Colors } from '../theme';
import ThemedText from './common/ThemedText';

export interface SuccessModalConfig {
  title: string;
  message: string;
  showEditButton?: boolean;
  hideDoneButton?: boolean;
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
  const iconScale = React.useRef(new Animated.Value(0.85)).current;

  const sparkleAnims = React.useRef(
    Array.from({ length: 5 }).map(() => ({
      opacity: new Animated.Value(0),
      translateY: new Animated.Value(0),
      scale: new Animated.Value(0.6),
    }))
  ).current;
  const sparklePositions = React.useMemo(
    () => [
      { top: 6, left: 10 } as const,
      { top: 10, right: 8 } as const,
      { bottom: 10, left: 16 } as const,
      { bottom: 8, right: 14 } as const,
      { top: 2, right: 26 } as const,
    ],
    []
  );
  const timersRef = React.useRef<number[]>([]);

  const hapticOptions = React.useMemo(() => ({
    enableVibrateFallback: true,
    ignoreAndroidSystemSettings: false,
  }), []);

  const triggerLightHaptic = React.useCallback(() => {
    try { ReactNativeHapticFeedback.trigger('impactLight', hapticOptions); } catch {}
  }, [hapticOptions]);

  // Success modal haptics: add a light tap on show and a subtle follow-up
  // synced with the sparkles start. FP toast haptics remain enabled.

  React.useEffect(() => {
    console.log('🎉 NewSuccessModal: Effect triggered:', {
      visible,
      hasConfig: !!config,
      configTitle: config?.title,
      timestamp: new Date().toISOString(),
    });

    if (visible && config) {
      console.log('🎉 NewSuccessModal: Showing modal with config:', config);
      // Visual fade-in
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: true,
      }).start();

      // Icon pop-in
      iconScale.setValue(0.85);
      Animated.spring(iconScale, {
        toValue: 1,
        stiffness: 180,
        damping: 14,
        mass: 0.6,
        useNativeDriver: true,
      }).start();

      // Tiny sparkles drift up and fade
      sparkleAnims.forEach((anim, idx) => {
        anim.opacity.setValue(0);
        anim.translateY.setValue(0);
        anim.scale.setValue(0.6);
        Animated.sequence([
          Animated.delay(80 + idx * 60),
          Animated.parallel([
            Animated.timing(anim.opacity, { toValue: 1, duration: 120, useNativeDriver: true }),
            Animated.timing(anim.translateY, { toValue: -8 - idx * 2, duration: 700, useNativeDriver: true }),
            Animated.timing(anim.scale, { toValue: 1, duration: 700, useNativeDriver: true }),
          ]),
          Animated.timing(anim.opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
        ]).start();
      });

      // Single haptic aligned with the first sparkles kick-off
      // Sparkles first delay is ~80ms; trigger slightly after to feel synced
      const t = setTimeout(() => { try { triggerLightHaptic(); } catch {} }, 140) as unknown as number;
      timersRef.current.push(t);
    } else {
      console.log('🎉 NewSuccessModal: Hiding modal');
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
  }, [visible, config, fadeAnim, iconScale, sparkleAnims, triggerLightHaptic]);

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
            <View style={styles.iconWrapper}>
              <Animated.View style={{ transform: [{ scale: iconScale }] }}>
                <MaterialCommunityIcons name="hands-pray" size={42} color={Colors.hopeWhite} />
              </Animated.View>
              {/* Tiny sparkles (icon-based) */}
              {sparkleAnims.map((anim, i) => (
                <Animated.View
                  key={`sp-${i}`}
                  style={[
                    styles.sparkle,
                    sparklePositions[i],
                    { opacity: anim.opacity, transform: [{ translateY: anim.translateY }, { scale: anim.scale }] },
                  ]}
                >
                  <Ionicons name="sparkles" size={12} color={Colors.hopeWhite} />
                </Animated.View>
              ))}
            </View>
            <ThemedText weight="semiBold" style={styles.title}>{config.title}</ThemedText>
            <ThemedText style={styles.message}>{config.message}</ThemedText>
            {(config.showEditButton && onEdit) || !config.hideDoneButton ? (
              <View style={styles.buttonContainer}>
                {config.showEditButton && onEdit && (
                  <TouchableOpacity
                    style={[styles.button, styles.editButton]}
                    onPress={() => { triggerLightHaptic(); onEdit(); }}
                  >
                    <ThemedText weight="medium" style={styles.editButtonText}>Edit</ThemedText>
                  </TouchableOpacity>
                )}

                {!config.hideDoneButton && (
                  <TouchableOpacity
                    style={[styles.button, styles.doneButton]}
                    onPress={() => { triggerLightHaptic(); onDone(); }}
                  >
                    <ThemedText weight="medium" style={styles.doneButtonText}>Done</ThemedText>
                  </TouchableOpacity>
                )}
              </View>
            ) : null}
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
    zIndex: 9999,
    elevation: 9999,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 9999,
    zIndex: 9999,
  },
  modalContent: {
    backgroundColor: Colors.anchorBlue,
    borderRadius: 30,
    padding: 28,
    alignItems: 'center',
  },
  iconWrapper: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 18,
    // weight handled by ThemedText
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
  sparkle: {
    position: 'absolute',
    opacity: 0,
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
    // weight handled by ThemedText
    textAlign: 'center',
  },
  doneButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    // weight handled by ThemedText
    textAlign: 'center',
  },
});

export default NewSuccessModal;
