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
    lightPurple: '#F3E5F5',

    // Standard UI Colors
    text: '#1A1A1A',
    textGray: '#9E9E9E',
    error: '#FF3B30',

    // Grayscale (original values)
    white: '#FFFFFF', // Keep for legacy compatibility
    black: '#000000',
    hopeWhite: '#F2F5F7',
    lightGray: '#E0E0E0',
    lightBlue: '#E8F4FD',
    darkGray: '#424242',
    trustGrey: '#B0B8C1',

    // UI Colors (original values)
    inputBackground: '#264777',
    inputBorder: '#3d5e8d',
    cardBackground: 'rgba(255, 255, 255, 0.95)',
    cardBorder: 'rgba(0, 0, 0, 0.05)',

    // Backgrounds
    darkBackground: '#121212',

    // Status (original values)
    warning: '#FFC107',

    // Semantic color names following spiritual/app context pattern
    lightBackground: '#f8f9fa',
    borderLight: '#e1e5e9',
    backgroundBlue: '#f0f8ff',
    
    // Admin & Dashboard Colors (spiritual wisdom theme)
    wisdomIndigo: '#6366F1',        // Admin primary - wisdom and insights
    reflectionGray: '#6B7280',      // Admin secondary text - contemplation
    sanctuaryWhite: '#F9FAFB',      // Admin light background - sacred space
    gentleBorder: '#E5E7EB',        // Admin borders - soft boundaries
    scriptureText: '#1F2937',       // Admin primary text - scripture reading
    treasureGold: '#D4AF37',        // Gold accent - spiritual treasures
    
    // Status & Interactive Colors
    prosperityGreen: '#10B981',     // Success/growth - prosperity
    warningAmber: '#F59E0B',        // Warning - guidance needed
    mysticalViolet: '#8B5CF6',      // Special states - spiritual mystery
    clarityTeal: '#06B6D4',         // Info/clarity - clear understanding
    revelationBlue: '#5196f4',      // Chart highlights - divine revelations
    truthBlue: '#2563EB',           // Information - truth and knowledge
    
    // Text Hierarchy (spiritual reading context)
    meditationGray: '#374151',      // Deep thought text
    wisdomText: '#333333',          // Primary wisdom text
    guidanceText: '#666666',        // Secondary guidance text
    whisperText: '#555555',         // Subtle instruction text
    echoText: '#888888',            // Faint supporting text
    
    
    // Opacity & Overlay Colors (semantic spiritual names)
    divineVeil: 'rgba(255,255,255,0.1)',     // Light sacred overlay
    holyGlow: 'rgba(255,255,255,0.8)',       // Bright spiritual presence
    gentlePresence: 'rgba(255,255,255,0.2)',  // Soft divine touch
    whisperOverlay: 'rgba(255,255,255,0.05)', // Barely visible blessing
    shadowOfPeace: 'rgba(0,0,0,0.5)',        // Calming dark overlay
    quietReflection: 'rgba(0,0,0,0.1)',      // Subtle contemplation
    deepMeditation: 'rgba(0,0,0,0.25)',      // Focused spiritual state
    restfulShadow: 'rgba(0,0,0,0.04)',       // Peaceful background tint

    // ActionStepsCard colors (preserving exact spiritual meanings)
    prayerPurple: '#9B59B6',        // Prayer - spiritual connection
    reflectionBlue: '#3498DB',      // Reflection - wisdom and depth
    gratitudeRed: '#E74C3C',        // Gratitude - love and warmth
    winGold: '#F39C12',             // Wins - celebration and joy
    timeblockGreen: '#2ECC71',      // Time management - growth
    debtRed: '#C0392B',             // Debt management - urgency
    actionBackground: '#d9dfe7',    // Action step backgrounds

    // ENTERPRISE ENHANCEMENT: Common Hardcoded Colors Now Named
    // Based on analysis of 1200+ hardcoded values across the app
    
    // Most Common Overlays (400+ instances found)
    placeholderText: 'rgba(255,255,255,0.6)',      // Input placeholders
    lightOverlay: 'rgba(255,255,255,0.1)',         // Light overlays
    mediumOverlay: 'rgba(255,255,255,0.2)',        // Medium overlays
    modalOverlay: 'rgba(0,0,0,0.5)',               // Modal backgrounds
    chevronColor: 'rgba(255,255,255,0.65)',        // Chevron icons
    
    // Additional Overlays
    subtleOverlay: 'rgba(255,255,255,0.05)',       // Very subtle
    strongOverlay: 'rgba(255,255,255,0.3)',        // Strong overlays
    darkOverlay: 'rgba(0,0,0,0.25)',               // Dark overlays
    veryDarkOverlay: 'rgba(0,0,0,0.7)',            // Very dark
    
    // Border System
    lightBorder: 'rgba(255,255,255,0.2)',          // Light borders
    mediumBorder: 'rgba(255,255,255,0.3)',         // Medium borders
    
    // Switch/Toggle Colors
    switchTrackInactive: 'rgba(255,255,255,0.25)', // Inactive switch
    switchTrackActive: 'rgba(255,255,255,0.45)',   // Active switch
    
    // Text Variations
    secondaryText: 'rgba(255,255,255,0.8)',        // Secondary text
    tertiaryText: 'rgba(255,255,255,0.7)',         // Tertiary text
    mutedText: 'rgba(255,255,255,0.5)',            // Muted text
    
    // Additional Missing Colors
    contemplationGray: '#666666',                   // Medium gray
    darkerGray: '#1A1A1A',                         // Darker gray
    inactiveIcon: '#B0B8C1',                       // Inactive icons
    dangerRed: '#FF3B30',                          // Danger red
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
