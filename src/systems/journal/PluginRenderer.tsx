import React from 'react';
import { View } from 'react-native';
import { PluginRenderProps } from './types';

export const PluginRenderer: React.FC<PluginRenderProps> = ({
  plugin,
  selectedDate,
  refreshKey,
  viewMode,
  filters,
  navigation,
  sessionId,
  reflectionId,
  reflectionIds,
  timelineItem,
  timelineItems,
}) => {
  const Component = plugin.component;

  // Preserve all existing component props and functionality
  const componentProps = {
    ...(plugin.savedMorningMoment && { moment: plugin.savedMorningMoment }),
    selectedDate,
    ...(refreshKey !== undefined && { refreshKey }),
    // Pass viewMode for future use (backward compatible)
    ...(viewMode && { viewMode }),
    ...(filters && { filters }),
    ...(navigation && { navigation }),
    // Pass the specific saved session (e.g. Bible study) so plugins can render it individually
    ...(sessionId !== undefined && { sessionId }),
    ...(reflectionId !== undefined && { reflectionId }),
    ...(reflectionIds !== undefined && { reflectionIds }),
    ...(timelineItem !== undefined && { timelineItem }),
    ...(timelineItems !== undefined && { timelineItems }),
  };

  return (
    <View>
      <Component {...componentProps} />
    </View>
  );
};
