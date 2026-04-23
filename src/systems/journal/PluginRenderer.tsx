import React from 'react';
import { View } from 'react-native';
import type { NavigationProp } from '@react-navigation/native';
import { PluginRenderProps } from './types';

export const PluginRenderer: React.FC<PluginRenderProps> = ({
  plugin,
  selectedDate,
  refreshKey,
  viewMode,
  filters,
  navigation,
}) => {
  const Component = plugin.component;

  // Preserve all existing component props and functionality
  const componentProps = {
    selectedDate,
    ...(refreshKey !== undefined && { refreshKey }),
    // Pass viewMode for future use (backward compatible)
    ...(viewMode && { viewMode }),
    ...(filters && { filters }),
    ...(navigation && { navigation }),
  };

  return (
    <View key={plugin.id}>
      <Component {...componentProps} />
    </View>
  );
};
