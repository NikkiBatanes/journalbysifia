import React from 'react';
import { View } from 'react-native';
import { JournalPlugin, ViewMode } from '../types';
import { PluginRenderer } from '../PluginRenderer';
import { ViewConfigurationManager } from '../ViewConfigurationManager';

export interface BaseRendererProps {
  plugins: JournalPlugin[];
  selectedDate: Date;
  refreshKey?: number;
  viewMode: ViewMode;
  style?: any;
  // Global edit mode props
  triggerGlobalEdit?: boolean;
  onGlobalEditTriggered?: () => void;
  onGlobalEditModeChange?: (isGlobalEditMode: boolean) => void;
}

export const BaseRenderer: React.FC<BaseRendererProps> = ({
  plugins,
  selectedDate,
  refreshKey,
  viewMode,
  style,
}) => {
  const viewConfig = ViewConfigurationManager.getConfiguration(viewMode);

  return (
    <View style={[viewConfig.containerStyle, style]}>
      {plugins.map((plugin) => (
        <View key={plugin.id} style={viewConfig.componentStyle}>
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
