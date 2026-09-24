import {getReviewStages} from '../reviewStages';

describe('Review stages', () => {
  it('opens Weekly Review with the feelings step immediately after the cover', () => {
    const stages = getReviewStages('weekly');
    expect(stages[0].kind).toBe('cover');
    expect(stages[1]).toMatchObject({
      key: 'feelings',
      kind: 'feelings',
      answerKey: 'week_feelings',
      question: 'How did this week feel?',
    });
  });

  it('keeps the feelings step out of longer seasonal reviews', () => {
    for (const type of ['quarterly', 'year_end', 'begin_year'] as const) {
      expect(
        getReviewStages(type).some(stage => stage.kind === 'feelings'),
      ).toBe(false);
    }
  });

  it('opens Monthly Review with a month-wide feelings reflection', () => {
    expect(getReviewStages('monthly')[1]).toMatchObject({
      key: 'monthly_feelings',
      kind: 'feelings',
      question: 'How did this month feel?',
      answerKey: 'month_feelings',
    });
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
    for (const type of [
      'monthly',
      'quarterly',
      'year_end',
      'begin_year',
    ] as const) {
      expect(
        getReviewStages(type).some(stage => stage.kind === 'life_check_in'),
      ).toBe(false);
    }
  });

  it('adds a read-only Whole-life synthesis to Monthly Review', () => {
    const stages = getReviewStages('monthly');
    const patternsIndex = stages.findIndex(stage => stage.key === 'notice');

    expect(stages[patternsIndex + 1]).toMatchObject({
      key: 'monthly_life_summary',
      kind: 'life_summary',
      question: 'How were you this month?',
      subtitle: 'A synthesis of your weekly Whole-life check-ins.',
    });
  });

  it('follows the Monthly Whole-life synthesis with life-giving and draining choices', () => {
    const stages = getReviewStages('monthly');
    const lifeIndex = stages.findIndex(
      stage => stage.key === 'monthly_life_summary',
    );

    expect(stages.slice(lifeIndex + 1, lifeIndex + 3)).toMatchObject([
      {
        key: 'monthly_life_giving',
        kind: 'pill_choices',
        question: 'What gave you life this month?',
        answerKey: 'month_life_giving',
        otherAnswerKey: 'month_life_giving_other',
        selectionLimit: 3,
      },
      {
        key: 'monthly_draining',
        kind: 'pill_choices',
        question: 'What drained you this month?',
        answerKey: 'month_draining',
        otherAnswerKey: 'month_draining_other',
        selectionLimit: 3,
      },
    ]);
  });

  it('adds a read-only wins reminder after Whole-life only when wins exist', () => {
    const withoutWins = getReviewStages('monthly');
    const withWins = getReviewStages('monthly', {
      includeMonthlyWins: true,
    });
    const lifeIndex = withWins.findIndex(
      stage => stage.key === 'monthly_life_summary',
    );

    expect(
      withoutWins.some(stage => stage.key === 'monthly_wins'),
    ).toBe(false);
    expect(withWins[lifeIndex + 1]).toMatchObject({
      key: 'monthly_wins',
      kind: 'wins',
      icon: 'leaf-outline',
      label: 'LOOKING BACK',
      title: 'You had wins worth remembering.',
    });
    expect(withWins[lifeIndex + 2].key).toBe('monthly_life_giving');
  });

  it('ends Monthly Looking Back with God’s faithfulness without a release page', () => {
    const stages = getReviewStages('monthly');
    const transitionIndex = stages.findIndex(
      stage => stage.key === 'step_into',
    );

    expect(
      stages
        .slice(transitionIndex - 3, transitionIndex)
        .map(stage => stage.key),
    ).toEqual(['formation', 'prayer', 'god']);
    expect(stages[transitionIndex - 2]).toMatchObject({
      label: 'PRAYERS',
      question: 'This month in prayer',
    });
    expect(stages[transitionIndex - 1]).toMatchObject({
      question: 'Where did you see God’s faithfulness this month?',
    });
    expect(stages.some(stage => stage.key === 'release')).toBe(false);
  });

  it('adds the testimony faithfulness page only when one was written that month', () => {
    const defaultStages = getReviewStages('monthly');
    const stages = getReviewStages('monthly', {
      includeMonthlyTestimony: true,
    });
    const godIndex = stages.findIndex(stage => stage.key === 'god');

    expect(
      defaultStages.some(stage => stage.key === 'monthly_testimony'),
    ).toBe(false);
    expect(stages[godIndex - 1]).toMatchObject({
      key: 'monthly_testimony',
      kind: 'testimony',
      icon: 'leaf-outline',
      label: 'GOD’S FAITHFULNESS',
      title: 'Also this month, you wrote your testimony.',
    });
  });

  it('uses one unfilled plant marker throughout Monthly Looking Back', () => {
    const stages = getReviewStages('monthly', {includeMonthlyWins: true});
    const keys = [
      'monthly_feelings',
      'notice',
      'monthly_life_summary',
      'monthly_wins',
      'monthly_life_giving',
      'monthly_draining',
      'formation',
      'prayer',
      'god',
    ];

    expect(
      stages.filter(stage => keys.includes(stage.key)).map(stage => stage.icon),
    ).toEqual(keys.map(() => 'leaf-outline'));
  });

  it('distills Weekly gratitude and removes the Heart and Scripture pages', () => {
    const stages = getReviewStages('weekly');
    const gratitude = stages.find(stage => stage.key === 'notice');

    expect(gratitude).toMatchObject({
      label: 'WEEKLY GRATITUDE',
      question: 'Looking back on this week, what do you want to thank God for?',
      subtitle:
        'A simple thank-you for something that mattered to you, however small.',
      placeholder: 'God, looking back on this week, thank You for…',
    });
    expect(stages.some(stage => stage.key === 'heart')).toBe(false);
    expect(stages.some(stage => stage.key === 'scripture')).toBe(false);
  });

  it('uses a simple guided question for God’s faithfulness', () => {
    expect(
      getReviewStages('weekly').find(stage => stage.key === 'god'),
    ).toMatchObject({
      label: 'GOD’S FAITHFULNESS',
      question: 'How did God meet you this week?',
      subtitle: 'Choose up to 3, or write your own.',
      answerKey: 'god',
    });
  });

  it('introduces the Weekly looking-ahead section with reflective transition copy', () => {
    expect(
      getReviewStages('weekly').find(stage => stage.key === 'looking_ahead'),
    ).toMatchObject({
      kind: 'transition',
      icon: 'leaf-outline',
      label: 'LOOKING AHEAD',
      title: 'Now, let’s look ahead.',
      subtitle:
        'Let what God has shown you shape how you step into the week ahead.',
    });
  });

  it('uses Needs Care for weekly area selections while retaining the saved note key', () => {
    expect(
      getReviewStages('weekly').find(stage => stage.key === 'dont_forget'),
    ).toMatchObject({
      label: 'NEEDS CARE',
      question: 'What needs care this week?',
      answerKey: 'dont_forget',
      answerKeys: ['week_care_areas', 'week_care_other', 'dont_forget'],
    });
    for (const type of [
      'monthly',
      'quarterly',
      'year_end',
      'begin_year',
    ] as const) {
      expect(
        getReviewStages(type).some(stage =>
          stage.answerKeys?.includes('week_care_areas'),
        ),
      ).toBe(false);
    }
  });

  it('puts the weekly Looking Forward walkthrough before a separate prayer page and recap', () => {
    const stages = getReviewStages('weekly');
    const careIndex = stages.findIndex(stage => stage.key === 'dont_forget');
    expect(stages.slice(careIndex - 1).map(stage => stage.key)).toEqual([
      'priority',
      'dont_forget',
      'watch_for',
      'looking_forward_feeling',
      'looking_forward',
      'prayer_ahead',
      'ready',
    ]);
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
      answerKeys: [
        'week_looking_forward',
        'week_looking_forward_emotion',
        'week_looking_forward_other',
      ],
    });
    expect(stages[careIndex + 4]).toMatchObject({
      question: 'Pray over your week',
      answerKey: 'prayer_ahead',
    });
    expect(stages.find(stage => stage.key === 'difficulty')?.answerKey).toBe(
      'week_difficulty',
    );
  });

  it('keeps the challenges picker specific to Weekly Review', () => {
    for (const type of [
      'monthly',
      'quarterly',
      'year_end',
      'begin_year',
    ] as const) {
      expect(
        getReviewStages(type).some(stage =>
          stage.answerKeys?.includes('week_challenge_choices'),
        ),
      ).toBe(false);
      expect(
        getReviewStages(type).some(stage =>
          stage.answerKeys?.includes('week_support_choices'),
        ),
      ).toBe(false);
    }
  });

  it('frames Monthly Review as a distinct looking-back and looking-ahead journey', () => {
    const stages = getReviewStages('monthly');
    const transitionIndex = stages.findIndex(
      stage => stage.key === 'step_into',
    );

    expect(stages[0]).toMatchObject({
      key: 'cover',
      kind: 'cover',
    });
    expect(stages.find(stage => stage.key === 'notice')).toMatchObject({
      label: 'PATTERNS',
      question: 'What patterns do you notice?',
    });
    expect(stages[transitionIndex]).toMatchObject({
      kind: 'transition',
      label: 'LOOKING AHEAD',
      title: 'Now, let’s look ahead.',
    });
    expect(stages.slice(transitionIndex + 1).map(stage => stage.key)).toEqual([
      'monthly_more_room',
      'monthly_care',
      'monthly_leave_behind',
      'priority',
      'prayer_for_month',
      'ready',
    ]);
    expect(stages[transitionIndex + 1]).toMatchObject({
      question: 'What do you want to make more room for?',
      kind: 'pill_choices',
      answerKey: 'month_more_room',
      otherAnswerKey: 'month_more_room_other',
      selectionLimit: 3,
    });
    const moreRoom = stages[transitionIndex + 1];
    expect(moreRoom.choiceDetails).toHaveLength(8);
    expect(
      moreRoom.choiceDetails?.find(
        detail => detail.choice === 'Time with God',
      ),
    ).toMatchObject({
      answerKey: 'month_more_room_with_god',
      selectionLimit: 3,
      choices: expect.arrayContaining([
        'Prayer',
        'Scripture reading',
        'Bible study',
        'Worship',
        'Church community',
        'Discipleship',
      ]),
    });
    expect(
      moreRoom.choiceDetails?.every(
        detail => detail.choices.length > 0 && detail.selectionLimit === 3,
      ),
    ).toBe(true);
    expect(stages[transitionIndex + 2]).toMatchObject({
      question: 'What needs care next month?',
      answerKey: 'month_care_areas',
      selectionLimit: 3,
      subtitle:
        'Based on your weekly Whole-life check-ins, these areas may need more attention next month. Choose up to 3.',
    });
    expect(stages[transitionIndex + 3]).toMatchObject({
      question: 'What do you want to leave behind?',
      kind: 'pill_choices',
      answerKey: 'month_leave_behind',
      otherAnswerKey: 'month_leave_behind_other',
      selectionLimit: 3,
    });
    const leaveBehind = stages[transitionIndex + 3];
    expect(
      leaveBehind.choiceDetails?.find(
        detail => detail.choice === 'Comparison',
      ),
    ).toMatchObject({
      answerKey: 'month_leave_behind_comparison',
      selectionLimit: 3,
      choices: expect.arrayContaining([
        'Comparing timelines',
        'Social media comparison',
        'Comparing spiritual growth',
      ]),
    });
    expect(
      leaveBehind.choiceDetails?.find(
        detail => detail.choice === 'Mental noise',
      ),
    ).toMatchObject({
      answerKey: 'month_leave_behind_mental_noise',
      selectionLimit: 3,
    });
    expect(
      leaveBehind.choiceDetails?.find(
        detail => detail.choice === 'Striving and self-reliance',
      ),
    ).toMatchObject({
      answerKey: 'month_leave_behind_self_reliance',
      choices: expect.arrayContaining([
        'Carrying what belongs to God',
        'Performing instead of abiding',
      ]),
    });
    expect(leaveBehind.choices).toEqual(
      expect.arrayContaining([
        'Striving and self-reliance',
        'Shame and condemnation',
        'Resentment or unforgiveness',
      ]),
    );
    expect(
      stages.find(stage => stage.key === 'prayer_for_month'),
    ).toMatchObject({
      label: 'WITH GOD',
      question: 'Pray over your month',
      subtitle: 'Bring the month ahead to God.',
      answerKeys: ['month_prayer_ids', 'prayer_for_month'],
    });
  });

  it('uses Monthly moments as the single shaping decision before patterns', () => {
    const stages = getReviewStages('monthly');
    const momentsIndex = stages.findIndex(stage => stage.key === 'captured');

    expect(stages[momentsIndex + 1]).toMatchObject({
      key: 'notice',
      question: 'What patterns do you notice?',
    });
    expect(stages.some(stage => stage.key === 'remembered')).toBe(false);
    expect(stages.some(stage => stage.key === 'remember')).toBe(false);
  });
});
