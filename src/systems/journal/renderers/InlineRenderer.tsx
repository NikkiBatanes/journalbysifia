import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BaseRendererProps } from './BaseRenderer';
import { PluginRenderer } from '../PluginRenderer';

export const InlineRenderer: React.FC<BaseRendererProps> = ({
  plugins,
  selectedDate,
  refreshKey,
  viewMode,
  style,
}) => {
  return (
    <View style={[styles.container, style]}>
      {plugins.map((plugin) => (
        <View key={plugin.id} style={styles.componentWrapper}>
          <PluginRenderer
            plugin={plugin}
            selectedDate={selectedDate}
            refreshKey={refreshKey}
            viewMode={viewMode}
          />
        </View>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  componentWrapper: {
    marginBottom: 16,
  },
});
