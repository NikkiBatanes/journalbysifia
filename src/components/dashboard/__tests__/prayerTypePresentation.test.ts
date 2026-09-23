import { buildPrayerV2DemoFixtures, PRAYER_V2_DEMO_NEED_TOPICS, PRAYER_V2_DEMO_PREFIX } from '../../../dev/prayerV2DemoFixtures';
import { getPrayerCandidateDateLabel, getPrayerRequestJourneyPresentation, getPrayerTypePresentation } from '../prayerTypePresentation';
import { prayerNeeds } from '../../../utils/prayerTracking';

const fixtures = buildPrayerV2DemoFixtures(new Date('2026-09-20T12:00:00.000Z'));
const byId = (suffix: string) => fixtures.find(item => item.id === `${PRAYER_V2_DEMO_PREFIX}${suffix}`)!;

describe('canonical Prayer type presentation', () => {
  it.each([
    ['return', 'Open Prayer'],
    ['cast-supplication', 'CAST · Supplication'],
    ['request-charles-response', 'Prayer for Someone · Charles'],
    ['bible-study', 'Bible Study Prayer · James 1:2–8'],
    ['playbook', 'Playbook Prayer · A Courageous Conversation'],
    ['devotional', 'Devotional Prayer · Trusting What Does Not Change'],
  ])('labels %s as %s', (suffix, expected) => {
    expect(getPrayerTypePresentation(byId(suffix)).label).toBe(expected);
  });

  it('distinguishes a Prayer for Someone and a selected Need from its parent Prayer', () => {
    const mixed = byId('mixed-needs');
    expect(getPrayerTypePresentation(mixed).label).toBe('Prayer for Someone · Greg');
    const health = prayerNeeds(mixed).find(item => item.topic === 'Health')!;
    const presentedNeed = getPrayerTypePresentation(mixed, health);
    expect(presentedNeed).toMatchObject({ label: 'Prayer Need · Health', secondaryContext: 'From: Prayer for Greg', content: health.text });
  });

  it('uses request context and keeps unknown historical records understandable', () => {
    expect(getPrayerTypePresentation(byId('request-charles')).label).toBe('Prayer Request · Charles');
    expect(getPrayerTypePresentation({ ...byId('remember'), metadata: {}, journal_category: undefined }).label).toBe('Prayer');
  });

  it('identifies an Open Prayer created by a Weekly Review', () => {
    const weeklyPrayer = {
      ...byId('return'),
      journal_category: 'personal_prayer' as const,
      metadata: {...byId('return').metadata, prayer_style: 'open', source: 'weekly_review'},
    };
    expect(getPrayerTypePresentation(weeklyPrayer)).toMatchObject({
      label: 'Weekly · Open Prayer',
      detailLabel: 'Weekly Open Prayer',
      originLabel: 'From your Weekly Review',
    });
  });

  it('distinguishes an incoming Request from its prayed linked Prayer', () => {
    const request = byId('request-unprayed');
    const linked = byId('request-charles-response');
    expect(getPrayerRequestJourneyPresentation(request).state).toBe('request');
    expect(getPrayerRequestJourneyPresentation(request).content).toBe(request.content);
    const charlesRequest = byId('request-charles');
    const journey = getPrayerRequestJourneyPresentation(linked, charlesRequest, linked);
    expect(journey).toMatchObject({ state: 'prayed_for', origin: 'Prayer Request', subject: 'Charles', content: linked.content });
    expect(getPrayerTypePresentation(linked)).toMatchObject({ label: 'Prayer for Someone · Charles', detailLabel: 'Prayer for Someone', originLabel: 'Prayer Request', requestContext: charlesRequest.content });
  });

  it('retains Answered and Let Go as current journey states with Request origin', () => {
    const request = byId('request-charles');
    const linked = byId('request-charles-response');
    const answered = { ...linked, status: 'answered' as const, answered_date: '2026-09-10', metadata: { ...linked.metadata, answer_history: [{ id: 'a1', date: '2026-09-10' }] } };
    expect(getPrayerRequestJourneyPresentation(answered, request, answered).state).toBe('answered');
    const letGo = { ...linked, metadata: { ...linked.metadata, tracking_status: 'closed', is_active: false } };
    expect(getPrayerRequestJourneyPresentation(letGo, request, letGo).state).toBe('let_go');
    expect(getPrayerRequestJourneyPresentation(letGo, request, letGo).origin).toBe('Prayer Request');
  });

  it('resolves every realistic fixture type and all seven actual Need categories', () => {
    expect(getPrayerTypePresentation(byId('cast-confession')).label).toBe('CAST · Confession');
    expect(getPrayerTypePresentation(byId('cast-adoration')).label).toBe('CAST · Adoration');
    expect(getPrayerTypePresentation(byId('cast-supplication')).label).toBe('CAST · Supplication');
    expect(getPrayerTypePresentation(byId('cast-thanksgiving')).label).toBe('CAST · Thanksgiving');
    const suffixByTopic = { Provision: 'provision', School: 'school', Relationships: 'relationships', 'Work & business': 'work', Health: 'health', Guidance: 'guidance', Other: 'other' } as const;
    const labels = PRAYER_V2_DEMO_NEED_TOPICS.map(topic => {
      const prayer = byId(`needs-${suffixByTopic[topic]}`);
      const need = prayerNeeds(prayer).find(item => item.topic === topic && item.active === true)!;
      return getPrayerTypePresentation(prayer, need).label;
    });
    expect(labels).toEqual(PRAYER_V2_DEMO_NEED_TOPICS.map(topic => `Prayer Need · ${topic}`));
  });

  it('uses the event-specific actual date on Today cards', () => {
    const reference = new Date('2026-09-20T12:00:00');
    const candidateFor = (purpose: 'return' | 'check_in' | 'follow_up' | 'remember' | 'celebrate', prayer: any, extra = {}) => ({
      id: prayer.id, purpose, prayerId: prayer.id, sourceType: prayer.is_prayer_request || prayer.metadata?.original_request_id ? 'request' : 'prayer',
      reason: 'test', createdAt: prayer.created_at, displayContext: 'legacy raw day count', rank: 1, ...extra,
    } as any);
    const returning = byId('return');
    expect(getPrayerCandidateDateLabel(candidateFor('return', returning, { lastPrayedAt: returning.last_prayed_at }), returning, undefined, undefined, reference))
      .toBe('Last prayed September 2, 2026 · 2 weeks ago');

    const checkIn = byId('check-in');
    expect(getPrayerCandidateDateLabel(candidateFor('check_in', checkIn, { lastPrayedAt: checkIn.last_prayed_at }), checkIn, undefined, undefined, reference))
      .toBe('Last prayed September 13, 2026 · 1 week ago');

    const request = byId('request-unprayed');
    const requestCandidate = candidateFor('follow_up', request);
    expect(getPrayerCandidateDateLabel(requestCandidate, request, getPrayerRequestJourneyPresentation(request), undefined, reference))
      .toBe('Saved September 14, 2026 · 6 days ago');

    const response = byId('request-prayed-response');
    const requestOrigin = byId('request-prayed');
    const responseCandidate = candidateFor('follow_up', response, { lastPrayedAt: response.last_prayed_at });
    expect(getPrayerCandidateDateLabel(responseCandidate, response, getPrayerRequestJourneyPresentation(response, requestOrigin, response), undefined, reference))
      .toBe('Prayed September 1, 2026 · 2 weeks ago');

    const remembered = byId('remember');
    expect(getPrayerCandidateDateLabel(candidateFor('remember', remembered), remembered, undefined, undefined, reference))
      .toBe('Written August 4, 2026 · 1 month ago');

    const answered = byId('one-answer');
    expect(getPrayerCandidateDateLabel(candidateFor('celebrate', answered, { answerDate: answered.metadata?.answer_history?.[0]?.date }), answered, undefined, undefined, reference))
      .toBe('Answer recorded September 12, 2026 · 1 week ago');

    const letGo = byId('let-go');
    expect(getPrayerCandidateDateLabel(candidateFor('follow_up', letGo), letGo, getPrayerRequestJourneyPresentation(letGo), undefined, reference))
      .toBe('Let go September 6, 2026 · 2 weeks ago');
  });

  it('does not invent a Need age from its parent Prayer creation date', () => {
    const prayer = byId('needs-health');
    const need = prayerNeeds(prayer).find(item => item.topic === 'Health' && item.status === 'pending')!;
    const candidate = { id: need.id, purpose: 'return', prayerId: prayer.id, needId: need.id, sourceType: 'need', reason: 'test', createdAt: prayer.created_at, displayContext: 'old', rank: 1 } as any;
    expect(getPrayerCandidateDateLabel(candidate, prayer, undefined, need, new Date('2026-09-20T12:00:00'))).toBe('Ready to pray');
  });
});
