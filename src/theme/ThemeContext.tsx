import React, { createContext, useContext, ReactNode, useEffect, useMemo, useState } from 'react';
import { getFontFamily } from './fonts';
import { defaultTheme } from './themes/default';
import { Colors } from './colors';
import { useAuth } from '../context/IndustryStandardAuthContext';

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
    lightPurple: string;

    // Standard UI Colors
    text: string;
    textGray: string;
    error: string;

    // Grayscale
    white: string;
    black: string;
    hopeWhite: string;
    lightGray: string;
    lightBlue: string;
    darkGray: string;
    trustGrey: string;

    // UI Colors
    inputBackground: string;
    inputBorder: string;
    cardBackground: string;
    cardBorder: string;

    // Backgrounds
    darkBackground: string;

    // Status
    warning: string;

    // Additional colors (preserving exact hardcoded values)
    lightBackground: string;
    borderLight: string;
    backgroundBlue: string;

    // Admin & Dashboard Colors (spiritual wisdom theme)
    wisdomIndigo: string;        // Admin primary - wisdom and insights
    reflectionGray: string;      // Admin secondary text - contemplation
    sanctuaryWhite: string;      // Admin light background - sacred space
    gentleBorder: string;        // Admin borders - soft boundaries
    scriptureText: string;       // Admin primary text - scripture reading
    treasureGold: string;        // Gold accent - spiritual treasures

    // Status & Interactive Colors
    prosperityGreen: string;     // Success/growth - prosperity
    warningAmber: string;        // Warning - guidance needed
    mysticalViolet: string;      // Special states - spiritual mystery
    clarityTeal: string;         // Info/clarity - clear understanding
    revelationBlue: string;      // Chart highlights - divine revelations
    truthBlue: string;           // Information - truth and knowledge

    // Text Hierarchy (spiritual reading context)
    meditationGray: string;      // Deep thought text
    wisdomText: string;          // Primary wisdom text
    guidanceText: string;        // Secondary guidance text
    whisperText: string;         // Subtle instruction text
    echoText: string;            // Faint supporting text


    // Opacity & Overlay Colors (spiritual transparency)
    divineVeil: string;          // Light sacred overlay
    holyGlow: string;            // Bright spiritual presence
    gentlePresence: string;      // Soft divine touch
    whisperOverlay: string;      // Barely visible blessing
    shadowOfPeace: string;       // Calming dark overlay
    quietReflection: string;     // Subtle contemplation
    deepMeditation: string;      // Focused spiritual state
    restfulShadow: string;       // Peaceful background tint

    // ActionStepsCard colors (spiritual meanings preserved)
    prayerPurple: string;
    reflectionBlue: string;
    gratitudeRed: string;
    winGold: string;
    timeblockGreen: string;
    debtRed: string;
    actionBackground: string;

    // Enterprise Enhancement: Common Hardcoded Colors
    placeholderText: string;
    lightOverlay: string;
    mediumOverlay: string;
    modalOverlay: string;
    chevronColor: string;
    subtleOverlay: string;
    strongOverlay: string;
    darkOverlay: string;
    veryDarkOverlay: string;
    lightBorder: string;
    mediumBorder: string;
    switchTrackInactive: string;
    switchTrackActive: string;
    secondaryText: string;
    tertiaryText: string;
    mutedText: string;
    contemplationGray: string;
    darkerGray: string;
    inactiveIcon: string;
    dangerRed: string;
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
  // Dynamically determine the current font from user preferences (with safe defaults)
  const { user } = useAuth();

  // Extract the preferred font from user metadata (if available)
  const preferredFont = useMemo(() => {
    try {
      const key = (user as any)?.user_metadata?.preferences?.font as FontFamily | undefined;
      // Validate against supported keys
      const allowed: FontFamily[] = ['system', 'lexend', 'poppins', 'nunito', 'lora'];
      return allowed.includes((key as any)) ? (key as FontFamily) : ('lexend' as FontFamily);
    } catch {
      return 'lexend' as FontFamily;
    }
  }, [user]);

  // Keep currentFont in state so updates propagate and trigger GlobalFontApplier
  const [currentFont, setCurrentFont] = useState<FontFamily>('lexend');

  useEffect(() => {
    setCurrentFont(preferredFont);
  }, [preferredFont]);

  const theme: Theme = useMemo(() => ({
    ...defaultTheme,
    currentFont,
    fontFamily: getFontFamily(currentFont),
  }), [currentFont]);

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

// Export Colors directly for components that don't need the full theme
export { Colors };


