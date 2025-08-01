import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BaseRendererProps } from './BaseRenderer';
import { PluginRenderer } from '../PluginRenderer';
import { EditModeProvider, useEditMode } from '../context/EditModeContext';

interface InlineContentProps extends BaseRendererProps {
  onGlobalEditModeChange?: (isGlobalEditMode: boolean) => void;
}

const InlineContent: React.FC<InlineContentProps> = ({
  plugins,
  selectedDate,
  refreshKey,
  viewMode,
  style,
  triggerGlobalEdit,
  onGlobalEditTriggered,
  onGlobalEditModeChange,
}) => {
  const { isGlobalEditMode, toggleGlobalEditMode } = useEditMode();

  // Notify parent of global edit mode changes
  React.useEffect(() => {
    onGlobalEditModeChange?.(isGlobalEditMode);
  }, [isGlobalEditMode, onGlobalEditModeChange]);

  // Handle global edit mode trigger from external source
  React.useEffect(() => {
    if (triggerGlobalEdit && !isGlobalEditMode) {
      toggleGlobalEditMode();
      onGlobalEditTriggered?.();
    } else if (triggerGlobalEdit && isGlobalEditMode) {
      // If already in global edit mode and trigger is pressed, exit edit mode
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

interface InlineRendererProps extends BaseRendererProps {
  onGlobalEditModeChange?: (isGlobalEditMode: boolean) => void;
}

export const InlineRenderer: React.FC<InlineRendererProps> = (props) => {
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
