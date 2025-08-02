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
const CARD_WIDTH = screenWidth * 0.8;
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
  const [expandedIndex, setExpandedIndex] = useState<number | null>(0); // Start with first card expanded
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
        // Auto-expand the currently focused card
        setExpandedIndex(newCardIndex);
        handleScrollFeedback();
      }
    },
    [handleScrollFeedback]
  );

  const carouselItems: CarouselItem[] = [
    {
      id: 'prayerjournal',
      title: 'PRAYER JOURNAL',
      icon: 'book-outline',
      component: <PrayerJournalCardReactQuery selectedDate={selectedDate} />,
      color: Colors.anchorBlue,
    },
    {
      id: 'devotionalprayers',
      title: 'PRAYED DEVOTIONALS',
      icon: 'leaf-outline',
      component: <DevotionalPrayerListReactQuery selectedDate={selectedDate} />,
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
        <Text style={styles.title}>PRAY</Text>
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
                  // Only handle component tap navigation, expansion is handled by scroll
                  if (onComponentTap) {
                    onComponentTap(item.id);
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
