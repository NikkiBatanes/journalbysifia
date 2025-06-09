import React, { useRef, useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { Colors } from '../theme/colors';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';

const { width } = Dimensions.get('window');

type Props = NativeStackScreenProps<RootStackParamList, 'GeneratingPlaybook'>;

const GeneratingPlaybookScreen: React.FC<Props> = ({ route, navigation }) => {
  const userName = route?.params?.userName || 'Friend';
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const [animationKey, setAnimationKey] = useState(0);
  const animations = useRef<Animated.Value[]>([]);
  
  // Fade in animation when component mounts
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);
  
  // Initialize animations for each line
  useEffect(() => {
    animations.current = Array(5).fill(0).map(() => new Animated.Value(0.3));
  }, []);

  // Text fade animation
  const textOpacity = useRef(new Animated.Value(1)).current;
  
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

    // Text fade animation
    const textFade = Animated.loop(
      Animated.sequence([
        Animated.timing(textOpacity, {
          toValue: 0.7,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(textOpacity, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        })
      ])
    );

    // Start all animations
    const lineAnimation = Animated.stagger(100, lineAnimations);
    lineAnimation.start();
    textFade.start();
    
    // Cleanup function
    return () => {
      lineAnimation.stop();
      textFade.stop();
      animations.current.forEach(anim => anim.setValue(0.3));
    };
  }, [animationKey, textOpacity]);

  // Reset animations when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      setAnimationKey(prev => prev + 1);
      return () => {};
    }, [])
  );

  const handleBack = () => {
    navigation.reset({
      index: 0,
      routes: [{ name: 'MainTabs' }],
    });
  };

  return (
    <Animated.View 
      style={[
        styles.container, 
        { opacity: fadeAnim, transform: [{ scale: fadeAnim }] }
      ]}
    >
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.background} />
      </View>
      <TouchableOpacity style={styles.backButton} onPress={handleBack}>
        <Text style={styles.closeIcon}>×</Text>
      </TouchableOpacity>
      <View style={styles.linesContainer}>
        {animations.current.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.line,
              { 
                opacity: anim,
                transform: [
                  { scaleX: anim.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0.8, 1.2]
                  })},
                  { scaleY: anim.interpolate({
                    inputRange: [0.3, 1],
                    outputRange: [0.8, 1.2]
                  })}
                ]
              }
            ]}
          />
        ))}
      </View>
      <Animated.Text style={[styles.generatingText, { opacity: textOpacity }]}>
        GENERATING
      </Animated.Text>
      <Animated.View 
        style={[
          styles.textContainer, 
          { 
            opacity: textOpacity.interpolate({
              inputRange: [0.7, 1],
              outputRange: [0.9, 1]
            }),
            transform: [{
              scale: textOpacity.interpolate({
                inputRange: [0.7, 1],
                outputRange: [0.98, 1.02]
              })
            }]
          }
        ]}
      >
        <Animated.Text style={[styles.textLine, { opacity: textOpacity }]}>
          Breathe in peace, breathe out worry.
        </Animated.Text>
        <Animated.Text style={[styles.textLine, { opacity: textOpacity }]}>
          {`${userName}'s playbook is being crafted with care.`}
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
  backButton: {
    position: 'absolute',
    top: 40,
    left: 20,
    zIndex: 10,
    padding: 10,
  },
  closeIcon: {
    color: Colors.hopeWhite,
    fontSize: 32,
    lineHeight: 32,
    marginTop: -5,
  },
  linesContainer: {
    alignItems: 'center',
    marginBottom: 30,
    height: 150,
    justifyContent: 'center',
  },
  line: {
    width: 120,  // Reduced from 160
    height: 8,    // Increased from 6
    backgroundColor: Colors.hopeWhite,
    borderRadius: 4, // Slightly increased to match thicker line
    marginVertical: 5, // Slightly reduced to compensate for thicker lines
  },
  textContainer: {
    width: '100%',
    marginTop: 24,
    backgroundColor: Colors.inputBackground,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  textLine: {
    color: Colors.hopeWhite,
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '400',
    letterSpacing: 0.2,
    lineHeight: 22,
    opacity: 0.9,
  },
  generatingText: {
    color: Colors.hopeWhite,
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 2.5,
    marginTop: 24,
    textAlign: 'center',
    textTransform: 'uppercase',
  },
});

export default GeneratingPlaybookScreen;
