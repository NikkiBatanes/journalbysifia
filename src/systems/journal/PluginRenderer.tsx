import React from 'react';
import { View } from 'react-native';
import { PluginRenderProps } from './types';

export const PluginRenderer: React.FC<PluginRenderProps> = ({
  plugin,
  selectedDate,
  refreshKey,
  viewMode,
}) => {
  const Component = plugin.component;

  // Preserve all existing component props and functionality
  const componentProps = {
    selectedDate,
    ...(refreshKey !== undefined && { refreshKey }),
    // Pass viewMode for future use (backward compatible)
    ...(viewMode && { viewMode }),
  };

  return (
    <View key={plugin.id}>
      <Component {...componentProps} />
    </View>
  );
};
