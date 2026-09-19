import type { PrayerApiEntry } from './api/prayerApi';
import { answerHistory, isNeedActive, isPrayerActive, isPrayerLetGo, needHasAnswer, prayerNeeds } from '../utils/prayerTracking';

export type PrayerIntelligencePurpose = 'return' | 'check_in' | 'follow_up' | 'remember' | 'celebrate';
export type PrayerIntelligenceSource = 'prayer' | 'need' | 'request' | 'thanksgiving';

export type PrayerResurfacingState = {
  lastResurfacedAt?: string;
  lastResurfacedPurpose?: PrayerIntelligencePurpose;
  dismissedUntil?: string;
};

export type PrayerIntelligenceCandidate = {
  id: string;
  purpose: PrayerIntelligencePurpose;
  prayerId: string;
  needId?: string;
  requestId?: string;
  sourceType: PrayerIntelligenceSource;
  reason: string;
  createdAt: string;
  lastPrayedAt?: string;
  lastUpdatedAt?: string;
  answerDate?: string;
  prayerCount?: number;
  displayContext: string;
  rank: number;
};

/** UX guardrails, not achievements or spiritual milestones. */
export const PRAYER_INTELLIGENCE_TIMING = {
  freshItemSuppressionDays: 2,
  repeatSurfaceSuppressionDays: 7,
  notNowSuppressionDays: 3,
} as const;

const day = 86_400_000;
const validTime = (value?: string | null) => {
  const stamp = value ? new Date(value).getTime() : NaN;
  return Number.isFinite(stamp) ? stamp : undefined;
};
const daysSince = (now: number, value?: string | null) => {
  const stamp = validTime(value);
  return stamp === undefined ? Number.POSITIVE_INFINITY : Math.max(0, Math.floor((now - stamp) / day));
};
const latest = (...values: Array<string | undefined | null>) => values
  .filter((value): value is string => validTime(value) !== undefined)
  .sort((a, b) => (validTime(b) || 0) - (validTime(a) || 0))[0];
const latestUpdate = (p: PrayerApiEntry, needId?: string) => {
  const updates = Array.isArray(p.metadata?.prayer_updates) ? p.metadata?.prayer_updates || [] : [];
  return latest(p.updated_at, ...updates.filter((u: any) => !needId || !u.needId || u.needId === needId).map((u: any) => u.date));
};
const relativeTime = (days: number, verb: string) => days === 0 ? `${verb} today` : days === 1 ? `${verb} yesterday` : `${verb} ${days} days ago`;
const canonicalId = (p: PrayerApiEntry, needId?: string) => `${p.metadata?.original_request_id || p.id}:${needId || ''}`;
const requestJourney = (p: PrayerApiEntry) => p.is_prayer_request ? p.id : p.metadata?.original_request_id;

const isSuppressed = (candidateId: string, now: number, states: Record<string, PrayerResurfacingState>) => {
  const state = states[candidateId];
  if (!state) return false;
  const dismissed = validTime(state.dismissedUntil);
  if (dismissed !== undefined && dismissed > now) return true;
  return daysSince(now, state.lastResurfacedAt) < PRAYER_INTELLIGENCE_TIMING.repeatSurfaceSuppressionDays;
};

export function getPrayerIntelligenceCandidates(
  prayers: PrayerApiEntry[],
  currentDate: Date,
  resurfacing: Record<string, PrayerResurfacingState> = {},
): PrayerIntelligenceCandidate[] {
  const now = currentDate.getTime();
  const candidates: PrayerIntelligenceCandidate[] = [];
  const groupedRequestIds = new Set(prayers.map(requestJourney).filter(Boolean));

  for (const p of prayers) {
    if ((validTime(p.created_at) || 0) > now || p.journal_category === 'confession') continue;
    const requestId = requestJourney(p);
    // A linked response is the canonical presentation record for one request journey.
    if (p.is_prayer_request && prayers.some(other => other.metadata?.original_request_id === p.id)) continue;
    const baseCreatedDays = daysSince(now, p.created_at);
    const updates = latestUpdate(p);
    const needs = prayerNeeds(p);
    const sources = needs.length ? needs.map(need => ({ need })) : [{ need: undefined }];

    for (const { need } of sources) {
      const needId = need?.id;
      const id = canonicalId(p, needId);
      if (isSuppressed(id, now, resurfacing)) continue;
      const active = need ? isNeedActive(need) : isPrayerActive(p);
      const lastPrayedAt = needId ? p.metadata?.need_last_prayed?.[needId] : p.last_prayed_at;
      const activityAt = latest(lastPrayedAt, updates);
      const inactiveDays = daysSince(now, activityAt);
      const sourceType: PrayerIntelligenceSource = need ? 'need' : requestId ? 'request' : p.journal_category === 'thanksgiving' ? 'thanksgiving' : 'prayer';

      if (requestId && active) {
        const prayed = !!lastPrayedAt || !!p.prayed || (p.prayer_count || 0) > 0;
        if (!prayed || inactiveDays > PRAYER_INTELLIGENCE_TIMING.freshItemSuppressionDays) {
          candidates.push({ id, purpose: 'follow_up', prayerId: p.id, needId, requestId, sourceType: 'request', reason: prayed ? 'request-without-later-activity' : 'unprayed-request', createdAt: p.created_at, lastPrayedAt, lastUpdatedAt: updates, prayerCount: p.prayer_count, displayContext: prayed ? `${relativeTime(daysSince(now, lastPrayedAt), 'Prayed for this request')}. Any update?` : relativeTime(baseCreatedDays, 'Saved this request'), rank: 500 + (prayed ? inactiveDays : 100) });
        }
      } else if (active) {
        // Active items are divided by relative inactivity below; this only excludes truly fresh activity.
        if (inactiveDays > PRAYER_INTELLIGENCE_TIMING.freshItemSuppressionDays) {
          candidates.push({ id, purpose: 'return', prayerId: p.id, needId, sourceType, reason: 'active-with-relatively-low-recent-activity', createdAt: p.created_at, lastPrayedAt, lastUpdatedAt: updates, prayerCount: p.prayer_count, displayContext: lastPrayedAt ? relativeTime(daysSince(now, lastPrayedAt), 'Last prayed') : 'Ready to return to in prayer', rank: 400 + Math.min(inactiveDays, 365) });
        }
      }

      const needAnswers = need?.answerHistory || (need && needHasAnswer(need) && need.answeredDate ? [{ date: need.answeredDate }] : []);
      const answers = need ? needAnswers : answerHistory(p);
      const answerDate = latest(...answers.map(answer => answer.date));
      if (answerDate) {
        candidates.push({ id, purpose: 'celebrate', prayerId: p.id, needId, requestId, sourceType, reason: 'user-recorded-answer', createdAt: p.created_at, lastPrayedAt, lastUpdatedAt: updates, answerDate, prayerCount: p.prayer_count, displayContext: relativeTime(daysSince(now, answerDate), 'You marked this Answered'), rank: 300 + Math.max(0, 30 - daysSince(now, answerDate)) });
      }
    }

    const justSave = p.metadata?.track_answered === false;
    const historical = justSave || isPrayerLetGo(p) || (!isPrayerActive(p) && !answerHistory(p).length);
    const gratitude = p.journal_category === 'thanksgiving';
    const conservativeAdoration = p.journal_category === 'adoration' && baseCreatedDays > 30;
    if (!needs.length && baseCreatedDays > PRAYER_INTELLIGENCE_TIMING.freshItemSuppressionDays && (historical || gratitude || conservativeAdoration) && !groupedRequestIds.has(p.id)) {
      const id = canonicalId(p);
      if (!isSuppressed(id, now, resurfacing)) candidates.push({ id, purpose: 'remember', prayerId: p.id, sourceType: gratitude ? 'thanksgiving' : 'prayer', reason: gratitude ? 'recorded-thanksgiving' : justSave ? 'saved-without-active-tracking' : 'historical-prayer', createdAt: p.created_at, lastUpdatedAt: updates, displayContext: relativeTime(baseCreatedDays, 'You wrote this'), rank: 200 + Math.min(baseCreatedDays, 365) });
    }
  }

  // One purpose per canonical concern. Active response/follow-up wins, then Return, Answer, and history.
  const byIdentity = new Map<string, PrayerIntelligenceCandidate>();
  for (const item of candidates.sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id))) {
    if (!byIdentity.has(item.id)) byIdentity.set(item.id, item);
  }
  const active = [...byIdentity.values()].filter(item => item.purpose === 'return');
  if (active.length > 1) {
    const inactivity = active.map(item => daysSince(now, latest(item.lastPrayedAt, item.lastUpdatedAt))).sort((a, b) => a - b);
    const median = inactivity[Math.floor(inactivity.length / 2)];
    active.forEach(item => {
      const itemInactive = daysSince(now, latest(item.lastPrayedAt, item.lastUpdatedAt));
      if (itemInactive < median && daysSince(now, item.createdAt) > itemInactive) {
        item.purpose = 'check_in'; item.reason = 'long-running-with-low-relative-activity'; item.rank -= 25;
      }
    });
  }
  return [...byIdentity.values()].sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
}

export function selectPrayerIntelligenceCandidate(candidates: PrayerIntelligenceCandidate[], recentIds: string[] = []) {
  if (!candidates.length) return null;
  const unseen = candidates.filter(candidate => !recentIds.includes(candidate.id));
  return (unseen.length ? unseen : candidates)[0];
}

export function answeredPrayerCollection(prayers: PrayerApiEntry[], start: Date, end: Date) {
  const from = start.getTime(); const to = end.getTime();
  const items = getPrayerIntelligenceCandidates(prayers, end).filter(item => item.purpose === 'celebrate' && (validTime(item.answerDate) || 0) >= from && (validTime(item.answerDate) || 0) <= to);
  return { count: items.length, items };
}
