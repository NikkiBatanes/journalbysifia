/**
 * Onboarding Style Standards
 * Consistent styling for all onboarding screens
 */

import { StyleSheet } from 'react-native';
import { Colors } from './colors';
import { Fonts } from './fonts';

export const OnboardingStyles = StyleSheet.create({
  // Container Styles
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
  },

  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 50,
    paddingBottom: 30,
  },

  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },

  // Logo Section
  logoSection: {
    alignItems: 'center',
    marginBottom: 30,
  },

  logoImage: {
    width: 140,
    height: 140,
  },

  // Typography Standards
  mainTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 12,
    lineHeight: 28,
    letterSpacing: 0.5,
  },

  subtitle: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },

  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.hopeWhite,
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },

  description: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 18,
  },

  // Feature Lists
  featuresList: {
    width: '100%',
    marginBottom: 16,
  },

  featureItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
    paddingHorizontal: 8,
  },

  featureText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    marginLeft: 12,
    flex: 1,
    lineHeight: 18,
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
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Fonts.medium,
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
    fontWeight: '600',
    textAlign: 'center',
    fontFamily: Fonts.medium,
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
    backgroundColor: Colors.hopeWhite,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
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
    fontFamily: Fonts.regular,
    color: Colors.hopeWhite,
    textAlign: 'center',
  },

  selectionTextSelected: {
    color: Colors.hopeWhite,
    fontWeight: '600',
  },

  // Footer/Terms Text
  termsText: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 16,
    fontFamily: Fonts.regular,
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

// Typography Scale
export const OnboardingTypography = {
  // Titles
  heroTitle: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    lineHeight: 34,
  },
  mainTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    lineHeight: 28,
  },
  sectionTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    lineHeight: 24,
  },

  // Body Text
  subtitle: {
    fontSize: 15,
    fontFamily: Fonts.regular,
    lineHeight: 20,
  },
  body: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  caption: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  small: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    lineHeight: 16,
  },

  // Button Text
  buttonPrimary: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    fontWeight: '600',
  },
  buttonSecondary: {
    fontSize: 16,
    fontFamily: Fonts.medium,
    fontWeight: '600',
  },
};

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
