import React, { type ComponentType } from 'react';
import { ColorValue, Platform, requireNativeComponent, StyleSheet, UIManager, View, ViewProps } from 'react-native';
import { BlurView } from '@react-native-community/blur';

type LiquidGlassViewProps = ViewProps & {
  tintColor?: ColorValue;
  cornerRadius?: number;
  fadesToTransparent?: boolean;
  isInteractive?: boolean;
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

const LiquidGlassView = ({
  tintColor,
  cornerRadius,
  fadesToTransparent = false,
  isInteractive = false,
  style,
  ...props
}: LiquidGlassViewProps) => NativeLiquidGlassView ? (
  <NativeLiquidGlassView
    {...props}
    tintColor={tintColor}
    cornerRadius={cornerRadius}
    fadesToTransparent={fadesToTransparent}
    isInteractive={isInteractive}
    style={[styles.transparent, style]}
  />
) : Platform.OS === 'ios' ? (
  <View
    {...props}
    style={[
      styles.fallbackClip,
      cornerRadius ? { borderRadius: cornerRadius } : null,
      style,
    ]}
  >
    <BlurView
      pointerEvents="none"
      blurType="thinMaterialLight"
      blurAmount={32}
      reducedTransparencyFallbackColor="rgba(248, 247, 242, 0.92)"
      style={StyleSheet.absoluteFill}
    />
    {tintColor ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} /> : null}
    <View
      pointerEvents="none"
      style={[
        styles.fallbackHighlight,
        cornerRadius ? { borderRadius: cornerRadius } : null,
      ]}
    />
  </View>
) : (
  <View {...props} style={[styles.transparent, style]} />
);

const styles = StyleSheet.create({
  transparent: { backgroundColor: 'transparent' },
  fallbackClip: {
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  fallbackHighlight: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.62)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
});

export default LiquidGlassView;
