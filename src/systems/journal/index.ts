// Main Journal System exports
export { JournalSystem } from './JournalSystem';
export type { EnhancedJournalSystemProps } from './JournalSystem';

// Core types
export type {
  ViewMode,
  JournalCategory,
  JournalPlugin,
  ViewConfiguration,
  JournalSystemProps,
  PluginRenderProps,
} from './types';

// Plugin system
export {
  JOURNAL_PLUGINS,
  getPluginsByCategory,
  getPluginsByViewMode,
  getPluginById,
  getAllPlugins,
} from './plugins/registry';

// View renderers
export { ViewRenderer } from './ViewRenderer';
export { CarouselRenderer } from './renderers/CarouselRenderer';
export { InlineRenderer } from './renderers/InlineRenderer';
export { MomentsRenderer } from './renderers/MomentsRenderer';
export { EnhancedMomentsRenderer } from './renderers/EnhancedMomentsRenderer';
export { BaseRenderer } from './renderers/BaseRenderer';

// Configuration
export { ViewConfigurationManager } from './ViewConfigurationManager';

// Plugin renderer
export { PluginRenderer } from './PluginRenderer';
