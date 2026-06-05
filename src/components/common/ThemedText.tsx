import React from 'react';
import { Platform, Text, TextProps, StyleProp, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';

export type ThemedWeight = 'regular' | 'medium' | 'semiBold' | 'bold';

interface ThemedTextProps extends TextProps {
  weight?: ThemedWeight;
  style?: StyleProp<TextStyle>;
}

const inferAndroidWeightFromStyle = (style: StyleProp<TextStyle>): ThemedWeight => {
  const flattened = StyleSheet.flatten(style);
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

const ThemedText: React.FC<ThemedTextProps> = ({ weight, style, children, ...rest }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const effectiveWeight = Platform.OS === 'android' ? weight ?? inferAndroidWeightFromStyle(style) : weight ?? 'regular';
  const fontFamily = getFontFamily(fontKey, effectiveWeight);
  const isUnsupportedAndroidItalic = fontKey !== 'system' && StyleSheet.flatten(style)?.fontStyle === 'italic';

  // Android custom font files should provide weight; legacy fontWeight styles can
  // make Android fall back or synthesize a different face.
  const themedFontStyle: TextStyle = Platform.OS === 'android'
    ? {
        fontFamily,
        fontWeight: 'normal',
        includeFontPadding: false,
        ...(isUnsupportedAndroidItalic ? { fontStyle: 'normal' as const } : {}),
      }
    : { fontFamily };

  // Ensure our themed fontFamily is applied; keep other styles passed in
  const combinedStyle = Array.isArray(style)
    ? [...style, themedFontStyle]
    : [style as TextStyle, themedFontStyle];

  return (
    <Text
      {...rest}
      allowFontScaling={Platform.OS === 'android' ? rest.allowFontScaling ?? false : rest.allowFontScaling}
      maxFontSizeMultiplier={Platform.OS === 'android' ? rest.maxFontSizeMultiplier ?? 1 : rest.maxFontSizeMultiplier}
      style={combinedStyle}
    >
      {children}
    </Text>
  );
};

export default ThemedText;
