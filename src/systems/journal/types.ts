import React from 'react';

export type ViewMode = 'carousel' | 'inline' | 'moments';
export type JournalCategory = 'plan' | 'reflect' | 'pray';

export interface JournalPlugin {
  id: string;
  category: JournalCategory;
  component: React.ComponentType<any>;
  dataHook?: () => any;
  priority: number;
  viewModes: ViewMode[];
  title: string;
  subtitle?: string;
  icon?: string | React.ReactNode;
}

// Optional filters that renderers can pass down to plugin components
export interface PluginFilters {
  answeredOnly?: boolean;
  allowedJournalCategories?: string[];
  excludeJournalCategories?: string[];
  hideEmptyComponents?: boolean;
}

export interface ViewConfiguration {
  containerStyle: Record<string, any>;
  componentStyle: Record<string, any>;
  titleStyle?: Record<string, any>;
  cardStyle?: Record<string, any>;
  spacing: number;
  layout: 'horizontal' | 'vertical' | 'timeline';
}

export interface JournalSystemProps {
  selectedDate: Date;
  viewMode: ViewMode;
  categories?: JournalCategory[];
  refreshKey?: number;
}

export interface PluginRenderProps {
  plugin: JournalPlugin;
  selectedDate: Date;
  refreshKey?: number;
  viewMode: ViewMode;
  // Optional filtering context for plugins to respect renderer-level filters
  filters?: PluginFilters;
  navigation?: any;
}
