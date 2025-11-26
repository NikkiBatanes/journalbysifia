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
import { ReflectionLogReactQuery } from './ReflectionLogReactQuery';
import { GratitudeListReactQuery } from './GratitudeListReactQuery';
import { TodayWinReactQuery } from './TodayWinReactQuery';
import { LookingForwardReactQuery } from './LookingForwardReactQuery';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const isLandscape = screenWidth > screenHeight;

// Enhanced responsive design for different screen sizes
const getResponsiveConfig = () => {
  // iPad Landscape - show more content, larger cards
  if (screenWidth >= 1024 && isLandscape) {
    return {
      cardWidth: Math.min(screenWidth * 0.85, 800), // Show 2 cards with peek
      cardSpacing: 12,
      peek: 16,
      maxCardsVisible: 1,
    };
  }
  // iPad Portrait - larger cards, better spacing
  else if (screenWidth >= 768) {
    return {
      cardWidth: Math.min(screenWidth * 0.85, 800), // 77% width for better iPad use
      cardSpacing: 12,
      peek: 0,
      maxCardsVisible: 1,
    };
  }
  // Large phones (iPhone Pro Max, etc.)
  else if (screenWidth >= 430) {
    return {
      cardWidth: screenWidth * 0.75, // Slightly smaller percentage for large phones
      cardSpacing: 8,
      peek: 8,
      maxCardsVisible: 1,
    };
  }
  // Standard phones
  else {
    return {
      cardWidth: screenWidth * 0.8, // Keep original for smaller phones
      cardSpacing: 8,
      peek: 8,
      maxCardsVisible: 1,
    };
  }
};

const config = getResponsiveConfig();
const CARD_WIDTH = config.cardWidth;
const CARD_SPACING = config.cardSpacing;
const SIDE_OFFSET = (screenWidth - CARD_WIDTH) / 2;
const PEEK = config.peek;
// When peek is 0 (iPad Portrait), center the cards by using minimal inset
const SIDE_INSET = PEEK === 0 ? 0 : Math.max(0, SIDE_OFFSET - PEEK);

interface ReflectCarouselProps {
  selectedDate: Date;
  refreshKey?: number;
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

const ReflectCarousel: React.FC<ReflectCarouselProps> = ({ selectedDate, refreshKey = 0, initialScrollIndex = 0, onScrollIndexChange }) => {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialScrollIndex); // Start with initial card expanded
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const currentCardIndex = useRef(0);
  const hasRestoredPosition = useRef(false);

  // Restore scroll position on mount
  React.useEffect(() => {
    if (!hasRestoredPosition.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: 0,
          animated: false,
        });
        hasRestoredPosition.current = true;
      }, 100);
    }
  }, []);

  // Handle scroll feedback with sound
  const handleScrollFeedback = useCallback(() => {
    try {
      // Play sound effect
      playSound();
    } catch (error) {

    }
  }, []);

  // Track scroll position for feedback and auto-expansion
  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newCardIndex = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));

    if (newCardIndex !== currentCardIndex.current && newCardIndex >= 0 && newCardIndex < 4) {
      currentCardIndex.current = newCardIndex;
      // Auto-expand the currently focused card
      setExpandedIndex(newCardIndex);
      handleScrollFeedback();
      // Notify parent of scroll index change
      onScrollIndexChange?.(newCardIndex);
    }
  }, [handleScrollFeedback, onScrollIndexChange]);

  const carouselItems: CarouselItem[] = [
    {
      id: 'reflection',
      title: 'HEART JOURNAL',
      icon: 'bulb-outline',
      component: <ReflectionLogReactQuery
        selectedDate={selectedDate}
        // Don't provide onPencilTap - let individual entries handle their own editing
      />,
      color: Colors.alertCoral,
    },
    {
      id: 'gratitude',
      title: 'GRATITUDE',
      icon: 'heart-outline',
      component: <GratitudeListReactQuery key={refreshKey} selectedDate={selectedDate} refreshKey={refreshKey} />,
      color: Colors.hopeWhite,
    },
    {
      id: 'todayswin',
      title: "TODAY'S WIN",
      icon: 'trophy-outline',
      component: <TodayWinReactQuery selectedDate={selectedDate} />,
      color: Colors.anchorBlue,
    },
    {
      id: 'lookingforward',
      title: 'LOOKING FORWARD',
      icon: 'telescope-outline',
      component: <LookingForwardReactQuery selectedDate={selectedDate} />,
      color: Colors.textGray,
    },
  ];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText weight="semiBold" style={styles.title}>REFLECT & GROW</ThemedText>
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
    // Margins are now handled by parent ScrollView's gap
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

export default ReflectCarousel;
