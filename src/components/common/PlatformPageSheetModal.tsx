import React from 'react';
import {
  Modal,
  ModalProps,
  Platform,
  Pressable,
  StyleProp,
  StyleSheet,
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
      animationType={animationType}
      transparent
      statusBarTranslucent
      onRequestClose={onRequestClose}
    >
      <View style={styles.androidRoot}>
        <Pressable style={StyleSheet.absoluteFill} onPress={closeFromBackdrop} />
        <View style={[styles.androidSheet, sheetStyle]}>
          {children}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  androidRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  androidSheet: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 720,
    height: '92%',
    backgroundColor: Colors.anchorBlue,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
});

export default PlatformPageSheetModal;
