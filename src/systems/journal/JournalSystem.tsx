import React from 'react';
import { JournalSystemProps } from './types';
import { getPluginsByCategory } from './plugins/registry';
import { ViewRenderer } from './ViewRenderer';

interface EnhancedJournalSystemProps extends JournalSystemProps {
  // Carousel-specific props
  carouselTitle?: string;
  onComponentTap?: (componentId: string) => void;
  // Moments-specific props
  showDateHeader?: boolean;
  // Global edit mode props
  triggerGlobalEdit?: boolean;
  onGlobalEditTriggered?: () => void;
  style?: any;
}

export const JournalSystem: React.FC<EnhancedJournalSystemProps> = ({
  selectedDate,
  viewMode,
  categories = ['plan', 'reflect', 'pray'],
  refreshKey,
  carouselTitle,
  onComponentTap,
  showDateHeader = true,
  triggerGlobalEdit,
  onGlobalEditTriggered,
  style,
}) => {
  // Get plugins for specified categories and view mode
  const plugins = React.useMemo(() => {
    const categoryPlugins = categories.flatMap(category =>
      getPluginsByCategory(category)
    );

    // Filter by view mode compatibility
    return categoryPlugins.filter(plugin =>
      plugin.viewModes.includes(viewMode)
    );
  }, [categories, viewMode]);

  return (
    <ViewRenderer
      viewMode={viewMode}
      plugins={plugins}
      selectedDate={selectedDate}
      refreshKey={refreshKey}
      style={style}
      carouselTitle={carouselTitle}
      onComponentTap={onComponentTap}
      showDateHeader={showDateHeader}
      triggerGlobalEdit={triggerGlobalEdit}
      onGlobalEditTriggered={onGlobalEditTriggered}
    />
  );
};

// Export the enhanced props type for external use
export type { EnhancedJournalSystemProps };
