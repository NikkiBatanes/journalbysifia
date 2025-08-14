import { useContext } from 'react';
import { useTheme as useThemeContext } from '../theme/ThemeContext';

// Re-export the theme hook for convenience
export const useTheme = useThemeContext;
