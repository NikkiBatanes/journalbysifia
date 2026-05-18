import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const DashboardReflectionSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const isMounted = React.useRef(true);
  // Match ReflectionQuestionsCard sizing
  const { width: screenWidth } = Dimensions.get('window');
  const CARD_HORIZONTAL_PADDING = 16; // matches styles.card padding in ReflectionQuestionsCard
  const VISIBLE_WIDTH = Math.max(0, screenWidth - CARD_HORIZONTAL_PADDING * 2);
  // On iPad, use fixed width (~4 inches = 384 points) so adjacent cards are visible; phones use 80%
  const isTablet = screenWidth >= 768;
  const ITEM_WIDTH = isTablet ? 384 : VISIBLE_WIDTH * 0.8;
  const CARD_SPACING = 8;
  const SIDE_INSET = Math.max(0, isTablet ? 24 : (VISIBLE_WIDTH - ITEM_WIDTH) / 2);

  React.useEffect(() => {
    isMounted.current = true;

    const animate = () => {
      if (!isMounted.current) {return;}

      Animated.sequence([
        Animated.timing(animatedValue, { toValue: 1, duration: 1000, useNativeDriver: true }),
        Animated.timing(animatedValue, { toValue: 0, duration: 1000, useNativeDriver: true }),
      ]).start((finished) => {
        if (finished && isMounted.current) {
          animate();
        }
      });
    };

    animate();

    return () => {
      isMounted.current = false;
      animatedValue.stopAnimation();
    };
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({ inputRange: [0, 1], outputRange: [0.3, 0.7] });

  return (
    <View style={styles.card}>
      {/* Centered title bar */}
      <View style={styles.titleRow}>
        <Animated.View style={[styles.titleBar, { opacity }]} />
      </View>

      {/* Two reflection card placeholders */}
      <View style={[styles.carouselContainer, { paddingHorizontal: SIDE_INSET }]}>
        {[1, 2].map((item) => (
          <View
            key={item}
            style={[
              styles.placeholderCard,
              {
                width: ITEM_WIDTH,
                marginRight: item === 1 ? CARD_SPACING : 0,
              },
            ]}
          >
            <View style={styles.sectionHeader}>
              <Animated.View style={[styles.sectionIcon, { opacity }]} />
              <Animated.View style={[styles.sectionLabel, { opacity }]} />
            </View>
            <Animated.View style={[styles.questionLineLong, { opacity }]} />
            <Animated.View style={[styles.questionLineShort, { opacity }]} />
            <View style={styles.buttonRow}>
              <Animated.View style={[styles.button, { opacity }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: 'transparent',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 0,
    borderColor: 'transparent',
    minHeight: 120,
  },
  titleRow: {
    alignItems: 'center',
    marginBottom: 14,
  },
  titleBar: {
    height: 12,
    width: 180,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  placeholderCard: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 30,
    padding: 24,
    borderWidth: 0,
    borderColor: 'transparent',
    height: 300,
    justifyContent: 'space-evenly',
    alignItems: 'center',
    gap: 16,
  },
  carouselContainer: {
    flexDirection: 'row',
    overflow: 'visible',
    marginHorizontal: -16,
  },
  sectionHeader: {
    alignItems: 'center',
  },
  sectionIcon: {
    height: 20,
    width: 20,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 6,
  },
  sectionLabel: {
    height: 12,
    width: 160,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  questionLineLong: {
    height: 18,
    width: '85%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  questionLineShort: {
    height: 18,
    width: '60%',
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  buttonRow: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  button: {
    height: 40,
    width: 140,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderWidth: 0,
    borderColor: 'transparent',
  },
});

export default DashboardReflectionSkeleton;
