import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import { dataPreloadService } from '../services/dataPreloadService';
import { toLocalDateString } from '../utils/date';

export interface OptimizedLoadingState {
  loading: boolean;
  syncing: boolean;
  error: string | null;
  isPreloaded: boolean;
}

/**
 * Hook for optimized data loading that leverages preloaded data
 * Falls back to individual loading if preload is not available
 */
export function useOptimizedDataLoading(
  selectedDate: Date = new Date(),
  componentName: string = 'Unknown'
) {
  const { user, loading: authLoading } = useAuth();
  const [loadingState, setLoadingState] = useState<OptimizedLoadingState>({
    loading: true,
    syncing: false,
    error: null,
    isPreloaded: false,
  });

  const hydratedRef = useRef(false);
  const dateStr = toLocalDateString(selectedDate);

  // Check if data is preloaded
  const checkPreloadStatus = useCallback(() => {
    if (!user) {return false;}

    const isPreloaded = dataPreloadService.isDataPreloaded(user.id, selectedDate);
    const progress = dataPreloadService.getPreloadProgress(user.id, selectedDate);

    console.log(`[${componentName}] Preload status:`, {
      isPreloaded,
      progress,
      dateStr,
    });

    return isPreloaded;
  }, [user, selectedDate, componentName, dateStr]);

  // Optimized hydration that uses preloaded data when available
  const hydrateWithOptimization = useCallback(async (
    localLoadFn: () => Promise<any>,
    cloudSyncFn?: () => Promise<any>
  ) => {
    if (!user || hydratedRef.current) {return;}

    console.log(`[${componentName}] Starting optimized hydration for ${dateStr}`);

    setLoadingState(prev => ({
      ...prev,
      loading: true,
      error: null,
      isPreloaded: checkPreloadStatus(),
    }));

    try {
      const isPreloaded = checkPreloadStatus();

      if (isPreloaded) {
        console.log(`[${componentName}] Using preloaded data - fast path`);

        // Fast path: data is already preloaded, just load from local storage
        await localLoadFn();

        setLoadingState(prev => ({
          ...prev,
          loading: false,
          isPreloaded: true,
        }));

        // Optional background sync for freshness (non-blocking)
        if (cloudSyncFn) {
          setLoadingState(prev => ({ ...prev, syncing: true }));
          cloudSyncFn()
            .then(() => localLoadFn()) // Reload after sync
            .catch(error => {
              console.warn(`[${componentName}] Background sync failed:`, error);
            })
            .finally(() => {
              setLoadingState(prev => ({ ...prev, syncing: false }));
            });
        }
      } else {
        console.log(`[${componentName}] No preloaded data - standard path`);

        // Standard path: load local first, then sync from cloud
        await localLoadFn();

        if (cloudSyncFn) {
          setLoadingState(prev => ({ ...prev, syncing: true }));
          await cloudSyncFn();
          await localLoadFn(); // Reload after sync
          setLoadingState(prev => ({ ...prev, syncing: false }));
        }

        setLoadingState(prev => ({
          ...prev,
          loading: false,
          isPreloaded: false,
        }));
      }

      hydratedRef.current = true;
      console.log(`[${componentName}] Hydration completed for ${dateStr}`);

    } catch (error) {
      console.error(`[${componentName}] Hydration failed:`, error);
      setLoadingState(prev => ({
        ...prev,
        loading: false,
        syncing: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
      }));
    }
  }, [user, componentName, dateStr, checkPreloadStatus]);

  // Reset hydration state when date or user changes
  useEffect(() => {
    hydratedRef.current = false;
    setLoadingState(prev => ({
      ...prev,
      loading: !authLoading && !!user,
      error: null,
    }));
  }, [user, dateStr, authLoading]);

  // Trigger preload for current date if not already done
  useEffect(() => {
    if (!authLoading && user && !checkPreloadStatus()) {
      console.log(`[${componentName}] Triggering preload for ${dateStr}`);
      dataPreloadService.preloadUserData(user.id, selectedDate).catch(error => {
        console.warn(`[${componentName}] Preload failed:`, error);
      });
    }
  }, [user, selectedDate, authLoading, componentName, dateStr, checkPreloadStatus]);

  return {
    loadingState,
    hydrateWithOptimization,
    isPreloaded: loadingState.isPreloaded,
    isReady: !authLoading && !!user && hydratedRef.current,
  };
}

/**
 * Simplified hook for components that just need to know if they should show loading states
 */
export function usePreloadStatus(selectedDate: Date = new Date()) {
  const { user } = useAuth();
  const [isPreloaded, setIsPreloaded] = useState(false);

  useEffect(() => {
    if (user) {
      const preloaded = dataPreloadService.isDataPreloaded(user.id, selectedDate);
      setIsPreloaded(preloaded);
    }
  }, [user, selectedDate]);

  return isPreloaded;
}
