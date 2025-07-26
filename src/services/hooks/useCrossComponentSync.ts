/**
 * Cross-Component Data Synchronization Hook
 * Ensures seamless data flow between Playbooks, Devotionals, Journal, and Prayer components
 */

import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '../queryKeys';

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

  // Sync playbook progress changes with related components
  const syncPlaybookProgress = useCallback(async (playbookId: string, progress: number) => {
    console.log('[CrossComponentSync] Syncing playbook progress:', { playbookId, progress });

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

    console.log('[CrossComponentSync] Playbook progress sync completed');
    return syncEvent;
  }, [queryClient, userId]);

  // Sync devotional completion with playbook progress
  const syncDevotionalCompletion = useCallback(async (devotionalId: string, playbookId?: string) => {
    console.log('[CrossComponentSync] Syncing devotional completion:', { devotionalId, playbookId });

    const syncEvent: SyncEvent = {
      type: 'devotional_completion',
      devotionalId,
      playbookId,
      userId,
      metadata: { timestamp: new Date().toISOString() },
    };

    // Update devotional queries
    await queryClient.invalidateQueries({
      queryKey: queryKeys.devotionals.list(userId),
    });

    // If linked to a playbook, update playbook queries
    if (playbookId) {
      await queryClient.invalidateQueries({
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

    console.log('[CrossComponentSync] Devotional completion sync completed');
    return syncEvent;
  }, [queryClient, userId]);

  // Sync journal entry creation with related playbooks
  const syncJournalEntry = useCallback(async (date: string, entryType: string, _content: any) => {
    console.log('[CrossComponentSync] Syncing journal entry:', { date, entryType });

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

    console.log('[CrossComponentSync] Journal entry sync completed');
    return syncEvent;
  }, [queryClient, userId]);

  // Sync prayer addition with related components
  const syncPrayerAddition = useCallback(async (date: string, prayerType: string, content: string) => {
    console.log('[CrossComponentSync] Syncing prayer addition:', { date, prayerType });

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

    console.log('[CrossComponentSync] Prayer addition sync completed');
    return syncEvent;
  }, [queryClient, userId]);

  // Batch sync multiple events for performance
  const batchSync = useCallback(async (events: SyncEvent[]) => {
    console.log('[CrossComponentSync] Starting batch sync:', events.length, 'events');

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
    console.log('[CrossComponentSync] Batch sync completed');
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

    console.log('[CrossComponentSync] Prefetching related data for:', playbookId);

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
    console.log('[CrossComponentSync] Related data prefetching completed');
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
