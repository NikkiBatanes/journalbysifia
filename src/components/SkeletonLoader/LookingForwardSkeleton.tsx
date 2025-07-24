import React from 'react';
import { View, StyleSheet } from 'react-native';
import { JournalCard } from '../journal/JournalCard';
import { Colors } from '../../theme/colors';
import { Sunrise as LuSunrise } from 'lucide-react-native';

export const LookingForwardSkeleton: React.FC = () => {
  return (
    <JournalCard
      title="Looking Forward To"
      subtitle="What are you looking forward to tomorrow?"
      icon={<LuSunrise size={24} color={Colors.alertCoral} strokeWidth={2.5} />}
      showAddButton={false}
    >
      <View style={styles.skeletonContainer}>
        <View style={styles.skeletonLine} />
        <View style={[styles.skeletonLine, styles.shortLine]} />
      </View>
    </JournalCard>
  );
};

const styles = StyleSheet.create({
  skeletonContainer: {
    backgroundColor: '#ebeef2',
    borderRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 12,
    minHeight: 60,
    borderWidth: 0.5,
    borderColor: 'rgba(26, 60, 109, 0.15)',
    justifyContent: 'center',
  },
  skeletonLine: {
    height: 14,
    backgroundColor: 'rgba(26, 60, 109, 0.1)',
    borderRadius: 4,
    marginBottom: 8,
  },
  shortLine: {
    width: '70%',
    marginBottom: 0,
  },
});
