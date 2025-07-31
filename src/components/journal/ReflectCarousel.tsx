import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  Animated,
  ScrollView,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Audio } from 'expo-av';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { ReflectionLogReactQuery } from './ReflectionLogReactQuery';
import { GratitudeListReactQuery } from './GratitudeListReactQuery';
import { TodayWinReactQuery } from './TodayWinReactQuery';
import { LookingForwardReactQuery } from './LookingForwardReactQuery';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 2 / 3; // Show 1.5 cards in view
const CARD_SPACING = 8; // Narrower gap between cards
const SIDE_PADDING = 8; // Less side padding to reveal more of next/prev card

interface ReflectCarouselProps {
  selectedDate: Date;
  refreshKey?: number;
}

interface CarouselItem {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
  color: string;
}

const ReflectCarousel: React.FC<ReflectCarouselProps> = ({ selectedDate, refreshKey = 0 }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const currentCardIndex = useRef(0);
  const soundObject = useRef<Audio.Sound | null>(null);

  // Initialize sound
  React.useEffect(() => {
    const initializeSound = async () => {
      try {
        const { sound } = await Audio.Sound.createAsync(
          { uri: 'https://www.soundjay.com/misc/sounds/bell-ringing-05.wav' },
          { shouldPlay: false, volume: 0.2 }
        );
        soundObject.current = sound;
      } catch (error) {
        console.log('Sound initialization failed:', error);
      }
    };
    initializeSound();
    
    return () => {
      soundObject.current?.unloadAsync();
    };
  }, []);

  // Handle scroll feedback
  const handleScrollFeedback = useCallback(async () => {
    try {
      // Medium haptic feedback for reflection (slightly stronger)
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      
      // Play subtle sound
      if (soundObject.current) {
        await soundObject.current.replayAsync();
      }
    } catch (error) {
      console.log('Feedback error:', error);
    }
  }, []);

  // Track scroll position for feedback
  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newCardIndex = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
    
    if (newCardIndex !== currentCardIndex.current && newCardIndex >= 0 && newCardIndex < carouselItems.length) {
      currentCardIndex.current = newCardIndex;
      handleScrollFeedback();
    }
  }, [handleScrollFeedback]);

  const carouselItems: CarouselItem[] = [
    {
      id: 'reflection',
      title: 'Heart Journal',
      icon: 'bulb-outline',
      component: <ReflectionLogReactQuery selectedDate={selectedDate} />,
      color: Colors.alertCoral,
    },
    {
      id: 'gratitude',
      title: 'Gratitude',
      icon: 'heart-outline',
      component: <GratitudeListReactQuery key={refreshKey} selectedDate={selectedDate} refreshKey={refreshKey} />,
      color: Colors.hopeWhite,
    },
    {
      id: 'todayswin',
      title: "Today's Win",
      icon: 'trophy-outline',
      component: <TodayWinReactQuery selectedDate={selectedDate} />,
      color: Colors.anchorBlue,
    },
    {
      id: 'lookingforward',
      title: 'Looking Forward',
      icon: 'telescope-outline',
      component: <LookingForwardReactQuery selectedDate={selectedDate} />,
      color: Colors.mediumGray,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>REFLECT</Text>
      </View>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        decelerationRate="fast"
        contentInset={{
          left: SIDE_PADDING,
          right: SIDE_PADDING,
        }}
        contentContainerStyle={{
          paddingLeft: SIDE_PADDING,
          paddingRight: SIDE_PADDING,
        }}
        style={styles.scrollView}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          { 
            useNativeDriver: true,
            listener: handleScroll
          }
        )}
        scrollEventThrottle={16}
      >
        {carouselItems.map((item, i) => {
          const inputRange = [
            (i - 1) * (CARD_WIDTH + CARD_SPACING),
            i * (CARD_WIDTH + CARD_SPACING),
            (i + 1) * (CARD_WIDTH + CARD_SPACING),
          ];
          const scale = scrollX.interpolate({
            inputRange,
            outputRange: [0.92, 1, 0.92],
            extrapolate: 'clamp',
          });
          const opacity = scrollX.interpolate({
            inputRange,
            outputRange: [0.7, 1, 0.7],
            extrapolate: 'clamp',
          });
          return (
            <Animated.View
              key={item.id}
              style={[styles.carouselItem, { transform: [{ scale }], opacity }]}
            >
              {item.component}
            </Animated.View>
          );
        })}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    // Margins are now handled by parent ScrollView's gap
    marginVertical: 0,
  },
  header: {
    paddingHorizontal: 20,
    marginBottom: 12,
    paddingLeft: 16,
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
    color: Colors.hopeWhite,
    letterSpacing: 2,
  },
  scrollView: {
    height: 400,
  },
  carouselItem: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
});

export default ReflectCarousel;
