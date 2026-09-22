import React, {useCallback} from 'react';
import type {Animated, LayoutChangeEvent} from 'react-native';

interface StickyCellProps {
  cellKey?: string;
  index?: number;
  onCellLayout?: (event: LayoutChangeEvent, cellKey: string, index: number) => void;
}

interface StickyHeaderProps {
  children: React.ReactElement<StickyCellProps>;
  onLayout: (event: LayoutChangeEvent) => void;
  scrollAnimatedValue: Animated.Value;
  nextHeaderLayoutY?: number;
  inverted?: boolean;
  scrollViewHeight?: number;
  nativeID?: string;
  hiddenOnScroll?: boolean;
}

interface StickyHeaderHandle {
  setNextHeaderY: (y: number) => void;
}

// Keep React Native's native-driven pinning and touch handling. This adapter is
// specific to RN 0.79's CellRenderer/ScrollViewStickyHeader layout contract;
// recheck it when upgrading React Native.
const NativeStickyHeader = require('react-native/Libraries/Components/ScrollView/ScrollViewStickyHeader').default as
  React.ForwardRefExoticComponent<StickyHeaderProps & React.RefAttributes<StickyHeaderHandle>>;

export const MomentsStickyHeader = React.forwardRef<StickyHeaderHandle, StickyHeaderProps>(
  ({children, onLayout, ...props}, ref) => {
    const child = React.Children.only(children);
    const {onCellLayout, cellKey, index} = child.props;
    const isListCell = !!onCellLayout && cellKey !== undefined && index !== undefined;
    const handleLayout = useCallback((event: LayoutChangeEvent) => {
      onLayout(event);
      if (onCellLayout && cellKey !== undefined && index !== undefined) {
        onCellLayout(event, cellKey, index);
      }
    }, [onLayout, onCellLayout, cellKey, index]);

    return (
      <NativeStickyHeader {...props} ref={ref} onLayout={handleLayout}>
        {isListCell ? React.cloneElement(child, {
          // The inner cell sits at y=0 inside the sticky wrapper. Only report
          // the wrapper's position in the scroll content to VirtualizedList,
          // or its spacers shrink/grow and repeatedly jump between dates.
          onCellLayout: undefined,
        }) : child}
      </NativeStickyHeader>
    );
  },
);

MomentsStickyHeader.displayName = 'MomentsStickyHeader';
