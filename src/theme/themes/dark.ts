import { Theme } from '../ThemeContext';

// Dark theme - dark mode variant with light text
export const darkTheme: Theme = {
  name: 'Dark',
  colors: {
    // Brand Colors (dark variants)
    anchorBlue: '#0f2347', // Darker blue
    anchorBlueLight: '#1a3c6d', // Original anchorBlue as light variant
    modalBlue: '#1a3c6d', // Darker modal
    faithGold: '#F5A623', // Keep gold bright
    growthGreen: '#4CAF50', // Keep green
    alertCoral: '#FF6B6B', // Keep coral
    devotionalPurple: '#6A0DAD', // Keep purple
    spiritualPink: '#E91E63', // Keep pink
    playbookBlue: '#2196F3', // Keep blue
    successGreen: '#4CAF50', // Keep success green
    lightPurple: '#2D1B3D', // Dark purple background

    // Standard UI Colors
    primary: '#E8EDFF',
    secondary: '#1a3c6d',
    text: '#FFFFFF',
    textDark: '#FFFFFF',
    textGray: '#B0B8C1',
    gray: '#9E9E9E',
    error: '#FF6B6B', // Light text for dark theme

    // Grayscale (inverted for dark)
    white: '#000000', // Black becomes white
    black: '#FFFFFF', // White becomes black
    hopeWhite: '#121212', // Dark background
    lightGray: '#2A2A2A', // Dark gray
    lightBlue: '#1a3c6d', // Dark blue
    mediumGray: '#666666', // Medium gray
    darkGray: '#CCCCCC', // Light gray (inverted)
    darkerGray: '#FFFFFF', // White text
    trustGrey: '#666666', // Darker trust grey
    inactiveIcon: '#666666', // Darker inactive

    // UI Colors
    inputBackground: '#0f2347', // Dark input
    inputBorder: '#1a3c6d', // Dark border
    dangerRed: '#FF6B6B', // Use coral
    cardBackground: 'rgba(26, 60, 109, 0.3)', // Dark card
    cardBorder: 'rgba(255, 255, 255, 0.1)', // Light border
    cardShadow: '#000',

    // Backgrounds
    darkBackground: '#000000', // Pure black

    // Status
    success: '#4CAF50',
    warning: '#F5A623', // Use gold
    info: '#2196F3',

    // Additional colors (dark theme variants)
    chartBackground: '#1A1A1A',
    lightBackground: '#2A2A2A',
    borderLight: '#3A3A3A',
    backgroundBlue: '#1A2332',
    adminPrimary: '#5A5CF1',
    adminGray: '#8B8B8B',
    adminLightGray: '#2A2A2A',
    adminBorder: '#3A3A3A',
    adminText: '#E5E5E5',
    adminSecondary: '#2A2A2A',
    goldAccent: '#D4AF37',
    progressGray: '#3A3A3A',

    // ActionStepsCard colors (dark theme variants preserving spiritual meanings)
    prayerPurple: '#A569BD',        // Lighter purple for dark theme
    reflectionBlue: '#5DADE2',      // Lighter blue for dark theme
    gratitudeRed: '#EC7063',        // Lighter red for dark theme
    winGold: '#F7DC6F',             // Lighter gold for dark theme
    timeblockGreen: '#58D68D',      // Lighter green for dark theme
    budgetingGreen: '#52C41A',      // Lighter green for dark theme
    tithingPurple: '#BB8FCE',       // Lighter purple for dark theme
    debtRed: '#E74C3C',             // Keep urgency visible
    actionBackground: '#3A3A3A',    // Dark action backgrounds
    heartRed: '#FF7979',            // Lighter red for dark theme
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
