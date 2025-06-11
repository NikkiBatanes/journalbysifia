// src/theme/colors.ts

export const Colors = {
  // Brand Colors
  anchorBlue: '#1a3c6d',
  anchorBlueLight: '#E8EDFF', // Lighter version of anchorBlue
  faithGold: '#F5A623',
  growthGreen: '#4CAF50',
  alertCoral: '#FF6B6B',
  
  // Grayscale
  hopeWhite: '#F2F5F7',
  lightGray: '#E0E0E0',
  mediumGray: '#9E9E9E',
  darkGray: '#424242',
  trustGrey: '#B0B8C1',
  
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
  error: '#F44336',
  info: '#2196F3',
} as const;
