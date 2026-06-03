import React from 'react';
import { Platform, Text, TextProps, StyleProp, StyleSheet, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';

export type ThemedWeight = 'regular' | 'medium' | 'semiBold' | 'bold';

interface ThemedTextProps extends TextProps {
  weight?: ThemedWeight;
  style?: StyleProp<TextStyle>;
}

const ThemedText: React.FC<ThemedTextProps> = ({ weight = 'regular', style, children, ...rest }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, weight);
  const isUnsupportedAndroidItalic = fontKey !== 'system' && StyleSheet.flatten(style)?.fontStyle === 'italic';

  // Android custom font files should provide weight; legacy fontWeight styles can
  // make Android fall back or synthesize a different face.
  const themedFontStyle: TextStyle = Platform.OS === 'android'
    ? {
        fontFamily,
        fontWeight: 'normal',
        ...(isUnsupportedAndroidItalic ? { fontStyle: 'normal' as const } : {}),
      }
    : { fontFamily };

  // Ensure our themed fontFamily is applied; keep other styles passed in
  const combinedStyle = Array.isArray(style)
    ? [...style, themedFontStyle]
    : [style as TextStyle, themedFontStyle];

  return (
    <Text {...rest} style={combinedStyle}>
      {children}
    </Text>
  );
};

export default ThemedText;
