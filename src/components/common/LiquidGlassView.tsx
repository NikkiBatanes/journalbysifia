import React from 'react';
import { ColorValue, Platform, requireNativeComponent, StyleSheet, UIManager, View, ViewProps } from 'react-native';
import { BlurView } from '@react-native-community/blur';

const hasNativeLiquidGlass = Platform.OS === 'ios' &&
  UIManager.getViewManagerConfig('LiquidGlassView') != null;

type LiquidGlassViewProps = ViewProps & {
  tintColor?: ColorValue;
  cornerRadius?: number;
};

const NativeLiquidGlassView = hasNativeLiquidGlass
  ? requireNativeComponent<LiquidGlassViewProps>('LiquidGlassView')
  : null;

const LiquidGlassView = ({ tintColor, cornerRadius, ...props }: LiquidGlassViewProps) => NativeLiquidGlassView ? (
  <NativeLiquidGlassView {...props} tintColor={tintColor} cornerRadius={cornerRadius} style={[styles.transparent, props.style]} />
) : Platform.OS === 'ios' ? (
  <BlurView
    {...props}
    blurType="ultraThinMaterialLight"
    blurAmount={24}
    style={[styles.transparent, tintColor ? { backgroundColor: tintColor } : null, cornerRadius ? { borderRadius: cornerRadius } : null, props.style]}
  />
) : (
  <View {...props} style={[styles.transparent, props.style]} />
);

const styles = StyleSheet.create({
  transparent: { backgroundColor: 'transparent' },
});

export default LiquidGlassView;
