import React from 'react';
import { Text, TextProps, StyleProp, TextStyle } from 'react-native';
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

  // Ensure our themed fontFamily is applied; keep other styles passed in
  const combinedStyle = Array.isArray(style)
    ? [...style, { fontFamily }]
    : [style as TextStyle, { fontFamily }];

  return (
    <Text {...rest} style={combinedStyle}>
      {children}
    </Text>
  );
};

export default ThemedText;
