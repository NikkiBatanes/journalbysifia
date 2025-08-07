/**
 * Onboarding Screen Animations
 * Beautiful transition animations for onboarding flow
 */

import { NativeStackNavigationOptions } from '@react-navigation/native-stack';

// Animation Option 1: Smooth Slide & Fade
export const smoothSlideAnimation: NativeStackNavigationOptions = {
  gestureEnabled: true,
  animation: 'slide_from_right',
  animationDuration: 400,
};

// Animation Option 2: Zoom & Fade
export const zoomFadeAnimation: NativeStackNavigationOptions = {
  gestureEnabled: true,
  animation: 'fade',
  animationDuration: 500,
};

// Animation Option 3: Flip Card
export const flipCardAnimation: NativeStackNavigationOptions = {
  gestureEnabled: false,
  animation: 'flip',
  animationDuration: 600,
};

// Animation Option 4: Push from Bottom
export const pushFromBottomAnimation: NativeStackNavigationOptions = {
  gestureEnabled: true,
  animation: 'slide_from_bottom',
  animationDuration: 400,
};

// Animation Option 5: Cross Dissolve
export const crossDissolveAnimation: NativeStackNavigationOptions = {
  gestureEnabled: true,
  animation: 'fade_from_bottom',
  animationDuration: 450,
};

// Animation Option 6: Elegant Slide Up
export const elegantSlideUpAnimation: NativeStackNavigationOptions = {
  gestureEnabled: true,
  animation: 'slide_from_bottom',
  animationDuration: 350,
};

// Animation Option 7: Carousel Style
export const carouselAnimation: NativeStackNavigationOptions = {
  gestureEnabled: true,
  animation: 'slide_from_right',
  animationDuration: 300,
};

// Preset configurations for easy use
export const OnboardingAnimations = {
  smoothSlide: smoothSlideAnimation,
  zoomFade: zoomFadeAnimation,
  flipCard: flipCardAnimation,
  pushFromBottom: pushFromBottomAnimation,
  crossDissolve: crossDissolveAnimation,
  elegantSlideUp: elegantSlideUpAnimation,
  carousel: carouselAnimation,
  // Additional native stack animations
  slideFromRight: { animation: 'slide_from_right', animationDuration: 300 } as NativeStackNavigationOptions,
  slideFromLeft: { animation: 'slide_from_left', animationDuration: 300 } as NativeStackNavigationOptions,
  fadeIn: { animation: 'fade', animationDuration: 250 } as NativeStackNavigationOptions,
};

// Special animation for splash to first screen
export const splashToFirstScreenAnimation: NativeStackNavigationOptions = {
  gestureEnabled: false,
  animation: 'fade_from_bottom',
  animationDuration: 800,
};
