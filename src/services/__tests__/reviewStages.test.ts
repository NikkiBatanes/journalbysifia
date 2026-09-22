import {getReviewStages} from '../reviewStages';

describe('Review stages', () => {
  it('opens Weekly Review with the feelings step immediately after the cover', () => {
    const stages=getReviewStages('weekly');
    expect(stages[0].kind).toBe('cover');
    expect(stages[1]).toMatchObject({
      key:'feelings',
      kind:'feelings',
      answerKey:'week_feelings',
      question:'How did this week feel?',
    });
  });

  it('does not add the Weekly feelings step to other cadences', () => {
    for(const type of ['monthly','quarterly','year_end','begin_year'] as const){
      expect(getReviewStages(type).some(stage=>stage.kind==='feelings')).toBe(false);
    }
  });
});
