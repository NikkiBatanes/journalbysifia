import React from 'react';
import {Animated, View} from 'react-native';
import type {LayoutChangeEvent} from 'react-native';
import TestRenderer, {act} from 'react-test-renderer';
import {MomentsStickyHeader} from '../MomentsStickyHeader';

// Use RN's actual CellRenderer: its inner y=0 layout event is the regression.
const CellRenderer = require('react-native/node_modules/@react-native/virtualized-lists/Lists/VirtualizedListCellRenderer').default;
const NativeStickyHeader = require('react-native/Libraries/Components/ScrollView/ScrollViewStickyHeader').default;

const layout = (y: number): LayoutChangeEvent => ({
  nativeEvent: {layout: {x: 0, y, width: 440, height: 48}},
} as LayoutChangeEvent);

it('measures the date in scroll-content coordinates and ignores the inner cell origin', () => {
  const onCellLayout = jest.fn();
  const onHeaderLayout = jest.fn();
  const onPress = jest.fn();
  const headerRef = React.createRef<React.ComponentRef<typeof MomentsStickyHeader>>();
  const scrollAnimatedValue = new Animated.Value(0);
  const render = (index: number) => (
    <MomentsStickyHeader ref={headerRef} onLayout={onHeaderLayout} scrollAnimatedValue={scrollAnimatedValue}>
      <CellRenderer cellKey="2026-09-18:header" index={index} item={{}} onCellLayout={onCellLayout}
        onUnmount={jest.fn()} renderItem={() => <View testID="date-content" onTouchEnd={onPress} />} />
    </MomentsStickyHeader>
  );
  let renderer!: TestRenderer.ReactTestRenderer;
  act(() => { renderer = TestRenderer.create(render(12), {createNodeMock: () => ({})}); });

  // The sticky wrapper is 3387 points down the content; its child is at 0.
  act(() => {
    renderer.root.findByType(NativeStickyHeader).findByType(Animated.View).props.onLayout(layout(3387));
    renderer.root.findByType(CellRenderer).instance._onLayout(layout(0));
  });
  expect(onHeaderLayout).toHaveBeenCalledWith(layout(3387));
  expect(onCellLayout.mock.calls).toEqual([[layout(3387), '2026-09-18:header', 12]]);

  // Refreshes can insert/remove earlier cells without replacing this date.
  act(() => { renderer.update(render(15)); });
  act(() => {
    renderer.root.findByType(NativeStickyHeader).findByType(Animated.View).props.onLayout(layout(3800));
    renderer.root.findByType(CellRenderer).instance._onLayout(layout(0));
  });
  expect(onCellLayout.mock.calls).toEqual([
    [layout(3387), '2026-09-18:header', 12],
    [layout(3800), '2026-09-18:header', 15],
  ]);
  // ScrollView must still be able to push this header out for the next date.
  expect(typeof headerRef.current?.setNextHeaderY).toBe('function');
  act(() => { headerRef.current!.setNextHeaderY(4000); });
  act(() => { renderer.root.findByProps({testID: 'date-content'}).props.onTouchEnd(); });
  expect(onPress).toHaveBeenCalledTimes(1);
  act(() => { renderer.unmount(); });
});
