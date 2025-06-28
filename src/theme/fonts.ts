// Define system fonts
export const Fonts = {
  // System fonts for all platforms
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',

  // Aliases for backward compatibility
  system: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },
} as const;

// Font weights
export const FontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

// No need to load any fonts since we're using system fonts
export const loadAppFonts = async () => true;

export const defaultTextStyle = {
  fontFamily: Fonts.regular,
  color: '#000',
};

// No special handling needed for system fonts
export const getFontFamily = (fontFamily: string): string => fontFamily;
