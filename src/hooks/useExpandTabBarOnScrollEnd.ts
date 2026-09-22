import {useCallback, useEffect, useRef} from 'react';

const DRAG_END_SETTLE_MS = 120;

/**
 * Restores the main tab bar once a vertical scroll has actually settled.
 * Drag-end is delayed because React Native may transition straight into
 * momentum; a subsequent scroll/momentum event cancels that pending restore.
 */
export const useExpandTabBarOnScrollEnd = (onExpand: () => void) => {
  const expandTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onExpandRef = useRef(onExpand);

  useEffect(() => {
    onExpandRef.current = onExpand;
  }, [onExpand]);

  const cancelPendingTabBarExpand = useCallback(() => {
    if (expandTimerRef.current) {
      clearTimeout(expandTimerRef.current);
      expandTimerRef.current = null;
    }
  }, []);

  const expandTabBarNow = useCallback(() => {
    cancelPendingTabBarExpand();
    onExpandRef.current();
  }, [cancelPendingTabBarExpand]);

  const handleTabBarScrollEndDrag = useCallback(() => {
    cancelPendingTabBarExpand();
    expandTimerRef.current = setTimeout(() => {
      expandTimerRef.current = null;
      onExpandRef.current();
    }, DRAG_END_SETTLE_MS);
  }, [cancelPendingTabBarExpand]);

  useEffect(() => cancelPendingTabBarExpand, [cancelPendingTabBarExpand]);

  return {
    cancelPendingTabBarExpand,
    handleTabBarMomentumScrollBegin: cancelPendingTabBarExpand,
    handleTabBarMomentumScrollEnd: expandTabBarNow,
    handleTabBarScrollEndDrag,
  };
};
