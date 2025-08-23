import React from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = width * 0.75;
const ITEM_SPACING = 2;
const SIDE_PADDING = (width - ITEM_WIDTH) / 2;

const DevotionalSkeleton: React.FC = () => {
  const animatedValue = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(animatedValue, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(animatedValue, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    animation.start();
    return () => animation.stop();
  }, [animatedValue]);

  const opacity = animatedValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <MaterialCommunityIcons name="book" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Your Devotionals</Text>
      </View>

      <View style={[styles.scrollContainer, { paddingHorizontal: SIDE_PADDING }]}>
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.card,
              { width: ITEM_WIDTH, marginRight: ITEM_SPACING },
              index === 0 ? { marginLeft: -(SIDE_PADDING - 16) } : null,
            ]}
          >
            <View style={styles.cardHeader}>
              <Animated.View style={[styles.badgeSkeleton, { opacity }]} />
              <Animated.View style={[styles.statusPillSkeleton, { opacity }]} />
            </View>

            <Animated.View style={[styles.titleSkeleton, { opacity }]} />

            <Animated.View style={[styles.verseSkeleton, { opacity }]} />

            <Animated.View style={[styles.descriptionSkeleton, { opacity }]} />

            <View style={styles.footerRow}>
              <Animated.View style={[styles.iconSkeleton, { opacity }]} />
              <Animated.View style={[styles.statusTextSkeleton, { opacity }]} />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    flex: 1,
  },
  scrollContainer: {
    paddingRight: 16,
    flexDirection: 'row',
  },
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  badgeSkeleton: {
    height: 18,
    width: 90,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  statusPillSkeleton: {
    height: 24,
    width: 24,
    borderRadius: 12,
    backgroundColor: Colors.faithGold,
  },
  titleSkeleton: {
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 12,
  },
  verseSkeleton: {
    height: 48,
    borderRadius: 8,
    backgroundColor: Colors.lightPurple,
    marginBottom: 12,
  },
  descriptionSkeleton: {
    height: 16,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginBottom: 16,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconSkeleton: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: Colors.faithGold,
  },
  statusTextSkeleton: {
    height: 12,
    width: 100,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});

export default DevotionalSkeleton;
