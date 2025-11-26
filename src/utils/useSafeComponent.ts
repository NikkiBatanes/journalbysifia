/**
 * Safe Component Utilities
 * Prevents memory leaks and EXC_BAD_ACCESS crashes in React components
 */

import { useCallback, useRef, useEffect } from 'react';
import { MemoryManager } from './memoryManager';
import { Logger } from './ProductionLogger';

/**
 * Hook for managing timeouts with automatic cleanup
 */
export const useSafeTimeouts = (namespace: string): { setTimeout: (id: string, callback: () => void, delay: number) => void; clearTimeout: (id: string) => void; clearTimeoutAll: () => void } => {
  const timersRef = useRef<Set<string>>(new Set());

  const setTimeout = useCallback((id: string, callback: () => void, delay: number): void => {
    const fullId = `${namespace}_${id}`;
    timersRef.current.add(fullId);
    MemoryManager.setTimeout(fullId, callback, delay);
  }, [namespace]);

  const clearTimeout = useCallback((id: string): void => {
    const fullId = `${namespace}_${id}`;
    timersRef.current.delete(fullId);
    MemoryManager.clearTimeout(fullId);
  }, [namespace]);

  const clearTimeoutAll = useCallback(() => {
    for (const fullId of timersRef.current) {
      MemoryManager.clearTimeout(fullId);
    }
    timersRef.current.clear();
  }, []);

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      clearTimeoutAll();
    };
  }, [clearTimeoutAll]);

  return { setTimeout, clearTimeout, clearTimeoutAll };
};

/**
 * Hook for managing intervals with automatic cleanup
 */
export const useSafeIntervals = (namespace: string): { setInterval: (id: string, callback: () => void, delay: number) => NodeJS.Timeout; clearInterval: (id: string) => void; clearIntervalAll: () => void } => {
  const intervalsRef = useRef<Map<string, NodeJS.Timeout>>(new Map());

  const setInterval = useCallback((id: string, callback: () => void, delay: number): NodeJS.Timeout => {
    const fullId = `${namespace}_${id}`;

    // Clear existing interval if any
    const existing = intervalsRef.current.get(fullId);
    if (existing) {
      global.clearInterval(existing);
    }

    const interval: NodeJS.Timeout = global.setInterval(() => {
      try {
        callback();
      } catch (error) {
        Logger.error(`Error in interval ${fullId}:`, error as Error, {
          component: 'useSafeComponent',
          intervalId: fullId,
        });
        // Clear this specific interval on error
        const errorInterval = intervalsRef.current.get(fullId);
        if (errorInterval) {
          global.clearInterval(errorInterval);
          intervalsRef.current.delete(fullId);
        }
      }
    }, delay);

    intervalsRef.current.set(fullId, interval);
    return interval;
  }, [namespace]);

  const clearInterval = useCallback((id: string): void => {
    const fullId = `${namespace}_${id}`;
    const interval = intervalsRef.current.get(fullId);
    if (interval) {
      global.clearInterval(interval);
      intervalsRef.current.delete(fullId);
    }
  }, [namespace]);

  const clearIntervalAll = useCallback((): void => {
    for (const [_fullId, interval] of intervalsRef.current) {
      global.clearInterval(interval);
    }
    intervalsRef.current.clear();
  }, []);

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      clearIntervalAll();
    };
  }, [clearIntervalAll]);

  return { setInterval, clearInterval, clearIntervalAll };
};

/**
 * Hook for safe async operations with cancellation
 */
export const useSafeAsync = (namespace: string): { createOperation: (id: string) => AbortController; abortOperation: (id: string) => void; abortAllOperations: () => void } => {
  const operationsRef = useRef<Map<string, AbortController>>(new Map());

  const createOperation = useCallback((id: string): AbortController => {
    const fullId = `${namespace}_${id}`;

    // Abort existing operation if any
    const existing = operationsRef.current.get(fullId);
    if (existing) {
      existing.abort();
    }

    const controller = MemoryManager.createAbortController(fullId);
    operationsRef.current.set(fullId, controller);
    return controller;
  }, [namespace]);

  const abortOperation = useCallback((id: string): void => {
    const fullId = `${namespace}_${id}`;
    const controller = operationsRef.current.get(fullId);
    if (controller) {
      controller.abort();
      operationsRef.current.delete(fullId);
    }
  }, [namespace]);

  const abortAllOperations = useCallback((): void => {
    for (const [_fullId, controller] of operationsRef.current) {
      controller.abort();
    }
    operationsRef.current.clear();
  }, []);

  // Auto cleanup on unmount
  useEffect(() => {
    return () => {
      abortAllOperations();
    };
  }, [abortAllOperations]);

  return { createOperation, abortOperation, abortAllOperations };
};

/**
 * Combined hook for all safe operations
 */
export const useSafeComponent = (namespace: string) => {
  const timeouts = useSafeTimeouts(namespace);
  const intervals = useSafeIntervals(namespace);
  const async = useSafeAsync(namespace);

  const cleanupAll = useCallback((): void => {
    timeouts.clearTimeoutAll();
    intervals.clearIntervalAll();
    async.abortAllOperations();
  }, [timeouts, intervals, async]);

  return {
    ...timeouts,
    ...intervals,
    ...async,
    cleanupAll,
  };
};
