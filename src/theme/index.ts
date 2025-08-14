// Re-export everything from the theme system
export * from './colors';
export * from './fonts';
export * from './typography';
export * from './ThemeContext';
export { useTheme } from '../hooks/useTheme';

// Theme variants
export { defaultTheme } from './themes/default';
export { darkTheme } from './themes/dark';
export { coralTheme } from './themes/coral';
export { sunshineTheme } from './themes/sunshine';
export { devotionalTheme } from './themes/devotional';
