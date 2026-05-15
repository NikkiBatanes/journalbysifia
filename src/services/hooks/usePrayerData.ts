// src/services/hooks/usePrayerData.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Logger } from '../../utils/ProductionLogger';
import { PrayerApi, PrayerApiEntry } from '../api/prayerApi';
import { queryKeys } from '../queryKeys';
import { faithPointsService } from '../faithPointsService';
import { createRetryFunction } from '../../utils/retry';
import { RETRY_CONFIGS } from '../../utils/retry';
import { streakTrackingService } from '../streakTrackingService';

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
 * Get all unprayed prayer requests for a user (no date restriction)
 */
export const useUnprayedPrayerRequests = (userId: string) => {
  return useQuery({
    queryKey: queryKeys.prayers.unprayedRequests(userId),
    queryFn: () => {
      console.log('[useUnprayedPrayerRequests] Fetching prayer requests for user:', userId);
      return PrayerApi.getUnprayedPrayerRequests(userId);
    },
    staleTime: 0, // Always consider stale to ensure immediate updates after deletion
    enabled: !!userId,
    retry: createRetryFunction(RETRY_CONFIGS.PRAYER_ENHANCED),
    refetchOnMount: true, // Refetch on mount to ensure dashboard shows latest data
    refetchOnWindowFocus: true, // Refetch when app comes to foreground
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
 * Get personal prayers (freeform prayers) for a specific date
 */
export const usePersonalPrayerData = (userId: string, dateStr: string) => {
  return useQuery({
    queryKey: queryKeys.prayers.personal(userId, dateStr),
    queryFn: async () => {
      const actsData = await PrayerApi.getACTSPrayers(userId, dateStr);
      return actsData.freeform || [];
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!userId && !!dateStr,
    retry: createRetryFunction(RETRY_CONFIGS.PRAYER_ENHANCED),
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
    mutationFn: (prayer: Omit<PrayerApiEntry, 'id' | 'created_at' | 'updated_at'> & { metadata?: Record<string, any> }) =>
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
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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

      // Also optimistically update the unprayed requests cache for instant dashboard display
      let previousUnprayedRequests: PrayerApiEntry[] | undefined;
      if (newPrayer.prayer_type === 'people' && newPrayer.is_prayer_request === true) {
        await queryClient.cancelQueries({
          queryKey: queryKeys.prayers.unprayedRequests(newPrayer.user_id),
        });
        previousUnprayedRequests = queryClient.getQueryData<PrayerApiEntry[]>(
          queryKeys.prayers.unprayedRequests(newPrayer.user_id)
        );
        queryClient.setQueryData<PrayerApiEntry[]>(
          queryKeys.prayers.unprayedRequests(newPrayer.user_id),
          (old = []) => [optimisticPrayer, ...old]
        );
      }

      // Return a context object with the snapshotted values
      return { previousPrayers, previousPeoplePrayers, previousUnprayedRequests, optimisticPrayer };
    },
    onError: (err: Error, newPrayer, context) => {
      Logger.error('Error creating prayer', err as Error, {
      component: 'usePrayerData',
    });
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
      if (context?.previousUnprayedRequests !== undefined) {
        queryClient.setQueryData(
          queryKeys.prayers.unprayedRequests(newPrayer.user_id),
          context.previousUnprayedRequests
        );
      }
    },
    onSuccess: async (_data, variables) => {
      // Cache is automatically handled by React Query

      // Update prayer streak
      if (variables.user_id) {
        try {
          await streakTrackingService.updateStreak(variables.user_id, 'prayer');

          // Invalidate streak tracker to refresh UI
          queryClient.invalidateQueries({
            queryKey: queryKeys.dashboard.streaks(variables.user_id),
          });
        } catch (error) {
          Logger.warn('Failed to update prayer streak', {
            component: 'usePrayerData',
            error: error as Error,
          });
        }
      }
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
        // Ensure dashboard unprayed requests list is refreshed when people prayers change
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.unprayedRequests(variables.user_id),
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
      updates: Partial<Omit<PrayerApiEntry, 'id' | 'user_id' | 'created_at'> & { metadata?: Record<string, any> }>;
      _userId: string;
      _dateStr: string;
    }) => PrayerApi.updatePrayer(id, updates),
    onMutate: async ({ id, updates, _userId, _dateStr }) => {
      // Cancel any outgoing refetches for entries, people, and acts caches
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.people(_userId, _dateStr),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.acts(_userId, _dateStr),
      });

      // Snapshot previous values for rollback
      const previousPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr)
      );
      const previousPeoplePrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.people(_userId, _dateStr)
      );
      const previousActsPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.acts(_userId, _dateStr)
      );

      const applyUpdate = (prayer: PrayerApiEntry) =>
        prayer.id === id
          ? { ...prayer, ...updates, updated_at: new Date().toISOString() }
          : prayer;

      // Optimistically update entries cache
      queryClient.setQueryData(
        queryKeys.prayers.entries(_userId, _dateStr),
        (old: any) => {
          if (!old || !Array.isArray(old)) {return old;}
          return old.map(applyUpdate);
        }
      );

      // Optimistically update people cache (covers answered tracking, etc.)
      queryClient.setQueryData(
        queryKeys.prayers.people(_userId, _dateStr),
        (old: any) => {
          if (!old || !Array.isArray(old)) {return old;}
          return old.map(applyUpdate);
        }
      );

      // Optimistically update acts cache (object shape: {adoration, confession, ...})
      queryClient.setQueryData(
        queryKeys.prayers.acts(_userId, _dateStr),
        (old: any) => {
          if (!old || typeof old !== 'object' || Array.isArray(old)) {return old;}
          const updateArr = (arr: any[]) => Array.isArray(arr) ? arr.map(applyUpdate) : arr;
          return {
            ...old,
            adoration: updateArr(old.adoration),
            confession: updateArr(old.confession),
            thanksgiving: updateArr(old.thanksgiving),
            supplication: updateArr(old.supplication),
            freeform: updateArr(old.freeform),
          };
        }
      );

      return { previousPrayers, previousPeoplePrayers, previousActsPrayers };
    },
    onError: (err: Error, { _userId, _dateStr }, context) => {
      Logger.error('Error updating prayer', err as Error, {
      component: 'usePrayerData',
    });
      // Roll back all caches on failure
      if (context?.previousPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.entries(_userId, _dateStr),
          context.previousPrayers
        );
      }
      if (context?.previousPeoplePrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.people(_userId, _dateStr),
          context.previousPeoplePrayers
        );
      }
      if (context?.previousActsPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.acts(_userId, _dateStr),
          context.previousActsPrayers
        );
      }
    },
    onSettled: (data, error, { _userId, _dateStr }) => {
      // Always refetch after error or success
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
      // Invalidate people cache so server state is consistent
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.people(_userId, _dateStr),
      });
      // Invalidate acts cache for journal prayer answered tracking
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.acts(_userId, _dateStr),
      });
      // Also refresh unprayed requests for dashboard in case an item transitioned
      // into/out of the unprayed requests set (e.g., marking prayed or toggling request flag)
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.unprayedRequests(_userId),
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
      // Cancel any outgoing refetches to avoid race conditions
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.people(_userId, _dateStr),
      });
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.acts(_userId, _dateStr),
      });

      // Snapshot previous values for rollback
      const previousPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr)
      );
      const previousPeople = queryClient.getQueryData<PrayerApiEntry[] | undefined>(
        queryKeys.prayers.people(_userId, _dateStr)
      );
      const previousACTS = queryClient.getQueryData<any>(
        queryKeys.prayers.acts(_userId, _dateStr)
      );

      // Optimistically update to the new value (entries list)
      queryClient.setQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr),
        (old = []) => old.filter(prayer => prayer.id !== id)
      );

      // Optimistically update People prayers cache
      queryClient.setQueryData<PrayerApiEntry[] | undefined>(
        queryKeys.prayers.people(_userId, _dateStr),
        (old) => (Array.isArray(old) ? old.filter(p => p.id !== id) : old)
      );

      // Optimistically update ACTS/freeform cache
      queryClient.setQueryData<any>(
        queryKeys.prayers.acts(_userId, _dateStr),
        (old: any) => {
          if (!old || typeof old !== 'object') { return old; }
          const clean = (arr: any[]) => (Array.isArray(arr) ? arr.filter((p: any) => p?.id !== id) : arr);
          return {
            ...old,
            adoration: clean(old.adoration),
            confession: clean(old.confession),
            thanksgiving: clean(old.thanksgiving),
            supplication: clean(old.supplication),
            freeform: clean(old.freeform),
          };
        }
      );

      return { previousPrayers, previousPeople, previousACTS };
    },
    onError: (err: Error, { _userId, _dateStr }, context) => {
      Logger.error('Error deleting prayer', err as Error, {
      component: 'usePrayerData',
    });
      // If the mutation fails, use the context to roll back
      if (context?.previousPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.entries(_userId, _dateStr),
          context.previousPrayers
        );
      }
      if (context?.previousPeople) {
        queryClient.setQueryData(
          queryKeys.prayers.people(_userId, _dateStr),
          context.previousPeople
        );
      }
      if (context?.previousACTS) {
        queryClient.setQueryData(
          queryKeys.prayers.acts(_userId, _dateStr),
          context.previousACTS
        );
      }
    },
    onSettled: (data, error, { _userId, _dateStr }) => {
      console.log('[useDeletePrayer] onSettled called - invalidating caches for user:', _userId);
      // Always refetch after error or success to ensure all views update
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
      // People list (Prayer List for People)
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.people(_userId, _dateStr),
      });
      // ACTS + Open Prayer (Prayer Journal)
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.acts(_userId, _dateStr),
      });
      // Dashboard unprayed requests list
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.unprayedRequests(_userId),
      });
      console.log('[useDeletePrayer] Cache invalidation complete');
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

      // Update entries query (guard against non-array cache)
      queryClient.setQueryData(
        queryKeys.prayers.entries(_userId, _dateStr),
        (old: any) => {
          if (!old || !Array.isArray(old)) {return old;}
          return old.map((prayer: any) =>
            prayer.id === id
              ? {
                  ...prayer,
                  is_answered: isAnswered,
                  answered_date: isAnswered ? new Date().toISOString() : null,
                  status: isAnswered ? 'answered' : 'pending',
                  updated_at: new Date().toISOString(),
                }
              : prayer
          );
        }
      );

      // Update ACTS query (this is the one the component uses)
      queryClient.setQueryData(
        queryKeys.prayers.acts(_userId, _dateStr),
        (old: any) => {
          if (!old) {return old;}

          const updatePrayer = (prayer: any) =>
            prayer.id === id
              ? {
                  ...prayer,
                  is_answered: isAnswered,
                  answered_date: isAnswered ? new Date().toISOString() : null,
                  status: isAnswered ? 'answered' : 'pending',
                  updated_at: new Date().toISOString(),
                }
              : prayer;

          return {
            ...old,
            supplication: old.supplication?.map(updatePrayer) || [],
            freeform: old.freeform?.map(updatePrayer) || [],
          };
        }
      );

      return { previousPrayers, previousACTSData };
    },
    onError: (err: Error, { _userId, _dateStr }, context) => {
      Logger.error('Error marking supplication as answered', err as Error, {
      component: 'usePrayerData',
    });
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
    onSuccess: async (data, { id, isAnswered, _userId, _dateStr }) => {
      // Directly update ACTS cache with confirmed server data to prevent refetch race
      queryClient.setQueryData(
        queryKeys.prayers.acts(_userId, _dateStr),
        (old: any) => {
          if (!old) {return old;}
          const updatePrayer = (prayer: any) =>
            prayer.id === id ? { ...prayer, ...data } : prayer;
          return {
            ...old,
            supplication: old.supplication?.map(updatePrayer) || [],
            freeform: old.freeform?.map(updatePrayer) || [],
          };
        }
      );

      // Award faith points when marking prayer as answered (once per day)
      if (isAnswered && _userId) {
        try {
          // Check if already awarded today
          const alreadyAwarded = await faithPointsService.hasActivityToday(_userId, 'prayer_answered');
          if (!alreadyAwarded) {
            await faithPointsService.awardPoints(
              _userId,
              'prayer_answered',
              {
                suppressNotification: false, // Show animation for answered prayers
                source: 'prayer_answered',
              }
            );
          }
        } catch (error) {
          Logger.warn('Failed to award faith points for prayer answered', {
            component: 'usePrayerData',
            error: error as Error,
          });
        }
      }
    },
    onSettled: (data, error, { _userId, _dateStr }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
      // Keep dashboard requests list in sync when marking a request as prayed/unprayed
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.unprayedRequests(_userId),
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
      await queryClient.cancelQueries({
        queryKey: queryKeys.prayers.unprayedRequests(_userId),
      });
      if (_dateStr) {
        await queryClient.cancelQueries({
          queryKey: queryKeys.prayers.people(_userId, _dateStr),
        });
      }

      const previousPrayers = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr)
      );
      const previousUnprayed = queryClient.getQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.unprayedRequests(_userId)
      );
      const previousPeople = _dateStr
        ? queryClient.getQueryData<PrayerApiEntry[]>(
            queryKeys.prayers.people(_userId, _dateStr)
          )
        : undefined;

      queryClient.setQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.entries(_userId, _dateStr),
        (old = []) => old.map(prayer =>
          prayer.id === id
            ? { ...prayer, is_prayed: isPrayed, updated_at: new Date().toISOString() }
            : prayer
        )
      );

      if (_dateStr) {
        queryClient.setQueryData<PrayerApiEntry[]>(
          queryKeys.prayers.people(_userId, _dateStr),
          (old = []) => old.map(prayer =>
            prayer.id === id
              ? { ...prayer, prayed: isPrayed, is_prayed: isPrayed, updated_at: new Date().toISOString() }
              : prayer
          )
        );
      }

      // Update dashboard unprayed requests list immediately
      queryClient.setQueryData<PrayerApiEntry[]>(
        queryKeys.prayers.unprayedRequests(_userId),
        (old = []) => {
          if (isPrayed) {
            // Remove from unprayed if just marked as prayed
            return old.filter(p => p.id !== id);
          }
          // If toggled back to unprayed, try to add a placeholder if not present
          const exists = old.some(p => p.id === id);
          if (exists) { return old; }
          // Try to recover minimal data from entries cache to re-add
          const fromEntries = (previousPrayers || []).find(p => p.id === id);
          return fromEntries ? [fromEntries, ...old] : old;
        }
      );

      return { previousPrayers, previousUnprayed, previousPeople };
    },
    onError: (err: Error, { _userId, _dateStr }, context) => {
      Logger.error('Error marking prayer request as prayed', err as Error, {
      component: 'usePrayerData',
    });
      if (context?.previousPrayers) {
        queryClient.setQueryData(
          queryKeys.prayers.entries(_userId, _dateStr),
          context.previousPrayers
        );
      }
      if (context?.previousUnprayed) {
        queryClient.setQueryData(
          queryKeys.prayers.unprayedRequests(_userId),
          context.previousUnprayed
        );
      }
      if (_dateStr && context?.previousPeople) {
        queryClient.setQueryData(
          queryKeys.prayers.people(_userId, _dateStr),
          context.previousPeople
        );
      }
    },
    onSettled: (data, error, { _userId, _dateStr }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.entries(_userId, _dateStr),
      });
      queryClient.invalidateQueries({
        queryKey: queryKeys.prayers.unprayedRequests(_userId),
      });
      if (_dateStr) {
        queryClient.invalidateQueries({
          queryKey: queryKeys.prayers.people(_userId, _dateStr),
        });
      }
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

// ===== DEVOTIONAL PRAYER HOOKS =====

/**
 * Create a devotional prayer entry
 */
export const useCreateDevotionalPrayer = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (prayer: {
      content: string;
      userId: string;
      dateStr: string;
      devotionalTitle: string;
      dayNumber: number;
      dayTitle: string;
      totalDays?: number;
      prayer_type?: string;
    }) => {
      return PrayerApi.createPrayer({
        user_id: prayer.userId,
        prayer_type: (prayer.prayer_type ?? 'devotional') as PrayerApiEntry['prayer_type'],
        content: prayer.content,
        selected_date: prayer.dateStr,
        status: 'pending',
        prayed: true, // Mark as prayed when user creates devotional prayer
        devotional_title: prayer.devotionalTitle,
        day_number: prayer.dayNumber,
        day_title: prayer.dayTitle,
        total_days: prayer.totalDays,
      });
    },
    onMutate: async ({ userId, dateStr, content, devotionalTitle, dayNumber, dayTitle, totalDays, prayer_type }) => {
      const actualPrayerType = (prayer_type ?? 'devotional') as PrayerApiEntry['prayer_type'];
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: queryKeys.prayers.devotional(userId, dateStr) });
      await queryClient.cancelQueries({ queryKey: queryKeys.prayers.allDevotional(userId) });
      await queryClient.cancelQueries({ queryKey: queryKeys.prayers.entries(userId, dateStr) });

      // Snapshot previous values
      const previousDevotional = queryClient.getQueryData(queryKeys.prayers.devotional(userId, dateStr));
      const previousAllDevotional = queryClient.getQueryData(queryKeys.prayers.allDevotional(userId));
      const previousEntries = queryClient.getQueryData(queryKeys.prayers.entries(userId, dateStr));

      // Check if an identical devotional prayer already exists in cache to avoid duplicates
      const existsIn = (list: any[] | undefined) =>
        !!list?.some((p: any) =>
          p?.user_id === userId &&
          (p?.prayer_type === 'devotional' || p?.prayer_type === 'guided_playbook') &&
          p?.selected_date === dateStr &&
          p?.devotional_title === devotionalTitle &&
          p?.day_number === dayNumber
        );

      const existingDevotional = queryClient.getQueryData<any[]>(queryKeys.prayers.devotional(userId, dateStr));
      const existingAllDevotional = queryClient.getQueryData<any[]>(queryKeys.prayers.allDevotional(userId));
      const existingEntries = queryClient.getQueryData<any[]>(queryKeys.prayers.entries(userId, dateStr));

      const alreadyExists = existsIn(existingDevotional) || existsIn(existingAllDevotional) || existsIn(existingEntries);

      // Create optimistic prayer entry
      const optimisticPrayer: PrayerApiEntry = {
        id: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        user_id: userId,
        prayer_type: actualPrayerType,
        content,
        selected_date: dateStr,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        status: 'pending',
        devotional_title: devotionalTitle,
        day_number: dayNumber,
        day_title: dayTitle,
        total_days: totalDays,
        type: 'devotional' as const,
        is_answered: false,
      };

      if (!alreadyExists) {
        // Optimistically update devotional prayers for date
        queryClient.setQueryData(
          queryKeys.prayers.devotional(userId, dateStr),
          (old: PrayerApiEntry[] = []) => [optimisticPrayer, ...old]
        );

        // Optimistically update all devotional prayers
        queryClient.setQueryData(
          queryKeys.prayers.allDevotional(userId),
          (old: PrayerApiEntry[] = []) => [optimisticPrayer, ...old]
        );

        // Optimistically update all entries for date
        queryClient.setQueryData(
          queryKeys.prayers.entries(userId, dateStr),
          (old: PrayerApiEntry[] = []) => [optimisticPrayer, ...old]
        );
      } else {

      }

      return { previousDevotional, previousAllDevotional, previousEntries };
    },
    onSuccess: async (_data, variables) => {
      // Cache is automatically handled by React Query optimistic updates

      // Update prayer streak
      if (variables.userId) {
        try {
          await streakTrackingService.updateStreak(variables.userId, 'prayer');

          // Invalidate streak tracker to refresh UI
          queryClient.invalidateQueries({
            queryKey: queryKeys.dashboard.streaks(variables.userId),
          });
        } catch (error) {
          Logger.warn('Failed to update prayer streak for devotional', {
            component: 'usePrayerData',
            error: error as Error,
          });
        }
      }
    },
    onError: (error, { userId, dateStr }, context) => {
      // Log the error for debugging
      Logger.error('Error creating devotional prayer', error as Error, {
      component: 'usePrayerData',
    });

      // Rollback optimistic updates
      if (context?.previousDevotional) {
        queryClient.setQueryData(queryKeys.prayers.devotional(userId, dateStr), context.previousDevotional);
      }
      if (context?.previousAllDevotional) {
        queryClient.setQueryData(queryKeys.prayers.allDevotional(userId), context.previousAllDevotional);
      }
      if (context?.previousEntries) {
        queryClient.setQueryData(queryKeys.prayers.entries(userId, dateStr), context.previousEntries);
      }
    },
    onSettled: (data, error, { userId, dateStr }) => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: queryKeys.prayers.devotional(userId, dateStr) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prayers.allDevotional(userId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prayers.entries(userId, dateStr) });
    },
  });
};
