import React, { type ComponentType } from 'react';
import { ColorValue, Platform, requireNativeComponent, StyleSheet, UIManager, View, ViewProps } from 'react-native';
import { BlurView } from '@react-native-community/blur';

type LiquidGlassViewProps = ViewProps & {
  tintColor?: ColorValue;
  cornerRadius?: number;
  fadesToTransparent?: boolean;
};

type LiquidGlassRuntime = typeof globalThis & {
  __sifiaLiquidGlassView?: ComponentType<LiquidGlassViewProps>;
};

const liquidGlassRuntime = globalThis as LiquidGlassRuntime;
const hasNativeLiquidGlass = Platform.OS === 'ios' &&
  UIManager.getViewManagerConfig('LiquidGlassView') != null;

// React Native keeps its native-view registry across Fast Refreshes. Cache the
// host component there too so re-evaluating this wrapper does not register the
// same native view name a second time.
const NativeLiquidGlassView = hasNativeLiquidGlass
  ? liquidGlassRuntime.__sifiaLiquidGlassView ??
    (liquidGlassRuntime.__sifiaLiquidGlassView = requireNativeComponent<LiquidGlassViewProps>('LiquidGlassView'))
  : null;

const LiquidGlassView = ({ tintColor, cornerRadius, fadesToTransparent = false, ...props }: LiquidGlassViewProps) => NativeLiquidGlassView ? (
  <NativeLiquidGlassView
    {...props}
    tintColor={tintColor}
    cornerRadius={cornerRadius}
    fadesToTransparent={fadesToTransparent}
    style={[styles.transparent, props.style]}
  />
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
