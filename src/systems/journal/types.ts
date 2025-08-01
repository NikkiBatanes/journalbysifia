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

export interface ViewConfiguration {
  containerStyle: Record<string, any>;
  componentStyle: Record<string, any>;
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
}
