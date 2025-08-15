// Clean font system with Christian-aligned font choices
export type FontFamily = 'system' | 'lexend' | 'poppins' | 'nunito' | 'lora';

export const Fonts = {
  // System fonts (default)
  system: {
    regular: 'System',
    medium: 'System',
    semiBold: 'System',
    bold: 'System',
  },

  // Lexend - dyslexia-friendly font for accessibility
  lexend: {
    regular: 'Lexend-Regular',
    medium: 'Lexend-Medium',
    semiBold: 'Lexend-SemiBold',
    bold: 'Lexend-Bold',
  },

  // Poppins - modern, clean font
  poppins: {
    regular: 'Poppins-Regular',
    medium: 'Poppins-Medium',
    semiBold: 'Poppins-SemiBold',
    bold: 'Poppins-Bold',
  },

  // Nunito Sans - friendly, readable font
  nunito: {
    regular: 'NunitoSans-VariableFont_YTLC,opsz,wdth,wght',
    medium: 'NunitoSans-VariableFont_YTLC,opsz,wdth,wght',
    semiBold: 'NunitoSans-VariableFont_YTLC,opsz,wdth,wght',
    bold: 'NunitoSans-VariableFont_YTLC,opsz,wdth,wght',
  },

  // Lora - elegant serif font for reading
  lora: {
    regular: 'Lora-Regular',
    medium: 'Lora-Medium',
    semiBold: 'Lora-SemiBold',
    bold: 'Lora-Bold',
  },
} as const;

// Font weights
export const FontWeights = {
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
} as const;

// Font family mapping for theme system
export const FontFamilyMap = {
  system: Fonts.system,
  poppins: Fonts.poppins,
  nunito: Fonts.nunito,
  lora: Fonts.lora,
  lexend: Fonts.lexend,
} as const;

// Get font family based on key and weight
export const getFontFamily = (fontKey: string, weight: 'regular' | 'medium' | 'semiBold' | 'bold' = 'regular'): string => {
  const fontFamily = FontFamilyMap[fontKey as keyof typeof FontFamilyMap];
  if (!fontFamily) {return 'System';}

  return fontFamily[weight] || fontFamily.regular;
};

// Font loading function (placeholder for future implementation)
export const loadAppFonts = async () => {
  // TODO: Implement font loading logic
  // For now, fonts will be loaded via react-native.config.js
  return true;
};

export const defaultTextStyle = {
  fontFamily: Fonts.system.regular,
  color: '#000',
};
