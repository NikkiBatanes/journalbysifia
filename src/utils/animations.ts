/**
 * animations.ts
 * Reusable animation utilities for enhanced onboarding experience
 */

import { Animated, Easing } from 'react-native';

export const AnimationConfig = {
  // Timing configurations
  fast: 300,
  medium: 600,
  slow: 1000,

  // Easing functions
  easeInOut: Easing.bezier(0.4, 0, 0.2, 1),
  easeOut: Easing.bezier(0, 0, 0.2, 1),
  easeIn: Easing.bezier(0.4, 0, 1, 1),
  bounce: Easing.bounce,
  elastic: Easing.elastic(1.5),
};

export class AnimationUtils {
  /**
   * Fade in animation with optional delay
   */
  static fadeIn(
    animatedValue: Animated.Value,
    duration: number = AnimationConfig.medium,
    delay: number = 0
  ): Animated.CompositeAnimation {
    return Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      delay,
      easing: AnimationConfig.easeOut,
      useNativeDriver: true,
    });
  }

  /**
   * Slide up animation
   */
  static slideUp(
    animatedValue: Animated.Value,
    duration: number = AnimationConfig.medium,
    delay: number = 0
  ): Animated.CompositeAnimation {
    return Animated.timing(animatedValue, {
      toValue: 0,
      duration,
      delay,
      easing: AnimationConfig.easeOut,
      useNativeDriver: true,
    });
  }

  /**
   * Scale animation with bounce effect
   */
  static scaleIn(
    animatedValue: Animated.Value,
    duration: number = AnimationConfig.medium,
    delay: number = 0
  ): Animated.CompositeAnimation {
    return Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      delay,
      easing: AnimationConfig.bounce,
      useNativeDriver: true,
    });
  }

  /**
   * Pulse animation for attention-grabbing elements
   */
  static pulse(
    animatedValue: Animated.Value,
    minScale: number = 0.95,
    maxScale: number = 1.05,
    duration: number = 1000
  ): Animated.CompositeAnimation {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: maxScale,
          duration: duration / 2,
          easing: AnimationConfig.easeInOut,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: minScale,
          duration: duration / 2,
          easing: AnimationConfig.easeInOut,
          useNativeDriver: true,
        }),
      ])
    );
  }

  /**
   * Staggered animation for multiple elements
   */
  static staggered(
    animations: Animated.CompositeAnimation[],
    staggerDelay: number = 100
  ): Animated.CompositeAnimation {
    const staggeredAnimations = animations.map((animation, index) =>
      Animated.timing(new Animated.Value(0), {
        toValue: 1,
        duration: 0,
        delay: index * staggerDelay,
        useNativeDriver: true,
      })
    );

    return Animated.parallel([
      ...staggeredAnimations,
      Animated.stagger(staggerDelay, animations),
    ]);
  }

  /**
   * Progress bar animation
   */
  static progressBar(
    animatedValue: Animated.Value,
    targetWidth: number,
    duration: number = AnimationConfig.slow
  ): Animated.CompositeAnimation {
    return Animated.timing(animatedValue, {
      toValue: targetWidth,
      duration,
      easing: AnimationConfig.easeOut,
      useNativeDriver: false, // Width animations can't use native driver
    });
  }

  /**
   * Floating animation for background elements
   */
  static float(
    animatedValue: Animated.Value,
    range: number = 10,
    duration: number = 3000
  ): Animated.CompositeAnimation {
    return Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: range,
          duration: duration / 2,
          easing: AnimationConfig.easeInOut,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: -range,
          duration: duration / 2,
          easing: AnimationConfig.easeInOut,
          useNativeDriver: true,
        }),
      ])
    );
  }

  /**
   * Rotate animation for loading indicators
   */
  static rotate(
    animatedValue: Animated.Value,
    duration: number = 2000
  ): Animated.CompositeAnimation {
    return Animated.loop(
      Animated.timing(animatedValue, {
        toValue: 1,
        duration,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    );
  }

  /**
   * Card flip animation
   */
  static flipCard(
    animatedValue: Animated.Value,
    duration: number = AnimationConfig.medium
  ): Animated.CompositeAnimation {
    return Animated.timing(animatedValue, {
      toValue: 1,
      duration,
      easing: AnimationConfig.easeInOut,
      useNativeDriver: true,
    });
  }

  /**
   * Shake animation for error states
   */
  static shake(
    animatedValue: Animated.Value,
    intensity: number = 10,
    duration: number = 500
  ): Animated.CompositeAnimation {
    return Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: intensity,
        duration: duration / 8,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: -intensity,
        duration: duration / 8,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: intensity,
        duration: duration / 8,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: -intensity,
        duration: duration / 8,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 0,
        duration: duration / 2,
        useNativeDriver: true,
      }),
    ]);
  }

  /**
   * Sequential entrance animation for onboarding screens
   */
  static onboardingEntrance(
    fadeAnim: Animated.Value,
    slideAnim: Animated.Value,
    scaleAnim: Animated.Value
  ): Animated.CompositeAnimation {
    return Animated.parallel([
      this.fadeIn(fadeAnim, AnimationConfig.medium),
      this.slideUp(slideAnim, AnimationConfig.medium),
      this.scaleIn(scaleAnim, AnimationConfig.medium, 200),
    ]);
  }

  /**
   * Button press animation
   */
  static buttonPress(
    animatedValue: Animated.Value,
    pressScale: number = 0.95,
    duration: number = 150
  ): Animated.CompositeAnimation {
    return Animated.sequence([
      Animated.timing(animatedValue, {
        toValue: pressScale,
        duration: duration / 2,
        easing: AnimationConfig.easeIn,
        useNativeDriver: true,
      }),
      Animated.timing(animatedValue, {
        toValue: 1,
        duration: duration / 2,
        easing: AnimationConfig.easeOut,
        useNativeDriver: true,
      }),
    ]);
  }

  /**
   * Modal slide in from bottom
   */
  static modalSlideIn(
    animatedValue: Animated.Value,
    duration: number = AnimationConfig.medium
  ): Animated.CompositeAnimation {
    return Animated.timing(animatedValue, {
      toValue: 0,
      duration,
      easing: AnimationConfig.easeOut,
      useNativeDriver: true,
    });
  }

  /**
   * Typewriter effect for text
   */
  static typewriter(
    animatedValue: Animated.Value,
    textLength: number,
    duration: number = 2000
  ): Animated.CompositeAnimation {
    return Animated.timing(animatedValue, {
      toValue: textLength,
      duration,
      easing: Easing.linear,
      useNativeDriver: false,
    });
  }
}

/**
 * Pre-configured animation sequences for common onboarding patterns
 */
export const OnboardingAnimations = {
  /**
   * Screen entrance animation
   */
  screenEntrance: (
    fadeAnim: Animated.Value,
    slideAnim: Animated.Value,
    delay: number = 0
  ) => {
    return Animated.parallel([
      AnimationUtils.fadeIn(fadeAnim, AnimationConfig.medium, delay),
      AnimationUtils.slideUp(slideAnim, AnimationConfig.medium, delay),
    ]);
  },

  /**
   * Progress step animation
   */
  progressStep: (
    progressAnim: Animated.Value,
    targetWidth: number
  ) => {
    return AnimationUtils.progressBar(progressAnim, targetWidth, AnimationConfig.slow);
  },

  /**
   * Feature card reveal animation
   */
  featureReveal: (
    cards: Animated.Value[],
    staggerDelay: number = 150
  ) => {
    const cardAnimations = cards.map(cardAnim =>
      AnimationUtils.fadeIn(cardAnim, AnimationConfig.medium)
    );
    return AnimationUtils.staggered(cardAnimations, staggerDelay);
  },

  /**
   * Logo animation sequence
   */
  logoSequence: (
    scaleAnim: Animated.Value,
    rotateAnim: Animated.Value,
    fadeAnim: Animated.Value
  ) => {
    return Animated.sequence([
      AnimationUtils.scaleIn(scaleAnim, AnimationConfig.medium),
      Animated.parallel([
        AnimationUtils.rotate(rotateAnim, 1000),
        AnimationUtils.fadeIn(fadeAnim, AnimationConfig.fast, 500),
      ]),
    ]);
  },
};
