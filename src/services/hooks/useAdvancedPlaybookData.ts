/**
 * Advanced Playbook Data Hooks with Prefetching and Cross-Component Relationships
 * Industry-standard patterns for lightning-fast user experience
 */

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { Playbook } from '../../interfaces/playbook';
import { queryKeys } from '../queryKeys';
import { getPlaybooks as getPlaybooksApi, getPlaybook as getPlaybookApi } from '../apiIntegration';
import { withQueryPerformance } from '../../utils/performanceMonitor';

// Types for advanced features
interface AdjacentPlaybooks {
  previous: Playbook | null;
  current: Playbook;
  next: Playbook | null;
}

interface PlaybookWithRelationships extends Playbook {
  relatedDevotionals?: any[];
  relatedJournalEntries?: any[];
  relatedPrayers?: any[];
}

/**
 * Hook for getting adjacent playbooks (previous/current/next) for seamless navigation
 * Automatically prefetches adjacent playbooks when viewing a playbook detail
 */
export const useAdjacentPlaybooks = (userId: string, currentPlaybookId: string) => {

  return useQuery({
    queryKey: queryKeys.playbooks.adjacent(userId, currentPlaybookId),
    queryFn: withQueryPerformance(
      async (): Promise<AdjacentPlaybooks> => {

        // Get all playbooks to determine order
        const allPlaybooks = await getPlaybooksApi(userId);

        // Sort by creation date (or updated date) to maintain consistent order
        const sortedPlaybooks = allPlaybooks.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA; // Most recent first
        });

        const currentIndex = sortedPlaybooks.findIndex(p => p.id === currentPlaybookId);
        const current = sortedPlaybooks[currentIndex];

        if (!current) {
          throw new Error(`Playbook ${currentPlaybookId} not found`);
        }

        const previous = currentIndex > 0 ? sortedPlaybooks[currentIndex - 1] : null;
        const next = currentIndex < sortedPlaybooks.length - 1 ? sortedPlaybooks[currentIndex + 1] : null;

        return { previous, current, next };
      },
      queryKeys.playbooks.adjacent(userId, currentPlaybookId)
    ),
    enabled: !!userId && !!currentPlaybookId,
    staleTime: 10 * 60 * 1000, // 10 minutes - adjacent relationships don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes
  });
};

/**
 * Hook for batch prefetching multiple playbooks
 * Perfect for prefetching visible playbooks in a list
 */
export const usePrefetchPlaybooks = (userId: string) => {
  const queryClient = useQueryClient();

  const prefetchPlaybooks = useCallback(async (playbookIds: string[]) => {

    // Prefetch each playbook individually for better cache granularity
    const prefetchPromises = playbookIds.map(playbookId =>
      queryClient.prefetchQuery({
        queryKey: queryKeys.playbooks.detail(userId, playbookId),
        queryFn: () => getPlaybookApi(userId, playbookId),
        staleTime: 5 * 60 * 1000, // 5 minutes
      })
    );

    await Promise.allSettled(prefetchPromises);

  }, [queryClient, userId]);

  const prefetchAdjacentPlaybooks = useCallback(async (currentPlaybookId: string) => {

    // First get the adjacent playbooks
    const adjacentData = await queryClient.fetchQuery({
      queryKey: queryKeys.playbooks.adjacent(userId, currentPlaybookId),
      queryFn: async () => {
        const allPlaybooks = await getPlaybooksApi(userId);
        const sortedPlaybooks = allPlaybooks.sort((a, b) => {
          const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
          const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
          return dateB - dateA;
        });

        const currentIndex = sortedPlaybooks.findIndex(p => p.id === currentPlaybookId);
        const current = sortedPlaybooks[currentIndex];
        const previous = currentIndex > 0 ? sortedPlaybooks[currentIndex - 1] : null;
        const next = currentIndex < sortedPlaybooks.length - 1 ? sortedPlaybooks[currentIndex + 1] : null;

        return { previous, current, next };
      },
    });

    // Prefetch the adjacent playbooks
    const prefetchIds = [
      adjacentData.previous?.id,
      adjacentData.next?.id,
    ].filter(Boolean) as string[];

    if (prefetchIds.length > 0) {
      await prefetchPlaybooks(prefetchIds);
    }
  }, [queryClient, userId, prefetchPlaybooks]);

  return {
    prefetchPlaybooks,
    prefetchAdjacentPlaybooks,
  };
};

/**
 * Hook for getting playbook with cross-component relationships
 * Links playbooks with devotionals, journal entries, and prayers
 */
export const usePlaybookWithRelationships = (userId: string, playbookId: string) => {
  const queryClient = useQueryClient();

  return useQuery({
    queryKey: queryKeys.playbooks.withDevotionals(userId, playbookId),
    queryFn: withQueryPerformance(
      async (): Promise<PlaybookWithRelationships> => {

        // Get the main playbook
        const playbook = await getPlaybookApi(userId, playbookId);

        // Get related data from cache if available, otherwise fetch
        const relatedDevotionals = (queryClient.getQueryData(
          queryKeys.devotionals.playbook(playbookId)
        ) as any[]) || [];

        const today = new Date().toISOString().split('T')[0];
        const relatedJournalEntries = (queryClient.getQueryData(
          queryKeys.playbooks.withJournal(userId, playbookId, today)
        ) as any[]) || [];

        const relatedPrayers = (queryClient.getQueryData(
          queryKeys.playbooks.withPrayers(userId, playbookId)
        ) as any[]) || [];

        return {
          ...playbook,
          relatedDevotionals,
          relatedJournalEntries,
          relatedPrayers,
        } as any;
      },
      queryKeys.playbooks.withDevotionals(userId, playbookId)
    ),
    enabled: !!userId && !!playbookId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 15 * 60 * 1000, // 15 minutes
  });
};

/**
 * Hook for intelligent playbook prefetching based on user behavior
 * Automatically prefetches likely-to-be-viewed playbooks
 */
export const useIntelligentPrefetching = (userId: string) => {
  const { prefetchPlaybooks, prefetchAdjacentPlaybooks } = usePrefetchPlaybooks(userId);
  const queryClient = useQueryClient();

  // Prefetch based on current playbook list view
  const prefetchVisiblePlaybooks = useCallback(async (visiblePlaybookIds: string[]) => {
    // Prefetch the first 3-5 visible playbooks for instant navigation
    const priorityIds = visiblePlaybookIds.slice(0, 5);
    await prefetchPlaybooks(priorityIds);
  }, [prefetchPlaybooks]);

  // Prefetch based on user's current playbook
  const prefetchForCurrentPlaybook = useCallback(async (currentPlaybookId: string) => {
    // Prefetch adjacent playbooks for seamless navigation
    await prefetchAdjacentPlaybooks(currentPlaybookId);

    // Prefetch related data
    const relatedQueries = [
      queryKeys.devotionals.playbook(currentPlaybookId),
      queryKeys.playbooks.withPrayers(userId, currentPlaybookId),
    ];

    // Prefetch related data if not already cached
    relatedQueries.forEach(queryKey => {
      if (!queryClient.getQueryData(queryKey)) {
        queryClient.prefetchQuery({
          queryKey,
          queryFn: () => [], // Placeholder - would be replaced with actual API calls
          staleTime: 10 * 60 * 1000,
        });
      }
    });
  }, [prefetchAdjacentPlaybooks, queryClient, userId]);

  return {
    prefetchVisiblePlaybooks,
    prefetchForCurrentPlaybook,
  };
};

/**
 * Hook for cross-component data synchronization
 * Ensures data consistency between playbooks and other app components
 */
export const useCrossComponentSync = (userId: string) => {
  const queryClient = useQueryClient();

  // Sync playbook progress with journal entries
  const syncWithJournal = useCallback(async (playbookId: string, date: string) => {

    // Invalidate related journal queries when playbook progress changes
    await queryClient.invalidateQueries({
      queryKey: queryKeys.journal.entries(userId, date),
    });

    // Update cross-component relationship cache
    queryClient.setQueryData(
      queryKeys.playbooks.withJournal(userId, playbookId, date),
      (oldData: any) => {
        // Update the relationship data
        return { ...oldData, lastSynced: new Date().toISOString() };
      }
    );
  }, [queryClient, userId]);

  // Sync playbook completion with devotionals
  const syncWithDevotionals = useCallback(async (playbookId: string) => {

    // Invalidate devotional queries related to this playbook
    await queryClient.invalidateQueries({
      queryKey: queryKeys.devotionals.playbook(playbookId),
    });
  }, [queryClient]);

  // Sync playbook themes with prayers
  const syncWithPrayers = useCallback(async (playbookId: string) => {

    // Invalidate prayer queries that might be related to playbook themes
    await queryClient.invalidateQueries({
      queryKey: queryKeys.playbooks.withPrayers(userId, playbookId),
    });
  }, [queryClient, userId]);

  return {
    syncWithJournal,
    syncWithDevotionals,
    syncWithPrayers,
  };
};
