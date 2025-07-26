import * as React from 'react';
import { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { View, StyleSheet, Animated, Image, Text } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';



type Props = NativeStackScreenProps<RootStackParamList, 'GeneratingPlaybook'>;

const GeneratingPlaybookScreen: React.FC<Props> = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [animationKey, setAnimationKey] = useState(0);
  const animations = useRef<Animated.Value[]>([]);

  // Pulse animation values
  const pulseValue = useRef(new Animated.Value(0.8)).current;

  // Fade in and pulse animation when component mounts
  useEffect(() => {
    // Start fade in animation
    const fadeIn = Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    });

    // Create pulse animation
    const pulseAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseValue, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseValue, {
          toValue: 0.9,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    // Start both animations
    fadeIn.start();
    pulseAnimation.start();

    // Cleanup function
    return () => {
      fadeIn.stop();
      pulseAnimation.stop();
      pulseValue.setValue(0.8); // Reset to initial scale
    };
  }, [fadeAnim, pulseValue]);

  // Scale transform for pulse effect
  const scale = pulseValue;

  // Initialize animations for each line
  useEffect(() => {
    animations.current = Array(5).fill(0).map(() => new Animated.Value(0.3));
  }, []);

  // Animation values
  const [dots, setDots] = useState('');
  const [currentText, setCurrentText] = useState('');
  const [currentLine, setCurrentLine] = useState(0);
  const textAnim = useRef(new Animated.Value(0)).current;
  const lines = useMemo(() => [
    'Breathe in peace...',
    'Breathe out worry...',
    'Your playbook is being crafted with care.',
  ], []); // Empty dependency array ensures this is only created once

  // Animate the dots after GENERATING
  useEffect(() => {
    const interval = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) {return '';}
        return prev + '.';
      });
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Typewriter effect with smooth animations
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    let animationTimeout: NodeJS.Timeout;
    let currentCharIndex = 0;
    let isMounted = true;

    const typeNextCharacter = () => {
      if (!isMounted) {return;}

      const currentLineText = lines[currentLine];

      if (currentCharIndex < currentLineText.length) {
        setCurrentText(currentLineText.substring(0, currentCharIndex + 1));
        currentCharIndex++;
        timeout = setTimeout(typeNextCharacter, 30); // Faster typing speed
      } else {
        // Start fade out animation after delay
        animationTimeout = setTimeout(() => {
          Animated.timing(textAnim, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }).start(() => {
            if (isMounted) {
              // Defer state updates to avoid useInsertionEffect conflicts
              requestAnimationFrame(() => {
                if (isMounted) {
                  // Move to next line or reset
                  const nextLine = (currentLine + 1) % lines.length;
                  setCurrentLine(nextLine);
                  setCurrentText('');
                  currentCharIndex = 0;

                  // Fade in new text
                  Animated.timing(textAnim, {
                    toValue: 1,
                    duration: 300,
                    useNativeDriver: true,
                  }).start(typeNextCharacter);
                }
              });
            }
          });
        }, 1500); // Pause before fading out
      }
    };

    // Start the animation
    Animated.timing(textAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start(typeNextCharacter);

    return () => {
      isMounted = false;
      clearTimeout(timeout);
      clearTimeout(animationTimeout);
      textAnim.setValue(0);
    };
  }, [currentLine, lines, textAnim]); // Added missing dependencies: lines and textAnim

  // Start line animations
  useEffect(() => {
    // Line animations
    const lineAnimations = animations.current.map((anim, index) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(index * 100),
          Animated.timing(anim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0.3,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      )
    );

    // Start line animations
    const lineAnimation = Animated.stagger(100, lineAnimations);
    lineAnimation.start();

    // Cleanup function
    return () => {
      lineAnimation.stop();
      animations.current.forEach(anim => anim.setValue(0.3));
    };
  }, [animationKey]);

  // Reset animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setAnimationKey(prev => prev + 1);
      return () => {};
    }, [])
  );

  return (
    <Animated.View
      style={[
        styles.container,
        { opacity: fadeAnim, transform: [{ scale: fadeAnim }] },
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.background} />
      </View>
      <Animated.View
        style={[
          styles.logoContainer,
          {
            transform: [
              { scale: scale },
              { translateY: textAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0, -10],
              })},
            ],
          },
        ]}
      >
        <Image
          source={require('../../assets/images/siFiaAppIcon.png')}
          style={styles.logo}
          resizeMode="contain"
        />
      </Animated.View>
      <View style={styles.generatingContainer}>
        <Text style={styles.generatingText}>
          GENERATING
        </Text>
        <Text style={styles.dotsText}>
          {dots}
        </Text>
      </View>
      <Animated.View
        style={[
          styles.textContainer,
          {
            opacity: textAnim,
            transform: [{
              scale: textAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.98, 1],
              }),
            }],
          },
        ]}
      >
        <Animated.Text
          style={[
            styles.textLine,
            {
              opacity: textAnim,
              transform: [{
                translateY: textAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [10, 0],
                }),
              }],
            },
          ]}
        >
          {currentText}
        </Animated.Text>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: Colors.anchorBlue,
  },
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 60,
  },

  logoContainer: {
    width: 120,
    height: 120,
    marginBottom: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
  },
  textContainer: {
    width: '100%',
    marginTop: 24,
    backgroundColor: Colors.inputBackground,
    padding: 16,
    borderRadius: 22,
    alignItems: 'center',
  },
  textLine: {
    color: Colors.hopeWhite,
    fontSize: 16,
    textAlign: 'center' as const,
    fontWeight: '400' as const,
    letterSpacing: 0.2,
    lineHeight: 24, // Increased from 22 to 24 for better spacing
    opacity: 0.9,
    marginBottom: 8, // Add bottom margin to text lines
  },
  generatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  generatingText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    textAlign: 'center',
    lineHeight: 24, // Added line height for better spacing
    letterSpacing: 1, // Slight letter spacing for better readability
  },
  dotsText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.hopeWhite,
    width: 32, // Reduced width for better alignment
    textAlign: 'left',
    lineHeight: 24, // Match line height with generatingText
  },

});

export default GeneratingPlaybookScreen;
