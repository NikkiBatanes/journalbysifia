import { Theme } from '../ThemeContext';

// Default theme - preserves current brand colors exactly
export const defaultTheme: Theme = {
  name: 'Default',
  colors: {
    // Core Brand Colors (Christian app foundation)
    anchorBlue: '#1a3c6d',
    anchorBlueLight: '#E8EDFF',
    modalBlue: '#274674',
    faithGold: '#F5A623',
    growthGreen: '#4CAF50',
    alertCoral: '#FF6B6B',
    devotionalPurple: '#6A0DAD',
    spiritualPink: '#E91E63',
    playbookBlue: '#2196F3',
    successGreen: '#4CAF50',
    lightPurple: '#F3E5F5',

    // Standard UI Colors
    primary: '#1a3c6d',
    secondary: '#E8EDFF',
    text: '#1A1A1A',
    textDark: '#1A1A1A',
    textGray: '#9E9E9E',
    gray: '#9E9E9E',
    error: '#FF3B30',

    // Grayscale (original values)
    white: '#FFFFFF',
    black: '#000000',
    hopeWhite: '#F2F5F7',
    lightGray: '#E0E0E0',
    lightBlue: '#E8F4FD',
    mediumGray: '#9E9E9E',
    darkGray: '#424242',
    darkerGray: '#1A1A1A',
    trustGrey: '#B0B8C1',
    inactiveIcon: '#B0B8C1',

    // UI Colors (original values)
    inputBackground: '#264777',
    inputBorder: '#3d5e8d',
    dangerRed: '#FF3B30',
    cardBackground: 'rgba(255, 255, 255, 0.95)',
    cardBorder: 'rgba(0, 0, 0, 0.05)',
    cardShadow: '#000',

    // Backgrounds
    darkBackground: '#121212',

    // Status (original values)
    success: '#4CAF50',
    warning: '#FFC107',
    info: '#2196F3',

    // Additional colors found in codebase (preserving exact values)
    chartBackground: '#ffffff',
    lightBackground: '#f8f9fa',
    borderLight: '#e1e5e9',
    backgroundBlue: '#f0f8ff',
    adminPrimary: '#6366F1',
    adminGray: '#6B7280',
    adminLightGray: '#F9FAFB',
    adminBorder: '#E5E7EB',
    adminText: '#1F2937',
    adminSecondary: '#F3F4F6',
    goldAccent: '#D4AF37',
    progressGray: '#e0e0e0',

    // ActionStepsCard colors (preserving exact spiritual meanings)
    prayerPurple: '#9B59B6',        // Prayer - spiritual connection
    reflectionBlue: '#3498DB',      // Reflection - wisdom and depth  
    gratitudeRed: '#E74C3C',        // Gratitude - love and warmth
    winGold: '#F39C12',             // Wins - celebration and joy
    timeblockGreen: '#2ECC71',      // Time management - growth
    budgetingGreen: '#27AE60',      // Financial stewardship - responsibility
    tithingPurple: '#8E44AD',       // Tithing - spiritual giving
    debtRed: '#C0392B',             // Debt management - urgency
    actionBackground: '#d9dfe7',    // Action step backgrounds
    heartRed: '#FF6B6B',            // Love and compassion
  },
  typography: {
    // Typography scale matching current usage patterns
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
