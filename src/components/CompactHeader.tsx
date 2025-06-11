import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle, Platform } from 'react-native';
import { Colors } from '../theme';

interface CompactHeaderProps {
  progress: number;
  completedTasks: number;
  totalTasks: number;
  title?: string;
  style?: ViewStyle;
}

const CompactHeader: React.FC<CompactHeaderProps> = ({
  progress,
  completedTasks,
  totalTasks,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.progressRow}>
        <View style={styles.progressBar}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, Math.max(0, progress))}%` },
            ]}
          />
        </View>
        <Text style={styles.progressText}>
          {completedTasks}/{totalTasks} tasks
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: Colors.hopeWhite,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
    paddingTop: 0,
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    paddingVertical: 8,
  },
  progressBar: {
    flex: 1,
    height: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 6,
    overflow: 'hidden',
    marginRight: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.growthGreen,
    borderRadius: 6,
  },
  progressText: {
    fontSize: 12,
    color: Colors.trustGrey,
    fontFamily: 'Inter-SemiBold',
    minWidth: 60,
    textAlign: 'right',
  },
});

export default CompactHeader;
