import type { PrayerApiEntry } from '../services/api/prayerApi';
import type { PrayerHomeEntry } from '../components/journal/PrayerCard';
const CAST_ORDER = ['confession', 'adoration', 'supplication', 'thanksgiving'];

export const groupPrayerEntries = (prayers: PrayerApiEntry[]): PrayerHomeEntry[] => {
  const sessions = new Map<string, PrayerApiEntry[]>();
  const ungrouped: PrayerHomeEntry[] = [];

  prayers.forEach((prayer) => {
    // siFia keeps fulfilled requests in storage but displays their saved prayer instead.
    if (prayer.is_prayer_request === true && prayer.prayed === true) return;
    const sessionId = prayer.metadata?.prayer_session_id;
    if (prayer.metadata?.prayer_style === 'cast' && sessionId) {
      sessions.set(sessionId, [...(sessions.get(sessionId) || []), prayer]);
    } else {
      ungrouped.push(prayer);
    }
  });

  sessions.forEach((entries, sessionId) => {
    const sorted = [...entries].sort(
      (a, b) => CAST_ORDER.indexOf(a.journal_category || '') - CAST_ORDER.indexOf(b.journal_category || '')
        || (b.updated_at || b.created_at).localeCompare(a.updated_at || a.created_at)
        || b.created_at.localeCompare(a.created_at)
    );
    const supplication = sorted.find((entry) => entry.journal_category === 'supplication');
    const representative = supplication || sorted[0];
    ungrouped.push({
      ...representative,
      id: `cast-${sessionId}`,
      content: sorted
        .map((entry) => `${entry.journal_category?.toUpperCase()}\n${entry.content}`)
        .join('\n\n'),
      created_at: sorted[0]?.created_at || representative.created_at,
      metadata: { ...representative.metadata, prayer_style: 'cast', prayer_session_id: sessionId },
      groupedEntries: sorted,
    });
  });

  return ungrouped.sort((a, b) => b.created_at.localeCompare(a.created_at));
};


export const prayerMomentType = (p: PrayerHomeEntry): string => {
  if (p.metadata?.prayer_need) return 'Prayer Need';
  if (p.is_prayer_request) return 'Prayer Request';
  if (p.prayer_type === 'people') return 'Prayed For';
  if (p.metadata?.prayer_style === 'cast' || p.groupedEntries) return 'CAST Prayer';
  return 'Open Prayer';
};
