/**
 * OnboardingSplashScreen.tsx
 * Clean splash screen with logo and loading animation
 * New Design: Simple, centered logo with loading indicator
 */

import React, { useEffect, useRef } from 'react';
import {
  View,
  StyleSheet,
  Animated,
  StatusBar,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Colors } from '../../theme/colors';

const { width, height } = Dimensions.get('window');

interface OnboardingSplashScreenProps {
  onComplete?: () => void;
}

const OnboardingSplashScreen: React.FC<OnboardingSplashScreenProps> = ({ onComplete }) => {
  const navigation = useNavigation();
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.3)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  
  // Simple loading dots animations
  const dot1Anim = useRef(new Animated.Value(0.3)).current;
  const dot2Anim = useRef(new Animated.Value(0.3)).current;
  const dot3Anim = useRef(new Animated.Value(0.3)).current;

  useEffect(() => {
    // Set status bar for splash
    StatusBar.setBarStyle('light-content');
    if (Platform.OS === 'android') {
      StatusBar.setBackgroundColor(Colors.anchorBlue);
    }

    // Fun logo entrance animation with bounce and rotation
    const logoSequence = Animated.sequence([
      // Initial bounce in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 100,
          friction: 8,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    ]);

    logoSequence.start();
    
    // Start simple dots animation after logo appears
    setTimeout(() => {
      const animateDot = (dotAnim: Animated.Value) => {
        return Animated.sequence([
          Animated.timing(dotAnim, {
            toValue: 1,
            duration: 600,
            useNativeDriver: true,
          }),
          Animated.timing(dotAnim, {
            toValue: 0.3,
            duration: 600,
            useNativeDriver: true,
          }),
        ]);
      };

      Animated.loop(
        Animated.stagger(200, [
          animateDot(dot1Anim),
          animateDot(dot2Anim),
          animateDot(dot3Anim),
        ])
      ).start();
    }, 1000);

    // Navigate after delay with fun exit animation
    setTimeout(() => {
      const exitAnimation = Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.8,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(rotateAnim, {
          toValue: 2,
          duration: 500,
          useNativeDriver: true,
        }),
      ]);

      exitAnimation.start(() => {
        if (onComplete) {
          onComplete();
        } else {
          navigation.navigate('OnboardingWelcome' as never);
        }
      });
    }, 3000);
  }, [navigation, onComplete, fadeAnim, scaleAnim, rotateAnim, dot1Anim, dot2Anim, dot3Anim]);

  const rotateInterpolate = rotateAnim.interpolate({
    inputRange: [0, 1, 2],
    outputRange: ['0deg', '360deg', '720deg'],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.anchorBlue} />
      
      {/* Logo Section */}
      <View style={styles.logoSection}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [
                { scale: scaleAnim },
                { rotate: rotateInterpolate },
              ],
            },
          ]}
        >
          <Image
            source={require('../../../assets/icons/siFiaTransparent.png')}
            style={styles.logoImage}
            resizeMode="contain"
          />
        </Animated.View>

        {/* Simple Loading Dots */}
        <View style={styles.loadingContainer}>
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot1Anim,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot2Anim,
              },
            ]}
          />
          <Animated.View
            style={[
              styles.dot,
              {
                opacity: dot3Anim,
              },
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.anchorBlue,
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoSection: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 0,
  },
  logoImage: {
    width: 200,
    height: 200,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.hopeWhite,
    marginHorizontal: 4,
  },
});

export default OnboardingSplashScreen;
