import { Platform, PlatformIOSStatic } from 'react-native';

// Define font families with fallbacks
export const Fonts = {
  // Primary font (Inter)
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semiBold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  
  // Playfair Display font with fallbacks
  playfair: {
    regular: Platform.OS === 'ios' ? 'PlayfairDisplay-Regular' : 'sans-serif',
    bold: Platform.OS === 'ios' ? 'PlayfairDisplay-Bold' : 'sans-serif-medium',
  },
  
  // Lora font
  lora: {
    regular: 'Lora_400Regular',
    italic: 'Lora_400Regular_Italic',
    semiBold: 'Lora_600SemiBold',
    semiBoldItalic: 'Lora_600SemiBold_Italic',
  },
  
  // System fonts as fallbacks
  system: {
    regular: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    medium: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    semiBold: Platform.OS === 'ios' ? 'System' : 'sans-serif-medium',
    bold: Platform.OS === 'ios' ? 'System' : 'sans-serif-bold',
  },
} as const;

// Font weights
export const FontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

// Helper to load fonts
export const loadAppFonts = async () => {
  try {
    // Load any custom fonts here if needed in the future
    // For now, we're using system fonts and react-native-vector-icons
    return true;
  } catch (error) {
    console.warn('Error loading fonts:', error);
    return false;
  }
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
