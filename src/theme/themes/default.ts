import { Theme } from '../ThemeContext';

// Default theme - Journal by siFia palette
// Identity: Warm Cream + Soft Ivory + Deep Sage + Forest Ink.
// Coral, gold, and anchor blue are reserved for specific communication only.
export const defaultTheme: Theme = {
  name: 'Default',
  colors: {
    // Core Brand Colors (siFia palette)
    anchorBlue: '#1A3C6D',          // Anchor Blue - siFia connection (sparing)
    sage: '#526A5B',                // Deep Sage - new main primary
    sageMuted: '#718476',           // Muted Sage - secondary/soft sage
    anchorBlueLight: '#E6EBE5',     // Pale Sage - soft sage background
    modalBlue: '#29342E',           // Forest Ink - modal surfaces
    faithGold: '#B99562',           // Muted Gold - gold accent (sparing)
    growthGreen: '#526A5B',         // Deep Sage - primary brand
    alertCoral: '#D97872',          // Muted Coral - alerts (sparing)
    ministryPurple: '#718476',      // Muted Sage
    spiritualPink: '#D97872',       // Muted Coral
    playbookBlue: '#526A5B',        // Deep Sage
    lightPurple: '#E6EBE5',         // Pale Sage

    // Standard UI Colors
    text: '#29342E',                // Deep Forest Charcoal - primary text
    textGray: '#7C837D',            // Warm Gray - secondary text
    error: '#D97872',               // Muted Coral

    // Grayscale (remapped to siFia neutrals)
    white: '#FFFEFA',               // Soft Ivory - paper/cards
    black: '#29342E',               // Forest Ink replaces pure black
    hopeWhite: '#FFFEFA',           // Soft Ivory
    lightGray: '#DFE4DD',           // Sage Gray - borders/dividers
    lightBlue: '#E6EBE5',           // Pale Sage
    darkGray: '#29342E',            // Forest Ink
    trustGrey: '#7C837D',           // Warm Gray

    // UI Colors
    inputBackground: '#F6F5EF',     // Warm Cream
    inputBorder: '#DFE4DD',         // Sage Gray
    cardBackground: '#FFFEFA',      // Soft Ivory
    cardBorder: '#DFE4DD',          // Sage Gray

    // Backgrounds
    darkBackground: '#29342E',      // Forest Ink - darkest surface

    // Status
    warning: '#B99562',             // Muted Gold

    // Semantic color names following spiritual/app context pattern
    lightBackground: '#F6F5EF',     // Warm Cream - main background
    borderLight: '#DFE4DD',         // Sage Gray
    backgroundBlue: '#E6EBE5',      // Pale Sage

    // Admin & Dashboard Colors (spiritual wisdom theme)
    wisdomIndigo: '#526A5B',        // Deep Sage - admin primary
    reflectionGray: '#7C837D',      // Warm Gray - contemplation
    sanctuaryWhite: '#FFFEFA',      // Soft Ivory - sacred space
    gentleBorder: '#DFE4DD',        // Sage Gray - soft boundaries
    scriptureText: '#29342E',       // Forest Ink - scripture reading
    treasureGold: '#B99562',        // Muted Gold - spiritual treasures

    // Status & Interactive Colors
    prosperityGreen: '#526A5B',     // Deep Sage - success/growth
    warningAmber: '#B99562',        // Muted Gold - guidance needed
    mysticalViolet: '#718476',      // Muted Sage - special states
    clarityTeal: '#718476',         // Muted Sage - info/clarity
    revelationBlue: '#718476',      // Muted Sage - chart highlights
    truthBlue: '#526A5B',           // Deep Sage - truth and knowledge

    // Text Hierarchy (spiritual reading context)
    meditationGray: '#29342E',      // Forest Ink - deep thought text
    wisdomText: '#29342E',          // Forest Ink - primary wisdom text
    guidanceText: '#7C837D',        // Warm Gray - secondary guidance
    whisperText: '#7C837D',         // Warm Gray - subtle instruction
    echoText: '#7C837D',            // Warm Gray - faint supporting text


    // Opacity & Overlay Colors (ivory/ink tints)
    divineVeil: 'rgba(255,254,250,0.1)',      // Soft Ivory veil
    holyGlow: 'rgba(255,254,250,0.8)',        // Soft Ivory glow
    gentlePresence: 'rgba(255,254,250,0.2)',  // Soft Ivory presence
    whisperOverlay: 'rgba(255,254,250,0.05)', // Soft Ivory whisper
    shadowOfPeace: 'rgba(41,52,46,0.5)',      // Forest Ink overlay
    quietReflection: 'rgba(41,52,46,0.1)',    // Forest Ink tint
    deepMeditation: 'rgba(41,52,46,0.25)',    // Forest Ink tint
    restfulShadow: 'rgba(41,52,46,0.04)',     // Forest Ink tint

    // ActionStepsCard colors (siFia semantic mapping)
    prayerPurple: '#526A5B',        // Deep Sage - prayer
    reflectionBlue: '#526A5B',      // Deep Sage - reflection
    gratitudeRed: '#D97872',        // Muted Coral - gratitude
    winGold: '#B99562',             // Muted Gold - wins
    timeblockGreen: '#526A5B',      // Deep Sage - time management
    debtRed: '#D97872',             // Muted Coral - urgency
    actionBackground: '#E6EBE5',    // Pale Sage - action step backgrounds

    // ENTERPRISE ENHANCEMENT: Common Hardcoded Colors Now Named
    // Based on analysis of 1200+ hardcoded values across the app

    // Most Common Overlays (400+ instances found)
    placeholderText: 'rgba(124,131,125,0.6)',  // Warm Gray placeholders
    lightOverlay: 'rgba(255,254,250,0.1)',     // Soft Ivory overlays
    mediumOverlay: 'rgba(255,254,250,0.2)',    // Soft Ivory overlays
    modalOverlay: 'rgba(41,52,46,0.5)',        // Forest Ink modal scrim
    chevronColor: 'rgba(124,131,125,0.65)',    // Warm Gray chevrons

    // Additional Overlays
    subtleOverlay: 'rgba(255,254,250,0.05)',   // Very subtle ivory
    strongOverlay: 'rgba(255,254,250,0.3)',    // Strong ivory
    darkOverlay: 'rgba(41,52,46,0.25)',        // Forest Ink overlay
    veryDarkOverlay: 'rgba(41,52,46,0.7)',     // Forest Ink overlay

    // Border System
    lightBorder: '#DFE4DD',                    // Sage Gray
    mediumBorder: 'rgba(124,131,125,0.3)',     // Warm Gray border

    // Switch/Toggle Colors
    switchTrackInactive: 'rgba(124,131,125,0.25)', // Warm Gray track
    switchTrackActive: 'rgba(82,106,91,0.45)',     // Deep Sage track

    // Text Variations
    secondaryText: 'rgba(41,52,46,0.8)',       // Forest Ink secondary
    tertiaryText: 'rgba(41,52,46,0.7)',        // Forest Ink tertiary
    mutedText: 'rgba(124,131,125,0.5)',        // Warm Gray muted

    // Additional Missing Colors
    contemplationGray: '#7C837D',              // Warm Gray
    darkerGray: '#29342E',                     // Forest Ink
    inactiveIcon: '#7C837D',                   // Warm Gray icons
    dangerRed: '#D97872',                      // Muted Coral
  },
  typography: {
    // Typography scale matching current usage patterns - fontFamily handled by font system
    h1: { fontSize: 32, lineHeight: 40, fontFamily: 'Lexend-Bold' },
    h2: { fontSize: 28, lineHeight: 36, fontFamily: 'Lexend-SemiBold' },
    h3: { fontSize: 24, lineHeight: 32, fontFamily: 'Lexend-SemiBold' },
    h4: { fontSize: 20, lineHeight: 28, fontFamily: 'Lexend-SemiBold' },
    h5: { fontSize: 18, lineHeight: 24, fontFamily: 'Lexend-SemiBold' },
    h6: { fontSize: 16, lineHeight: 22, fontFamily: 'Lexend-SemiBold' },
    body1: { fontSize: 16, lineHeight: 24, fontFamily: 'Lexend-Regular' },
    body2: { fontSize: 14, lineHeight: 20, fontFamily: 'Lexend-Regular' },
    caption: { fontSize: 12, lineHeight: 16, fontFamily: 'Lexend-Regular' },
    button: { fontSize: 16, lineHeight: 20, fontFamily: 'Lexend-SemiBold' },
    label: { fontSize: 14, lineHeight: 18, fontFamily: 'Lexend-Medium' },
  },
};
