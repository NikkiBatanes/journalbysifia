import React from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';
import { Colors } from '../../theme';

const { width } = Dimensions.get('window');
const CARD_HORIZONTAL_PADDING = 16;
const VISIBLE_WIDTH = Math.max(0, width - CARD_HORIZONTAL_PADDING * 2);
const ITEM_WIDTH = VISIBLE_WIDTH * 0.8;
const ITEM_SPACING = 8;
const SIDE_INSET = Math.max(0, (VISIBLE_WIDTH - ITEM_WIDTH) / 2);

const DevotionalCarouselSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;
  const isMounted = React.useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    
    const animate = () => {
      if (!isMounted.current) return;
      
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
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

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      {/* Horizontal Carousel Cards */}
      <View style={[styles.carouselContainer, { paddingHorizontal: SIDE_INSET }]}>
        {[1, 2].map((item) => {
          // Compute margin based on item position to avoid inline styles
          const cardMarginRight = item === 1 ? ITEM_SPACING : 0;

          return (
            <View
              key={item}
              style={[
                styles.carouselCard,
                {
                  width: ITEM_WIDTH,
                  marginRight: cardMarginRight,
                },
              ]}
            >
              {/* Card Header - Category Badge and Status Badge */}
              <View style={styles.cardHeader}>
                <Animated.View style={[styles.categoryBadge, { opacity }]} />
                <Animated.View style={[styles.statusBadge, { opacity }]} />
              </View>

              {/* Title */}
              <Animated.View style={[styles.titleSkeleton, { opacity }]} />
              <Animated.View style={[styles.titleSkeletonShort, { opacity }]} />

              {/* Description */}
              <Animated.View style={[styles.descriptionLine, { opacity }]} />
              <Animated.View style={[styles.descriptionLineShort, { opacity }]} />

              {/* Next/Status Section */}
              <View style={styles.statusSection}>
                <Animated.View style={[styles.statusLabel, { opacity }]} />
                <Animated.View style={[styles.statusText, { opacity }]} />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 36,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 0,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    marginLeft: 8,
    flex: 1,
  },
  viewAllButton: {
    height: 18,
    width: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 4,
  },
  carouselContainer: {
    flexDirection: 'row',
    overflow: 'visible',
    marginHorizontal: -16,
  },
  carouselCard: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    minHeight: 240,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  categoryBadge: {
    height: 22,
    width: 70,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderRadius: 12,
  },
  statusBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  titleSkeleton: {
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 6,
    width: '90%',
  },
  titleSkeletonShort: {
    height: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.25)',
    borderRadius: 4,
    marginBottom: 12,
    width: '60%',
  },
  descriptionLine: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 4,
    marginBottom: 6,
    width: '95%',
  },
  descriptionLineShort: {
    height: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 4,
    marginBottom: 16,
    width: '75%',
  },
  statusSection: {
    marginTop: 'auto',
    gap: 6,
  },
  statusLabel: {
    height: 14,
    width: 40,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 4,
  },
  statusText: {
    height: 16,
    width: 120,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    borderRadius: 4,
  },
});

export default DevotionalCarouselSkeleton;
