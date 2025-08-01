import React, { useRef, useCallback } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { playSound } from '../../utils/soundUtils';
import { Fonts } from '../../theme/fonts';
import { Colors } from '../../theme/colors';
import { TodaysFocusReactQuery } from './TodaysFocusReactQuery';
import { TodosReactQuery } from './TodosReactQuery';
import { TimeBlockReactQueryWithErrorBoundary as TimeBlockReactQuery } from './TimeBlockReactQuery';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 2 / 3; // Show 1.5 cards in view
const CARD_SPACING = 8; // Narrower gap between cards
const SIDE_PADDING = 8; // Less side padding to reveal more of next/prev card

interface PlanCarouselProps {
  selectedDate: Date;
  refreshKey?: number;
  onComponentTap?: (componentId: string) => void;
}


const PlanCarousel: React.FC<PlanCarouselProps> = ({ selectedDate, refreshKey, onComponentTap }) => {
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const currentCardIndex = useRef(0);



  const carouselItems = [
    {
      id: 'focus',
      title: 'FOCUS',
      icon: 'target-outline',
      component: <TodaysFocusReactQuery selectedDate={selectedDate} refreshKey={refreshKey} />,
      color: Colors.alertCoral,
    },
    {
      id: 'todos',
      title: 'TODOS',
      icon: 'checkmark-circle-outline',
      component: <TodosReactQuery selectedDate={selectedDate} refreshKey={refreshKey} />,
      color: Colors.anchorBlue,
    },
    {
      id: 'timeblocks',
      title: 'Time Blocks',
      icon: 'time-outline',
      component: <TimeBlockReactQuery selectedDate={selectedDate} />,
      color: Colors.growthGreen,
    },
  ];

  // Handle scroll feedback with sound
  const handleScrollFeedback = useCallback(() => {
    try {
      // Play sound effect
      playSound();
    } catch (error) {
      console.log('Error with sound feedback:', error);
    }
  }, []);

  // Track scroll position for feedback
  const handleScroll = useCallback((event: any) => {
    const offsetX = event.nativeEvent.contentOffset.x;
    const newCardIndex = Math.round(offsetX / (CARD_WIDTH + CARD_SPACING));

    if (newCardIndex !== currentCardIndex.current && newCardIndex >= 0 && newCardIndex < 3) {
      currentCardIndex.current = newCardIndex;
      handleScrollFeedback();
    }
  }, [handleScrollFeedback]);

  // Removed unused renderHeader

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>PLAN</Text>
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
                onPress={() => onComponentTap?.(item.id)}
                style={styles.touchableComponent}
              >
                {item.component}
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
  touchableComponent: {
    flex: 1,
  },
});

export default PlanCarousel;
