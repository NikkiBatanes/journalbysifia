import React from 'react';
import { Platform, TextInput, TextInputProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';

export type ThemedWeight = 'regular' | 'medium' | 'semiBold' | 'bold';

interface ThemedTextInputProps extends TextInputProps {
  weight?: ThemedWeight;
  style?: StyleProp<TextStyle>;
}

const ThemedTextInput = React.forwardRef<TextInput, ThemedTextInputProps>(({ weight = 'regular', style, ...rest }, ref) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, weight);
  const themedFontStyle: TextStyle = Platform.OS === 'android'
    ? { fontFamily, fontWeight: 'normal' }
    : { fontFamily };

  const combinedStyle = [
    style,
    themedFontStyle,
  ];

  return <TextInput ref={ref} {...rest} style={combinedStyle} />;
});

export default ThemedTextInput;
