import React, { useRef, useCallback, useState } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { playSound } from '../../utils/soundUtils';
import { Colors } from '../../theme/colors';
import { PrayerJournalReactQuery } from './PrayerJournalReactQuery';
import DevotionalPrayerListReactQuery from './DevotionalPrayerListReactQuery';
import EnhancedPrayerListReactQuery from './EnhancedPrayerListReactQuery';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 0.8;
const CARD_SPACING = 8;
const SIDE_OFFSET = (screenWidth - CARD_WIDTH) / 2; // Center items in viewport
const PEEK = 8; // reveal a bit of next card
const SIDE_INSET = Math.max(0, SIDE_OFFSET - PEEK);

interface PrayCarouselProps {
  selectedDate: Date;
  initialScrollIndex?: number;
  onScrollIndexChange?: (index: number) => void;
}

interface CarouselItem {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
  color: string;
}

const PrayCarousel: React.FC<PrayCarouselProps> = ({ selectedDate, initialScrollIndex = 0, onScrollIndexChange }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialScrollIndex); // Start with initial card expanded
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const currentCardIndex = useRef(initialScrollIndex);
  const hasRestoredPosition = useRef(false);

  // Restore scroll position on mount
  React.useEffect(() => {
    if (!hasRestoredPosition.current && initialScrollIndex > 0) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: initialScrollIndex * (CARD_WIDTH + CARD_SPACING),
          animated: false,
        });
        hasRestoredPosition.current = true;
      }, 100);
    }
  }, [initialScrollIndex]);

  const handleScrollFeedback = useCallback(() => {
    try {
      playSound();
    } catch (error) {

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
        // Auto-expand the currently focused card
        setExpandedIndex(newCardIndex);
        handleScrollFeedback();
        // Notify parent of scroll index change
        onScrollIndexChange?.(newCardIndex);
      }
    },
    [handleScrollFeedback, onScrollIndexChange]
  );

  const carouselItems: CarouselItem[] = [
    {
      id: 'prayerjournal',
      title: 'PRAYER JOURNAL',
      icon: 'hand-left-outline',
      component: <PrayerJournalReactQuery selectedDate={selectedDate} variant="carousel" />,
      color: Colors.anchorBlue,
    },
    {
      id: 'devotionalprayers',
      title: 'PRAYED DEVOTIONALS',
      icon: 'book-heart',
      component: <DevotionalPrayerListReactQuery selectedDate={selectedDate} viewMode="carousel" />,
      color: Colors.hopeWhite,
    },
    {
      id: 'peopleprayers',
      title: 'PRAYER LIST (PEOPLE)',
      icon: 'people-outline',
      component: <EnhancedPrayerListReactQuery selectedDate={selectedDate} />,
      color: Colors.alertCoral,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText weight="semiBold" style={styles.title}>PRAY & SEEK</ThemedText>
      </View>
      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        decelerationRate="fast"
        pagingEnabled={false}
        directionalLockEnabled={true}
        bounces={true}
        bouncesZoom={false}
        contentInset={{ left: SIDE_INSET, right: SIDE_INSET }}
        contentContainerStyle={{ paddingHorizontal: SIDE_INSET }}
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
              <View style={styles.touchableComponent}>
                {React.cloneElement(item.component as React.ReactElement<any>, {
                  expanded: expandedIndex === i,
                  onExpand: () => {
                    triggerLightHaptic();
                    setExpandedIndex(expandedIndex === i ? null : i);
                  },
                })}
              </View>
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
    paddingHorizontal: 16,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  title: {
    fontSize: 14,
    color: Colors.hopeWhite,
    letterSpacing: 2,
    textAlign: 'left',
    width: '100%',
  },
  scrollView: {
    // Removed fixed height for dynamic expansion
    // Centering handled by contentInset + content padding
  },
  carouselItem: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
    // Add padding to expand touch area
    paddingHorizontal: 4,
  },
  touchableComponent: {
    flex: 1,
    // Expand touch area beyond card content
    marginHorizontal: -4,
  },
  // Add invisible swipe area between cards
  swipeArea: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: CARD_SPACING,
    right: -CARD_SPACING,
    zIndex: -1,
  },
});

export default PrayCarousel;
