import React from 'react';
import { View, StyleSheet, Animated, Dimensions, Text } from 'react-native';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { Colors } from '../../theme/colors';

const { width } = Dimensions.get('window');
const ITEM_WIDTH = Math.round(width * 0.75);
const ITEM_SPACING = 12; // visible gap between cards in skeleton
const SIDE_PADDING = Math.round((width - ITEM_WIDTH) / 2);

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
      {/* Header to match carousel section */}
      <View style={styles.header}>
        <MaterialCommunityIcons name="book" size={24} color={Colors.alertCoral} />
        <Text style={styles.title}>Your Devotionals</Text>
      </View>

      {/* Horizontal row of skeleton cards to match carousel layout */}
      <View style={[styles.row, { paddingHorizontal: SIDE_PADDING }]}> 
        {[0, 1, 2].map((index) => (
          <View
            key={index}
            style={[
              styles.card,
              { width: ITEM_WIDTH, marginRight: ITEM_SPACING },
              index === 0 ? { marginLeft: -(SIDE_PADDING - 16) } : null,
            ]}
          >
            {/* Title */}
            <Animated.View style={[styles.titleSkeleton, { opacity }]} />

            {/* Verse/description block */}
            <Animated.View style={[styles.descriptionSkeleton, { opacity }]} />

            {/* Status section (progress/time text) */}
            <View style={styles.statusSection}>
              <Animated.View style={[styles.statusTextSkeleton, { opacity }]} />
              <Animated.View style={[styles.lastAccessedSkeleton, { opacity }]} />
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
  row: {
    flexDirection: 'row',
    paddingRight: 16,
  },
  card: {
    backgroundColor: Colors.modalBlue,
    borderRadius: 30,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    position: 'relative',
  },
  titleSkeleton: {
    height: 18,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginTop: 6,
    marginBottom: 12,
    width: '78%',
    alignSelf: 'flex-start',
  },
  descriptionSkeleton: {
    height: 40,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginBottom: 16,
    width: '92%',
    alignSelf: 'flex-start',
  },
  statusSection: {
    gap: 6,
  },
  statusTextSkeleton: {
    height: 12,
    width: 120,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  lastAccessedSkeleton: {
    height: 10,
    width: 90,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
});

export default DevotionalSkeleton;
