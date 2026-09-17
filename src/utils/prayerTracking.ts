import type { PrayerApiEntry } from '../services/api/prayerApi';

export type PrayerNeed = { id: string; text: string; status: 'pending' | 'answered' | 'closed'; answeredDate?: string; expectedDate?: string; topic?: string };
export type PrayerUpdateKind = 'still-praying' | 'answered' | 'situation-changed';
export type PrayerUpdate = { id: string; text: string; date: string; needId?: string; kind?: PrayerUpdateKind; status?: PrayerNeed['status'] };
export const isTrackedPrayer = (p: PrayerApiEntry) => p.metadata?.track_answered !== false && (p.is_prayer_request === true || p.prayer_type === 'people' || p.journal_category === 'supplication' || p.journal_category === 'personal_prayer' || p.metadata?.prayer_style === 'open' || p.metadata?.prayer_need === true);
export const prayerNeeds = (p: PrayerApiEntry): PrayerNeed[] => Array.isArray(p.metadata?.prayer_needs) ? (p.metadata?.prayer_needs ?? []) : [];
export const trackingStatus = (p: PrayerApiEntry): PrayerNeed['status'] => {
  const needs = prayerNeeds(p);
  if (needs.length) return needs.some(n => n.status === 'pending') ? 'pending' : needs.every(n => n.status === 'answered') ? 'answered' : 'closed';
  return p.metadata?.tracking_status === 'closed' ? 'closed' : p.status === 'answered' || p.is_answered ? 'answered' : 'pending';
};

export const answerPrayer = (p: PrayerApiEntry, needId?: string, date = new Date().toISOString()) => {
  const needs = prayerNeeds(p);
  const selected = needId ? needs.find(n => n.id === needId) : needs.length === 1 ? needs[0] : undefined;
  if (needs.length > 1 && !selected) throw new Error('Choose a specific prayer need.');
  const answered = selected ? selected.status !== 'answered' : trackingStatus(p) !== 'answered';
  const nextNeeds = needs.map(n => n.id === selected?.id ? { ...n, status: answered ? 'answered' as const : 'pending' as const, answeredDate: answered ? date : undefined } : n);
  const status = nextNeeds.length ? nextNeeds.some(n => n.status === 'pending') ? 'pending' : nextNeeds.every(n => n.status === 'answered') ? 'answered' : 'closed' : answered ? 'answered' : 'pending';
  return {
    status: status === 'answered' ? 'answered' as const : 'pending' as const,
    answered_date: status === 'answered' ? date : null,
    metadata: { ...p.metadata, track_answered: true, tracking_status: status, prayer_needs: nextNeeds, prayer_updates: [...(p.metadata?.prayer_updates || []), { id: `${date}-${Math.random().toString(36).slice(2, 8)}`, date, text: answered ? 'Marked answered' : 'Still praying', status: answered ? 'answered' : 'pending', needId: selected?.id }] },
  };
};

export const releasePrayer = (p: PrayerApiEntry, date = new Date().toISOString()) => {
  const released = trackingStatus(p) !== 'closed';
  const nextStatus = released ? 'closed' as const : 'pending' as const;
  const nextNeeds = prayerNeeds(p).map(need =>
    need.status === 'answered'
      ? need
      : {...need, status: nextStatus, answeredDate: undefined},
  );
  return {
    status: 'pending' as const,
    answered_date: null,
    metadata: {
      ...p.metadata,
      track_answered: true,
      tracking_status: nextStatus,
      prayer_needs: nextNeeds,
      prayer_updates: [
        ...(p.metadata?.prayer_updates || []),
        {
          id: `${date}-${Math.random().toString(36).slice(2, 8)}`,
          date,
          text: released ? 'Let go of this prayer' : 'Returned to prayer',
          status: nextStatus,
        },
      ],
    },
  };
};

export const describePrayerUpdate = (p: PrayerApiEntry, text: string, kind: PrayerUpdateKind, needId?: string, date = new Date().toISOString()) => {
  const needs = prayerNeeds(p);
  const selected = needId ? needs.find(n => n.id === needId) : needs.length === 1 ? needs[0] : undefined;
  if (kind === 'answered' && needs.length > 1 && !selected) throw new Error('Choose which need God answered.');
  const nextNeeds = needs.map(n => selected?.id === n.id && kind !== 'situation-changed' ? { ...n, status: kind === 'answered' ? 'answered' as const : 'pending' as const, answeredDate: kind === 'answered' ? n.answeredDate || date : undefined } : n);
  const nextStatus = kind === 'situation-changed' ? trackingStatus(p) : nextNeeds.length ? trackingStatus({ ...p, metadata: { ...p.metadata, prayer_needs: nextNeeds } }) : kind === 'answered' ? 'answered' : 'pending';
  return { content: p.content, person_name: p.person_name, status: nextStatus === 'answered' ? 'answered' as const : 'pending' as const, answered_date: nextStatus === 'answered' ? p.answered_date || date : null, metadata: { ...p.metadata, ...(kind !== 'situation-changed' ? { track_answered: true } : {}), tracking_status: nextStatus, prayer_needs: nextNeeds, prayer_updates: [...(p.metadata?.prayer_updates || []), { id: `${date}-${Math.random().toString(36).slice(2, 8)}`, text: text.trim(), date, kind, needId: selected?.id }] } };
};
