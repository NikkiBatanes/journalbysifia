import { Theme } from '../ThemeContext';

// Coral theme - coral-based warm theme
export const coralTheme: Theme = {
  name: 'Coral',
  colors: {
    // Brand Colors (coral-focused)
    anchorBlue: '#FF6B6B', // Coral as main brand
    anchorBlueLight: '#FFE5E5', // Light coral
    modalBlue: '#FF5252', // Darker coral for modals
    faithGold: '#F5A623', // Keep gold
    growthGreen: '#4CAF50', // Keep green
    alertCoral: '#FF6B6B', // Primary coral
    devotionalPurple: '#6A0DAD', // Keep purple
    spiritualPink: '#E91E63', // Keep pink
    playbookBlue: '#FF8A80', // Coral-tinted blue
    successGreen: '#4CAF50', // Keep success green
    lightPurple: '#FFE5E5', // Light coral background

    // Standard UI Colors
    primary: '#FF6B6B', // Coral primary
    secondary: '#FFE5E5', // Lighter coral as secondary
    text: '#1A1A1A',
    textDark: '#1A1A1A',
    textGray: '#9E9E9E',
    gray: '#9E9E9E',
    error: '#FF3B30', // Darker red for errors

    // Grayscale (warm tinted)
    white: '#FFFFFF',
    black: '#000000',
    hopeWhite: '#FFF8F8', // Warm white
    lightGray: '#F5E5E5', // Warm light gray
    lightBlue: '#FFE5E5', // Coral tint
    mediumGray: '#9E9E9E',
    darkGray: '#424242',
    darkerGray: '#1A1A1A',
    trustGrey: '#B0B8C1',
    inactiveIcon: '#B0B8C1',

    // UI Colors
    inputBackground: '#FF5252', // Coral input
    inputBorder: '#FF8A80', // Light coral border
    dangerRed: '#D32F2F', // Darker red
    cardBackground: 'rgba(255, 107, 107, 0.05)', // Light coral card
    cardBorder: 'rgba(255, 107, 107, 0.1)', // Coral border
    cardShadow: '#FF6B6B',

    // Backgrounds
    darkBackground: '#2D1B1B', // Dark warm background

    // Status
    success: '#4CAF50',
    warning: '#F5A623',
    info: '#2196F3',

    // Additional colors (coral theme variants)
    chartBackground: '#FFF5F5',
    lightBackground: '#FFEAEA',
    borderLight: '#FFD6D6',
    backgroundBlue: '#FFF0F0',
    adminPrimary: '#FF6B6B',
    adminGray: '#8B8B8B',
    adminLightGray: '#F5F5F5',
    adminBorder: '#E0E0E0',
    adminText: '#333333',
    adminSecondary: '#FFF5F5',
    goldAccent: '#D4AF37',
    progressGray: '#E0E0E0',

    // ActionStepsCard colors (coral theme variants preserving spiritual meanings)
    prayerPurple: '#9B59B6',        // Prayer and spiritual connection
    reflectionBlue: '#3498DB',      // Wisdom and contemplation
    gratitudeRed: '#E74C3C',        // Love and thankfulness
    winGold: '#F39C12',             // Joy and God's blessings
    timeblockGreen: '#27AE60',      // Growth and stewardship
    budgetingGreen: '#2ECC71',      // Financial responsibility
    tithingPurple: '#8E44AD',       // Spiritual giving
    debtRed: '#C0392B',             // Financial urgency
    actionBackground: '#FFF8F8',    // Clean action backgrounds
    heartRed: '#E74C3C',            // Love and compassion
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
