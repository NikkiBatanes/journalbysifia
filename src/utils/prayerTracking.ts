import type { PrayerApiEntry } from '../services/api/prayerApi';

export type PrayerAnswer = { id: string; date: string; note?: string; needId?: string };
export type PrayerLifecycleEntry = { id: string; date: string; action: 'let-go' | 'return'; needId?: string };
export type PrayerNeed = { id: string; text: string; status: 'pending' | 'answered' | 'closed'; answeredDate?: string; expectedDate?: string; topic?: string; active?: boolean; answerHistory?: PrayerAnswer[]; lifecycleHistory?: PrayerLifecycleEntry[] };
export type PrayerUpdateKind = 'still-praying' | 'answered' | 'situation-changed' | 'general-note';
export type PrayerUpdate = { id: string; text: string; date: string; needId?: string; kind?: PrayerUpdateKind; status?: PrayerNeed['status'] };
export const prayerNeeds = (p: PrayerApiEntry): PrayerNeed[] => Array.isArray(p.metadata?.prayer_needs) ? (p.metadata?.prayer_needs ?? []) : [];
const eventId = (date: string) => `${date}-${Math.random().toString(36).slice(2, 8)}`;
export const answerHistory = (p: PrayerApiEntry): PrayerAnswer[] => Array.isArray(p.metadata?.answer_history) ? p.metadata!.answer_history : p.answered_date || p.status === 'answered' || p.is_answered ? [{ id: `legacy-${p.answered_date || p.id}`, date: p.answered_date || p.updated_at || p.created_at }] : [];
export const needHasAnswer = (need: PrayerNeed) => !!need.answeredDate || need.status === 'answered' || !!need.answerHistory?.length;
export const hasAnswerHistory = (p: PrayerApiEntry) => answerHistory(p).length > 0 || prayerNeeds(p).some(needHasAnswer);
export const isTrackedPrayer = (p: PrayerApiEntry) => p.metadata?.track_answered !== false && (p.is_prayer_request === true || p.prayer_type === 'people' || p.journal_category === 'supplication' || p.journal_category === 'personal_prayer' || p.metadata?.prayer_style === 'open' || p.metadata?.prayer_need === true);
export const isNeedActive = (need: PrayerNeed) => need.active ?? need.status === 'pending';
export const isPrayerActive = (p: PrayerApiEntry) => {
  if (!isTrackedPrayer(p) || p.metadata?.tracking_status === 'closed') return false;
  const needs = prayerNeeds(p);
  if (needs.length) return needs.some(isNeedActive);
  if (typeof p.metadata?.is_active === 'boolean') return p.metadata.is_active;
  return p.status !== 'answered' && !p.is_answered;
};
export const isPrayerLetGo = (p: PrayerApiEntry) => p.metadata?.tracking_status === 'closed' || (prayerNeeds(p).length > 0 && prayerNeeds(p).every(n => !isNeedActive(n) && !needHasAnswer(n)));
export const trackingStatus = (p: PrayerApiEntry): PrayerNeed['status'] => isPrayerActive(p) ? 'pending' : hasAnswerHistory(p) ? 'answered' : isPrayerLetGo(p) ? 'closed' : 'pending';

export const answerPrayer = (p: PrayerApiEntry, needId?: string, date = new Date().toISOString(), note?: string, continuePraying = false) => {
  const needs = prayerNeeds(p);
  const selected = needId ? needs.find(n => n.id === needId) : needs.length === 1 ? needs[0] : undefined;
  if (needs.length > 1 && !selected) throw new Error('Choose a specific prayer need.');
  const answer: PrayerAnswer = { id: eventId(date), date, ...(note?.trim() ? { note: note.trim() } : {}), ...(selected ? { needId: selected.id } : {}) };
  const nextNeeds = needs.map(n => n.id === selected?.id ? { ...n, status: 'answered' as const, active: continuePraying, answeredDate: n.answeredDate || date, answerHistory: [...(n.answerHistory || []), answer] } : n);
  const history = [...answerHistory(p), ...(!selected ? [answer] : [])];
  const active = selected ? nextNeeds.some(isNeedActive) : continuePraying;
  return {
    status: 'answered' as const,
    answered_date: p.answered_date || date,
    metadata: { ...p.metadata, track_answered: true, is_active: active, tracking_status: active ? 'pending' : 'answered', answer_history: history, prayer_needs: nextNeeds, prayer_updates: [...(p.metadata?.prayer_updates || []), { id: eventId(date), date, text: note?.trim() || 'Recorded an answer', kind: 'answered' as const, status: 'answered' as const, needId: selected?.id }] },
  };
};

export const continuePrayer = (p: PrayerApiEntry, needId?: string, date = new Date().toISOString()) => {
  const nextNeeds = prayerNeeds(p).map(n => !needId || n.id === needId ? { ...n, active: true, status: n.status === 'closed' ? 'pending' as const : n.status } : n);
  return { status: hasAnswerHistory(p) ? 'answered' as const : 'pending' as const, answered_date: p.answered_date || null, metadata: { ...p.metadata, track_answered: true, is_active: true, tracking_status: 'pending', prayer_needs: nextNeeds, prayer_updates: [...(p.metadata?.prayer_updates || []), { id: eventId(date), date, text: 'Still praying', kind: 'still-praying' as const, needId }] } };
};

export const releasePrayer = (p: PrayerApiEntry, date = new Date().toISOString()) => {
  const returning = isPrayerLetGo(p);
  const nextStatus = returning ? 'pending' as const : 'closed' as const;
  const action: PrayerLifecycleEntry['action'] = returning ? 'return' : 'let-go';
  const nextNeeds = prayerNeeds(p).map(need =>
    needHasAnswer(need)
      ? need
      : {...need, status: nextStatus, active: returning, lifecycleHistory: [...(need.lifecycleHistory || []), { id: eventId(date), date, action, needId: need.id }]},
  );
  return {
    status: hasAnswerHistory(p) ? 'answered' as const : 'pending' as const,
    answered_date: p.answered_date || null,
    metadata: {
      ...p.metadata,
      track_answered: true,
      is_active: returning,
      tracking_status: nextStatus,
      prayer_needs: nextNeeds,
      lifecycle_history: [...(p.metadata?.lifecycle_history || []), { id: eventId(date), date, action }],
      prayer_updates: [
        ...(p.metadata?.prayer_updates || []),
        {
          id: `${date}-${Math.random().toString(36).slice(2, 8)}`,
          date,
          text: returning ? 'Returned to prayer' : 'Let go of this prayer',
          status: nextStatus,
        },
      ],
    },
  };
};

export const describePrayerUpdate = (p: PrayerApiEntry, text: string, kind: PrayerUpdateKind, needId?: string, date = new Date().toISOString(), continuePraying = false) => {
  if (kind === 'answered') return { content: p.content, person_name: p.person_name, ...answerPrayer(p, needId, date, text, continuePraying) };
  if (kind === 'still-praying') {
    const continued = continuePrayer(p, needId, date);
    return { content: p.content, person_name: p.person_name, ...continued, metadata: { ...continued.metadata, prayer_updates: [...(p.metadata?.prayer_updates || []), { id: eventId(date), text: text.trim(), date, kind, needId }] } };
  }
  return { content: p.content, person_name: p.person_name, status: hasAnswerHistory(p) ? 'answered' as const : 'pending' as const, answered_date: p.answered_date || null, metadata: { ...p.metadata, prayer_updates: [...(p.metadata?.prayer_updates || []), { id: eventId(date), text: text.trim(), date, kind, needId }] } };
};
