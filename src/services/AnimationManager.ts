/**
 * AnimationManager.ts
 * Advanced animation system for smooth UI transitions
 */

import { Animated, Easing, Dimensions } from 'react-native';

const { width, height } = Dimensions.get('window');

export type AnimationType =
  | 'fadeIn'
  | 'fadeOut'
  | 'slideInLeft'
  | 'slideInRight'
  | 'slideInUp'
  | 'slideInDown'
  | 'scaleIn'
  | 'scaleOut'
  | 'bounce'
  | 'pulse'
  | 'shake'
  | 'flip'
  | 'cardFlip'
  | 'staggeredFadeIn';

export interface AnimationConfig {
  duration?: number;
  delay?: number;
  easing?: any;
  useNativeDriver?: boolean;
}

export interface StaggerConfig extends AnimationConfig {
  staggerDelay?: number;
  itemCount?: number;
}

class AnimationManager {
  private animations: Map<string, Animated.Value> = new Map();
  private compositeAnimations: Map<string, Animated.CompositeAnimation> = new Map();

  /**
   * Create or get an animated value
   */
  getAnimatedValue(key: string, initialValue: number = 0): Animated.Value {
    if (!this.animations.has(key)) {
      this.animations.set(key, new Animated.Value(initialValue));
    }
    return this.animations.get(key)!;
  }

  /**
   * Create or get an animated XY value
   */
  getAnimatedXY(key: string, initialValue: { x: number; y: number } = { x: 0, y: 0 }): Animated.ValueXY {
    const xyKey = `${key}_xy`;
    if (!this.animations.has(xyKey)) {
      this.animations.set(xyKey, new Animated.ValueXY(initialValue) as any);
    }
    return this.animations.get(xyKey) as any;
  }

  /**
   * Execute a single animation
   */
  animate(
    animatedValue: Animated.Value,
    toValue: number,
    config: AnimationConfig = {}
  ): Promise<void> {
    const {
      duration = 300,
      delay = 0,
      easing = Easing.out(Easing.cubic),
      useNativeDriver = true,
    } = config;

    return new Promise((resolve) => {
      const animation = Animated.timing(animatedValue, {
        toValue,
        duration,
        delay,
        easing,
        useNativeDriver,
      });

      animation.start(() => resolve());
    });
  }

  /**
   * Execute a spring animation
   */
  spring(
    animatedValue: Animated.Value,
    toValue: number,
    config: {
      tension?: number;
      friction?: number;
      delay?: number;
      useNativeDriver?: boolean;
    } = {}
  ): Promise<void> {
    const {
      tension = 40,
      friction = 7,
      delay = 0,
      useNativeDriver = true,
    } = config;

    return new Promise((resolve) => {
      const animation = Animated.spring(animatedValue, {
        toValue,
        tension,
        friction,
        delay,
        useNativeDriver,
      });

      animation.start(() => resolve());
    });
  }

  /**
   * Execute predefined animation types
   */
  executeAnimation(
    type: AnimationType,
    animatedValue: Animated.Value | Animated.ValueXY,
    config: AnimationConfig = {}
  ): Promise<void> {
    const {
      duration = 300,
      delay = 0,
      easing = Easing.out(Easing.cubic),
      useNativeDriver = true,
    } = config;

    return new Promise((resolve) => {
      let animation: Animated.CompositeAnimation;

      switch (type) {
        case 'fadeIn':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 1,
            duration,
            delay,
            easing,
            useNativeDriver,
          });
          break;

        case 'fadeOut':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 0,
            duration,
            delay,
            easing,
            useNativeDriver,
          });
          break;

        case 'slideInLeft':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 0,
            duration,
            delay,
            easing,
            useNativeDriver,
          });
          break;

        case 'slideInRight':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 0,
            duration,
            delay,
            easing,
            useNativeDriver,
          });
          break;

        case 'slideInUp':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 0,
            duration,
            delay,
            easing,
            useNativeDriver,
          });
          break;

        case 'slideInDown':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 0,
            duration,
            delay,
            easing,
            useNativeDriver,
          });
          break;

        case 'scaleIn':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 1,
            duration,
            delay,
            easing: Easing.back(1.5),
            useNativeDriver,
          });
          break;

        case 'scaleOut':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 0,
            duration,
            delay,
            easing,
            useNativeDriver,
          });
          break;

        case 'bounce':
          animation = Animated.spring(animatedValue as Animated.Value, {
            toValue: 1,
            tension: 100,
            friction: 3,
            delay,
            useNativeDriver,
          });
          break;

        case 'pulse':
          animation = Animated.sequence([
            Animated.timing(animatedValue as Animated.Value, {
              toValue: 1.1,
              duration: duration / 2,
              easing,
              useNativeDriver,
            }),
            Animated.timing(animatedValue as Animated.Value, {
              toValue: 1,
              duration: duration / 2,
              easing,
              useNativeDriver,
            }),
          ]);
          break;

        case 'shake':
          animation = Animated.sequence([
            Animated.timing(animatedValue as Animated.Value, {
              toValue: 10,
              duration: 50,
              useNativeDriver,
            }),
            Animated.timing(animatedValue as Animated.Value, {
              toValue: -10,
              duration: 50,
              useNativeDriver,
            }),
            Animated.timing(animatedValue as Animated.Value, {
              toValue: 10,
              duration: 50,
              useNativeDriver,
            }),
            Animated.timing(animatedValue as Animated.Value, {
              toValue: 0,
              duration: 50,
              useNativeDriver,
            }),
          ]);
          break;

        case 'flip':
          animation = Animated.sequence([
            Animated.timing(animatedValue as Animated.Value, {
              toValue: 90,
              duration: duration / 2,
              easing,
              useNativeDriver,
            }),
            Animated.timing(animatedValue as Animated.Value, {
              toValue: 0,
              duration: duration / 2,
              easing,
              useNativeDriver,
            }),
          ]);
          break;

        case 'cardFlip':
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 180,
            duration,
            easing,
            useNativeDriver,
          });
          break;

        default:
          animation = Animated.timing(animatedValue as Animated.Value, {
            toValue: 1,
            duration,
            delay,
            easing,
            useNativeDriver,
          });
      }

      animation.start(() => resolve());
    });
  }

  /**
   * Execute staggered animations for multiple items
   */
  executeStaggeredAnimation(
    type: AnimationType,
    animatedValues: Animated.Value[],
    config: StaggerConfig = {}
  ): Promise<void> {
    const {
      duration = 300,
      delay = 0,
      staggerDelay = 100,
      easing = Easing.out(Easing.cubic),
      useNativeDriver = true,
    } = config;

    const animations = animatedValues.map((value, index) =>
      this.executeAnimation(type, value, {
        duration,
        delay: delay + (index * staggerDelay),
        easing,
        useNativeDriver,
      })
    );

    return Promise.all(animations).then(() => {});
  }

  /**
   * Create a parallel animation
   */
  parallel(animations: Animated.CompositeAnimation[]): Promise<void> {
    return new Promise((resolve) => {
      Animated.parallel(animations).start(() => resolve());
    });
  }

  /**
   * Create a sequence animation
   */
  sequence(animations: Animated.CompositeAnimation[]): Promise<void> {
    return new Promise((resolve) => {
      Animated.sequence(animations).start(() => resolve());
    });
  }

  /**
   * Stop all animations for a key
   */
  stopAnimation(key: string) {
    const animatedValue = this.animations.get(key);
    if (animatedValue) {
      animatedValue.stopAnimation();
    }

    const compositeAnimation = this.compositeAnimations.get(key);
    if (compositeAnimation) {
      compositeAnimation.stop();
      this.compositeAnimations.delete(key);
    }
  }

  /**
   * Reset animated value
   */
  resetAnimation(key: string, value: number = 0) {
    const animatedValue = this.animations.get(key);
    if (animatedValue) {
      animatedValue.setValue(value);
    }
  }

  /**
   * Create interpolated styles
   */
  createInterpolation(
    animatedValue: Animated.Value,
    inputRange: number[],
    outputRange: any[],
    extrapolate?: 'extend' | 'identity' | 'clamp'
  ) {
    return animatedValue.interpolate({
      inputRange,
      outputRange,
      extrapolate: extrapolate || 'clamp',
    });
  }

  /**
   * Get common animation styles
   */
  getAnimationStyles(type: AnimationType, animatedValue: Animated.Value) {
    switch (type) {
      case 'fadeIn':
      case 'fadeOut':
        return { opacity: animatedValue };

      case 'slideInLeft':
        return {
          transform: [{
            translateX: this.createInterpolation(
              animatedValue,
              [0, 1],
              [-width, 0]
            ),
          }],
        };

      case 'slideInRight':
        return {
          transform: [{
            translateX: this.createInterpolation(
              animatedValue,
              [0, 1],
              [width, 0]
            ),
          }],
        };

      case 'slideInUp':
        return {
          transform: [{
            translateY: this.createInterpolation(
              animatedValue,
              [0, 1],
              [-height, 0]
            ),
          }],
        };

      case 'slideInDown':
        return {
          transform: [{
            translateY: this.createInterpolation(
              animatedValue,
              [0, 1],
              [height, 0]
            ),
          }],
        };

      case 'scaleIn':
      case 'scaleOut':
        return {
          transform: [{ scale: animatedValue }],
        };

      case 'shake':
        return {
          transform: [{ translateX: animatedValue }],
        };

      case 'flip':
        return {
          transform: [{
            rotateY: this.createInterpolation(
              animatedValue,
              [0, 90, 180],
              ['0deg', '90deg', '180deg']
            ),
          }],
        };

      default:
        return { opacity: animatedValue };
    }
  }

  /**
   * Clean up animations
   */
  cleanup() {
    this.animations.forEach((value) => {
      value.stopAnimation();
    });
    this.animations.clear();
    this.compositeAnimations.clear();
  }
}

// Singleton instance
export const animationManager = new AnimationManager();

export default AnimationManager;
