// src/services/hooks/usePrayerData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PrayerApi, PrayerApiEntry } from '../api/prayerApi';
import { queryKeys } from '../queryKeys';
import { createRetryFunction } from '../../utils/retry';
import { RETRY_CONFIGS } from '../../utils/retry';

// ===== QUERY HOOKS =====

/**
 * Get all prayers for a specific user and date
 */
export const usePrayerData = (userId: string, dateStr: string) => {
  return useQuery({
    queryKey: queryKeys.prayers.entries(userId, dateStr),
    queryFn: () => PrayerApi.getPrayers(userId, dateStr),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!userId && !!dateStr,
    initialData: () => {
      // Cache will be handled by React Query's built-in caching
      return [];
    },
  });
};

/**
 * Get ACTS prayers (Adoration, Confession, Thanksgiving, Supplication)
 */
export const useACTSPrayerData = (userId: string, dateStr: string) => {
  return useQuery({
    queryKey: queryKeys.prayers.acts(userId, dateStr),
    queryFn: () => PrayerApi.getACTSPrayers(userId, dateStr),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!dateStr,
    retry: createRetryFunction(RETRY_CONFIGS.PRAYER_ENHANCED),
  });
};

/**
 * Get people prayers for a specific date
 */
export const usePeoplePrayerData = (userId: string, dateStr: string) => {
  return useQuery({
    queryKey: queryKeys.prayers.people(userId, dateStr),
    queryFn: () => PrayerApi.getPeoplePrayers(userId, dateStr),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!dateStr,
    retry: createRetryFunction(RETRY_CONFIGS.PRAYER_ENHANCED),
  });
};

/**
 * Get devotional prayers for a specific date
 */
export const useDevotionalPrayerData = (userId: string, dateStr: string) => {
  return useQuery({
    queryKey: queryKeys.prayers.devotional(userId, dateStr),
    queryFn: () => PrayerApi.getDevotionalPrayers(userId, dateStr),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!dateStr,
  });
};

/**
 * Get ALL devotional prayers for a user (for prayedItems display)
 */
export const useAllDevotionalPrayerData = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.prayers.allDevotional(userId),
    queryFn: () => PrayerApi.getAllDevotionalPrayers(userId),
    staleTime: 10 * 60 * 1000, // 10 minutes for all devotional prayers
    enabled: !!userId,
  });
};

/**
 * Get prayers by specific type
 */
export const usePrayersByType = (
  userId: string,
  dateStr: string,
  type: NonNullable<PrayerApiEntry['type']>
) => {
  return useQuery({
    queryKey: queryKeys.prayers.byType(userId, dateStr, type),
    queryFn: () => PrayerApi.getPrayersByType(userId, dateStr, type),
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!dateStr && !!type,
  });
};

/**
 * Search prayers by content
 */
export const useSearchPrayers = (
  userId: string,
  searchTerm: string,
  limit: number = 20
) => {
  return useQuery({
    queryKey: queryKeys.prayers.search(userId, searchTerm),
    queryFn: () => PrayerApi.searchPrayers(userId, searchTerm, limit),
    staleTime: 2 * 60 * 1000, // 2 minutes for search results
    enabled: !!userId && !!searchTerm && searchTerm.length > 2,
  });
};

/**
 * Get prayer statistics for a date range
 */
export const usePrayerStats = (
  userId: string,
  startDate: string,
  endDate: string
) => {
  return useQuery({
    queryKey: queryKeys.prayers.stats(userId, startDate, endDate),
    queryFn: () => PrayerApi.getPrayerStats(userId, startDate, endDate),
    staleTime: 15 * 60 * 1000, // 15 minutes for stats
    enabled: !!userId && !!startDate && !!endDate,
  });
};

// ===== MUTATION HOOKS =====

/**
 * Create a new prayer entry
 */
export const useCreatePrayer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prayer: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'>) =>
      PrayerApi.createPrayer(prayer),
    onMutate: async (newPrayer) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.entries(newPrayer.user_id, newPrayer.selected_date),
      });

      // Also cancel people prayers query if this is a people prayer
      if (newPrayer.prayer_type === 'people') {
        await queryClient.cancelQueries({
          queryKey: queryKeys.prayers.people(newPrayer.user_id, newPrayer.selected_date),
        });
      }

      // Snapshot the previous values
      const previousPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(newPrayer.user_id, newPrayer.selected_date)
      );
      const previousPeoplePrayers = newPrayer.prayer_type === 'people'
        ? queryClient.getQueryData<PrayerApiEntry[]>(
            queryKeys.prayers.people(newPrayer.user_id, newPrayer.selected_date)
          )
        : undefined;

      // Optimistically update to the new value
      const optimisticPrayer: PrayerApiEntry = {
        ...newPrayer,
        id: `temp-${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update main prayers query
      queryClient.setQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(newPrayer.user_id, newPrayer.selected_date),
        (old = []) => [optimisticPrayer, ...old]
      );

      // Update people prayers query if applicable
      if (newPrayer.prayer_type === 'people') {
        queryClient.setQueryData<PrayerApiEntry[]>(
          queryKeys.prayers.people(newPrayer.user_id, newPrayer.selected_date),
          (old = []) => [optimisticPrayer, ...old]
        );
      }

      // Return a context object with the snapshotted values
      return { previousPrayers, previousPeoplePrayers, optimisticPrayer };
    },
    onError: (err: Error, newPrayer, context) => {
      console.error('Error creating prayer:', err);
      // If the mutation fails, use the context returned from onMutate to roll back
      if (context?.previousPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.entries(newPrayer.user_id, newPrayer.selected_date),
          context.previousPrayers
        );
      }
      if (context?.previousPeoplePrayers && newPrayer.prayer_type === 'people') {
        queryClient.setQueryData(
          queryKeys.prayers.people(newPrayer.user_id, newPrayer.selected_date),
          context.previousPeoplePrayers
        );
      }
    },
    onSuccess: (_data, _variables) => {
      // Cache is automatically handled by React Query
    },
    onSettled: (data, error, variables) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(variables.user_id, variables.selected_date),
      });

      // Invalidate specific prayer type queries
      if (variables.prayer_type === 'people') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.people(variables.user_id, variables.selected_date),
        });
      } else if (variables.prayer_type === 'devotional') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.devotional(variables.user_id, variables.selected_date),
        });
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.allDevotional(variables.user_id),
        });
      } else if (variables.prayer_type === 'journal') {
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.acts(variables.user_id, variables.selected_date),
        });
      }
    },
  });
};

/**
 * Update an existing prayer entry
 */
export const useUpdatePrayer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      updates,
      _userId,
      _dateStr,
    }: {
      id: string;
      updates: Partial<Omit<PrayerApiEntry, 'id' | 'user_id' | 'created_at'>>;
      _userId: string;
      _dateStr: string;
    }) => PrayerApi.updatePrayer(id, updates),
    onMutate: async ({ id, updates, _userId, _dateStr }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });

      // Snapshot the previous value
      const previousPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr)
      );

      // Optimistically update to the new value
      queryClient.setQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr),
        (old = []) => old.map(prayer =>
          prayer.id === id
            ? { ...prayer, ...updates, updated_at: new Date().toISOString() }
            : prayer
        )
      );

      return { previousPrayers };
    },
    onError: (err: Error, { _userId, _dateStr }, context) => {
      console.error('Error updating prayer:', err);
      // If the mutation fails, use the context to roll back
      if (context?.previousPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.entries(_userId, _dateStr),
          context.previousPrayers
        );
      }
    },
    onSettled: (data, error, { _userId, _dateStr }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
    },
  });
};

/**
 * Delete a prayer entry
 */
export const useDeletePrayer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      _userId,
      _dateStr,
    }: {
      id: string;
      _userId: string;
      _dateStr: string;
    }) => PrayerApi.deletePrayer(id),
    onMutate: async ({ id, _userId, _dateStr }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });

      // Snapshot the previous value
      const previousPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr)
      );

      // Optimistically update to the new value
      queryClient.setQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr),
        (old = []) => old.filter(prayer => prayer.id !== id)
      );

      return { previousPrayers };
    },
    onError: (err: Error, { _userId, _dateStr }, context) => {
      console.error('Error deleting prayer:', err);
      // If the mutation fails, use the context to roll back
      if (context?.previousPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.entries(_userId, _dateStr),
          context.previousPrayers
        );
      }
    },
    onSettled: (data, error, { _userId, _dateStr }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
    },
  });
};

/**
 * Mark supplication as answered
 */
export const useMarkSupplicationAnswered = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      isAnswered,
      _userId,
      _dateStr,
    }: {
      id: string;
      isAnswered: boolean;
      _userId: string;
      _dateStr: string;
    }) => PrayerApi.markSupplicationAnswered(id, isAnswered),
    onMutate: async ({ id, isAnswered, _userId, _dateStr }) => {
      // Optimistically update both entries and acts queries
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.acts(_userId, _dateStr),
      });

      const previousPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr)
      );
      const previousACTSData = queryClient.getQueryData(
        queryKeys.prayers.acts(_userId, _dateStr)
      );

      // Update entries query
      queryClient.setQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr),
        (old = []) => old.map(prayer =>
          prayer.id === id
            ? {
                ...prayer,
                is_answered: isAnswered,
                answered_date: isAnswered ? new Date().toISOString() : null,
                updated_at: new Date().toISOString(),
              }
            : prayer
        )
      );

      // Update ACTS query (this is the one the component uses)
      queryClient.setQueryData(
        queryKeys.prayers.acts(_userId, _dateStr),
        (old: any) => {
          if (!old) {return old;}
          return {
            ...old,
            supplication: old.supplication?.map((prayer: any) =>
              prayer.id === id
                ? {
                    ...prayer,
                    is_answered: isAnswered,
                    answered_date: isAnswered ? new Date().toISOString() : null,
                    updated_at: new Date().toISOString(),
                  }
                : prayer
            ) || [],
          };
        }
      );

      return { previousPrayers, previousACTSData };
    },
    onError: (err: Error, { _userId, _dateStr }, context) => {
      console.error('Error marking supplication as answered:', err);
      if (context?.previousPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.entries(_userId, _dateStr),
          context.previousPrayers
        );
      }
      if (context?.previousACTSData) {
        queryClient.setQueryData(
          queryKeys.prayers.acts(_userId, _dateStr),
          context.previousACTSData
        );
      }
    },
    onSettled: (data, error, { _userId, _dateStr }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
    },
  });
};

/**
 * Mark prayer request as prayed
 */
export const useMarkPrayerRequestPrayed = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      isPrayed,
      _userId,
      _dateStr,
    }: {
      id: string;
      isPrayed: boolean;
      _userId: string;
      _dateStr: string;
    }) => PrayerApi.markPrayerRequestPrayed(id, isPrayed),
    onMutate: async ({ id, isPrayed, _userId, _dateStr }) => {
      // Optimistically update
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });

      const previousPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr)
      );

      queryClient.setQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr),
        (old = []) => old.map(prayer =>
          prayer.id === id
            ? { ...prayer, is_prayed: isPrayed, updated_at: new Date().toISOString() }
            : prayer
        )
      );

      return { previousPrayers };
    },
    onError: (err: Error, { _userId, _dateStr }, context) => {
      console.error('Error marking prayer request as prayed:', err);
      if (context?.previousPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.entries(_userId, _dateStr),
          context.previousPrayers
        );
      }
    },
    onSettled: (data, error, { _userId, _dateStr }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
    },
  });
};

// ===== UTILITY HOOKS =====

/**
 * Prefetch prayers for adjacent dates
 */
export const usePrefetchPrayers = () => {
  const queryClient = useQueryClient();

  const prefetchPrayers = async (userId: string, dateStr: string) => {
    await queryClient.prefetchQuery({
      queryKey: queryKeys.prayers.entries(userId, dateStr),
      queryFn: () => PrayerApi.getPrayers(userId, dateStr),
      staleTime: 5 * 60 * 1000,
    });
  };

  return { prefetchPrayers };
};

/**
 * Invalidate all prayer queries for a user
 */
export const useInvalidatePrayers = () => {
  const queryClient = useQueryClient();

  const invalidateAllPrayers = (userId: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.prayers.all(userId),
    });
  };

  const invalidatePrayersForDate = (userId: string, dateStr: string) => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.prayers.entries(userId, dateStr),
    });
  };

  return { invalidateAllPrayers, invalidatePrayersForDate };
};
