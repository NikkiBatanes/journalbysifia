// src/services/hooks/useSimpleInfiniteQueries.ts

/**
 * Simplified infinite query hooks that work with existing APIs
 * Focus on practical implementation over complex pagination
 */

import { useInfiniteQuery } from '@tanstack/react-query';

// Simple infinite query hook for any data type
export const useSimpleInfiniteQuery = <T>(
  queryKey: readonly unknown[],
  fetchFn: () => Promise<T[]>,
  options?: {
    pageSize?: number;
    enabled?: boolean;
    staleTime?: number;
  }
) => {
  const pageSize = options?.pageSize || 20;

  return useInfiniteQuery({
    queryKey,
    queryFn: async ({ pageParam = 0 }: { pageParam?: number }) => {
      const allData = await fetchFn();
      const startIndex = (pageParam || 0) * pageSize;
      const endIndex = startIndex + pageSize;
      const pageData = allData.slice(startIndex, endIndex);

      return {
        data: pageData,
        nextPage: endIndex < allData.length ? (pageParam || 0) + 1 : undefined,
        totalCount: allData.length,
      };
    },
    getNextPageParam: (lastPage: any) => lastPage.nextPage,
    initialPageParam: 0,
    enabled: options?.enabled !== false,
    staleTime: options?.staleTime || 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });
};

// Utility hooks for infinite scroll management
export const useInfiniteScrollUtils = () => {
  const flattenInfiniteData = <T>(data: any): T[] => {
    return data?.pages?.flatMap((page: any) => page.data) || [];
  };

  const getTotalCount = (data: any): number => {
    return data?.pages?.[0]?.totalCount || 0;
  };

  const hasMoreData = (hasNextPage: boolean): boolean => {
    return !!hasNextPage;
  };

  return {
    flattenInfiniteData,
    getTotalCount,
    hasMoreData,
  };
};

// Hook for managing infinite scroll behavior in FlatList
export const useInfiniteScrollHandler = (
  fetchNextPage: () => void,
  hasNextPage: boolean,
  isFetchingNextPage: boolean
) => {
  const handleEndReached = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  return {
    onEndReached: handleEndReached,
    onEndReachedThreshold: 0.1,
  };
};

// Search utility for filtering data
export const useSearchFilter = () => {
  const searchInData = <T>(data: T[], searchTerm: string, searchFields?: string[]): T[] => {
    if (!searchTerm || searchTerm.length < 2) {return data;}

    const lowerSearchTerm = searchTerm.toLowerCase();

    return data.filter((item: any) => {
      if (searchFields && searchFields.length > 0) {
        // Search in specific fields
        return searchFields.some(field => {
          const fieldValue = item[field];
          return fieldValue && String(fieldValue).toLowerCase().includes(lowerSearchTerm);
        });
      } else {
        // Search in all string fields
        return JSON.stringify(item).toLowerCase().includes(lowerSearchTerm);
      }
    });
  };

  return { searchInData };
};

// Export types for use in components
export interface InfiniteQueryResult<T> {
  data: {
    pages: Array<{
      data: T[];
      nextPage?: number;
      totalCount: number;
    }>;
  };
  fetchNextPage: () => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  isLoading: boolean;
  error: Error | null;
}
