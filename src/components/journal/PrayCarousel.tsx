import React, { useRef, useCallback, useState, useMemo } from 'react';
import {
  View,
  Animated,
  StyleSheet,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { playSound } from '../../utils/soundUtils';
import { Colors } from '../../theme/colors';
import { PrayerJournalReactQuery } from './PrayerJournalReactQuery';
import EnhancedPrayerListReactQuery from './EnhancedPrayerListReactQuery';
import { triggerLightHaptic } from '../../utils/haptics';
import ThemedText from '../common/ThemedText';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../../navigation/types';

interface PrayCarouselProps {
  selectedDate: Date;
  initialScrollIndex?: number;
  onScrollIndexChange?: (index: number) => void;
  navigation?: NativeStackNavigationProp<RootStackParamList>;
}

interface CarouselItem {
  id: string;
  title: string;
  icon: string;
  component: React.ReactNode;
  color: string;
}

const PrayCarousel: React.FC<PrayCarouselProps> = ({ selectedDate, initialScrollIndex = 0, onScrollIndexChange, navigation }) => {
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const isLandscape = screenWidth > screenHeight;

  const { CARD_WIDTH, CARD_SPACING, SIDE_INSET, PEEK } = useMemo(() => {
    const getResponsiveConfig = () => {
      if (screenWidth >= 1024 && isLandscape) {
        return { cardWidth: Math.min(screenWidth * 0.85, 800), cardSpacing: 12, peek: 180, maxCardsVisible: 1 };
      } else if (screenWidth >= 768) {
        return { cardWidth: Math.min(screenWidth * 0.85, 800), cardSpacing: 12, peek: 0, maxCardsVisible: 1 };
      } else if (screenWidth >= 430) {
        return { cardWidth: screenWidth * 0.75, cardSpacing: 8, peek: 8, maxCardsVisible: 1 };
      } else {
        return { cardWidth: screenWidth * 0.8, cardSpacing: 8, peek: 8, maxCardsVisible: 1 };
      }
    };
    const config = getResponsiveConfig();
    const sideOffset = (screenWidth - config.cardWidth) / 2;
    const sideInset = config.peek === 0 ? 0 : Math.max(0, sideOffset - config.peek);
    return { CARD_WIDTH: config.cardWidth, CARD_SPACING: config.cardSpacing, SIDE_INSET: sideInset, PEEK: config.peek };
  }, [screenWidth, isLandscape]);
  const [expandedIndex, setExpandedIndex] = useState<number | null>(initialScrollIndex); // Start with initial card expanded
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const currentCardIndex = useRef(initialScrollIndex);
  const hasRestoredPosition = useRef(false);

  // Restore scroll position on mount and when parent targets a card
  React.useEffect(() => {
    const shouldAnimate = hasRestoredPosition.current;
    setExpandedIndex(initialScrollIndex);
    currentCardIndex.current = initialScrollIndex;
    setTimeout(() => {
      scrollViewRef.current?.scrollTo({
        x: initialScrollIndex * (CARD_WIDTH + CARD_SPACING),
        animated: shouldAnimate,
      });
      hasRestoredPosition.current = true;
    }, 100);
  }, [initialScrollIndex, CARD_WIDTH, CARD_SPACING]);

  const handleScrollFeedback = useCallback(() => {
    try {
      playSound();
    } catch (error) {

    }
  }, []);

  const handleScroll = useCallback((event: any) => {
    const contentOffset = event.nativeEvent.contentOffset;
    const index = Math.round(contentOffset.x / (CARD_WIDTH + CARD_SPACING));
    if (index !== currentCardIndex.current && index >= 0 && index < 2) {
      currentCardIndex.current = index;
      // Auto-expand the currently focused card
      setExpandedIndex(index);
      handleScrollFeedback();
      // Notify parent of scroll index change
      onScrollIndexChange?.(index);
    }
  }, [onScrollIndexChange, CARD_WIDTH, CARD_SPACING, handleScrollFeedback]);

  const carouselItems: CarouselItem[] = [
    {
      id: 'prayerjournal',
      title: 'PRAYER JOURNAL',
      icon: 'hand-left-outline',
      component: <PrayerJournalReactQuery selectedDate={selectedDate} variant="carousel" navigation={navigation} />,
      color: Colors.anchorBlue,
    },
    {
      id: 'peopleprayers',
      title: 'PRAYER LIST (PEOPLE)',
      icon: 'people-outline',
      component: <EnhancedPrayerListReactQuery selectedDate={selectedDate} navigation={navigation} />,
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
  carouselItemPadding: {
    paddingHorizontal: 4,
  },
  touchableComponent: {
    flex: 1,
    // Expand touch area beyond card content
    marginHorizontal: -4,
  },
});

export default PrayCarousel;
