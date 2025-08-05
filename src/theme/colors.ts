// src/theme/colors.ts

export const Colors = {
  // Brand Colors
  anchorBlue: '#1a3c6d',
  anchorBlueLight: '#E8EDFF', // Lighter version of anchorBlue
  faithGold: '#F5A623',
  growthGreen: '#4CAF50',
  alertCoral: '#FF6B6B',
  devotionalPurple: '#6A0DAD',
  spiritualPink: '#E91E63', // New pink color

  // Standard UI Colors (for consistency)
  primary: '#1a3c6d', // Maps to anchorBlue
  text: '#1A1A1A', // Maps to darkerGray
  gray: '#9E9E9E', // Maps to mediumGray
  error: '#FF3B30', // Maps to dangerRed

  // Grayscale
  white: '#FFFFFF',
  black: '#000000',
  hopeWhite: '#F2F5F7',
  lightGray: '#E0E0E0',
  lightBlue: '#E8F4FD',
  mediumGray: '#9E9E9E',
  darkGray: '#424242',
  darkerGray: '#1A1A1A', // For better text contrast
  trustGrey: '#B0B8C1',
  inactiveIcon: '#B0B8C1',

  // UI Colors
  inputBackground: '#264777', // Dark blue background for input fields
  inputBorder: '#3d5e8d', // Border color for input fields
  dangerRed: '#FF3B30', // Used for logout button
  cardBackground: 'rgba(255, 255, 255, 0.95)',
  cardBorder: 'rgba(0, 0, 0, 0.05)',
  cardShadow: '#000',

  // Backgrounds
  darkBackground: '#121212',

  // Status
  success: '#4CAF50',
  warning: '#FFC107',
  info: '#2196F3',

  // Theme Colors
  themes: {
    default: {
      primary: '#1a3c6d',
      secondary: '#F5A623',
      accent: '#4CAF50',
    },
    blue: {
      primary: '#2196F3',
      secondary: '#03DAC6',
      accent: '#FF9800',
    },
    green: {
      primary: '#4CAF50',
      secondary: '#8BC34A',
      accent: '#CDDC39',
    },
    purple: {
      primary: '#6A0DAD',
      secondary: '#9C27B0',
      accent: '#E91E63',
    },
    pink: {
      primary: '#E91E63',
      secondary: '#F06292',
      accent: '#FF4081',
    },
    warm: {
      primary: '#FF6B35',
      secondary: '#F7931E',
      accent: '#FFD23F',
    },
  },
} as const;
