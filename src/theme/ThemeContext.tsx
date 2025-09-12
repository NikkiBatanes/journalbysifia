import React, { createContext, useContext, useMemo, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { useAuth } from '../context/IndustryStandardAuthContext';
import { getFontFamily } from './fonts';
import { defaultTheme } from './themes/default';
import { darkTheme } from './themes/dark';
import { coralTheme } from './themes/coral';
import { sunshineTheme } from './themes/sunshine';
import { devotionalTheme } from './themes/devotional';
import { Colors } from './colors';

export type ThemeVariant = 'default' | 'dark' | 'coral' | 'sunshine' | 'devotional' | 'system';
export type FontFamily = 'system' | 'lexend' | 'poppins' | 'nunito' | 'lora';

export interface Theme {
  name: string;
  colors: {
    // Core brand colors
    anchorBlue: string;
    anchorBlueLight: string;
    modalBlue: string;
    faithGold: string;
    growthGreen: string;
    alertCoral: string;
    devotionalPurple: string;
    spiritualPink: string;
    playbookBlue: string;
    successGreen: string;
    lightPurple: string;

    // Standard UI Colors
    primary: string;
    secondary: string;
    text: string;
    textDark: string;
    textGray: string;
    gray: string;
    error: string;

    // Grayscale
    white: string;
    black: string;
    hopeWhite: string;
    lightGray: string;
    lightBlue: string;
    mediumGray: string;
    darkGray: string;
    darkerGray: string;
    trustGrey: string;
    inactiveIcon: string;

    // UI Colors
    inputBackground: string;
    inputBorder: string;
    dangerRed: string;
    cardBackground: string;
    cardBorder: string;
    cardShadow: string;

    // Backgrounds
    darkBackground: string;

    // Status
    success: string;
    warning: string;
    info: string;

    // Additional colors (preserving exact hardcoded values)
    chartBackground: string;
    lightBackground: string;
    borderLight: string;
    backgroundBlue: string;
    adminPrimary: string;
    adminGray: string;
    adminLightGray: string;
    adminBorder: string;
    adminText: string;
    adminSecondary: string;
    goldAccent: string;
    progressGray: string;

    // ActionStepsCard colors (spiritual meanings preserved)
    prayerPurple: string;
    reflectionBlue: string;
    gratitudeRed: string;
    winGold: string;
    timeblockGreen: string;
    budgetingGreen: string;
    tithingPurple: string;
    debtRed: string;
    actionBackground: string;
    heartRed: string;
  };
  typography: {
    h1: { fontSize: number; lineHeight: number; fontFamily: string };
    h2: { fontSize: number; lineHeight: number; fontFamily: string };
    h3: { fontSize: number; lineHeight: number; fontFamily: string };
    h4: { fontSize: number; lineHeight: number; fontFamily: string };
    h5: { fontSize: number; lineHeight: number; fontFamily: string };
    h6: { fontSize: number; lineHeight: number; fontFamily: string };
    body1: { fontSize: number; lineHeight: number; fontFamily: string };
    body2: { fontSize: number; lineHeight: number; fontFamily: string };
    caption: { fontSize: number; lineHeight: number; fontFamily: string };
    button: { fontSize: number; lineHeight: number; fontFamily: string };
    label: { fontSize: number; lineHeight: number; fontFamily: string };
  };
  currentFont?: string;
  fontFamily?: string;
}

const ThemeContext = createContext<Theme | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  const { user } = useAuth();
  const systemColorScheme = useColorScheme();

  const theme = useMemo(() => {
    // Get user preferences
    const userTheme = (user as any)?.user_metadata?.preferences?.theme as ThemeVariant;
    const userFont = (user as any)?.user_metadata?.preferences?.font as FontFamily;

    // Determine effective theme variant
    let effectiveVariant: ThemeVariant = 'default';
    if (userTheme === 'system') {
      effectiveVariant = systemColorScheme === 'dark' ? 'dark' : 'default';
    } else if (userTheme) {
      effectiveVariant = userTheme;
    }

    // Select theme based on variant
    let baseTheme: Theme;
    switch (effectiveVariant) {
      case 'dark':
        baseTheme = darkTheme;
        break;
      case 'coral':
        baseTheme = coralTheme;
        break;
      case 'sunshine':
        baseTheme = sunshineTheme;
        break;
      case 'devotional':
        baseTheme = devotionalTheme;
        break;
      default:
        baseTheme = defaultTheme;
    }

    // Apply font preference (default to 'lexend' as the app-wide default)
    // Coerce legacy 'system' value to 'lexend' to enforce Lexend default
    const effectiveFont = !userFont || userFont === 'system' ? 'lexend' : userFont;
    const fontFamily = getFontFamily(effectiveFont);

    return {
      ...baseTheme,
      currentFont: effectiveFont,
      fontFamily: fontFamily,
    };
  }, [user, systemColorScheme]);

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = (): Theme => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};


