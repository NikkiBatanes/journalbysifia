import React, { useEffect } from 'react';
import { Text as RNText, TextInput as RNTextInput } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { getFontFamily } from '../../theme/fonts';

const GlobalFontApplier: React.FC = () => {
  const { currentFont } = useTheme();

  useEffect(() => {
    const fontKey = currentFont || 'lexend';
    const regularFamily = getFontFamily(fontKey, 'regular');

    // Ensure defaultProps objects exist
    if ((RNText as any).defaultProps == null) {
      (RNText as any).defaultProps = {};
    }
    if ((RNTextInput as any).defaultProps == null) {
      (RNTextInput as any).defaultProps = {};
    }

    // Merge existing styles safely and apply current theme font
    (RNText as any).defaultProps.style = [
      (RNText as any).defaultProps.style,
      { fontFamily: regularFamily },
    ];

    (RNTextInput as any).defaultProps.style = [
      (RNTextInput as any).defaultProps.style,
      { fontFamily: regularFamily },
    ];
  }, [currentFont]);

  return null;
};

export default GlobalFontApplier;
