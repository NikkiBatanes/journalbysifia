import React from 'react';
import { View, Text, Animated, StyleSheet, Dimensions, ScrollView, TouchableOpacity } from 'react-native';
import { BaseRendererProps } from './BaseRenderer';
import { PluginRenderer } from '../PluginRenderer';
import { Colors } from '../../../theme/colors';
import { Fonts } from '../../../theme/fonts';

const { width: screenWidth } = Dimensions.get('window');
const CARD_WIDTH = screenWidth * 2 / 3;
const CARD_SPACING = 8;

interface CarouselRendererProps extends BaseRendererProps {
  title?: string;
  onComponentTap?: (componentId: string) => void;
}

export const CarouselRenderer: React.FC<CarouselRendererProps> = ({
  plugins,
  selectedDate,
  refreshKey,
  viewMode,
  title,
  onComponentTap,
  style,
}) => {
  const scrollX = React.useRef(new Animated.Value(0)).current;
  const scrollViewRef = React.useRef<ScrollView>(null);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { useNativeDriver: false }
  );

  return (
    <View style={[styles.container, style]}>
      {title && (
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
        </View>
      )}

      <Animated.ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled={false}
        showsHorizontalScrollIndicator={false}
        snapToInterval={CARD_WIDTH + CARD_SPACING}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.scrollContent}
        onScroll={handleScroll}
        scrollEventThrottle={16}
        style={styles.scrollView}
      >
        {plugins.map((plugin, index) => {
          const inputRange = [
            (index - 1) * (CARD_WIDTH + CARD_SPACING),
            index * (CARD_WIDTH + CARD_SPACING),
            (index + 1) * (CARD_WIDTH + CARD_SPACING),
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
              key={plugin.id}
              style={[
                styles.carouselItem,
                { transform: [{ scale }], opacity },
              ]}
            >
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => onComponentTap?.(plugin.id)}
                style={styles.touchableComponent}
              >
                <PluginRenderer
                  plugin={plugin}
                  selectedDate={selectedDate}
                  refreshKey={refreshKey}
                  viewMode={viewMode}
                />
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
  scrollContent: {
    paddingLeft: 8,
    paddingRight: 8,
  },
  carouselItem: {
    width: CARD_WIDTH,
    marginRight: CARD_SPACING,
  },
  touchableComponent: {
    flex: 1,
  },
});
