// src/services/hooks/useInfiniteQueries.ts

/**
 * Infinite query hooks for handling large datasets with pagination
 * Simplified version that works with existing APIs
 */

import { useInfiniteQuery } from '@tanstack/react-query';
import { JournalApi } from '../api/journalApi';
import { PrayerApi } from '../api/prayerApi';
import { ReflectionApi } from '../api/reflectionApi';
import { queryKeys } from '../queryKeys';

// Pagination types removed as they were unused

interface PaginatedResponse<T> {
  data: T[];
  totalCount: number;
  hasNextPage: boolean;
  nextPage?: number;
}

// Default infinite query options
const defaultInfiniteOptions = {
  staleTime: 5 * 60 * 1000, // 5 minutes
  gcTime: 10 * 60 * 1000, // 10 minutes
  refetchOnWindowFocus: false,
};

// Journal Entries Infinite Query (using existing getEntries method)
export const useInfiniteJournalEntries = (userId: string, options?: any) => {
  return useInfiniteQuery({
    queryKey: queryKeys.journal.infinite(userId),
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      const page = pageParam || 0;
      const limit = 20;

      // Use existing getEntries method - we'll adapt it for pagination
      const allEntries = await JournalApi.getEntries(userId);
      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      const pageData = allEntries.slice(startIndex, endIndex);

      return {
        data: pageData,
        nextPage: endIndex < allEntries.length ? page + 1 : undefined,
        totalCount: allEntries.length,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    ...defaultInfiniteOptions,
    ...options,
  });
};

// Prayer Entries Infinite Query (using existing getPrayers method)
export const useInfinitePrayerEntries = (userId: string, prayerType?: string, options?: any) => {
  return useInfiniteQuery({
    queryKey: queryKeys.prayers.infinite(userId, prayerType),
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      const page = pageParam || 0;
      const limit = 20;

      // Use existing getPrayers method - we'll adapt it for pagination
      const allPrayers = await PrayerApi.getPrayers(userId);
      const filteredPrayers = prayerType
        ? allPrayers.filter((prayer: any) => prayer.prayer_type === prayerType)
        : allPrayers;

      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      const pageData = filteredPrayers.slice(startIndex, endIndex);

      return {
        data: pageData,
        nextPage: endIndex < filteredPrayers.length ? page + 1 : undefined,
        totalCount: filteredPrayers.length,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    ...defaultInfiniteOptions,
    ...options,
  });
};

// Reflection Entries Infinite Query (using existing getReflections method)
export const useInfiniteReflectionEntries = (userId: string, reflectionType?: string, options?: any) => {
  return useInfiniteQuery({
    queryKey: queryKeys.reflections?.infinite?.(userId, reflectionType) || ['reflections', 'infinite', userId, reflectionType],
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      const page = pageParam || 0;
      const limit = 20;

      // Use existing getReflections method - we'll adapt it for pagination
      const allReflections = await ReflectionApi.getReflections(userId);
      const filteredReflections = reflectionType
        ? allReflections.filter((reflection: any) => reflection.reflection_type === reflectionType)
        : allReflections;

      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      const pageData = filteredReflections.slice(startIndex, endIndex);

      return {
        data: pageData,
        nextPage: endIndex < filteredReflections.length ? page + 1 : undefined,
        totalCount: filteredReflections.length,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    ...defaultInfiniteOptions,
    ...options,
  });
};

// Global Search Infinite Query (simplified search across all content)
export const useInfiniteSearch = (
  userId: string,
  searchTerm: string,
  contentTypes: string[] = ['journal', 'prayer', 'reflection'],
  options?: any
) => {
  return useInfiniteQuery({
    queryKey: queryKeys.search.infinite(userId, searchTerm, contentTypes),
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      const page = pageParam || 0;
      const limit = 20;

      // Simple search across all content types
      let allResults: any[] = [];

      if (contentTypes.includes('journal')) {
        const journalEntries = await JournalApi.getEntries(userId);
        const filteredJournal = journalEntries.filter((entry: any) =>
          JSON.stringify(entry).toLowerCase().includes(searchTerm.toLowerCase())
        );
        allResults = [...allResults, ...filteredJournal.map((entry: any) => ({ ...entry, type: 'journal' }))];
      }

      if (contentTypes.includes('prayer')) {
        const prayerEntries = await PrayerApi.getPrayers(userId);
        const filteredPrayers = prayerEntries.filter((entry: any) =>
          JSON.stringify(entry).toLowerCase().includes(searchTerm.toLowerCase())
        );
        allResults = [...allResults, ...filteredPrayers.map((entry: any) => ({ ...entry, type: 'prayer' }))];
      }

      if (contentTypes.includes('reflection')) {
        const reflectionEntries = await ReflectionApi.getReflections(userId);
        const filteredReflections = reflectionEntries.filter((entry: any) =>
          JSON.stringify(entry).toLowerCase().includes(searchTerm.toLowerCase())
        );
        allResults = [...allResults, ...filteredReflections.map((entry: any) => ({ ...entry, type: 'reflection' }))];
      }

      // Sort by date (most recent first)
      allResults.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const startIndex = page * limit;
      const endIndex = startIndex + limit;
      const pageData = allResults.slice(startIndex, endIndex);

      return {
        data: pageData,
        nextPage: endIndex < allResults.length ? page + 1 : undefined,
        totalCount: allResults.length,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextPage,
    initialPageParam: 0,
    ...defaultInfiniteOptions,
    ...options,
    enabled: searchTerm.length >= 3, // Only search if term is at least 3 characters
    ...queryConfigs.fast, // Use fast config for search
  });
};

/**
 * Hook for managing infinite scroll behavior
 */
export const useInfiniteScrollManager = () => {
  const handleLoadMore = (
    hasNextPage: boolean,
    isFetchingNextPage: boolean,
    fetchNextPage: () => void
  ) => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const isNearBottom = (
    layoutMeasurement: { height: number },
    contentOffset: { y: number },
    contentSize: { height: number },
    threshold: number = 100
  ) => {
    return layoutMeasurement.height + contentOffset.y >= contentSize.height - threshold;
  };

  return {
    handleLoadMore,
    isNearBottom,
  };
};

/**
 * Hook for flattening infinite query data
 */
export const useInfiniteData = <T>(
  infiniteQueryResult: {
    data?: {
      pages: PaginatedResponse<T>[];
    };
    hasNextPage?: boolean;
    isFetchingNextPage?: boolean;
    fetchNextPage: () => void;
  }
) => {
  const flatData = infiniteQueryResult.data?.pages.flatMap(page => page.data) || [];
  const totalCount = infiniteQueryResult.data?.pages.reduce((acc, page) => acc + (page.total || 0), 0) || 0;

  return {
    data: flatData,
    totalCount,
    hasNextPage: infiniteQueryResult.hasNextPage,
    isFetchingNextPage: infiniteQueryResult.isFetchingNextPage,
    fetchNextPage: infiniteQueryResult.fetchNextPage,
  };
};

/**
 * Prefetch strategies for infinite queries
 */
export const usePrefetchStrategies = () => {
  const prefetchAdjacentPages = async (
    queryClient: any,
    queryKey: any[],
    currentPage: number,
    fetchFn: (page: number) => Promise<any>
  ) => {
    // Prefetch next page
    if (currentPage >= 0) {
      queryClient.prefetchInfiniteQuery({
        queryKey,
        queryFn: () => fetchFn(currentPage + 1),
        pages: 1,
      });
    }

    // Prefetch previous page if not first page
    if (currentPage > 0) {
      queryClient.prefetchInfiniteQuery({
        queryKey,
        queryFn: () => fetchFn(currentPage - 1),
        pages: 1,
      });
    }
  };

  return {
    prefetchAdjacentPages,
  };
};
