/**
 * Cross-Component Data Synchronization Hook
 * Ensures seamless data flow between Playbooks, Devotionals, Journal, and Prayer components
 */

import { useCallback, useRef } from 'react';
import { Logger } from '../../utils/ProductionLogger';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';
import { faithPointsService } from '../faithPointsService';

interface SyncEvent {
  type: 'playbook_progress' | 'devotional_completion' | 'journal_entry' | 'prayer_added';
  playbookId?: string;
  devotionalId?: string;
  date?: string;
  userId: string;
  metadata?: any;
}

/**
 * Hook for managing cross-component data synchronization
 * Automatically updates related queries when data changes in one component
 */
export const useCrossComponentSync = (userId: string) => {
  const queryClient = useQueryClient();
  const completionGuardRef = useRef<Record<string, number>>({});

  // Sync playbook progress changes with related components
  const syncPlaybookProgress = useCallback(async (playbookId: string, progress: number) => {

    const syncEvent: SyncEvent = {
      type: 'playbook_progress',
      playbookId,
      userId,
      metadata: { progress, timestamp: new Date().toISOString() },
    };

    // Update playbook-related queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.playbooks.all(userId),
    });

    // Update related devotional queries if this playbook has devotionals
    await queryClient.invalidateQueries({
      queryKey: queryKeys.devotionals.playbook(playbookId),
    });

    // Update journal entries that might reference this playbook
    const today = new Date().toISOString().split('T')[0];
    await queryClient.invalidateQueries({
      queryKey: queryKeys.journal.entries(userId, today),
    });

    // Update prayer queries that might be related to this playbook's themes
    await queryClient.invalidateQueries({
      queryKey: queryKeys.prayers.entries(userId, today),
    });

    return syncEvent;
  }, [queryClient, userId]);

  // Sync devotional completion with playbook progress
  const syncDevotionalCompletion = useCallback(async (devotionalId: string, playbookId?: string, completionContext?: {
    isFullDevotionalComplete?: boolean;
    completedDaysCount?: number;
    totalDays?: number;
    currentDay?: number;
  }) => {

    // Guard against multiple calls within 3 seconds for the same devotional (increased from 2s)
    const guardKey = `${devotionalId}-${completionContext?.currentDay || 'unknown'}`;
    const baseGuardKey = `${devotionalId}-base`; // Base guard without currentDay
    const now = Date.now();
    const lastCall = completionGuardRef.current[guardKey];
    const baseLastCall = completionGuardRef.current[baseGuardKey];

    Logger.debug('[CrossComponentSync] Guard check', {
      component: 'useCrossComponentSync',
      guardKey,
      baseGuardKey,
      devotionalId,
      currentDay: completionContext?.currentDay,
      lastCall,
      baseLastCall,
      now,
      timeDiff: lastCall ? now - lastCall : 'none',
      baseTimeDiff: baseLastCall ? now - baseLastCall : 'none',
    });

    // Check both specific day guard and base guard with stricter timing
    if ((lastCall && (now - lastCall) < 3000) || (baseLastCall && (now - baseLastCall) < 2000)) {
      Logger.debug('[CrossComponentSync] Guard blocked duplicate call', {
        component: 'useCrossComponentSync',
        guardKey,
        baseGuardKey,
        timeDiff: lastCall ? now - lastCall : 'none',
        baseTimeDiff: baseLastCall ? now - baseLastCall : 'none',
      });
      return { pointsAwarded: 0 };
    }

    completionGuardRef.current[guardKey] = now;
    completionGuardRef.current[baseGuardKey] = now;

    try {
      // Award faith points based on completion type
      const activityType = completionContext?.isFullDevotionalComplete ? 'devotional_full_completed' : 'devotional_completed';
      const isFullCompletion = completionContext?.isFullDevotionalComplete;

      Logger.debug('[CrossComponentSync] BEFORE Promise.all parallel operations', {
        component: 'useCrossComponentSync',
        activityType,
        isFullCompletion,
      });

      // 1. Award points first (critical path)
      const pointsResult = await faithPointsService.awardPoints(userId, activityType as any, {
        devotionalId,
        playbookId,
        timestamp: new Date().toISOString(),
        suppressNotification: !isFullCompletion,
        completionContext,
      });

      // 2. CRITICAL: For 1-day devotionals, skip ALL query invalidations to prevent PlaybookListScreen hang
      // 1-day devotionals complete immediately and navigate back, causing UI freeze
      if (isFullDevotionalComplete && totalDays === 1) {
        console.log('[CrossComponentSync] Skipping invalidations for 1-day devotional to prevent PlaybookListScreen hang');
        return; // Skip all invalidations for 1-day devotionals
      }

      // For multi-day devotionals, defer invalidations with longer delay
      const deferInvalidations = () => {
        // Use a 500ms delay to ensure navigation is fully complete before invalidating
        setTimeout(() => {
          try {
            console.log('[CrossComponentSync] Starting deferred invalidations');
            // CRITICAL: DO NOT invalidate devotionals list - causes 4.5s VirtualizedList freeze
            // The PlaybookListScreen will refetch naturally when user navigates back
            // queryClient.invalidateQueries({
            //   queryKey: ['devotionals', 'list', userId],
            // });

            // Invalidate dashboard-related queries in parallel
            queryClient.invalidateQueries({
              queryKey: ['dashboard', 'streaks', userId],
            });
            queryClient.invalidateQueries({
              queryKey: ['dashboard', 'insights', userId],
            });
            queryClient.invalidateQueries({
              queryKey: ['dashboard', 'affirmations', userId],
            });

            // If linked to a playbook, update playbook queries
            if (playbookId) {
              queryClient.invalidateQueries({
                queryKey: queryKeys.playbooks.detail(userId, playbookId),
              });

              // Update cross-component relationship
              queryClient.setQueryData(
                queryKeys.playbooks.withDevotionals(userId, playbookId),
                (oldData: any) => ({
                  ...oldData,
                  lastDevotionalCompleted: devotionalId,
                  lastSynced: new Date().toISOString(),
                })
              );
            }
            console.log('[CrossComponentSync] Deferred invalidations complete');
          } catch (e) {
            Logger.error('[CrossComponentSync] Deferred invalidations failed', e as Error, { component: 'useCrossComponentSync' });
          }
        }, 500); // 500ms delay to ensure navigation completes first
      };
      deferInvalidations();

      Logger.debug('[CrossComponentSync] AFTER Promise.all parallel operations', {
        component: 'useCrossComponentSync',
        pointsAwarded: pointsResult?.pointsAwarded,
      });

      const syncEvent: SyncEvent = {
        type: 'devotional_completion',
        devotionalId,
        playbookId,
        userId,
        metadata: {
          timestamp: new Date().toISOString(),
          pointsAwarded: pointsResult?.pointsAwarded || 0,
          newLevel: pointsResult?.newLevel,
        },
      };

      Logger.debug('[CrossComponentSync] BEFORE return syncEvent', {
        component: 'useCrossComponentSync',
      });

      return syncEvent;
    } catch (error) {
      Logger.error('[CrossComponentSync] Error syncing devotional completion', error as Error, { component: 'useCrossComponentSync' });
      // Clear guard on error to allow retry
      const guardKeyForCleanup = `${devotionalId}-${completionContext?.currentDay || 'unknown'}`;
      delete completionGuardRef.current[guardKeyForCleanup];
      throw error;
    }
  }, [queryClient, userId]);

  // Sync journal entry creation with related playbooks
  const syncJournalEntry = useCallback(async (date: string, entryType: string, _content: any) => {

    const syncEvent: SyncEvent = {
      type: 'journal_entry',
      date,
      userId,
      metadata: { entryType, timestamp: new Date().toISOString() },
    };

    // Update journal queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.journal.entries(userId, date),
    });

    // Check if this journal entry relates to any active playbooks
    const activePlaybooks = queryClient.getQueryData(queryKeys.playbooks.byStatus(userId, 'ongoing')) as any[];

    if (activePlaybooks && activePlaybooks.length > 0) {
      // Update cross-component relationships for active playbooks
      activePlaybooks.forEach(playbook => {
        queryClient.setQueryData(
          queryKeys.playbooks.withJournal(userId, playbook.id, date),
          (oldData: any) => ({
            ...oldData,
            lastJournalEntry: { type: entryType, date },
            lastSynced: new Date().toISOString(),
          })
        );
      });
    }

    return syncEvent;
  }, [queryClient, userId]);

  // Sync prayer addition with related components
  const syncPrayerAddition = useCallback(async (date: string, prayerType: string, content: string) => {

    const syncEvent: SyncEvent = {
      type: 'prayer_added',
      date,
      userId,
      metadata: { prayerType, content: content.substring(0, 100), timestamp: new Date().toISOString() },
    };

    // Update prayer queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.prayers.entries(userId, date),
    });

    // Check if this prayer relates to any playbook themes
    const allPlaybooks = queryClient.getQueryData(queryKeys.playbooks.all(userId)) as any[];

    if (allPlaybooks && allPlaybooks.length > 0) {
      // Simple keyword matching to find related playbooks
      const keywords = content.toLowerCase().split(' ').filter(word => word.length > 3);

      const relatedPlaybooks = allPlaybooks.filter(playbook => {
        const playbookText = `${playbook.title} ${playbook.userInput || ''}`.toLowerCase();
        return keywords.some(keyword => playbookText.includes(keyword));
      });

      // Update cross-component relationships for related playbooks
      relatedPlaybooks.forEach(playbook => {
        queryClient.setQueryData(
          queryKeys.playbooks.withPrayers(userId, playbook.id),
          (oldData: any) => ({
            ...oldData,
            lastRelatedPrayer: { type: prayerType, date },
            lastSynced: new Date().toISOString(),
          })
        );
      });
    }

    return syncEvent;
  }, [queryClient, userId]);

  // Batch sync multiple events for performance
  const batchSync = useCallback(async (events: SyncEvent[]) => {

    const syncPromises = events.map(event => {
      switch (event.type) {
        case 'playbook_progress':
          return event.playbookId ? syncPlaybookProgress(event.playbookId, event.metadata?.progress || 0) : Promise.resolve();
        case 'devotional_completion':
          return event.devotionalId ? syncDevotionalCompletion(event.devotionalId, event.playbookId) : Promise.resolve();
        case 'journal_entry':
          return event.date ? syncJournalEntry(event.date, event.metadata?.entryType || '', event.metadata || {}) : Promise.resolve();
        case 'prayer_added':
          return event.date ? syncPrayerAddition(event.date, event.metadata?.prayerType || '', event.metadata?.content || '') : Promise.resolve();
        default:
          return Promise.resolve();
      }
    });

    await Promise.allSettled(syncPromises);

  }, [syncPlaybookProgress, syncDevotionalCompletion, syncJournalEntry, syncPrayerAddition]);

  // Get relationship data between components
  const getRelationshipData = useCallback((playbookId: string, date?: string) => {
    const currentDate = date || new Date().toISOString().split('T')[0];

    return {
      devotionals: queryClient.getQueryData(queryKeys.devotionals.playbook(playbookId)) || [],
      journalEntries: queryClient.getQueryData(queryKeys.playbooks.withJournal(userId, playbookId, currentDate)) || [],
      prayers: queryClient.getQueryData(queryKeys.playbooks.withPrayers(userId, playbookId)) || [],
    };
  }, [queryClient, userId]);

  // Prefetch related data for better performance
  const prefetchRelatedData = useCallback(async (playbookId: string, date?: string) => {
    const currentDate = date || new Date().toISOString().split('T')[0];

    const prefetchPromises = [
      queryClient.prefetchQuery({
        queryKey: queryKeys.devotionals.playbook(playbookId),
        queryFn: () => [], // Would be replaced with actual API call
        staleTime: 10 * 60 * 1000, // 10 minutes
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.playbooks.withJournal(userId, playbookId, currentDate),
        queryFn: () => [], // Would be replaced with actual API call
        staleTime: 5 * 60 * 1000, // 5 minutes
      }),
      queryClient.prefetchQuery({
        queryKey: queryKeys.playbooks.withPrayers(userId, playbookId),
        queryFn: () => [], // Would be replaced with actual API call
        staleTime: 15 * 60 * 1000, // 15 minutes
      }),
    ];

    await Promise.allSettled(prefetchPromises);

  }, [queryClient, userId]);

  return {
    // Individual sync functions
    syncPlaybookProgress,
    syncDevotionalCompletion,
    syncJournalEntry,
    syncPrayerAddition,

    // Batch operations
    batchSync,

    // Data access
    getRelationshipData,
    prefetchRelatedData,
  };
};
