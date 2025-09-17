// src/theme/colors.ts - CONSOLIDATED THEME SYSTEM
import { defaultTheme } from './themes/default';

// ENTERPRISE SOLUTION: Single source of truth for all colors
// Export default theme colors directly - all hardcoded colors now have semantic names
export const Colors = defaultTheme.colors;

// Legacy support - will be deprecated
export const standardColors = {
  // Core mappings to new theme system
  primary: defaultTheme.colors.anchorBlue,
  text: defaultTheme.colors.text,
  gray: defaultTheme.colors.textGray,
  error: defaultTheme.colors.error,
  white: defaultTheme.colors.white,
  black: defaultTheme.colors.black,
  success: defaultTheme.colors.growthGreen,
  warning: defaultTheme.colors.warning,
  info: defaultTheme.colors.playbookBlue,
} as const;
