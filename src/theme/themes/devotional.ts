import { Theme } from '../ThemeContext';

// Devotional theme - purple-based spiritual theme
export const devotionalTheme: Theme = {
  name: 'Devotional',
  colors: {
    // Core Brand Colors (devotional-focused)
    anchorBlue: '#6A0DAD', // Purple as main brand
    anchorBlueLight: '#F3E5F5', // Light purple
    modalBlue: '#4A148C', // Darker purple for modals
    faithGold: '#FFB300', // Spiritual gold
    growthGreen: '#4CAF50', // Growth and life
    alertCoral: '#FF6B6B', // Attention and love
    devotionalPurple: '#6A0DAD', // Primary purple
    spiritualPink: '#E91E63', // Spiritual connection
    playbookBlue: '#9C27B0', // Purple-tinted blue
    successGreen: '#4CAF50', // Success and growth
    lightPurple: '#F3E5F5', // Light purple background

    // Standard UI Colors
    primary: '#6A0DAD', // Purple primary
    secondary: '#F3E5F5', // Lighter purple as secondary
    text: '#1A1A1A',
    textDark: '#1A1A1A',
    textGray: '#9E9E9E',
    gray: '#9E9E9E',
    error: '#FF3B30', // Keep red for errors

    // Grayscale
    white: '#FFFFFF',
    black: '#000000',
    hopeWhite: '#FAFAFA', // Warm white
    lightGray: '#F5F5F5', // Light gray
    lightBlue: '#F3E5F5', // Purple tint instead of blue
    mediumGray: '#BDBDBD',
    darkGray: '#424242',
    darkerGray: '#1A1A1A',
    trustGrey: '#B0B8C1',
    inactiveIcon: '#B0B8C1',

    // UI Colors
    inputBackground: '#FFFFFF', // Clean white inputs
    inputBorder: '#E0E0E0', // Light borders
    dangerRed: '#FF3B30', // Keep red for danger
    cardBackground: '#FFFFFF', // White cards
    cardBorder: '#E0E0E0', // Light borders
    cardShadow: '#6A0DAD', // Purple shadow

    // Backgrounds
    darkBackground: '#1A0B2E', // Dark purple background

    // Status
    success: '#4CAF50',
    warning: '#F5A623',
    info: '#2196F3',

    // Additional colors (devotional theme variants)
    chartBackground: '#F8F5FF',
    lightBackground: '#F3E5F5',
    borderLight: '#E1BEE7',
    backgroundBlue: '#F8F5FF',
    adminPrimary: '#9C27B0',
    adminGray: '#8B8B8B',
    adminLightGray: '#F5F5F5',
    adminBorder: '#E0E0E0',
    adminText: '#333333',
    adminSecondary: '#F8F5FF',
    goldAccent: '#D4AF37',
    progressGray: '#E0E0E0',

    // ActionStepsCard colors (devotional theme variants preserving spiritual meanings)
    prayerPurple: '#7B1FA2',        // Deep prayer and spiritual connection
    reflectionBlue: '#303F9F',      // Deep wisdom and contemplation
    gratitudeRed: '#C2185B',        // Love and thankfulness
    winGold: '#E65100',             // Joy and God's blessings
    timeblockGreen: '#2E7D32',      // Growth and stewardship
    budgetingGreen: '#388E3C',      // Financial responsibility
    tithingPurple: '#6A1B9A',       // Deep spiritual giving
    debtRed: '#B71C1C',             // Financial urgency
    actionBackground: '#F8F5FF',    // Clean action backgrounds
    heartRed: '#C2185B',            // Love and compassion
  },
  typography: {
    h1: { fontSize: 32, fontWeight: '700', lineHeight: 40 },
    h2: { fontSize: 28, fontWeight: '600', lineHeight: 36 },
    h3: { fontSize: 24, fontWeight: '600', lineHeight: 32 },
    h4: { fontSize: 20, fontWeight: '500', lineHeight: 28 },
    h5: { fontSize: 18, fontWeight: '500', lineHeight: 24 },
    h6: { fontSize: 16, fontWeight: '500', lineHeight: 22 },
    body1: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
    body2: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
    caption: { fontSize: 12, fontWeight: '400', lineHeight: 16 },
    button: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
    label: { fontSize: 14, fontWeight: '500', lineHeight: 18 },
  },
};
