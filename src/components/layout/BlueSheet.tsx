import React, { ReactNode } from 'react';
import { View, ViewStyle, StyleProp, StyleSheet } from 'react-native';
import { Colors } from '../../theme';

interface BlueSheetProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  radius?: number; // allow override if needed later
}

/**
 * BlueSheet
 * Canonical blue, rounded, edge-to-edge container used below white headers.
 * Defaults match Journal screen: anchor blue background, 24 top-corner radius.
 */
const BlueSheet: React.FC<BlueSheetProps> = ({ children, style, radius = 24 }) => {
  return (
    <View style={[styles.base, { borderTopLeftRadius: radius, borderTopRightRadius: radius }, style]}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    flex: 1,
    backgroundColor: Colors.sage,
    overflow: 'hidden',
  },
});

export default BlueSheet;
