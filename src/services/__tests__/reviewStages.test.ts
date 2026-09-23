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

  it('puts the life-area check-in immediately after Weekly feelings', () => {
    const stages = getReviewStages('weekly');
    const feelingsIndex = stages.findIndex(stage => stage.kind === 'feelings');

    expect(stages[feelingsIndex + 1]).toMatchObject({
      key: 'life_check_in',
      kind: 'life_check_in',
      question: 'How did these areas of life feel this week?',
      subtitle: 'A quick check-in across areas of life.',
      answerKeys: [
        'week_check_in_mind',
        'week_check_in_body',
        'week_check_in_relationships',
        'week_check_in_work',
        'week_check_in_finances',
        'week_check_in_responsibilities',
        'week_check_in_rest',
        'week_check_in_with_god',
      ],
    });
    expect(stages[feelingsIndex + 2]).toMatchObject({
      key: 'captured',
      kind: 'captured',
      title: 'What you captured',
    });
  });

  it('does not add the life-area check-in to other cadences', () => {
    for (const type of ['monthly', 'quarterly', 'year_end', 'begin_year'] as const) {
      expect(getReviewStages(type).some(stage => stage.kind === 'life_check_in')).toBe(false);
    }
  });

  it('distills Weekly gratitude and removes the Heart and Scripture pages', () => {
    const stages = getReviewStages('weekly');
    const gratitude = stages.find(stage => stage.key === 'notice');

    expect(gratitude).toMatchObject({
      label: 'WEEKLY GRATITUDE',
      question: 'Looking back on this week, what do you want to thank God for?',
      subtitle: 'A simple thank-you for something that mattered to you, however small.',
      placeholder: 'God, looking back on this week, thank You for…',
    });
    expect(stages.some(stage => stage.key === 'heart')).toBe(false);
    expect(stages.some(stage => stage.key === 'scripture')).toBe(false);
  });

  it('uses a simple guided question for God’s faithfulness', () => {
    expect(getReviewStages('weekly').find(stage => stage.key === 'god')).toMatchObject({
      label: 'GOD’S FAITHFULNESS',
      question: 'How did God meet you this week?',
      subtitle: 'Choose up to 3, or write your own.',
      answerKey: 'god',
    });
  });

  it('introduces the Weekly looking-ahead section with reflective transition copy', () => {
    expect(getReviewStages('weekly').find(stage => stage.key === 'looking_ahead')).toMatchObject({
      kind: 'transition',
      icon: 'leaf-outline',
      label: 'LOOKING AHEAD',
      title: 'Now, let’s look ahead.',
      subtitle: 'Let what God has shown you shape how you step into the week ahead.',
    });
  });

  it('uses Needs Care for weekly area selections while retaining the saved note key', () => {
    expect(getReviewStages('weekly').find(stage => stage.key === 'dont_forget')).toMatchObject({
      label: 'NEEDS CARE',
      question: 'What needs care this week?',
      answerKey: 'dont_forget',
      answerKeys: ['week_care_areas', 'week_care_other', 'dont_forget'],
    });
    for (const type of ['monthly', 'quarterly', 'year_end', 'begin_year'] as const) {
      expect(getReviewStages(type).some(stage => stage.answerKeys?.includes('week_care_areas'))).toBe(false);
    }
  });

  it('puts the weekly Looking Forward walkthrough before a separate prayer page and recap', () => {
    const stages = getReviewStages('weekly');
    const careIndex = stages.findIndex(stage => stage.key === 'dont_forget');
    expect(stages.slice(careIndex - 1).map(stage => stage.key))
      .toEqual(['priority', 'dont_forget', 'watch_for', 'looking_forward_feeling', 'looking_forward', 'prayer_ahead', 'ready']);
    expect(stages).toHaveLength(17);
    expect(new Set(stages.map(stage => stage.key)).size).toBe(stages.length);
    expect(stages[careIndex + 1]).toMatchObject({
      question: 'What could make this week difficult?',
      subtitle: 'What do you want to be mindful of?',
      answerKey: 'watch_for',
      answerKeys: ['week_challenge_choices', 'watch_for'],
    });
    expect(stages[careIndex + 2]).toMatchObject({
      question: 'How does this week feel right now?',
      answerKey: 'week_looking_forward_emotion',
    });
    expect(stages[careIndex + 3]).toMatchObject({
      question: 'What are you looking forward to this week?',
      answerKey: 'week_looking_forward',
      answerKeys: ['week_looking_forward', 'week_looking_forward_emotion', 'week_looking_forward_other'],
    });
    expect(stages[careIndex + 4]).toMatchObject({
      question: 'Pray over your week',
      answerKey: 'prayer_ahead',
    });
    expect(stages.find(stage => stage.key === 'difficulty')?.answerKey).toBe('week_difficulty');
  });

  it('keeps the challenges picker specific to Weekly Review', () => {
    for (const type of ['monthly', 'quarterly', 'year_end', 'begin_year'] as const) {
      expect(getReviewStages(type).some(stage => stage.answerKeys?.includes('week_challenge_choices'))).toBe(false);
      expect(getReviewStages(type).some(stage => stage.answerKeys?.includes('week_support_choices'))).toBe(false);
    }
  });
});
