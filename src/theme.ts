import { Platform } from 'react-native';

export const Colors = {
  anchorBlue: '#1A3C6D',
  hopeWhite: '#F5F6F5',
  faithGold: '#D4A017',
  trustGrey: '#6B7280',
  growthGreen: '#2F855A',
  alertCoral: '#F87171',
  darkBackground: '#1C2526',
  // Text colors
  textDark: '#333333',
  textGray: '#6B7280',
  textLight: '#9CA3AF',
};

// Re-export fonts from fonts.ts
export * from './theme/fonts';

// Export default font family
export const defaultFontFamily = {
  regular: 'System',
  medium: 'System',
  semiBold: 'System',
  bold: 'System',
  ...Platform.select({
    android: {
      regular: 'sans-serif',
      medium: 'sans-serif-medium',
      semiBold: 'sans-serif-medium',
      bold: 'sans-serif-bold',
    },
  }),
} as const;
