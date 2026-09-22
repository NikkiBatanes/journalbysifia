import { buildPrayerV2DemoFixtures, fixturesForScenario, PRAYER_V2_DEMO_NEED_TOPICS, PRAYER_V2_DEMO_PREFIX } from '../prayerV2DemoFixtures';
import { getPrayerIntelligenceCandidates } from '../../services/prayerIntelligenceService';
import { derivePrayerReview } from '../../services/prayerReviewService';
import { hasAnswerHistory, isPrayerActive, isPrayerLetGo, prayerNeeds } from '../../utils/prayerTracking';

const reference = new Date('2026-09-20T12:00:00.000Z');

describe('Prayer V2 demo fixtures', () => {
  it('uses stable namespaced IDs and deterministic relative dates', () => {
    const fixtures = buildPrayerV2DemoFixtures(reference);
    expect(fixtures.length).toBeGreaterThanOrEqual(20);
    expect(fixtures.every(item => item.id.startsWith(PRAYER_V2_DEMO_PREFIX))).toBe(true);
    expect(fixtures.find(item => item.id.endsWith('return'))).toMatchObject({ selected_date: '2026-07-02', last_prayed_at: '2026-09-02T04:00:00.000Z' });
    expect(fixtures.find(item => item.id.endsWith('remember'))?.selected_date).toBe('2026-08-04');
    expect(fixturesForScenario('celebrate', reference)).toHaveLength(1);
    expect(fixturesForScenario('cast', reference)).toHaveLength(4);
  });

  it('offers every Phase 2A purpose without changing intelligence rules', () => {
    const fixtures = buildPrayerV2DemoFixtures(reference);
    const candidates = getPrayerIntelligenceCandidates(fixtures, reference);
    expect(new Set(candidates.map(item => item.purpose))).toEqual(new Set(['return', 'check_in', 'follow_up', 'remember', 'celebrate']));
    for (const purpose of ['return', 'check_in', 'follow_up', 'remember', 'celebrate'] as const) {
      expect(fixtures.some(fixture => fixture.expectedToday === purpose && candidates.some(candidate => candidate.prayerId === fixture.id && candidate.purpose === purpose))).toBe(true);
    }
    expect(candidates.some(item => item.prayerId.endsWith('recent-active'))).toBe(false);
    expect(candidates.some(item => item.prayerId.endsWith('old-recent'))).toBe(false);
  });

  it('exercises Phase 2B events and cross-period answers', () => {
    const fixtures = buildPrayerV2DemoFixtures(reference);
    const yearly = derivePrayerReview(fixtures, '2026-01-01', '2026-12-31', 'year_end');
    expect(yearly.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ eventType: 'new_prayer' }),
      expect.objectContaining({ eventType: 'answer_recorded' }),
      expect.objectContaining({ eventType: 'need_answer_recorded' }),
      expect.objectContaining({ eventType: 'request_prayed_for' }),
      expect.objectContaining({ eventType: 'thanksgiving' }),
      expect.objectContaining({ eventType: 'still_carrying' }),
      expect.objectContaining({ eventType: 'let_go' }),
    ]));
    const recent = derivePrayerReview(fixtures, '2026-09-01', '2026-09-30', 'monthly');
    expect(recent.items).toEqual(expect.arrayContaining([expect.objectContaining({ prayerId: `${PRAYER_V2_DEMO_PREFIX}multiple-answers`, eventType: 'answer_recorded', eventDate: '2026-09-02' })]));
  });

  it('conforms to the frozen lifecycle predicates', () => {
    const fixtures = buildPrayerV2DemoFixtures(reference);
    const find = (suffix: string) => fixtures.find(item => item.id.endsWith(suffix))!;
    expect(isPrayerActive(find('remember'))).toBe(false);
    expect(isPrayerActive(find('answered-active'))).toBe(true);
    expect(hasAnswerHistory(find('answered-active'))).toBe(true);
    expect(isPrayerLetGo(find('let-go'))).toBe(true);
    expect(isPrayerActive(find('let-go'))).toBe(false);
    expect(prayerNeeds(find('mixed-needs')).map(need => [need.status, need.active])).toEqual([
      ['answered', false], ['pending', true], ['closed', false],
    ]);
  });

  it('provides a lived-in dataset without placeholder Prayer content', () => {
    const fixtures = buildPrayerV2DemoFixtures(reference);
    const journeys = new Set(fixtures.map(item => item.metadata?.prayer_session_id || item.metadata?.original_request_id || item.id));
    expect(journeys.size).toBeGreaterThanOrEqual(30);
    expect(journeys.size).toBeLessThanOrEqual(50);
    expect(fixtures.filter(item => item.metadata?.prayer_style === 'open').length).toBeGreaterThanOrEqual(4);
    expect(fixtures.some(item => item.content.length > 500)).toBe(true);
    expect(fixtures.some(item => item.content.length < 200)).toBe(true);
    expect(fixtures.filter(item => item.prayer_type === 'people' && !item.is_prayer_request).every(item => !!item.person_name && item.content.length > 120)).toBe(true);
  });

  it('contains two complete CAST sessions with only Supplication tracked', () => {
    const cast = buildPrayerV2DemoFixtures(reference).filter(item => item.metadata?.prayer_style === 'cast' && item.metadata?.prayer_session_id?.includes('cast-session'));
    const sessions = [...new Set(cast.map(item => item.metadata?.prayer_session_id))];
    expect(sessions).toHaveLength(2);
    for (const session of sessions) {
      const entries = cast.filter(item => item.metadata?.prayer_session_id === session);
      expect(new Set(entries.map(item => item.journal_category))).toEqual(new Set(['confession', 'adoration', 'supplication', 'thanksgiving']));
      expect(entries.every(item => item.content.length > 100)).toBe(true);
      expect(entries.filter(item => item.metadata?.track_answered === true).map(item => item.journal_category)).toEqual(['supplication']);
    }
  });

  it('covers every production Prayer Need topic with active and answered examples', () => {
    const needs = buildPrayerV2DemoFixtures(reference).flatMap(item => prayerNeeds(item));
    for (const topic of PRAYER_V2_DEMO_NEED_TOPICS) {
      const topicNeeds = needs.filter(need => (need as typeof need & { topic?: string }).topic === topic);
      expect(topicNeeds.length).toBeGreaterThanOrEqual(2);
      expect(topicNeeds.some(need => need.status === 'pending' && need.active !== false)).toBe(true);
      expect(topicNeeds.some(need => need.status === 'answered' && (need.answerHistory?.length || 0) > 0)).toBe(true);
    }
  });

  it('includes realistic request-only and linked Request journeys', () => {
    const fixtures = buildPrayerV2DemoFixtures(reference);
    const unprayed = fixtures.filter(item => item.is_prayer_request && !item.prayed);
    const linked = fixtures.filter(item => !!item.metadata?.original_request_id);
    expect(unprayed.length).toBeGreaterThanOrEqual(3);
    expect(new Set(unprayed.map(item => item.person_name)).size).toBeGreaterThanOrEqual(3);
    expect(linked.length).toBeGreaterThanOrEqual(3);
    expect(linked.every(item => fixtures.some(request => request.id === item.metadata?.original_request_id && request.is_prayer_request))).toBe(true);
    expect(linked.some(item => item.metadata?.prayer_updates?.some((update: any) => update.kind === 'situation-changed'))).toBe(true);
  });

  it('preserves answer, Let Go, Bible Study, and legacy source contracts', () => {
    const fixtures = buildPrayerV2DemoFixtures(reference);
    expect(fixtures.some(item => item.metadata?.answer_history?.some((entry: any) => entry.note.length > 30))).toBe(true);
    expect(fixtures.some(item => item.metadata?.answer_history?.length > 1)).toBe(true);
    expect(fixtures.some(item => item.metadata?.answer_history?.length && isPrayerActive(item))).toBe(true);
    expect(fixtures.some(item => isPrayerLetGo(item))).toBe(true);
    expect(fixtures.some(item => item.metadata?.source === 'bible_study' && item.metadata?.bibleStudySessionId)).toBe(true);
    expect(fixtures.some(item => item.metadata?.source === 'playbook' && item.metadata?.playbook_id && item.metadata?.step_id)).toBe(true);
    expect(fixtures.some(item => item.metadata?.source === 'devotional' && item.metadata?.devotional_id)).toBe(true);
  });
});
