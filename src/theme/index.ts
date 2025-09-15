// Re-export everything from the theme system
export * from './colors';
export { Fonts, getFontFamily } from './fonts';
export * from './typography';
export * from './ThemeContext';
export { useTheme } from '../hooks/useTheme';

// Theme variants - only default theme available
export { defaultTheme } from './themes/default';
// Other theme variants removed as part of theme system simplification
