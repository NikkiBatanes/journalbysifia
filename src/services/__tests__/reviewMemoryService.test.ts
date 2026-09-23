import {
  buildRememberedCanonicalIdSet,
  getCarryForwardReferences,
  rememberedReferenceMatchesMoment,
} from '../reviewMemoryService';
import {getAllLocalReviews} from '../../storage/reviewStorage';

jest.mock('../../storage/reviewStorage', () => ({getAllLocalReviews: jest.fn()}));

describe('review memory', () => {
  it('resolves new and legacy prayer review events to the source prayer', () => {
    const remembered = {id:'prayer-review:answer_recorded:prayer-1:answer-1:2026-09-03',selectedDate:'2026-09-03'};
    expect(rememberedReferenceMatchesMoment(remembered,{id:'timeline-prayer',prayerId:'prayer-1'})).toBe(true);
    expect(buildRememberedCanonicalIdSet([remembered])).toContain('prayer-1');
  });

  it('offers completed weekly selections to the matching monthly review', async () => {
    (getAllLocalReviews as jest.Mock).mockResolvedValue([
      {id:'week-1',type:'weekly',status:'completed',periodStart:'2026-09-01',periodEnd:'2026-09-07',memorableItems:[{kind:'journal',id:'entry-1',selectedDate:'2026-09-03'}]},
      {id:'week-draft',type:'weekly',status:'draft',periodStart:'2026-09-08',periodEnd:'2026-09-14',memorableItems:[{kind:'journal',id:'entry-2',selectedDate:'2026-09-10'}]},
      {id:'month-1',type:'monthly',status:'completed',periodStart:'2026-09-01',periodEnd:'2026-09-30',memorableItems:[{kind:'journal',id:'entry-3',selectedDate:'2026-09-12'}]},
    ]);

    const references = await getCarryForwardReferences('monthly','2026-09-01','2026-09-30');
    expect(references.map(item=>item.id)).toEqual(['entry-1']);
  });
});
