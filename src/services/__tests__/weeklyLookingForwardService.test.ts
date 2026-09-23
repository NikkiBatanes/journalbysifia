import AsyncStorage from '@react-native-async-storage/async-storage';
import {getLocalJournalSingleton, saveLocalJournalSingleton} from '../../storage/journalStorage';
import {saveWeeklyLookingForwardMoment} from '../weeklyLookingForwardService';
import {formatWeeklyLookingForwardAnswer, getWeeklyLookingForwardContent} from '../../utils/weeklyLookingForwardAnswers';

jest.mock('../../utils/momentsRefresh', () => ({emitMomentsStructuralRefresh: jest.fn()}));

const period = {periodStart: '2026-09-14', periodEnd: '2026-09-20', reviewId: 'weekly-review'};

beforeEach(() => {
  jest.clearAllMocks();
  const store = new Map<string, string>();
  (AsyncStorage.getItem as jest.Mock).mockImplementation(async key => store.get(key) ?? null);
  (AsyncStorage.setItem as jest.Mock).mockImplementation(async (key, value) => {store.set(key, value);});
});

it('updates one weekly Moment while preserving the daily Looking Forward record', async () => {
  const daily = await saveLocalJournalSingleton('looking_forward', period.periodEnd, JSON.stringify({entry: {text: 'A walk tomorrow'}}));
  const first = await saveWeeklyLookingForwardMoment({...period, answers: {week_looking_forward: ' Dinner with family ', week_looking_forward_emotion: 'hopeful'}});
  const second = await saveWeeklyLookingForwardMoment({...period, answers: {week_looking_forward: 'A quiet dinner', week_looking_forward_emotion: 'trusting'}});
  expect(second?.id).toBe(first?.id);
  expect(second?.content_type).toBe('weekly_looking_forward');
  expect(JSON.parse(second!.content)).toMatchObject({title: 'Looking forward to this week', entry: {text: 'A quiet dinner'}, emotionId: 'trusting', emotionName: 'Trusting'});
  expect(second?.metadata).toMatchObject({source: 'weekly_review', reviewId: period.reviewId});
  expect(await getLocalJournalSingleton('looking_forward', period.periodEnd)).toEqual(daily);
});

it('serializes rapid edits and allows feeling-only and text-only weekly entries', async () => {
  await Promise.all([
    saveWeeklyLookingForwardMoment({...period, answers: {week_looking_forward_emotion: 'hopeful'}}),
    saveWeeklyLookingForwardMoment({...period, answers: {week_looking_forward: 'Seeing my sister'}}),
  ]);
  const saved = await getLocalJournalSingleton('weekly_looking_forward', period.periodEnd);
  expect(JSON.parse(saved!.content)).toMatchObject({entry: {text: 'Seeing my sister'}, emotionName: ''});
});

it('retains custom feelings and only displays them when Other is selected', () => {
  const answers = {week_looking_forward: 'A new project', week_looking_forward_emotion: 'other', week_looking_forward_other: ' Hopeful but nervous '};
  expect(formatWeeklyLookingForwardAnswer(answers)).toBe('A new project\n\nHow you’re holding it: Hopeful but nervous');
  expect(getWeeklyLookingForwardContent({...answers, week_looking_forward_emotion: 'calm'})).toMatchObject({emotionName: 'Calm', customEmotion: ''});
  expect(formatWeeklyLookingForwardAnswer({week_looking_forward: 'An older written answer'})).toBe('An older written answer');
});

it('clears only the weekly Moment when both responses are removed', async () => {
  const daily = await saveLocalJournalSingleton('looking_forward', period.periodEnd, JSON.stringify({entry: {text: 'Tomorrow'}}));
  await saveWeeklyLookingForwardMoment({...period, answers: {week_looking_forward: 'This week'}});
  await saveWeeklyLookingForwardMoment({...period, answers: {week_looking_forward: ' ', week_looking_forward_emotion: ''}});
  expect(await getLocalJournalSingleton('weekly_looking_forward', period.periodEnd)).toBeNull();
  expect(await getLocalJournalSingleton('looking_forward', period.periodEnd)).toEqual(daily);
});
