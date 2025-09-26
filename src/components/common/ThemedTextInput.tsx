import React from 'react';
import { TextInput, TextInputProps, StyleProp, TextStyle } from 'react-native';
import { useTheme } from '../../hooks/useTheme';
import { getFontFamily } from '../../theme/fonts';

export type ThemedWeight = 'regular' | 'medium' | 'semiBold' | 'bold';

interface ThemedTextInputProps extends TextInputProps {
  weight?: ThemedWeight;
  style?: StyleProp<TextStyle>;
}

const ThemedTextInput: React.FC<ThemedTextInputProps> = ({ weight = 'regular', style, ...rest }) => {
  const { currentFont } = useTheme();
  const fontKey = currentFont || 'lexend';
  const fontFamily = getFontFamily(fontKey, weight);

  const combinedStyle = [
    style,
    { fontFamily },
  ];

  return <TextInput {...rest} style={combinedStyle} />;
};

export default ThemedTextInput;
