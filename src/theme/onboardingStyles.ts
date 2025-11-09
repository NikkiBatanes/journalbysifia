/**
 * Onboarding Style Standards
 * Consistent styling for all onboarding screens
 */

import { StyleSheet } from 'react-native';
import { Colors } from './colors';
import { getFontFamily } from './fonts';

// Dynamic onboarding styles that accept font families
export const createOnboardingStyles = (fonts: {
  fontRegular: string;
  fontMedium: string;
  fontSemiBold: string;
  fontBold: string;
}) => StyleSheet.create({
  // Container Styles
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    alignItems: 'center',
  },
  
  innerContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 768,
  },

  scrollContent: {
    flexGrow: 1,
    paddingTop: 50,
    paddingBottom: 30,
    paddingHorizontal: 24,
  },

  content: {
    flex: 1,
    paddingTop: 60,
    paddingBottom: 40,
    paddingHorizontal: 24,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoImage: {
    width: 120,
    height: 120,
  },

  // Typography Standards
  mainTitle: {
    fontSize: 24,
    fontFamily: fonts.fontBold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
    letterSpacing: 0.5,
  },

  subtitle: {
    fontSize: 15,
    fontFamily: fonts.fontRegular,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.fontBold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },

  description: {
    fontSize: 14,
    fontFamily: fonts.fontRegular,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },

  // Feature Lists
  featuresList: {
    width: '100%',
    marginBottom: 24,
    marginTop: 8,
  },

  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 16,
    paddingHorizontal: 8,
    minHeight: 30, // Ensure consistent height for each item
  },

  featureText: {
    fontSize: 15,
    fontFamily: fonts.fontRegular,
    color: Colors.hopeWhite,
    marginLeft: 14,
    flex: 1,
    lineHeight: 22,
  },

  // Icon Containers
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },

  featureIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },

  // Button Standards
  primaryButton: {
    backgroundColor: Colors.alertCoral,
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },

  primaryButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: fonts.fontSemiBold,
  },

  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: Colors.hopeWhite,
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
  },

  secondaryButtonText: {
    color: Colors.hopeWhite,
    fontSize: 16,
    textAlign: 'center',
    fontFamily: fonts.fontSemiBold,
  },

  buttonDisabled: {
    opacity: 0.7,
  },

  // Pagination (Journal Style)
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },

  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
    marginHorizontal: 3,
  },

  activeDot: {
    backgroundColor: Colors.growthGreen,
    width: 20,
  },

  // Progress Indicators
  progressContainer: {
    alignItems: 'center',
    marginBottom: 20,
  },

  progressText: {
    fontSize: 14,
    color: Colors.hopeWhite,
    marginBottom: 8,
    fontFamily: fonts.fontRegular,
  },

  progressBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },

  progressFill: {
    height: '100%',
    backgroundColor: Colors.hopeWhite,
    borderRadius: 2,
  },

  // Input Fields
  inputContainer: {
    width: '100%',
    marginBottom: 20,
  },

  textInput: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontSize: 16,
    fontFamily: fonts.fontRegular,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },

  // Selection Items
  selectionContainer: {
    width: '100%',
  },

  selectionButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    marginBottom: 12,
    alignItems: 'center',
  },

  selectionButtonSelected: {
    backgroundColor: 'rgba(255, 107, 107, 0.2)',
    borderColor: Colors.alertCoral,
  },

  selectionText: {
    fontSize: 16,
    fontFamily: fonts.fontRegular,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },

  selectionTextSelected: {
    color: Colors.hopeWhite,
    fontFamily: fonts.fontSemiBold,
  },

  // Footer/Terms Text
  termsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: fonts.fontRegular,
    paddingHorizontal: 20,
  },

  linkText: {
    color: Colors.hopeWhite,
    textDecorationLine: 'underline',
  },

  // Layout Helpers
  centerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },

  spacedContent: {
    justifyContent: 'space-between',
  },

  bottomSection: {
    alignItems: 'center',
    paddingTop: 20,
  },

  // Animation Helpers
  fadeContainer: {
    opacity: 1, // Will be animated
  },

  slideContainer: {
    transform: [{ translateY: 0 }], // Will be animated
  },
});

// Dynamic Typography Scale
export const createOnboardingTypography = (fonts: {
  fontRegular: string;
  fontMedium: string;
  fontSemiBold: string;
  fontBold: string;
}) => ({
  // Titles
  heroTitle: {
    fontSize: 28,
    fontFamily: fonts.fontBold,
    lineHeight: 34,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: fonts.fontBold,
    lineHeight: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: fonts.fontBold,
    lineHeight: 24,
  },

  // Body Text
  subtitle: {
    fontSize: 15,
    fontFamily: fonts.fontRegular,
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    fontFamily: fonts.fontRegular,
    lineHeight: 18,
  },
  caption: {
    fontSize: 13,
    fontFamily: fonts.fontRegular,
    lineHeight: 18,
  },
  small: {
    fontSize: 12,
    fontFamily: fonts.fontRegular,
    lineHeight: 16,
  },

  // Button Text
  buttonPrimary: {
    fontSize: 16,
    fontFamily: fonts.fontSemiBold,
  },
  buttonSecondary: {
    fontSize: 16,
    fontFamily: fonts.fontSemiBold,
  },
});

// Legacy support - create default styles with Lexend
export const OnboardingStyles = createOnboardingStyles({
  fontRegular: getFontFamily('lexend', 'regular'),
  fontMedium: getFontFamily('lexend', 'medium'),
  fontSemiBold: getFontFamily('lexend', 'semiBold'),
  fontBold: getFontFamily('lexend', 'bold'),
});

export const OnboardingTypography = createOnboardingTypography({
  fontRegular: getFontFamily('lexend', 'regular'),
  fontMedium: getFontFamily('lexend', 'medium'),
  fontSemiBold: getFontFamily('lexend', 'semiBold'),
  fontBold: getFontFamily('lexend', 'bold'),
});

// Spacing Scale
export const OnboardingSpacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 30,
  huge: 40,
};

// Color Variants for Onboarding
export const OnboardingColors = {
  primary: Colors.anchorBlue,
  accent: Colors.alertCoral,
  text: Colors.hopeWhite,
  textSecondary: 'rgba(255, 255, 255, 0.8)',
  textTertiary: 'rgba(255, 255, 255, 0.7)',
  overlay: 'rgba(255, 255, 255, 0.1)',
  overlayStrong: 'rgba(255, 255, 255, 0.2)',
  iconBackground: 'rgba(255, 107, 107, 0.2)',
};
