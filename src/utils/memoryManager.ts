/**
 * Memory Management Utilities
 * Prevents EXC_BAD_ACCESS crashes from dangling timers and network operations
 */

import { useCallback, useRef, useEffect } from 'react';
import { Logger } from './ProductionLogger';

export class MemoryManager {
  private static timers = new Map<string, NodeJS.Timeout>();
  private static abortControllers = new Map<string, AbortController>();
  private static cleanupCallbacks = new Map<string, () => void>();

  /**
   * Set a timeout with automatic cleanup tracking
   */
  static setTimeout(id: string, callback: () => void, delay: number): NodeJS.Timeout {
    // Clear any existing timer with this ID
    this.clearTimeout(id);
    
    const timer = setTimeout(() => {
      try {
        callback();
      } catch (error) {
        Logger.error(`Error in timer ${id}:`, error as Error, { component: 'MemoryManager' });
      } finally {
        this.timers.delete(id);
      }
    }, delay);
    
    this.timers.set(id, timer);
    return timer;
  }

  /**
   * Clear a specific timeout by ID
   */
  static clearTimeout(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  /**
   * Create an AbortController with automatic cleanup
   */
  static createAbortController(id: string): AbortController {
    // Abort any existing controller with this ID
    this.abortController(id);
    
    const controller = new AbortController();
    this.abortControllers.set(id, controller);
    return controller;
  }

  /**
   * Abort a specific operation by ID
   */
  static abortController(id: string): void {
    const controller = this.abortControllers.get(id);
    if (controller) {
      controller.abort();
      this.abortControllers.delete(id);
    }
  }

  /**
   * Register a cleanup callback
   */
  static registerCleanup(id: string, callback: () => void): void {
    this.cleanupCallbacks.set(id, callback);
  }

  /**
   * Execute and remove a cleanup callback
   */
  static executeCleanup(id: string): void {
    const callback = this.cleanupCallbacks.get(id);
    if (callback) {
      try {
        callback();
      } catch (error) {
        Logger.error(`Error in cleanup ${id}:`, error as Error, { component: 'MemoryManager' });
      } finally {
        this.cleanupCallbacks.delete(id);
      }
    }
  }

  /**
   * Cleanup all resources for a specific namespace
   */
  static cleanupNamespace(namespace: string): void {
    // Clear timers
    for (const [id, timer] of this.timers.entries()) {
      if (id.startsWith(namespace)) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
    }

    // Abort operations
    for (const [id, controller] of this.abortControllers.entries()) {
      if (id.startsWith(namespace)) {
        controller.abort();
        this.abortControllers.delete(id);
      }
    }

    // Execute cleanup callbacks
    for (const [id] of this.cleanupCallbacks.entries()) {
      if (id.startsWith(namespace)) {
        this.executeCleanup(id);
      }
    }

    Logger.debug(`🧹 Cleaned up namespace: ${namespace}`, { component: 'MemoryManager' });
  }

  /**
   * Cleanup all resources (for app shutdown)
   */
  static cleanupAll(): void {
    // Clear all timers
    for (const [id, timer] of this.timers.entries()) {
      clearTimeout(timer);
    }
    this.timers.clear();

    // Abort all operations
    for (const [id, controller] of this.abortControllers.entries()) {
      controller.abort();
    }
    this.abortControllers.clear();

    // Execute all cleanup callbacks
    for (const [id] of this.cleanupCallbacks.entries()) {
      this.executeCleanup(id);
    }

    Logger.debug('🧹 Cleaned up all resources', { component: 'MemoryManager' });
  }

  /**
   * Get statistics for debugging
   */
  static getStats(): { timers: number; abortControllers: number; cleanupCallbacks: number } {
    return {
      timers: this.timers.size,
      abortControllers: this.abortControllers.size,
      cleanupCallbacks: this.cleanupCallbacks.size,
    };
  }
}

/**
 * React hook for automatic cleanup on unmount
 */
export const useMemoryCleanup = (namespace: string): void => {
  useEffect(() => {
    return () => {
      MemoryManager.cleanupNamespace(namespace);
    };
  }, [namespace]);
};

/**
 * Safe timeout hook that automatically cleans up
 */
export const useSafeTimeout = () => {
  const timersRef = useRef<Set<string>>(new Set());

  const setTimeout = useCallback((id: string, callback: () => void, delay: number): void => {
    timersRef.current.add(id);
    MemoryManager.setTimeout(id, callback, delay);
  }, []);

  const clearTimeout = useCallback((id: string): void => {
    timersRef.current.delete(id);
    MemoryManager.clearTimeout(id);
  }, []);

  useEffect(() => {
    return () => {
      // Clear all timers created by this hook instance
      for (const id of timersRef.current) {
        MemoryManager.clearTimeout(id);
      }
      timersRef.current.clear();
    };
  }, []);

  return { setTimeout, clearTimeout };
};
