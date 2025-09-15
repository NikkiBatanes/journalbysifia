// Simplified colors hook - now only provides default theme colors
import { Colors } from './colors';

// Hook to get default colors (no theme switching)
export const useColors = () => {
  return Colors;
};

// For components that need colors but can't use hooks
export const getThemeColors = () => {
  return Colors;
};
