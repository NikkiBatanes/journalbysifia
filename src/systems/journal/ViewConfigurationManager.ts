import { ViewMode, ViewConfiguration } from './types';

// View-specific configurations (preserving existing UI/UX)
export const VIEW_CONFIGURATIONS: Record<ViewMode, ViewConfiguration> = {
  carousel: {
    containerStyle: {
      // Preserve existing carousel styles
      flexDirection: 'column',
      gap: 16,
    },
    componentStyle: {
      // Individual carousel item styles
      marginVertical: 0,
    },
    spacing: 16,
    layout: 'horizontal',
  },

  inline: {
    containerStyle: {
      // Preserve existing inline view styles
      flex: 1,
      paddingHorizontal: 0,
    },
    componentStyle: {
      // Individual inline component styles
      marginBottom: 16,
    },
    titleStyle: {
      // Inline view title customizations
      fontSize: 14, // Smaller size
      textTransform: 'uppercase', // Capitalized
      letterSpacing: 1.2, // Added letter spacing
      fontWeight: '600',
    },
    cardStyle: {
      // Fully transparent background for inline view
      backgroundColor: 'transparent',
    },
    spacing: 16,
    layout: 'vertical',
  },

  moments: {
    containerStyle: {
      // Future moments page styles (similar to inline for now)
      flex: 1,
      paddingHorizontal: 16,
    },
    componentStyle: {
      // Individual moment component styles
      marginBottom: 20,
      borderRadius: 12,
      backgroundColor: 'transparent',
    },
    spacing: 20,
    layout: 'timeline',
  },
};

export class ViewConfigurationManager {
  static getConfiguration(viewMode: ViewMode): ViewConfiguration {
    return VIEW_CONFIGURATIONS[viewMode];
  }

  static getContainerStyle(viewMode: ViewMode) {
    return this.getConfiguration(viewMode).containerStyle;
  }

  static getComponentStyle(viewMode: ViewMode) {
    return this.getConfiguration(viewMode).componentStyle;
  }

  static getSpacing(viewMode: ViewMode): number {
    return this.getConfiguration(viewMode).spacing;
  }

  static getLayout(viewMode: ViewMode) {
    return this.getConfiguration(viewMode).layout;
  }

  static getTitleStyle(viewMode: ViewMode) {
    return this.getConfiguration(viewMode).titleStyle || {};
  }

  static getCardStyle(viewMode: ViewMode) {
    return this.getConfiguration(viewMode).cardStyle || {};
  }
}
