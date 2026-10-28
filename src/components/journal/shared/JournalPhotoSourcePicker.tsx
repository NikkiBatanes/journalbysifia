import React, {useEffect, useRef} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from 'react-native-vector-icons/Ionicons';
import ThemedText from '../../common/ThemedText';
import {Colors} from '../../../theme/colors';
import {
  pickImageFromSource,
  type LocalImage,
  type LocalImageSource,
} from '../../../services/avatarService';
import {triggerLightHaptic, triggerSelectionHaptic} from '../../../utils/haptics';

interface JournalPhotoSourcePickerProps {
  visible: boolean;
  onClose: () => void;
  onImageSelected: (image: LocalImage) => void;
}

const JournalPhotoSourcePicker: React.FC<JournalPhotoSourcePickerProps> = ({
  visible,
  onClose,
  onImageSelected,
}) => {
  const closingRef = useRef(false);
  const pendingSourceRef = useRef<LocalImageSource | null>(null);
  const launchFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const sheetTranslateY = useRef(new Animated.Value(24)).current;

  useEffect(() => {
    if (!visible) {
      return;
    }
    closingRef.current = false;
    backdropOpacity.setValue(0);
    sheetTranslateY.setValue(24);
    const entrance = Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 0,
        duration: 180,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    entrance.start();
    return () => entrance.stop();
  }, [backdropOpacity, sheetTranslateY, visible]);

  useEffect(
    () => () => {
      if (launchFallbackRef.current) {
        clearTimeout(launchFallbackRef.current);
      }
    },
    [],
  );

  const launchPendingSource = async () => {
    const source = pendingSourceRef.current;
    if (!source) {
      return;
    }
    pendingSourceRef.current = null;
    if (launchFallbackRef.current) {
      clearTimeout(launchFallbackRef.current);
      launchFallbackRef.current = null;
    }
    try {
      const image = await pickImageFromSource(source);
      if (image) {
        onImageSelected(image);
      }
    } catch {
      Alert.alert(
        'Could not add photo',
        'Please try choosing your photo again.',
      );
    }
  };

  const close = (source?: LocalImageSource) => {
    if (closingRef.current) {
      return;
    }
    closingRef.current = true;
    if (source) {
      triggerSelectionHaptic();
      pendingSourceRef.current = source;
    } else {
      triggerLightHaptic();
    }
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 120,
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: 24,
        duration: 150,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
      if (!source) {
        return;
      }
      // onDismiss is the reliable iOS presentation boundary. The short
      // fallback covers Android versions that do not emit it for transparent
      // modals without reintroducing the old 400 ms alert delay.
      launchFallbackRef.current = setTimeout(launchPendingSource, 80);
    });
  };

  return (
    <Modal
      animationType="none"
      transparent
      statusBarTranslucent
      visible={visible}
      onDismiss={launchPendingSource}
      onRequestClose={() => close()}>
      <View style={styles.root}>
        <Animated.View style={[styles.backdrop, {opacity: backdropOpacity}]}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close photo options"
            style={StyleSheet.absoluteFill}
            onPress={() => close()}
          />
        </Animated.View>
        <Animated.View
          accessibilityLabel="Add a photo"
          style={[styles.sheet, {transform: [{translateY: sheetTranslateY}]}]}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.heading}>
              <ThemedText weight="bold" style={styles.title}>
                Add a photo
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Choose where your photo comes from.
              </ThemedText>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Close photo options"
              onPress={() => close()}
              style={styles.closeButton}>
              <Ionicons name="close" size={20} color={Colors.hopeWhite} />
            </TouchableOpacity>
          </View>
          <View style={styles.options}>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Take photo"
              activeOpacity={0.82}
              onPress={() => close('camera')}
              style={styles.option}>
              <View style={styles.optionIcon}>
                <Ionicons name="camera-outline" size={25} color={Colors.sage} />
              </View>
              <ThemedText weight="semiBold" style={styles.optionTitle}>
                Take photo
              </ThemedText>
              <ThemedText style={styles.optionDetail}>Use your camera</ThemedText>
            </TouchableOpacity>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Choose from photo library"
              activeOpacity={0.82}
              onPress={() => close('library')}
              style={styles.option}>
              <View style={styles.optionIcon}>
                <Ionicons name="images-outline" size={25} color={Colors.sage} />
              </View>
              <ThemedText weight="semiBold" style={styles.optionTitle}>
                Photo library
              </ThemedText>
              <ThemedText style={styles.optionDetail}>Choose an existing photo</ThemedText>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: {flex: 1, justifyContent: 'flex-end'},
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(20,28,23,0.48)',
  },
  sheet: {
    paddingTop: 8,
    paddingHorizontal: 20,
    paddingBottom: 32,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: Colors.sage,
    shadowColor: Colors.text,
    shadowOpacity: 0.2,
    shadowRadius: 18,
    shadowOffset: {width: 0, height: -5},
    elevation: 18,
  },
  handle: {
    width: 42,
    height: 4,
    alignSelf: 'center',
    marginBottom: 12,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.38)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 18,
  },
  heading: {flex: 1},
  title: {fontSize: 20, color: Colors.hopeWhite},
  subtitle: {
    marginTop: 3,
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  closeButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  options: {flexDirection: 'row', gap: 12},
  option: {
    flex: 1,
    minHeight: 132,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 10,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    borderRadius: 20,
    backgroundColor: '#5E7A6B',
  },
  optionIcon: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderRadius: 24,
    backgroundColor: Colors.anchorBlueLight,
  },
  optionTitle: {fontSize: 14, color: Colors.hopeWhite, textAlign: 'center'},
  optionDetail: {
    marginTop: 4,
    fontSize: 11,
    lineHeight: 15,
    color: 'rgba(255,255,255,0.7)',
    textAlign: 'center',
  },
});

export default JournalPhotoSourcePicker;
