import { supabase } from '../supabaseClient';
import { Logger } from '../../utils/ProductionLogger';
import { notificationSchedulerService } from '../notificationSchedulerService';
import { NotificationQueueItem } from '../notificationManagementService';
import { buildSmartNotificationCandidates } from './notificationCandidateResolver';
import {
  ScheduledSmartNotification,
  SmartNotificationCandidate,
  SmartNotificationDecision,
  SmartNotificationTimeWindow,
  SMART_NOTIFICATION_ENGINE_VERSION,
} from './notificationTypes';

const LEGACY_DAILY_NOTIFICATION_TYPES = [
  'morning_devotional',
  'devotional_reminder',
  'daily_scripture',
  'affirmation_reminder',
  'midday_checkin',
  'evening_reflection',
  'gratitude_reminder',
  'upgrade_reminder',
  'prayer_request_reminder',
  'journal_reminder',
  'devotional_reflection',
  'playbook_reminder',
  'wins_reminder',
];

const WINDOW_HOURS: Record<SmartNotificationTimeWindow, { hour: number; minute: number }> = {
  morning: { hour: 8, minute: 0 },
  midday: { hour: 12, minute: 15 },
  afternoon: { hour: 15, minute: 30 },
  evening: { hour: 19, minute: 0 },
  night: { hour: 21, minute: 0 },
};

type PendingQueueRow = {
  id: string;
  type: string;
  scheduled_for?: string | null;
  status?: string | null;
  data?: Record<string, unknown> | null;
};

const getNextWindowDate = (window: SmartNotificationTimeWindow): Date => {
  const now = new Date();
  const target = new Date(now);
  const { hour, minute } = WINDOW_HOURS[window];
  target.setHours(hour, minute, 0, 0);

  if (target <= now) {
    target.setDate(target.getDate() + 1);
  }

  return target;
};

const getDedupeKey = (row: PendingQueueRow): string | undefined => {
  const value = row.data?.dedupe_key;
  return typeof value === 'string' ? value : undefined;
};

const isSmartEngineRow = (row: PendingQueueRow): boolean => {
  return row.data?.engine_version === SMART_NOTIFICATION_ENGINE_VERSION;
};

const shouldKeepExisting = (row: PendingQueueRow): boolean => {
  if (!row.scheduled_for) {
    return false;
  }

  const scheduledFor = new Date(row.scheduled_for);
  return scheduledFor.getTime() > Date.now();
};

class SmartNotificationEngine {
  private selectByTimeWindow(candidates: SmartNotificationCandidate[]): SmartNotificationCandidate[] {
    const MAX_PER_WINDOW = 3;
    const MAX_TOTAL = 10;

    const byWindow = new Map<SmartNotificationTimeWindow, SmartNotificationCandidate[]>();

    [...candidates]
      .sort((a, b) => b.score - a.score)
      .forEach(candidate => {
        const existing = byWindow.get(candidate.timeWindow) || [];
        if (existing.length < MAX_PER_WINDOW) {
          existing.push(candidate);
          byWindow.set(candidate.timeWindow, existing);
        }
      });

    // Flatten all candidates and sort by time window
    const allCandidates = Array.from(byWindow.entries())
      .flatMap(([_timeWindow, windowCandidates]) => windowCandidates)
      .sort((a, b) => {
        const aDate = getNextWindowDate(a.timeWindow).getTime();
        const bDate = getNextWindowDate(b.timeWindow).getTime();
        return aDate - bDate;
      });

    // Limit total candidates to avoid overwhelming user
    return allCandidates.slice(0, MAX_TOTAL);
  }

  private async getPendingSmartRows(userId: string): Promise<PendingQueueRow[]> {
    const { data, error } = await supabase
      .from('notification_queue')
      .select('id, type, scheduled_for, status, data')
      .eq('user_id', userId)
      .eq('status', 'pending');

    if (error) {
      Logger.warn('[SmartNotifications] Unable to read pending queue for dedupe', {
        component: 'smartNotificationEngine',
        userId,
        error,
      });
      return [];
    }

    return (data || []) as PendingQueueRow[];
  }

  private async cancelRows(ids: string[]): Promise<string[]> {
    if (ids.length === 0) {
      return [];
    }

    const { error } = await supabase
      .from('notification_queue')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .in('id', ids);

    if (error) {
      Logger.warn('[SmartNotifications] Unable to cancel stale notifications', {
        component: 'smartNotificationEngine',
        error,
        ids,
      });
      return [];
    }

    return ids;
  }

  private async cancelLegacyDailyNotifications(userId: string): Promise<void> {
    const { error } = await supabase
      .from('notification_queue')
      .update({
        status: 'cancelled',
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'pending')
      .in('type', LEGACY_DAILY_NOTIFICATION_TYPES);

    if (error) {
      Logger.warn('[SmartNotifications] Unable to cancel legacy daily notifications', {
        component: 'smartNotificationEngine',
        userId,
        error,
      });
    }
  }

  private toQueueItem(userId: string, candidate: ScheduledSmartNotification): NotificationQueueItem {
    return {
      user_id: userId,
      type: candidate.type,
      title: candidate.copy.title,
      message: candidate.copy.message,
      scheduled_for: candidate.scheduledFor.toISOString(),
      priority: candidate.priority,
      data: {
        ...(candidate.metadata || {}),
        deep_link: candidate.deepLink,
        dedupe_key: candidate.dedupeKey,
        engine_version: SMART_NOTIFICATION_ENGINE_VERSION,
        category: candidate.category,
        time_window: candidate.timeWindow,
        source_type: candidate.source.sourceType,
        source_id: candidate.source.sourceId,
        source_sub_id: candidate.source.sourceSubId,
        privacy_level: candidate.privacyLevel,
        generated_at: new Date().toISOString(),
      },
    };
  }

  async scheduleForUser(userId: string): Promise<SmartNotificationDecision> {
    const candidates = await buildSmartNotificationCandidates(userId);
    const selectedCandidates = this.selectByTimeWindow(candidates);
    const selected: ScheduledSmartNotification[] = selectedCandidates.map(candidate => ({
      ...candidate,
      scheduledFor: getNextWindowDate(candidate.timeWindow),
    }));

    await this.cancelLegacyDailyNotifications(userId);

    const pendingRows = await this.getPendingSmartRows(userId);
    const selectedKeys = new Set(selected.map(candidate => candidate.dedupeKey));
    const existingKeys = new Set(
      pendingRows
        .filter(row => isSmartEngineRow(row) && shouldKeepExisting(row))
        .map(getDedupeKey)
        .filter((key): key is string => !!key)
    );

    const staleIds = pendingRows
      .filter(row => isSmartEngineRow(row))
      .filter(row => {
        const key = getDedupeKey(row);
        return !key || !selectedKeys.has(key) || !shouldKeepExisting(row);
      })
      .map(row => row.id);

    const cancelledStaleIds = await this.cancelRows(staleIds);
    const skippedDedupeKeys: string[] = [];

    for (const candidate of selected) {
      if (existingKeys.has(candidate.dedupeKey)) {
        skippedDedupeKeys.push(candidate.dedupeKey);
        continue;
      }

      await notificationSchedulerService.scheduleNotification(
        this.toQueueItem(userId, candidate),
        {
          priority: candidate.priority,
          batchWithOthers: false,
        }
      );
    }

    Logger.info('[SmartNotifications] Scheduled state-based notifications', {
      component: 'smartNotificationEngine',
      userId,
      candidateCount: candidates.length,
      selectedCount: selected.length,
      cancelledStaleCount: cancelledStaleIds.length,
      skippedDedupeCount: skippedDedupeKeys.length,
    });

    return {
      candidates,
      selected,
      cancelledStaleIds,
      skippedDedupeKeys,
    };
  }
}

export const smartNotificationEngine = new SmartNotificationEngine();
