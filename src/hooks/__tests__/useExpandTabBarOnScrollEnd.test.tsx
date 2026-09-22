import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {useExpandTabBarOnScrollEnd} from '../useExpandTabBarOnScrollEnd';

type ScrollEndHandlers = ReturnType<typeof useExpandTabBarOnScrollEnd>;

let handlers: ScrollEndHandlers;

const Harness = ({onExpand}: {onExpand: () => void}) => {
  handlers = useExpandTabBarOnScrollEnd(onExpand);
  return null;
};

describe('useExpandTabBarOnScrollEnd', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('expands after a drag settles without momentum', () => {
    const onExpand = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<Harness onExpand={onExpand} />); });

    act(() => { handlers.handleTabBarScrollEndDrag(); });
    act(() => { jest.advanceTimersByTime(119); });
    expect(onExpand).not.toHaveBeenCalled();

    act(() => { jest.advanceTimersByTime(1); });
    expect(onExpand).toHaveBeenCalledTimes(1);

    act(() => { renderer!.unmount(); });
  });

  it('waits for momentum to finish before expanding', () => {
    const onExpand = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<Harness onExpand={onExpand} />); });

    act(() => {
      handlers.handleTabBarScrollEndDrag();
      handlers.handleTabBarMomentumScrollBegin();
      jest.runOnlyPendingTimers();
    });
    expect(onExpand).not.toHaveBeenCalled();

    act(() => { handlers.handleTabBarMomentumScrollEnd(); });
    expect(onExpand).toHaveBeenCalledTimes(1);

    act(() => { renderer!.unmount(); });
  });

  it('cancels a pending restore when scrolling resumes', () => {
    const onExpand = jest.fn();
    let renderer: TestRenderer.ReactTestRenderer;
    act(() => { renderer = TestRenderer.create(<Harness onExpand={onExpand} />); });

    act(() => {
      handlers.handleTabBarScrollEndDrag();
      handlers.cancelPendingTabBarExpand();
      jest.runOnlyPendingTimers();
    });
    expect(onExpand).not.toHaveBeenCalled();

    act(() => { renderer!.unmount(); });
  });
});
