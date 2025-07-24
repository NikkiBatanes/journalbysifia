import React from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors } from '../../theme/colors';

interface PrayerSkeletonProps {
  showDropdown?: boolean;
  showPrayerGroups?: boolean;
}

const PrayerSkeleton: React.FC<PrayerSkeletonProps> = ({
  showDropdown = true,
  showPrayerGroups = true,
}) => {
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
      {/* Prayer Type Dropdown Skeleton */}
      {showDropdown && (
        <View style={styles.dropdownSection}>
          <Animated.View style={[styles.dropdownSkeleton, { opacity }]} />
        </View>
      )}

      {/* Prayer Input Section Skeleton */}
      <View style={styles.inputSection}>
        <Animated.View style={[styles.inputSkeleton, { opacity }]} />
        <Animated.View style={[styles.buttonSkeleton, { opacity }]} />
      </View>

      {/* Prayer Groups Skeleton */}
      {showPrayerGroups && (
        <View style={styles.prayerGroupsSection}>
          {[1, 2, 3].map((index) => (
            <View key={index} style={styles.prayerGroupCard}>
              {/* Prayer Group Header */}
              <View style={styles.prayerGroupHeader}>
                <Animated.View style={[styles.badgeSkeleton, { opacity }]} />
              </View>

              {/* Prayer Items */}
              {[1, 2].map((itemIndex) => (
                <View key={itemIndex} style={styles.prayerItem}>
                  <Animated.View style={[styles.prayerTextSkeleton, { opacity }]} />
                  {index === 3 && ( // Supplication group has status pills
                    <Animated.View style={[styles.statusPillSkeleton, { opacity }]} />
                  )}
                </View>
              ))}
            </View>
          ))}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 16,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownSection: {
    marginBottom: 16,
  },
  dropdownSkeleton: {
    height: 48,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.mediumGray,
  },
  inputSection: {
    marginBottom: 20,
  },
  inputSkeleton: {
    height: 80,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.mediumGray,
  },
  buttonSkeleton: {
    height: 44,
    backgroundColor: Colors.lightGray,
    borderRadius: 8,
    width: 100,
    alignSelf: 'flex-end',
  },
  prayerGroupsSection: {
    gap: 12,
  },
  prayerGroupCard: {
    backgroundColor: Colors.hopeWhite,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.mediumGray,
  },
  prayerGroupHeader: {
    marginBottom: 8,
  },
  badgeSkeleton: {
    height: 24,
    width: 120,
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
  },
  prayerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  prayerTextSkeleton: {
    height: 16,
    flex: 1,
    backgroundColor: Colors.lightGray,
    borderRadius: 4,
    marginRight: 12,
  },
  statusPillSkeleton: {
    height: 24,
    width: 80,
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
  },
});

export default PrayerSkeleton;
