export interface CancellableIdleTask {
  cancel: () => void;
}

interface IdleScheduler {
  requestIdleCallback?: (
    callback: () => void,
    options?: {timeout: number},
  ) => number;
  cancelIdleCallback?: (handle: number) => void;
}

/**
 * Schedules non-urgent work without relying on React Native's removed
 * InteractionManager API. The timer fallback keeps older runtimes working.
 */
export const runWhenIdle = (
  callback: () => void,
  timeout = 1000,
): CancellableIdleTask => {
  const scheduler = globalThis as typeof globalThis & IdleScheduler;
  let cancelled = false;

  const invoke = () => {
    if (!cancelled) {
      callback();
    }
  };

  if (typeof scheduler.requestIdleCallback === 'function') {
    const handle = scheduler.requestIdleCallback(invoke, {timeout});

    return {
      cancel: () => {
        cancelled = true;
        scheduler.cancelIdleCallback?.(handle);
      },
    };
  }

  const handle = setTimeout(invoke, 0);

  return {
    cancel: () => {
      cancelled = true;
      clearTimeout(handle);
    },
  };
};
