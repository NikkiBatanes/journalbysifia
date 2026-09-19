import type { PrayerApiEntry } from './api/prayerApi';
import { getPrayerIntelligenceCandidates } from './prayerIntelligenceService';
import { isPrayerActive, prayerNeeds, type PrayerAnswer, type PrayerUpdate } from '../utils/prayerTracking';
import type { ReviewType } from '../storage/reviewStorage';

export type PrayerReviewEventType =
  | 'new_prayer' | 'answer_recorded' | 'need_answer_recorded' | 'update'
  | 'let_go' | 'return_to_prayer' | 'request_received' | 'request_prayed_for'
  | 'thanksgiving' | 'still_carrying';

export interface PrayerReviewItem {
  id: string;
  prayerId: string;
  needId?: string;
  requestId?: string;
  eventType: PrayerReviewEventType;
  eventDate: string;
  title: string;
  subtitle: string;
  text?: string;
}

export interface PrayerReviewSummary {
  items: PrayerReviewItem[];
  counts: Partial<Record<PrayerReviewEventType, number>>;
}

const ymd = (value: unknown): string | null => {
  if (typeof value !== 'string') return null;
  const match = value.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : null;
};
const inside = (date: string | null, start: string, end: string) => !!date && date >= start && date <= end;
const line = (value: unknown, fallback = 'Prayer') => {
  const text = typeof value === 'string' ? value.trim().split(/\n+/)[0] : '';
  return text ? (text.length > 60 ? `${text.slice(0, 60).trim()}…` : text) : fallback;
};
const unique = <T extends { id: string }>(items: T[]) => [...new Map(items.map(item => [item.id, item])).values()];
const eventId = (type: PrayerReviewEventType, prayerId: string, date: string, detail?: string) =>
  `prayer-review:${type}:${prayerId}:${detail || ''}:${date}`;

const carryingLimit: Record<ReviewType, number> = {
  weekly: 2, monthly: 3, quarterly: 4, year_end: 5, begin_year: 0,
};

/** Pure, deterministic Review-period derivation. It performs no IO and never mutates Prayer records. */
export function derivePrayerReview(
  prayers: PrayerApiEntry[], periodStart: string, periodEnd: string, reviewType: ReviewType,
): PrayerReviewSummary {
  if (reviewType === 'begin_year') return { items: [], counts: {} };
  const items: PrayerReviewItem[] = [];
  const byId = new Map(prayers.map(prayer => [prayer.id, prayer]));
  const linkedResponseIds = new Set(prayers.map(p => p.metadata?.original_request_id ? p.id : '').filter(Boolean));
  const castNewSessions = new Set<string>();

  const add = (item: PrayerReviewItem) => items.push(item);
  for (const prayer of prayers) {
    const metadata = prayer.metadata || {};
    const requestId = typeof metadata.original_request_id === 'string' ? metadata.original_request_id : undefined;
    const title = line(prayer.person_name || prayer.content, prayer.is_prayer_request ? 'Prayer Request' : 'Prayer');
    const createdDate = ymd(prayer.selected_date) || ymd(prayer.created_at);
    const sessionId = typeof prayer.metadata?.prayer_session_id === 'string' ? prayer.metadata.prayer_session_id : undefined;
    const justSave = prayer.metadata?.track_answered === false && prayer.metadata?.is_active !== true;

    if (prayer.journal_category === 'thanksgiving' && inside(createdDate, periodStart, periodEnd)) {
      add({ id: eventId('thanksgiving', prayer.id, createdDate!), prayerId: prayer.id, eventType: 'thanksgiving', eventDate: createdDate!, title, subtitle: 'What you wrote in Thanksgiving', text: prayer.content });
    }

    // Confession and Adoration are not automatically surfaced. A CAST session contributes
    // at most one new Prayer journey; Thanksgiving remains distinct remembrance material.
    const eligibleNew = prayer.journal_category !== 'confession' && prayer.journal_category !== 'adoration' && prayer.journal_category !== 'thanksgiving';
    const unseenCast = !sessionId || !castNewSessions.has(sessionId);
    if (eligibleNew && unseenCast && !requestId && inside(createdDate, periodStart, periodEnd)) {
      if (sessionId) castNewSessions.add(sessionId);
      const type = prayer.is_prayer_request ? 'request_received' : 'new_prayer';
      add({ id: eventId(type, prayer.id, createdDate!), prayerId: prayer.id, ...(prayer.is_prayer_request ? { requestId: prayer.id } : {}), eventType: type, eventDate: createdDate!, title, subtitle: prayer.is_prayer_request ? 'Prayer Request · Received' : justSave ? 'New in prayer · Saved' : 'New in prayer', text: prayer.content });
    }

    const answers: PrayerAnswer[] = Array.isArray(metadata.answer_history)
      ? metadata.answer_history
      : prayer.answered_date ? [{ id: `legacy-${prayer.id}`, date: prayer.answered_date }] : [];
    for (const answer of answers) {
      const date = ymd(answer.date);
      if (!inside(date, periodStart, periodEnd)) continue;
      add({ id: eventId('answer_recorded', prayer.id, date!, answer.id), prayerId: prayer.id, eventType: 'answer_recorded', eventDate: date!, title, subtitle: 'You recorded an answer', text: answer.note || prayer.content });
    }

    for (const need of prayerNeeds(prayer)) {
      const needAnswers: PrayerAnswer[] = Array.isArray(need.answerHistory)
        ? need.answerHistory : need.answeredDate ? [{ id: `legacy-${need.id}`, date: need.answeredDate, needId: need.id }] : [];
      for (const answer of needAnswers) {
        const date = ymd(answer.date);
        if (!inside(date, periodStart, periodEnd)) continue;
        add({ id: eventId('need_answer_recorded', prayer.id, date!, answer.id || need.id), prayerId: prayer.id, needId: need.id, eventType: 'need_answer_recorded', eventDate: date!, title: line(need.text, 'Prayer Need'), subtitle: 'Prayer Need · You recorded an answer', text: answer.note || need.text });
      }
      for (const event of Array.isArray(need.lifecycleHistory) ? need.lifecycleHistory : []) {
        const date = ymd(event.date);
        if (!inside(date, periodStart, periodEnd)) continue;
        const type = event.action === 'let-go' ? 'let_go' : 'return_to_prayer';
        add({ id: eventId(type, prayer.id, date!, event.id || need.id), prayerId: prayer.id, needId: need.id, eventType: type, eventDate: date!, title: line(need.text, 'Prayer Need'), subtitle: event.action === 'let-go' ? 'Prayer Need · You chose to Let Go' : 'Prayer Need · Returned to prayer', text: need.text });
      }
    }

    for (const event of Array.isArray(metadata.lifecycle_history) ? metadata.lifecycle_history : []) {
      const date = ymd(event.date);
      if (!inside(date, periodStart, periodEnd)) continue;
      const type = event.action === 'let-go' ? 'let_go' : 'return_to_prayer';
      add({ id: eventId(type, prayer.id, date!, event.id), prayerId: prayer.id, eventType: type, eventDate: date!, title, subtitle: event.action === 'let-go' ? 'A prayer you chose to Let Go' : 'Returned to prayer', text: prayer.content });
    }

    const answerKeys = new Set(answers.map(a => `${ymd(a.date)}:${a.needId || ''}`));
    const needAnswerKeys = new Set(prayerNeeds(prayer).flatMap(n => (n.answerHistory || []).map(a => `${ymd(a.date)}:${n.id}`)));
    for (const update of (Array.isArray(metadata.prayer_updates) ? metadata.prayer_updates : []) as PrayerUpdate[]) {
      const date = ymd(update.date);
      if (!inside(date, periodStart, periodEnd) || !update.text?.trim()) continue;
      if (update.kind === 'general-note' && update.text.trim() === 'Saved without active tracking') continue;
      if (update.kind === 'answered' && (answerKeys.has(`${date}:${update.needId || ''}`) || needAnswerKeys.has(`${date}:${update.needId || ''}`))) continue;
      if (!update.kind && /^(let go|returned to prayer)/i.test(update.text.trim())) continue;
      add({ id: eventId('update', prayer.id, date!, update.id), prayerId: prayer.id, needId: update.needId, eventType: 'update', eventDate: date!, title: update.needId ? line(prayerNeeds(prayer).find(n => n.id === update.needId)?.text, title) : title, subtitle: 'Something changed', text: update.text.trim() });
    }

    // A linked response is the reliable relationship boundary for "prayed for".
    if (requestId && byId.has(requestId)) {
      const prayedDate = ymd(prayer.last_prayed_at) || createdDate;
      if (inside(prayedDate, periodStart, periodEnd)) {
        const request = byId.get(requestId)!;
        add({ id: eventId('request_prayed_for', requestId, prayedDate!, prayer.id), prayerId: prayer.id, requestId, eventType: 'request_prayed_for', eventDate: prayedDate!, title: line(request.person_name || request.content, 'Prayer Request'), subtitle: 'You prayed for this request', text: request.content });
      }
    }
  }

  // Reuse Phase 2A's deterministic ranking for a deliberately small carry-forward set.
  const carryCandidates = getPrayerIntelligenceCandidates(prayers, new Date(`${periodEnd}T23:59:59.999Z`))
    .filter(candidate => ['return', 'check_in', 'follow_up'].includes(candidate.purpose))
    .sort((a, b) => b.rank - a.rank || a.id.localeCompare(b.id));
  const seenJourneys = new Set<string>();
  for (const candidate of carryCandidates) {
    if (seenJourneys.size >= carryingLimit[reviewType]) break;
    const prayer = byId.get(candidate.prayerId);
    if (!prayer || !isPrayerActive(prayer) || linkedResponseIds.has(prayer.id)) continue;
    const journeyId = (prayer.metadata?.original_request_id as string | undefined) || prayer.id;
    if (seenJourneys.has(journeyId)) continue;
    seenJourneys.add(journeyId);
    const need = candidate.needId ? prayerNeeds(prayer).find(n => n.id === candidate.needId) : undefined;
    add({ id: eventId('still_carrying', prayer.id, periodEnd, candidate.needId), prayerId: prayer.id, needId: candidate.needId, eventType: 'still_carrying', eventDate: periodEnd, title: line(need?.text || prayer.person_name || prayer.content), subtitle: need ? 'Prayer Need · Still carrying' : 'Still carrying', text: need?.text || prayer.content });
  }

  const result = unique(items).sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id.localeCompare(b.id));
  return { items: result, counts: result.reduce<PrayerReviewSummary['counts']>((counts, item) => ({ ...counts, [item.eventType]: (counts[item.eventType] || 0) + 1 }), {}) };
}
