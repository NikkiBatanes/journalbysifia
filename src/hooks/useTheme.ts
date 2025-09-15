// Simplified theme hook - now only provides default theme
import { useTheme as useThemeContext } from '../theme/ThemeContext';

// Re-export the theme hook for convenience
export const useTheme = useThemeContext;
