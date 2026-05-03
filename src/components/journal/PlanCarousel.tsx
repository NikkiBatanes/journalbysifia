import React, { useRef, useCallback, useState, useMemo, useEffect } from 'react';
import { View, Animated, StyleSheet, ScrollView, useWindowDimensions, DeviceEventEmitter } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { Colors, standardColors } from '../../theme/colors';
import { TodaysFocusReactQuery } from './TodaysFocusReactQuery';
import { TodosReactQuery } from './TodosReactQuery';
import { TimeBlockReactQueryWithErrorBoundary as TimeBlockReactQuery } from './TimeBlockReactQuery';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';

interface PlanCarouselProps {
  selectedDate: Date;
  refreshKey?: number;
  initialScrollIndex?: number;
  onScrollIndexChange?: (index: number) => void;
  navigation?: NavigationProp<any>;
}

const PlanCarousel: React.FC<PlanCarouselProps> = ({ selectedDate, refreshKey, initialScrollIndex = 0, onScrollIndexChange, navigation }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;

  // Enhanced responsive design for different screen sizes
  const { CARD_WIDTH, CARD_SPACING, SIDE_INSET, PEEK } = useMemo(() => {
    const getResponsiveConfig = () => {
      // iPad Landscape - centered cards like Portrait
      if (screenWidth >= 1024 && isLandscape) {
        return {
          cardWidth: Math.min(screenWidth * 0.85, 800),
          cardSpacing: 12,
          peek: 180,  // No peek for centered layout
          maxCardsVisible: 1,
        };
      }
      // iPad Portrait - larger cards, better spacing
      else if (screenWidth >= 768) {
        return {
          cardWidth: Math.min(screenWidth * 0.85, 800),
          cardSpacing: 12,
          peek: 0,
          maxCardsVisible: 1,
        };
      }
      // Large phones (iPhone Pro Max, etc.)
      else if (screenWidth >= 430) {
        return {
          cardWidth: screenWidth * 0.75,
          cardSpacing: 8,
          peek: 8,
          maxCardsVisible: 1,
        };
      }
      // Standard phones
      else {
        return {
          cardWidth: screenWidth * 0.8,
          cardSpacing: 8,
          peek: 8,
          maxCardsVisible: 1,
        };
      }
    };

    const config = getResponsiveConfig();
    const cardWidth = config.cardWidth;
    const cardSpacing = config.cardSpacing;
    const sideOffset = (screenWidth - cardWidth) / 2;
    const peek = config.peek;
    // When peek is 0 (iPad Portrait), center the cards by using minimal inset
    const sideInset = peek === 0 ? 0 : Math.max(0, sideOffset - peek);

    return { CARD_WIDTH: cardWidth, CARD_SPACING: cardSpacing, SIDE_INSET: sideInset, PEEK: peek };
  }, [screenWidth, isLandscape]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialScrollIndex); // Start with initial card expanded
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const currentCardIndex = useRef(0); // Start at 0 like ReflectCarousel
  const hasRestoredPosition = useRef(false);

  // Restore scroll position on mount
  React.useEffect(() => {
    if (!hasRestoredPosition.current) {
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          x: initialScrollIndex * (CARD_WIDTH + CARD_SPACING),
          animated: false,
        });
        hasRestoredPosition.current = true;
        // Set expanded index after scroll position is restored
        setExpandedIndex(initialScrollIndex);
      }, 100);
    }
  }, [initialScrollIndex, CARD_WIDTH, CARD_SPACING]);

  // Listen for collapse event when navigating away from journal screen
  useEffect(() => {
    const subscription = DeviceEventEmitter.addListener('collapse_all_expanded', () => {
      setExpandedIndex(null);
    });
    return () => subscription.remove();
  }, []);

  const carouselItems = useMemo(() => [
    {
      id: 'focus',
      title: 'FOCUS',
      icon: 'target-outline',
      component: <TodaysFocusReactQuery selectedDate={selectedDate} refreshKey={refreshKey} variant="carousel" navigation={navigation} />,
      color: Colors.alertCoral,
    },
    {
      id: 'todos',
      title: 'TODOS',
      icon: 'checkmark-circle-outline',
      component: <TodosReactQuery selectedDate={selectedDate} refreshKey={refreshKey} />,
      color: standardColors.primary,
    },
    {
      id: 'timeblocks',
      title: 'TIMEBLOCKS',
      icon: 'time-outline',
      component: <TimeBlockReactQuery selectedDate={selectedDate} />,
      color: standardColors.info,
    },
  ], [selectedDate, refreshKey, navigation]);

  // Handle scroll feedback with sound

  // Track scroll position for feedback and auto-expansion
  const handleScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const index = Math.round(contentOffset.x / (CARD_WIDTH + CARD_SPACING));
    if (index !== currentCardIndex.current && index >= 0 && index < carouselItems.length) {
      currentCardIndex.current = index;
      // Auto-expand the currently focused card
      setExpandedIndex(index);
      onScrollIndexChange?.(index);
    }
  }, [onScrollIndexChange, CARD_WIDTH, CARD_SPACING, carouselItems]);

  // Removed unused renderHeader

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <ThemedText weight="semiBold" style={styles.title}>PLAN & PREPARE</ThemedText>
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
        contentInset={PEEK === 0 ? undefined : { left: SIDE_INSET, right: SIDE_INSET }}
        contentContainerStyle={{ paddingHorizontal: PEEK === 0 ? (screenWidth - CARD_WIDTH) / 2 : SIDE_INSET }}
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
              style={[
                styles.carouselItem,
                { width: CARD_WIDTH, marginRight: CARD_SPACING },
                styles.carouselItemPadding,
                { transform: [{ scale }], opacity },
              ]}
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
  },
  carouselItem: {
    width: 0, // Will be overridden by inline style
    marginRight: 0, // Will be overridden by inline style
  },
  carouselItemPadding: {
    paddingHorizontal: 4,
  },
  touchableComponent: {
    flex: 1,
    // Expand touch area beyond card content
    marginHorizontal: -4,
  },
});

export default PlanCarousel;
