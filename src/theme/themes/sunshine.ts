import { Theme } from '../ThemeContext';

// Sunshine theme - yellow-based bright theme
export const sunshineTheme: Theme = {
  name: 'Sunshine',
  colors: {
    // Brand Colors (sunshine-focused)
    anchorBlue: '#F5A623', // Gold as main brand
    anchorBlueLight: '#FFF8E1', // Light yellow
    modalBlue: '#FF8F00', // Darker gold for modals
    faithGold: '#F5A623', // Primary gold
    growthGreen: '#4CAF50', // Keep green
    alertCoral: '#FF6B6B', // Keep coral
    devotionalPurple: '#6A0DAD', // Keep purple
    spiritualPink: '#E91E63', // Keep pink
    playbookBlue: '#FFB74D', // Gold-tinted blue
    successGreen: '#4CAF50', // Keep success green
    lightPurple: '#FFF8E1', // Light yellow background

    // Standard UI Colors
    primary: '#F5A623', // Golden yellow primary
    secondary: '#FFF3CD',
    text: '#1A1A1A',
    textDark: '#1A1A1A',
    textGray: '#9E9E9E',
    gray: '#9E9E9E',
    error: '#FF3B30', // Keep red for errors

    // Grayscale (warm yellow tinted)
    white: '#FFFFFF',
    black: '#000000',
    hopeWhite: '#FFFEF7', // Warm white
    lightGray: '#F5F3E0', // Warm light gray
    lightBlue: '#FFF8E1', // Yellow tint
    mediumGray: '#9E9E9E',
    darkGray: '#424242',
    darkerGray: '#1A1A1A',
    trustGrey: '#B0B8C1',
    inactiveIcon: '#B0B8C1',

    // UI Colors
    inputBackground: '#FF8F00', // Gold input
    inputBorder: '#FFB74D', // Light gold border
    dangerRed: '#FF3B30', // Keep red
    cardBackground: 'rgba(245, 166, 35, 0.05)', // Light gold card
    cardBorder: 'rgba(245, 166, 35, 0.1)', // Gold border
    cardShadow: '#F5A623',

    // Backgrounds
    darkBackground: '#2D2416', // Dark warm background

    // Status
    success: '#4CAF50',
    warning: '#FF9800',
    info: '#FFB74D', // Gold info

    // Additional colors (sunshine theme variants)
    chartBackground: '#FFFEF7',
    lightBackground: '#FFF9C4',
    borderLight: '#FFF176',
    backgroundBlue: '#FFF8E1',
    adminPrimary: '#F5A623',
    adminGray: '#8B8B8B',
    adminLightGray: '#F5F5F5',
    adminBorder: '#E0E0E0',
    adminText: '#333333',
    adminSecondary: '#FFF8E1',
    goldAccent: '#D4AF37',
    progressGray: '#E0E0E0',

    // ActionStepsCard colors (sunshine theme variants preserving spiritual meanings)
    prayerPurple: '#9C27B0',        // Prayer and spiritual connection
    reflectionBlue: '#1976D2',      // Wisdom and contemplation
    gratitudeRed: '#D32F2F',        // Love and thankfulness
    winGold: '#F57C00',             // Joy and God's blessings
    timeblockGreen: '#388E3C',      // Growth and stewardship
    budgetingGreen: '#4CAF50',      // Financial responsibility
    tithingPurple: '#7B1FA2',       // Spiritual giving
    debtRed: '#C62828',             // Financial urgency
    actionBackground: '#FFFEF7',    // Clean action backgrounds
    heartRed: '#D32F2F',            // Love and compassion
  },
  typography: {
    h1: { fontSize: 32, lineHeight: 40, fontWeight: '700' },
    h2: { fontSize: 28, lineHeight: 36, fontWeight: '600' },
    h3: { fontSize: 24, lineHeight: 32, fontWeight: '600' },
    h4: { fontSize: 20, lineHeight: 28, fontWeight: '600' },
    h5: { fontSize: 18, lineHeight: 24, fontWeight: '600' },
    h6: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
    body1: { fontSize: 16, lineHeight: 24, fontWeight: '400' },
    body2: { fontSize: 14, lineHeight: 20, fontWeight: '400' },
    caption: { fontSize: 12, lineHeight: 16, fontWeight: '400' },
    button: { fontSize: 16, lineHeight: 20, fontWeight: '600' },
    label: { fontSize: 14, lineHeight: 18, fontWeight: '500' },
  },
};
