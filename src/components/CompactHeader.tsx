import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
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
  title,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {title && (
        <Text style={styles.title}>{title}</Text>
      )}
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
          {completedTasks}/{totalTasks} Steps
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
    paddingTop: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
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
    color: Colors.anchorBlue,
    fontWeight: '600',
    minWidth: 60,
    textAlign: 'right',
    textTransform: 'capitalize',
  },
});

export default CompactHeader;
