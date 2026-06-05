import React, { useLayoutEffect } from 'react';
import { Platform, StyleProp, StyleSheet, Text as RNText, TextInput as RNTextInput, TextStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { FontFamilyMap, getFontFamily } from '../../theme/fonts';
import { requestAndroidSoftKeyboard, shouldRequestAndroidSoftKeyboard } from '../../utils/androidKeyboard';

type ThemeWeight = 'regular' | 'medium' | 'semiBold' | 'bold';
type PatchableTextComponent = {
  render?: (props: any, ref: any) => React.ReactNode;
  defaultProps?: any;
  __sifiaOriginalRender?: (props: any, ref: any) => React.ReactNode;
  __sifiaFontKey?: string;
};

const replaceableFontFamilies = new Set<string>([
  'System',
  'system',
  'regular',
  'medium',
  'semiBold',
  'bold',
  ...Object.keys(FontFamilyMap),
  ...Object.values(FontFamilyMap).flatMap(fonts => Object.values(fonts)),
]);

const inferWeightFromStyle = (style: StyleProp<TextStyle>): ThemeWeight => {
  const flattened = StyleSheet.flatten(style);
  const explicitFamily = typeof flattened?.fontFamily === 'string' ? flattened.fontFamily : '';

  if (/bold/i.test(explicitFamily)) {
    return /semi/i.test(explicitFamily) ? 'semiBold' : 'bold';
  }
  if (/medium/i.test(explicitFamily) || explicitFamily === 'medium') {
    return 'medium';
  }
  if (explicitFamily === 'semiBold') {
    return 'semiBold';
  }

  const fontWeight = flattened?.fontWeight;
  if (fontWeight === 'bold') {
    return 'bold';
  }
  const numericWeight = typeof fontWeight === 'number'
    ? fontWeight
    : typeof fontWeight === 'string'
      ? Number(fontWeight)
      : 400;

  if (numericWeight >= 700) {
    return 'bold';
  }
  if (numericWeight >= 600) {
    return 'semiBold';
  }
  if (numericWeight >= 500) {
    return 'medium';
  }
  return 'regular';
};

const needsAndroidItalicFallbackGuard = (style: StyleProp<TextStyle>, fontKey: string) => {
  return fontKey !== 'system' && StyleSheet.flatten(style)?.fontStyle === 'italic';
};

const getAndroidThemedStyle = (style: StyleProp<TextStyle>, fontKey: string): TextStyle | null => {
  const flattened = StyleSheet.flatten(style);
  const explicitFamily = typeof flattened?.fontFamily === 'string' ? flattened.fontFamily : undefined;

  if (explicitFamily && !replaceableFontFamilies.has(explicitFamily)) {
    return null;
  }

  return {
    fontFamily: getFontFamily(fontKey, inferWeightFromStyle(style)),
    fontWeight: 'normal',
    includeFontPadding: false,
    ...(needsAndroidItalicFallbackGuard(style, fontKey) ? { fontStyle: 'normal' as const } : {}),
  };
};

const patchAndroidTextRender = (component: PatchableTextComponent) => {
  if (Platform.OS !== 'android' || component.__sifiaOriginalRender || typeof component.render !== 'function') {
    return;
  }

  const originalRender = component.render;
  component.__sifiaOriginalRender = originalRender;
  component.render = function sifiaThemedTextRender(props: any, ref: any) {
    const themedStyle = getAndroidThemedStyle(props?.style, component.__sifiaFontKey || 'lexend');
    const nextProps = themedStyle
      ? { ...props, style: [props?.style, themedStyle] }
      : props;

    return originalRender.call(this, nextProps, ref);
  };
};

const patchAndroidTextInputRender = (component: PatchableTextComponent) => {
  if (Platform.OS !== 'android' || component.__sifiaOriginalRender || typeof component.render !== 'function') {
    return;
  }

  const originalRender = component.render;
  component.__sifiaOriginalRender = originalRender;
  component.render = function sifiaThemedTextInputRender(props: any, ref: any) {
    const themedStyle = getAndroidThemedStyle(props?.style, component.__sifiaFontKey || 'lexend');
    const shouldShowKeyboard = shouldRequestAndroidSoftKeyboard(props);
    const originalOnFocus = props?.onFocus;
    const nativeProps = { ...(props || {}) };
    delete nativeProps.sifiaDisableKeyboardForce;
    const nextProps = {
      ...nativeProps,
      ...(themedStyle ? { style: [props?.style, themedStyle] } : {}),
      ...(shouldShowKeyboard
        ? {
            showSoftInputOnFocus: props?.showSoftInputOnFocus ?? true,
            onFocus: (event: any) => {
              originalOnFocus?.(event);
              requestAndroidSoftKeyboard();
            },
          }
        : {}),
    };

    return originalRender.call(this, nextProps, ref);
  };
};

const GlobalFontApplier: React.FC = () => {
  const { currentFont } = useTheme();

  useLayoutEffect(() => {
    const fontKey = currentFont || 'lexend';
    const regularFamily = getFontFamily(fontKey, 'regular');
    const defaultTextStyle = Platform.OS === 'android'
      ? { fontFamily: regularFamily, fontWeight: 'normal' as const, includeFontPadding: false }
      : { fontFamily: regularFamily };

    const textComponent = RNText as unknown as PatchableTextComponent;
    const textInputComponent = RNTextInput as unknown as PatchableTextComponent;
    textComponent.__sifiaFontKey = fontKey;
    textInputComponent.__sifiaFontKey = fontKey;
    patchAndroidTextRender(textComponent);
    patchAndroidTextInputRender(textInputComponent);

    // Ensure defaultProps objects exist
    if ((RNText as any).defaultProps == null) {
      (RNText as any).defaultProps = {};
    }
    if ((RNTextInput as any).defaultProps == null) {
      (RNTextInput as any).defaultProps = {};
    }

    // Merge existing styles safely and apply current theme font
    (RNText as any).defaultProps.style = [
      defaultTextStyle,
    ];
    (RNText as any).defaultProps.allowFontScaling = false;
    (RNText as any).defaultProps.maxFontSizeMultiplier = 1;

    (RNTextInput as any).defaultProps.style = [
      defaultTextStyle,
    ];
    (RNTextInput as any).defaultProps.allowFontScaling = false;
    (RNTextInput as any).defaultProps.maxFontSizeMultiplier = 1;
  }, [currentFont]);

  return null;
};

export default GlobalFontApplier;
