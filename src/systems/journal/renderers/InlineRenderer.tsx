import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BaseRendererProps } from './BaseRenderer';
import { PluginRenderer } from '../PluginRenderer';
import { EditModeProvider, useEditMode } from '../context/EditModeContext';

const InlineContent: React.FC<BaseRendererProps> = ({
  plugins,
  selectedDate,
  refreshKey,
  viewMode,
  style,
  triggerGlobalEdit,
  onGlobalEditTriggered,
}) => {
  const { isGlobalEditMode, toggleGlobalEditMode } = useEditMode();

  // Handle global edit mode trigger from external source
  React.useEffect(() => {
    if (triggerGlobalEdit && !isGlobalEditMode) {
      toggleGlobalEditMode();
      onGlobalEditTriggered?.();
    }
  }, [triggerGlobalEdit, isGlobalEditMode, toggleGlobalEditMode, onGlobalEditTriggered]);

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

export const InlineRenderer: React.FC<BaseRendererProps> = (props) => {
  return (
    <EditModeProvider>
      <InlineContent {...props} />
    </EditModeProvider>
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
