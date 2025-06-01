import { Platform } from 'react-native';

// Define font family names for Inter from react-native-vector-icons
export const Fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  // Fallbacks for Android
  ...Platform.select({
    android: {
      regular: 'sans-serif',
      medium: 'sans-serif-medium',
      semiBold: 'sans-serif-medium',
      bold: 'sans-serif-bold',
    },
  }),
};

// Helper to load fonts (call this in your App.tsx or root component)
export const loadFonts = async () => {
  // No need to manually load Inter if using react-native-vector-icons
  // This is a placeholder in case you add custom fonts later
  return Promise.resolve(true);
};

// Default font family for Text components
export const defaultTextStyle = {
  fontFamily: Fonts.regular,
  color: '#000',
};

// Platform-specific font fixes (if needed)
export const getFontFamily = (fontFamily: string): string => {
  if (Platform.OS === 'ios') {
    return fontFamily;
  }
  // Android may need adjustments for font weights
  return fontFamily;
};
