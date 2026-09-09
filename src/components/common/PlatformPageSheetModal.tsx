import React from 'react';
import {
  Animated,
  Easing,
  Modal,
  ModalProps,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { Colors } from '../../theme/colors';

interface PlatformPageSheetModalProps extends ModalProps {
  children: React.ReactNode;
  sheetStyle?: StyleProp<ViewStyle>;
}

const PlatformPageSheetModal: React.FC<PlatformPageSheetModalProps> = ({
  children,
  animationType = 'slide',
  presentationStyle = 'pageSheet',
  sheetStyle,
  onRequestClose,
  ...modalProps
}) => {
  const { height } = useWindowDimensions();
  const visible = modalProps.visible ?? true;
  const [androidVisible, setAndroidVisible] = React.useState(Boolean(visible));
  const backdropOpacity = React.useRef(new Animated.Value(0)).current;
  const sheetTranslateY = React.useRef(new Animated.Value(height)).current;

  React.useEffect(() => {
    if (Platform.OS !== 'android') {
      return;
    }

    if (visible) {
      setAndroidVisible(true);
      backdropOpacity.setValue(0);
      sheetTranslateY.setValue(height);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: 180,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(sheetTranslateY, {
          toValue: 0,
          duration: 280,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }

    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: 140,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(sheetTranslateY, {
        toValue: height,
        duration: 220,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(({ finished }) => {
      if (finished) {
        setAndroidVisible(false);
      }
    });
  }, [backdropOpacity, height, sheetTranslateY, visible]);

  if (Platform.OS !== 'android') {
    return (
      <Modal
        {...modalProps}
        animationType={animationType}
        presentationStyle={presentationStyle}
        onRequestClose={onRequestClose}
      >
        {children}
      </Modal>
    );
  }

  const closeFromBackdrop = () => {
    onRequestClose?.({} as never);
  };

  return (
    <Modal
      {...modalProps}
      visible={androidVisible}
      animationType="none"
      transparent
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.androidRoot}>
        <Animated.View
          pointerEvents="none"
          style={[StyleSheet.absoluteFill, styles.androidBackdrop, { opacity: backdropOpacity }]}
        />
        <Pressable style={StyleSheet.absoluteFill} onPress={closeFromBackdrop} />
        <Animated.View
          style={[
            styles.androidSheet,
            sheetStyle,
            { transform: [{ translateY: sheetTranslateY }] },
          ]}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  androidRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  androidBackdrop: {
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  androidSheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
    height: '92%',
    backgroundColor: Colors.sage,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
});

export default PlatformPageSheetModal;
