import { useTheme } from './ThemeContext';

// Hook to get theme-aware colors
export const useColors = () => {
  const theme = useTheme();
  return theme.colors;
};

// For components that need theme-aware colors but can't use hooks
export const getThemeColors = (theme: any) => {
  return theme.colors;
};
