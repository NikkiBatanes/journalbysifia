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

type NativeStickyHeaderComponent = React.ForwardRefExoticComponent<
  StickyHeaderProps & React.RefAttributes<StickyHeaderHandle>
>;

export const resolveNativeStickyHeader = (
  moduleValue: NativeStickyHeaderComponent | {default?: NativeStickyHeaderComponent},
): NativeStickyHeaderComponent => {
  if (typeof moduleValue === 'function') {
    return moduleValue;
  }

  if (typeof moduleValue.default === 'function') {
    return moduleValue.default;
  }

  throw new Error('React Native ScrollViewStickyHeader export is unavailable');
};

// Keep React Native's native-driven pinning and touch handling. RN 0.88 Metro
// returns this internal component directly while Jest/older RN expose it under
// `.default`. Resolve both shapes so the adapter cannot render `undefined`.
// The internal CellRenderer/ScrollViewStickyHeader contract remains an upgrade
// checkpoint until React Native exposes an equivalent public hook.
const NativeStickyHeader = resolveNativeStickyHeader(
  require('react-native/Libraries/Components/ScrollView/ScrollViewStickyHeader'),
);

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
