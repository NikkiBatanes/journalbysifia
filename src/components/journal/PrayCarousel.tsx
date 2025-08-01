import React, { useRef, useCallback } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { playSound } from '../../utils/soundUtils';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import PrayerJournalCardReactQuery from './PrayerJournalCardReactQuery';
import DevotionalPrayerListReactQuery from './DevotionalPrayerListReactQuery';
import EnhancedPrayerListReactQuery from './EnhancedPrayerListReactQuery';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = (screenWidth * 2) / 3;
const CARD_SPACING = 8;
const SIDE_PADDING = 8;

interface PrayCarouselProps {
  selectedDate: Date;
}

interface CarouselItem {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
  color: string;
}

const PrayCarousel: React.FC<PrayCarouselProps> = ({ selectedDate }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const currentCardIndex = useRef(0);

  const handleScrollFeedback = useCallback(() => {
    try {
      playSound();
    } catch (error) {
      console.log('Error with sound feedback:', error);
    }
  }, []);

  const handleScroll = useCallback(
    (event: any) => {
      const offsetX = event.nativeEvent.contentOffset.x;
      const newCardIndex = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));
      if (
        newCardIndex !== currentCardIndex.current &&
        newCardIndex >= 0 &&
        newCardIndex < 3
      ) {
        currentCardIndex.current = newCardIndex;
        handleScrollFeedback();
      }
    },
    [handleScrollFeedback]
  );

  const carouselItems: CarouselItem[] = [
    {
      id: 'prayerjournal',
      title: 'Prayer Journal',
      icon: 'book-outline',
      component: <PrayerJournalCardReactQuery selectedDate={selectedDate} />,
      color: Colors.anchorBlue,
    },
    {
      id: 'devotionalprayers',
      title: 'Prayed Devotionals',
      icon: 'leaf-outline',
      component: <DevotionalPrayerListReactQuery selectedDate={selectedDate} />,
      color: Colors.hopeWhite,
    },
    {
      id: 'peopleprayers',
      title: 'Prayer List (People)',
      icon: 'people-outline',
      component: <EnhancedPrayerListReactQuery selectedDate={selectedDate} />,
      color: Colors.alertCoral,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>PRAY</Text>
      </View>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        decelerationRate="fast"
        contentInset={{
          left: SIDE_PADDING / 2,
          right: SIDE_PADDING / 2,
        }}
        contentContainerStyle={{
          paddingHorizontal: SIDE_PADDING,
        }}
        style={styles.scrollView}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { x: scrollX } } }],
          {
            useNativeDriver: true,
            listener: handleScroll,
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

export default PrayCarousel;
