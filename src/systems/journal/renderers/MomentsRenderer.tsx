import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BaseRendererProps } from './BaseRenderer';
import { PluginRenderer } from '../PluginRenderer';
import { Colors } from '../../../theme/colors';
import { Fonts } from '../../../theme/fonts';
import { format } from 'date-fns';

interface MomentsRendererProps extends BaseRendererProps {
  showDateHeader?: boolean;
}

export const MomentsRenderer: React.FC<MomentsRendererProps> = ({
  plugins,
  selectedDate,
  refreshKey,
  viewMode,
  showDateHeader = true,
  style,
}) => {
  // Filter plugins that have data (future enhancement)
  const pluginsWithData = plugins; // For now, show all plugins

  if (pluginsWithData.length === 0) {
    return (
      <View style={[styles.container, style]}>
        {showDateHeader && (
          <View style={styles.dateHeader}>
            <Text style={styles.dateText}>
              {format(
                selectedDate,
                selectedDate.getFullYear() === new Date().getFullYear()
                  ? 'EEEE, MMMM d'
                  : 'EEEE, MMMM d, yyyy'
              )}
            </Text>
            <Text style={styles.noEntriesText}>No entries for this date</Text>
          </View>
        )}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      {showDateHeader && (
        <View style={styles.dateHeader}>
          <Text style={styles.dateText}>
            {format(
              selectedDate,
              selectedDate.getFullYear() === new Date().getFullYear()
                ? 'EEEE, MMMM d'
                : 'EEEE, MMMM d, yyyy'
            )}
          </Text>
          <Text style={styles.entriesCountText}>
            {pluginsWithData.length} {pluginsWithData.length === 1 ? 'entry' : 'entries'}
          </Text>
        </View>
      )}

      <View style={styles.momentsContainer}>
        {pluginsWithData.map((plugin, index) => (
          <View key={plugin.id} style={styles.momentItem}>
            <View style={styles.timelineIndicator}>
              <View style={styles.timelineDot} />
              {index < pluginsWithData.length - 1 && (
                <View style={styles.timelineLine} />
              )}
            </View>

            <View style={styles.momentContent}>
              <PluginRenderer
                plugin={plugin}
                selectedDate={selectedDate}
                refreshKey={refreshKey}
                viewMode={viewMode}
              />
            </View>
          </View>
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  dateHeader: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    marginBottom: 20,
  },
  dateText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.hopeWhite,
    fontFamily: Fonts.semiBold,
  },
  entriesCountText: {
    fontSize: 14,
    color: Colors.mediumGray,
    marginTop: 4,
  },
  noEntriesText: {
    fontSize: 14,
    color: Colors.mediumGray,
    marginTop: 4,
    fontStyle: 'italic',
  },
  momentsContainer: {
    flex: 1,
  },
  momentItem: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  timelineIndicator: {
    alignItems: 'center',
    marginRight: 16,
    paddingTop: 8,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: Colors.alertCoral,
    marginBottom: 8,
  },
  timelineLine: {
    width: 2,
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minHeight: 40,
  },
  momentContent: {
    flex: 1,
  },
});
