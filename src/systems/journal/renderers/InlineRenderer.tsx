import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
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
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const ITEM_WIDTH = Math.round(width);
  const JOURNAL_SIDE_PAD = 16;
  const EDGE_OVERDRAW = 2;
  const leftBreakout = (insets?.left || 0) + JOURNAL_SIDE_PAD + EDGE_OVERDRAW;
  const rightBreakout = (insets?.right || 0) + JOURNAL_SIDE_PAD + EDGE_OVERDRAW;

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
      {plugins.map((plugin) => {
        const isDevotional = plugin.title?.toLowerCase().includes('devotional');
        if (isDevotional) {
          // Edge-to-edge wrapper for devotional content
          return (
            <View
              key={plugin.id}
              style={[
                styles.componentWrapper,
                styles.devoEdgeToEdge,
                { marginLeft: -leftBreakout, marginRight: -rightBreakout },
              ]}
            >
              <View style={{ width: ITEM_WIDTH + leftBreakout + rightBreakout, marginLeft: -leftBreakout }}>
                <PluginRenderer
                  plugin={plugin}
                  selectedDate={selectedDate}
                  refreshKey={refreshKey}
                  viewMode={viewMode}
                />
              </View>
            </View>
          );
        }
        // Default inline content wrapper
        return (
          <View key={plugin.id} style={styles.componentWrapper}>
            <PluginRenderer
              plugin={plugin}
              selectedDate={selectedDate}
              refreshKey={refreshKey}
              viewMode={viewMode}
            />
          </View>
        );
      })}
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
    marginBottom: 0, // Reduced from 16 to 6 for tighter spacing between components
  },
  devoEdgeToEdge: {
    alignSelf: 'stretch',
    overflow: 'visible',
  },
});
