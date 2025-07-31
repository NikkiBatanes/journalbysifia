import React, { useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
} from 'react-native';
import { Colors } from '../../theme/colors';
import { Fonts } from '../../theme/fonts';
import { TodaysFocusReactQuery } from './TodaysFocusReactQuery';
import { TodosReactQuery } from './TodosReactQuery';
import { TimeBlockReactQueryWithErrorBoundary as TimeBlockReactQuery } from './TimeBlockReactQuery';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth - 80; // Show peek of next/previous cards
const CARD_SPACING = 16;
const SIDE_PADDING = 20;

interface PlanCarouselProps {
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

const PlanCarousel: React.FC<PlanCarouselProps> = ({ selectedDate, refreshKey = 0 }) => {
  const scrollViewRef = useRef<ScrollView>(null);

  const carouselItems: CarouselItem[] = [
    {
      id: 'focus',
      title: "Today's Focus",
      icon: 'target-outline',
      component: <TodaysFocusReactQuery selectedDate={selectedDate} />,
      color: Colors.alertCoral,
    },
    {
      id: 'todos',
      title: 'Todos',
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

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.title}>PLAN</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      {renderHeader()}

      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        decelerationRate="fast"
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        contentInset={{
          left: SIDE_PADDING,
          right: SIDE_PADDING,
        }}
        contentContainerStyle={{
          paddingLeft: SIDE_PADDING,
          paddingRight: SIDE_PADDING,
        }}
        style={styles.scrollView}
      >
        {carouselItems.map((item) => (
          <View key={item.id} style={styles.carouselItem}>
            {item.component}
          </View>
        ))}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: Fonts.semiBold,
    color: Colors.anchorBlue,
  },
  scrollView: {
    height: 400,
  },
  carouselItem: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
});

export default PlanCarousel;
