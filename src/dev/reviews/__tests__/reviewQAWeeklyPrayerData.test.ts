import {
  buildPrayerV2DemoFixtures,
  PRAYER_V2_DEMO_NEED_TOPICS,
} from '../../prayerV2DemoFixtures';
import {prayerNeeds} from '../../../utils/prayerTracking';
import {derivePrayerReview} from '../../../services/prayerReviewService';
import {reviewQAReferenceDate} from '../reviewQAClock';
import {buildWeeklyReviewQAPrayerFixtures} from '../reviewQAWeeklyPrayerData';

const collectDatedStrings = (value: unknown): string[] => {
  if (typeof value === 'string') {return /^\d{4}-\d{2}-\d{2}/.test(value) ? [value] : [];}
  if (Array.isArray(value)) {return value.flatMap(collectDatedStrings);}
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => [
      ...collectDatedStrings(key),
      ...collectDatedStrings(item),
    ]);
  }
  return [];
};

describe('Weekly Review QA Prayer V2 data', () => {
  it('moves every Prayer V2 fixture into the September 21–27 review week', () => {
    const source = buildPrayerV2DemoFixtures(reviewQAReferenceDate());
    const fixtures = buildWeeklyReviewQAPrayerFixtures();

    expect(fixtures).toHaveLength(source.length);
    expect(fixtures).toHaveLength(49);
    expect(fixtures.every(item => item.id.startsWith('dev-review-v2:weekly:prayer-v2:'))).toBe(true);
    expect(new Set(fixtures.map(item => item.selected_date))).toEqual(new Set([
      '2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24',
      '2026-09-25', '2026-09-26', '2026-09-27',
    ]));
    expect(collectDatedStrings(fixtures).every(value => {
      const date = value.slice(0, 10);
      return date >= '2026-09-21' && date <= '2026-09-27';
    })).toBe(true);
    expect(JSON.stringify(fixtures)).not.toContain('dev-prayer-v2-');
    expect(JSON.stringify(fixtures)).not.toContain('dev-need-v2-');
  });

  it('preserves linked requests, CAST sessions, source prayers, and every Prayer Need topic', () => {
    const fixtures = buildWeeklyReviewQAPrayerFixtures();
    const linked = fixtures.filter(item => !!item.metadata?.original_request_id);
    expect(linked.every(item => fixtures.some(request => request.id === item.metadata?.original_request_id))).toBe(true);
    expect(new Set(fixtures.filter(item => item.metadata?.prayer_style === 'cast').map(item => item.metadata?.prayer_session_id)).size).toBe(2);
    expect(fixtures.some(item => item.metadata?.source === 'bible_study')).toBe(true);
    expect(fixtures.some(item => item.metadata?.source === 'playbook')).toBe(true);
    expect(fixtures.some(item => item.metadata?.source === 'devotional')).toBe(true);
    expect(new Set(fixtures.flatMap(item => prayerNeeds(item).map(need => need.topic)).filter(Boolean))).toEqual(new Set(PRAYER_V2_DEMO_NEED_TOPICS));
  });

  it('surfaces the complete Prayer event vocabulary in Weekly Review capture', () => {
    const review = derivePrayerReview(
      buildWeeklyReviewQAPrayerFixtures(),
      '2026-09-21',
      '2026-09-27',
      'weekly',
    );
    expect([...new Set(review.items.map(item => item.eventType))]).toEqual(expect.arrayContaining([
      'new_prayer',
      'answer_recorded',
      'need_answer_recorded',
      'update',
      'let_go',
      'request_received',
      'request_prayed_for',
      'thanksgiving',
      'still_carrying',
    ]));
  });
});
