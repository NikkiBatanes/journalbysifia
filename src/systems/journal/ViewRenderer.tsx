import React from 'react';
import { ViewMode, JournalPlugin } from './types';
import { CarouselRenderer } from './renderers/CarouselRenderer';
import { InlineRenderer } from './renderers/InlineRenderer';
import { MomentsRenderer } from './renderers/MomentsRenderer';
import { BaseRenderer } from './renderers/BaseRenderer';

interface ViewRendererProps {
  viewMode: ViewMode;
  plugins: JournalPlugin[];
  selectedDate: Date;
  refreshKey?: number;
  style?: any;
  // Carousel-specific props
  carouselTitle?: string;
  onComponentTap?: (componentId: string) => void;
  // Moments-specific props
  showDateHeader?: boolean;
  // Global edit mode props
  triggerGlobalEdit?: boolean;
  onGlobalEditTriggered?: () => void;
}

export const ViewRenderer: React.FC<ViewRendererProps> = ({
  viewMode,
  plugins,
  selectedDate,
  refreshKey,
  style,
  carouselTitle,
  onComponentTap,
  showDateHeader,
  triggerGlobalEdit,
  onGlobalEditTriggered,
}) => {
  const commonProps = {
    plugins,
    selectedDate,
    refreshKey,
    viewMode,
    style,
  };

  switch (viewMode) {
    case 'carousel':
      return (
        <CarouselRenderer
          {...commonProps}
          title={carouselTitle}
          onComponentTap={onComponentTap}
        />
      );

    case 'inline':
      return (
        <InlineRenderer
          {...commonProps}
          triggerGlobalEdit={triggerGlobalEdit}
          onGlobalEditTriggered={onGlobalEditTriggered}
        />
      );

    case 'moments':
      return (
        <MomentsRenderer
          {...commonProps}
          showDateHeader={showDateHeader}
        />
      );

    default:
      // Fallback to base renderer
      return <BaseRenderer {...commonProps} />;
  }
};
