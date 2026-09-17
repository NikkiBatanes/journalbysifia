import React from 'react';
import type { MorningMoment } from '../../storage/morningMomentsStorage';
import type { MomentTimelineItem } from '../../services/momentTimelineService';

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
  savedMorningMoment?: MorningMoment;
  timelineItem?: MomentTimelineItem;
}

// Optional filters that renderers can pass down to plugin components
export interface PluginFilters {
  answeredOnly?: boolean;
  allowedJournalCategories?: string[];
  excludeJournalCategories?: string[];
  hideEmptyComponents?: boolean;
  /** A presentation group owns the shared heading; child cards must not repeat it. */
  hideSectionHeader?: boolean;
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
  // Optional per-entry identifier (e.g., for an individual saved Bible study)
  sessionId?: string;
  reflectionId?: string;
  reflectionIds?: string[];
  timelineItem?: MomentTimelineItem;
}
