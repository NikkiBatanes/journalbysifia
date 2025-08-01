import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
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
  onComponentTap?: (componentId: string) => void;
}

interface CarouselItem {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
  color: string;
}

const PrayCarousel: React.FC<PrayCarouselProps> = ({ selectedDate, onComponentTap }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);
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
        setExpandedIndex(null); // Collapse any expanded card on swipe
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
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  if (onComponentTap) {
                    onComponentTap(item.id);
                  } else {
                    setExpandedIndex(expandedIndex === i ? null : i);
                  }
                }}
                style={styles.touchableComponent}
              >
                {React.cloneElement(item.component as React.ReactElement<any>, {
                  expanded: expandedIndex === i,
                  onExpand: () => setExpandedIndex(expandedIndex === i ? null : i),
                })}
              </TouchableOpacity>
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
  filterContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 12,
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
    // Removed fixed height for dynamic expansion
  },
  carouselItem: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
  touchableComponent: {
    flex: 1,
  },
});

export default PrayCarousel;
