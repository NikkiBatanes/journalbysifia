import { buildMomentTimeline } from '../momentTimelineService';
import { devotionalPonder, devotionalReflection, playbookReflection, sifiaGuided, sifiaThought } from '../../compatibility/__fixtures__/sifiaPersistedRecords';

describe('siFia compatibility records in canonical Moments', () => {
  it('discovers, searches, reopens, and preserves same-date reflection identities', () => {
    const reflections = [sifiaThought, sifiaGuided, devotionalPonder, devotionalReflection, playbookReflection] as any[];
    const timeline = buildMomentTimeline({ journalEntries: [], reflections, bibleStudies: [], prayers: [] });
    expect(timeline).toHaveLength(reflections.length);
    expect(new Set(timeline.flatMap(item => item.canonicalIds))).toEqual(new Set(reflections.map(item => item.id)));
    expect(timeline.find(item => item.canonicalIds[0] === sifiaThought.id)?.metadata?.compatibilityOrigin).toBe('sifia_thought');
    expect(timeline.find(item => item.canonicalIds[0] === devotionalPonder.id)?.searchText).toContain('hope in waiting');
    expect(timeline.find(item => item.canonicalIds[0] === playbookReflection.id)?.navigation).toMatchObject({ screen: 'ReflectionEditor', params: { reflectionId: playbookReflection.id } });
  });
});
