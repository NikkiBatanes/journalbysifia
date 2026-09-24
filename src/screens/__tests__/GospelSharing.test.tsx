import React from 'react';
import { AccessibilityInfo, Alert, Share } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import GospelScreen from '../GospelScreen';
import PrayerHandsIcon from '../../components/common/PrayerHandsIcon';
import {GOSPEL_PAGES} from '../../data/gospelContent';
import { gospelStorage } from '../../storage/gospelStorage';
import { gospelShareService } from '../../services/gospelShareService';
import {recordGospelAcceptanceAsAnsweredPrayer} from '../../services/gospelAcceptancePrayerService';
import {queueSelfGospelAcceptanceImpact} from '../../services/journalImpactAnalyticsService';

jest.mock('../../theme/ThemeContext', () => ({ useTheme: () => ({ fontFamily: 'System' }) }));
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../../hooks/useScreenStatusBar', () => ({ useScreenStatusBar: jest.fn() }));
jest.mock('../../utils/haptics', () => ({ triggerLightHaptic: jest.fn(), triggerSuccessHaptic: jest.fn() }));
jest.mock('../../utils/soundUtils', () => ({ playGospelOpeningSound: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/forMeDayService', () => ({ scheduleForMeDayReminder: jest.fn() }));
jest.mock('../../storage/gospelStorage', () => ({ gospelStorage: {
  getPeople: jest.fn(),
  getShareEvents: jest.fn(),
  addPerson: jest.fn(),
  recordShareEvent: jest.fn(),
  removeShareEvent: jest.fn(),
  linkShareEventToPerson: jest.fn(),
  saveResponse: jest.fn(),
  getForMeDaySettings: jest.fn(),
} }));
jest.mock('../../services/gospelShareService', () => ({ gospelShareService: { createLink: jest.fn(), getSharedResponses: jest.fn(), linkResponseToPerson: jest.fn() } }));
jest.mock('../../services/gospelAcceptancePrayerService', () => ({ recordGospelAcceptanceAsAnsweredPrayer: jest.fn() }));
jest.mock('../../services/journalImpactAnalyticsService', () => ({queueSelfGospelAcceptanceImpact: jest.fn()}));

const people = [
  { id: 'person-1', displayName: 'Anna', createdAt: '2026-09-20T08:00:00.000Z', updatedAt: '2026-09-20T08:00:00.000Z' },
  { id: 'person-2', displayName: 'Ben', createdAt: '2026-09-21T08:00:00.000Z', updatedAt: '2026-09-21T08:00:00.000Z' },
];

async function openScreen() {
  const navigation = { navigate: jest.fn(), replace: jest.fn(), goBack: jest.fn() };
  const screen = render(<GospelScreen navigation={navigation} />);
  await act(async () => {});
  return { screen, navigation };
}

function reachSelfResponse(screen: Awaited<ReturnType<typeof openScreen>>['screen']) {
  fireEvent.press(screen.getByText('Go through the Gospel'));
  fireEvent.press(screen.getByText("I'm reading for myself"));
  GOSPEL_PAGES.forEach((page, index) => {
    const label = (page.cta || (index === GOSPEL_PAGES.length - 1 ? 'I\'m ready to respond →' : 'Continue →'))
      .replace(/\s*(→|↗)$/, '');
    fireEvent.press(screen.getByLabelText(label));
  });
  fireEvent.press(screen.getByLabelText('What does this mean for me?'));
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  jest.mocked(gospelStorage.getPeople).mockResolvedValue(people);
  jest.mocked(gospelStorage.getShareEvents).mockResolvedValue([]);
  jest.mocked(gospelStorage.addPerson).mockResolvedValue(people[0]);
  jest.mocked(gospelStorage.removeShareEvent).mockResolvedValue(undefined);
  jest.mocked(gospelStorage.linkShareEventToPerson).mockResolvedValue(undefined);
  jest.mocked(gospelStorage.getForMeDaySettings).mockResolvedValue(null);
  jest.mocked(gospelStorage.recordShareEvent).mockImplementation(async input => ({
    id: 'share-event',
    sharedAt: new Date().toISOString(),
    method: typeof input === 'object' && input.method ? input.method : 'link',
    ...(typeof input === 'object' && input.personId ? {personId: input.personId} : {}),
    ...(typeof input === 'object' && input.responderName ? {responderName: input.responderName} : {}),
    ...(typeof input === 'object' && input.response ? {response: input.response} : {}),
    ...(typeof input === 'object' && input.spiritualBirthday ? {spiritualBirthday: input.spiritualBirthday} : {}),
  }));
  jest.mocked(gospelShareService.createLink).mockImplementation(async personId => ({ token: personId || 'other', url: `https://example.com/${personId || 'other'}` }));
  jest.mocked(gospelShareService.getSharedResponses).mockResolvedValue([]);
  jest.mocked(gospelShareService.linkResponseToPerson).mockResolvedValue(undefined);
  jest.mocked(recordGospelAcceptanceAsAnsweredPrayer).mockResolvedValue({} as any);
  jest.mocked(queueSelfGospelAcceptanceImpact).mockResolvedValue(undefined);
});

afterEach(() => jest.restoreAllMocks());

it('asks a person trusting Jesus to confess their faith aloud', async () => {
  const {screen} = await openScreen();
  reachSelfResponse(screen);

  fireEvent.press(screen.getByText('Yes. I want to trust and follow Jesus.'));
  fireEvent.press(screen.getByLabelText('Continue'));

  expect(screen.getByText('PRAY THIS ALOUD IN FAITH')).toBeTruthy();
  expect(screen.getByText(/pray it aloud—confess with your mouth that Jesus is Lord/)).toBeTruthy();
  expect(screen.getByText(/Romans 10:9/)).toBeTruthy();
});

it.each([
  ['I have questions.', 'has_questions'],
  ["I'm not ready yet.", 'not_ready'],
] as const)('saves a self response for %s', async (label, savedResponse) => {
  const {screen} = await openScreen();
  reachSelfResponse(screen);

  fireEvent.press(screen.getByText(label));
  fireEvent.press(screen.getByLabelText('Continue'));

  await waitFor(() => expect(gospelStorage.saveResponse).toHaveBeenCalledWith(savedResponse, 'app_self'));
  expect(screen.getByText('Your response is saved on this device, so you can return to the Gospel from where you are today.')).toBeTruthy();
});

it('includes a new self decision in the accepted-Jesus impact total', async () => {
  jest.mocked(gospelStorage.saveResponse).mockResolvedValueOnce({
    response: 'trusted_jesus_today',
    sourceMode: 'app_self',
    respondedAt: '2026-09-24T08:15:00.000Z',
    spiritualBirthday: '2026-09-24',
    contentVersion: 'test',
  });
  const {screen, navigation} = await openScreen();
  reachSelfResponse(screen);

  fireEvent.press(screen.getByText('Yes. I want to trust and follow Jesus.'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('I trust Jesus today'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByText('Save & finish'));

  await waitFor(() => expect(queueSelfGospelAcceptanceImpact).toHaveBeenCalledWith(
    '2026-09-24T08:15:00.000Z',
  ));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ForMeDay', {
    mode: 'celebrate',
  }));
});

it('offers a spiritual birthday or an opt-out when an existing believer has no saved date', async () => {
  const {screen} = await openScreen();
  reachSelfResponse(screen);

  fireEvent.press(screen.getByText('I already trust and follow Jesus.'));
  fireEvent.press(screen.getByLabelText('Continue'));

  await waitFor(() => expect(screen.getByText('Would you like to save your spiritual birthday?')).toBeTruthy());
  expect(screen.getByText('Save my spiritual birthday')).toBeTruthy();
  fireEvent.press(screen.getByText('Not now'));

  await waitFor(() => expect(gospelStorage.saveResponse).toHaveBeenCalledWith(
    'already_follows_jesus',
    'app_self',
    undefined,
  ));
  expect(screen.getByText('Keep preaching the Gospel to yourself.')).toBeTruthy();
  expect(screen.getByText('Preach the gospel to yourself every day.')).toBeTruthy();
  expect(screen.getByText('JERRY BRIDGES · THE DISCIPLINE OF GRACE')).toBeTruthy();
  expect(screen.queryByText('No pressure to manufacture a response.')).toBeNull();
});

it('saves the selected spiritual birthday and opens For Me Day', async () => {
  const {screen, navigation} = await openScreen();
  reachSelfResponse(screen);

  fireEvent.press(screen.getByText('I already trust and follow Jesus.'));
  fireEvent.press(screen.getByLabelText('Continue'));
  await waitFor(() => expect(screen.getByText('Save my spiritual birthday')).toBeTruthy());
  fireEvent.press(screen.getByText('Save my spiritual birthday'));

  await waitFor(() => expect(gospelStorage.saveResponse).toHaveBeenCalledWith(
    'already_follows_jesus',
    'app_self',
    expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  ));
  await waitFor(() => expect(navigation.replace).toHaveBeenCalledWith('ForMeDay', {
    mode: 'celebrate',
  }));
  expect(screen.queryByText('Keep preaching the Gospel to yourself.')).toBeNull();
});

it('keeps an existing spiritual birthday and does not ask for it again', async () => {
  jest.mocked(gospelStorage.getForMeDaySettings).mockResolvedValue({
    spiritualBirthday: '2018-09-18',
    reminderEnabled: true,
    reminderTime: '09:00',
    showInMoments: true,
    includeYearWhenSharing: true,
    updatedAt: '2026-09-24T00:00:00.000Z',
  });
  const {screen} = await openScreen();
  reachSelfResponse(screen);

  fireEvent.press(screen.getByText('I already trust and follow Jesus.'));
  fireEvent.press(screen.getByLabelText('Continue'));

  await waitFor(() => expect(screen.getByText('Keep preaching the Gospel to yourself.')).toBeTruthy());
  expect(screen.queryByText('Would you like to save your spiritual birthday?')).toBeNull();
  expect(gospelStorage.saveResponse).toHaveBeenCalledWith(
    'already_follows_jesus',
    'app_self',
    '2018-09-18',
  );
});

it('uses the navigation prayer hands, opens prayer, and sends with the chosen person', async () => {
  const { screen, navigation } = await openScreen();
  expect(screen.getByLabelText('Record open Gospel share. 0 shared today')).toBeTruthy();
  fireEvent.press(screen.getByText("People I'm praying for"));
  expect(screen.queryByLabelText(/Record open Gospel share/)).toBeNull();
  expect(screen.getByText('Pray. Share. Follow up.')).toBeTruthy();
  expect(screen.getByText('Began praying · Sun, Sep 20')).toBeTruthy();
  expect(screen.getAllByText('Praying that they will know Christ and for an opportunity to share the Gospel.')).toHaveLength(2);
  expect(screen.queryByText('Shared responses')).toBeNull();
  const pray = screen.getByLabelText('Pray for Anna');
  expect(within(pray).UNSAFE_getByType(PrayerHandsIcon).props).toMatchObject({ size: 20, strokeWidth: 2.2 });
  fireEvent.press(pray);
  expect(navigation.navigate).toHaveBeenCalledWith('PrayersForPeopleWalkthrough', {
    initialPersonName: 'Anna',
    initialPrayerType: 'pray-for-someone',
    skipPersonName: true,
  });
  fireEvent.press(screen.getByLabelText('Send the Gospel to Anna'));
  expect(screen.getByRole('radio', { name: 'Anna' }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByText('Share the Gospel'));
  await waitFor(() => expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({
    message: "Hey Anna, because I care about you, I wanted to share something close to my heart. My hope in Jesus has changed my life, and this short guide explains where that hope comes from. There's no need to respond. I simply wanted you to have it.",
    url: 'https://example.com/person-1',
  })));
  await waitFor(() => expect(gospelStorage.recordShareEvent).toHaveBeenCalledWith({method: 'link', personId: 'person-1'}));
  expect(gospelStorage.recordShareEvent).toHaveBeenCalledTimes(1);
  expect(screen.queryByLabelText(/Record open Gospel share/)).toBeNull();
  expect(gospelShareService.createLink).toHaveBeenCalledWith('person-1');
});

it('shares one URL on iOS so Messages renders only one link preview', async () => {
  const {screen} = await openScreen();
  fireEvent.press(screen.getByText('Send the Gospel'));
  fireEvent.press(screen.getByText('Share the Gospel'));

  await waitFor(() => expect(Share.share).toHaveBeenCalledWith({
    title: 'The Gospel',
    message: "Hey, because I care about you, I wanted to share something close to my heart. My hope in Jesus has changed my life, and this short guide explains where that hope comes from. There's no need to respond. I simply wanted you to have it.",
    url: 'https://example.com/other',
  }));
});

it('shows the Shared today button only on the first Gospel screen', async () => {
  const {screen} = await openScreen();
  expect(screen.getByLabelText('Record open Gospel share. 0 shared today')).toBeTruthy();

  fireEvent.press(screen.getByText('Go through the Gospel'));
  expect(screen.queryByLabelText(/Record open Gospel share/)).toBeNull();

  fireEvent.press(screen.getByLabelText('Go back'));
  expect(screen.getByLabelText('Record open Gospel share. 0 shared today')).toBeTruthy();
});

it('shows the Moments-style response empty state with short copy and an icon', async () => {
  const { screen } = await openScreen();
  fireEvent.press(screen.getByText('Shared responses'));

  await waitFor(() => expect(screen.getByText('No Responses Yet')).toBeTruthy());
  expect(screen.getByTestId('shared-responses-empty-icon')).toBeTruthy();
  expect(screen.queryByText(/No responses have been shared/)).toBeNull();
});

it('adds a person through open walkthrough steps without form containers', async () => {
  const { screen } = await openScreen();
  fireEvent.press(screen.getByText("People I'm praying for"));
  fireEvent.press(screen.getByText('Add someone to pray for'));

  expect(screen.getByText('Who do you want to share the Gospel with?')).toBeTruthy();
  expect(screen.getByText('Begin by praying that they will come to know Christ.')).toBeTruthy();
  const nameInput = screen.getByLabelText('Name or initial');
  expect(nameInput.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: 'transparent' })]));
  expect(screen.queryByLabelText('Continue')).toBeNull();

  fireEvent.changeText(nameInput, 'Mara');
  fireEvent.press(screen.getByLabelText('Continue'));
  expect(screen.getByText('As you pray for Mara, what would help you share the Gospel with them?')).toBeTruthy();
  expect(screen.getByText('Choose anything that fits, or add your own note.')).toBeTruthy();
  expect(screen.queryByText('Their prayer history begins today.')).toBeNull();

  const prayerInput = screen.getByLabelText('Optional note about Mara');
  expect(prayerInput.props.placeholder).toBe('Add your own note (optional)...');
  expect(prayerInput.props.style).toEqual(expect.arrayContaining([expect.objectContaining({ backgroundColor: 'transparent' })]));
  fireEvent.press(screen.getByRole('checkbox', { name: 'They have questions' }));
  fireEvent.press(screen.getByRole('checkbox', { name: 'Invite them for coffee' }));
  expect(screen.getByRole('checkbox', { name: 'They have questions' }).props.accessibilityState.checked).toBe(true);
  fireEvent.changeText(prayerInput, 'That she feels God near.');
  fireEvent.press(screen.getByLabelText("Add Mara to people I'm praying for"));

  await waitFor(() => expect(gospelStorage.addPerson).toHaveBeenCalledWith('Mara', 'They have questions · Invite them for coffee · That she feels God near.'));
  expect(screen.getByText('Pray. Share. Follow up.')).toBeTruthy();
});

it('keeps links separate when changing recipients while links are being prepared', async () => {
  let resolveAnna!: (link: { token: string; url: string }) => void;
  jest.mocked(gospelShareService.createLink).mockImplementation(personId => personId === 'person-1'
    ? new Promise(resolve => { resolveAnna = resolve; })
    : Promise.resolve({ token: personId || 'other', url: `https://example.com/${personId || 'other'}` }));
  const { screen } = await openScreen();
  fireEvent.press(screen.getByText('Send the Gospel'));
  fireEvent.press(screen.getByRole('radio', { name: 'Anna' }));
  fireEvent.press(screen.getByRole('radio', { name: 'Ben' }));
  await act(async () => resolveAnna({ token: 'anna', url: 'https://example.com/person-1' }));
  fireEvent.press(screen.getByText('Share the Gospel'));
  await waitFor(() => expect(Share.share).toHaveBeenLastCalledWith(expect.objectContaining({ url: 'https://example.com/person-2' })));
  await waitFor(() => expect(screen.getByText('Share the Gospel')).toBeTruthy());
  fireEvent.press(screen.getByRole('radio', { name: 'Someone else' }));
  fireEvent.press(screen.getByText('Share the Gospel'));
  await waitFor(() => expect(Share.share).toHaveBeenLastCalledWith(expect.objectContaining({ url: 'https://example.com/other' })));
});

it('records an anonymous open Gospel share with one tap', async () => {
  const {screen} = await openScreen();

  expect(screen.getByText('Shared today')).toBeTruthy();
  expect(screen.queryByText('0')).toBeNull();
  fireEvent.press(screen.getByLabelText('Record open Gospel share. 0 shared today'));

  await waitFor(() => expect(gospelStorage.recordShareEvent).toHaveBeenCalledWith({
    method: 'shared_openly',
    personId: undefined,
  }));
  expect(screen.getByLabelText('Record open Gospel share. 1 shared today')).toBeTruthy();
  expect(screen.getByText('Open Gospel share recorded')).toBeTruthy();

  fireEvent.press(screen.getByText('Undo'));

  await waitFor(() => expect(gospelStorage.removeShareEvent).toHaveBeenCalledWith('share-event'));
  expect(screen.getByLabelText('Record open Gospel share. 0 shared today')).toBeTruthy();
  expect(screen.queryByText('Open Gospel share recorded')).toBeNull();
});

it('does not record a dismissed link share on platforms that report dismissal', async () => {
  jest.mocked(Share.share).mockResolvedValueOnce({action: Share.dismissedAction});
  const {screen} = await openScreen();
  fireEvent.press(screen.getByText('Send the Gospel'));
  fireEvent.press(screen.getByText('Share the Gospel'));
  await waitFor(() => expect(Share.share).toHaveBeenCalled());

  expect(gospelStorage.recordShareEvent).not.toHaveBeenCalled();
  expect(screen.getByText('Send the good news to someone.')).toBeTruthy();
});

it('records a named in-app response and date without replacing the owner response', async () => {
  const {screen} = await openScreen();
  fireEvent.press(screen.getByText('Go through the Gospel'));
  fireEvent.press(screen.getByText("Someone is with me"));
  expect(screen.getByText('Who is with you?')).toBeTruthy();
  fireEvent.press(screen.getByText('Anna'));

  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Begin the Gospel'));

  GOSPEL_PAGES.forEach((page, index) => {
    const label = (page.cta || (index === GOSPEL_PAGES.length - 1 ? 'I\'m ready to respond →' : 'Continue →'))
      .replace(/\s*(→|↗)$/, '');
    fireEvent.press(screen.getByLabelText(label));
  });
  fireEvent.press(screen.getByLabelText('What does this mean for me?'));
  fireEvent.press(screen.getByText("I'm not ready yet."));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByText('Save response & finish'));

  expect(gospelStorage.saveResponse).not.toHaveBeenCalled();
  await waitFor(() => expect(gospelStorage.recordShareEvent).toHaveBeenCalledWith({
    method: 'together',
    personId: 'person-1',
    responderName: undefined,
    response: 'not_ready',
    spiritualBirthday: undefined,
  }));
  expect(screen.getByLabelText('Record open Gospel share. 1 shared today')).toBeTruthy();

  fireEvent.press(screen.getByText('Shared responses'));
  await waitFor(() => expect(screen.getByText("I’m not ready yet.")).toBeTruthy());
  expect(screen.getByText('Anna')).toBeTruthy();
});

it('saves a named not-yet response and adds the person to the prayer list', async () => {
  const mara = {
    id: 'person-mara',
    displayName: 'Mara',
    note: 'They are not ready to trust Jesus yet. Keep praying and follow up with care.',
    createdAt: '2026-09-24T08:00:00.000Z',
    updatedAt: '2026-09-24T08:00:00.000Z',
  };
  jest.mocked(gospelStorage.addPerson).mockResolvedValueOnce(mara);
  const {screen} = await openScreen();
  fireEvent.press(screen.getByText('Go through the Gospel'));
  fireEvent.press(screen.getByText('Someone is with me'));
  fireEvent.changeText(screen.getByLabelText('Name or initial for Gospel response'), 'Mara');
  fireEvent.press(screen.getByLabelText('Begin together'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Begin the Gospel'));
  GOSPEL_PAGES.forEach((page, index) => {
    const label = (page.cta || (index === GOSPEL_PAGES.length - 1 ? 'I\'m ready to respond →' : 'Continue →'))
      .replace(/\s*(→|↗)$/, '');
    fireEvent.press(screen.getByLabelText(label));
  });
  fireEvent.press(screen.getByLabelText('What does this mean for me?'));
  fireEvent.press(screen.getByText("I'm not ready yet."));
  fireEvent.press(screen.getByLabelText('Continue'));

  expect(screen.getByText('This is not the end of the story.')).toBeTruthy();
  fireEvent.press(screen.getByText('Save response & keep praying for Mara'));

  await waitFor(() => expect(gospelStorage.addPerson).toHaveBeenCalledWith(
    'Mara',
    'They are not ready to trust Jesus yet. Keep praying and follow up with care.',
  ));
  await waitFor(() => expect(gospelStorage.recordShareEvent).toHaveBeenCalledWith({
    method: 'together',
    personId: 'person-mara',
    responderName: 'Mara',
    response: 'not_ready',
    spiritualBirthday: undefined,
  }));
});

it('records today as the spiritual birthday for a named person who trusts Jesus in-app', async () => {
  const {screen} = await openScreen();
  fireEvent.press(screen.getByText('Go through the Gospel'));
  fireEvent.press(screen.getByText("Someone is with me"));
  fireEvent.press(screen.getByText('Anna'));

  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Begin the Gospel'));
  GOSPEL_PAGES.forEach((page, index) => {
    const label = (page.cta || (index === GOSPEL_PAGES.length - 1 ? 'I\'m ready to respond →' : 'Continue →'))
      .replace(/\s*(→|↗)$/, '');
    fireEvent.press(screen.getByLabelText(label));
  });
  fireEvent.press(screen.getByLabelText('What does this mean for me?'));
  fireEvent.press(screen.getByText('Yes. I want to trust and follow Jesus.'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('I trust Jesus today'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByLabelText('Continue'));
  fireEvent.press(screen.getByText('Save response & finish'));

  await waitFor(() => expect(gospelStorage.recordShareEvent).toHaveBeenCalledWith(expect.objectContaining({
    method: 'together',
    personId: 'person-1',
    responderName: undefined,
    response: 'trusted_jesus_today',
    spiritualBirthday: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
  })));
  await waitFor(() => expect(recordGospelAcceptanceAsAnsweredPrayer).toHaveBeenCalledWith(expect.objectContaining({
    gospelPersonId: 'person-1',
    personName: 'Anna',
    prayerStartedAt: '2026-09-20T08:00:00.000Z',
    acceptedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
  })));
  expect(gospelStorage.saveResponse).not.toHaveBeenCalled();

  fireEvent.press(screen.getByText("People I'm praying for"));
  expect(screen.getByText('Answered prayer')).toBeTruthy();
  expect(screen.getByText(/^Accepted Jesus as Lord and Savior ·/)).toBeTruthy();
  expect(screen.queryByLabelText('Send the Gospel to Anna')).toBeNull();
  fireEvent.press(screen.getByLabelText('Go back'));

  fireEvent.press(screen.getByText('Shared responses'));
  await waitFor(() => expect(screen.getByText('Anna')).toBeTruthy());
  expect(screen.getByText('Accepted Jesus as Lord and Savior.')).toBeTruthy();
  expect(screen.getByText(`Spiritual birthday · ${new Date().toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  })}`)).toBeTruthy();
  expect(screen.queryByText(new Date().toLocaleDateString())).toBeNull();
});

it('reuses a dismissed link and creates a fresh one after sharing successfully', async () => {
  jest.mocked(Share.share).mockResolvedValueOnce({ action: Share.dismissedAction });
  const { screen } = await openScreen();
  fireEvent.press(screen.getByText('Send the Gospel'));
  fireEvent.press(screen.getByText('Share the Gospel'));
  await waitFor(() => expect(screen.getByText('Share the Gospel')).toBeTruthy());
  expect(gospelShareService.createLink).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByText('Share the Gospel'));
  await waitFor(() => expect(gospelShareService.createLink).toHaveBeenCalledTimes(2));
});

it('retries failed preparation for the selected recipient', async () => {
  const { screen } = await openScreen();
  jest.mocked(gospelShareService.createLink).mockRejectedValueOnce(new Error('Offline'));
  fireEvent.press(screen.getByText('Send the Gospel'));
  await act(async () => {});
  fireEvent.press(screen.getByText('Share the Gospel'));
  await waitFor(() => expect(Share.share).toHaveBeenCalled());
  expect(gospelShareService.createLink).toHaveBeenCalledTimes(3);
});

it('connects responses by person ID and retains named and anonymous other recipients', async () => {
  const response = { response: 'has_questions' as const, spiritual_birthday: null, optional_message: null, consented_at: '2026-09-22', created_at: '2026-09-22' };
  jest.mocked(gospelShareService.getSharedResponses).mockResolvedValue([
    { ...response, id: 'r1', responder_name: null, optional_message: 'Can we talk?', gospel_share_links: { id: 'l1', person_id: 'person-1', created_at: '' } },
    { ...response, id: 'r2', responder_name: 'Anna', gospel_share_links: { id: 'l2', person_id: null, created_at: '' } },
    { ...response, id: 'r3', responder_name: null, gospel_share_links: { id: 'l3', person_id: null, created_at: '' } },
  ]);
  const { screen } = await openScreen();
  fireEvent.press(screen.getByText('Shared responses'));
  await waitFor(() => expect(screen.getByText('Can we talk?')).toBeTruthy());
  fireEvent.press(screen.getByLabelText("Add Anna to people I'm praying for"));
  await waitFor(() => expect(gospelShareService.linkResponseToPerson).toHaveBeenCalledWith('l2', 'person-1'));
  fireEvent.press(screen.getByLabelText("People I'm praying for"));
  expect(screen.getByLabelText('Everyone').props.style).toEqual(expect.objectContaining({
    backgroundColor: 'rgba(82, 106, 91, 0.08)',
    borderRadius: 28,
    borderWidth: 0.5,
    paddingHorizontal: 18,
    paddingVertical: 14,
  }));
  expect(screen.getByLabelText("People I'm praying for").props.style).toEqual(expect.objectContaining({
    backgroundColor: '#718476',
  }));
  expect(screen.getByText("People I'm praying for").props.style).toEqual(expect.arrayContaining([
    expect.objectContaining({ color: '#FFFEFA' }),
  ]));
  expect(screen.getAllByText('Anna')).toHaveLength(2);
  expect(screen.queryByText('Someone')).toBeNull();
  fireEvent.press(screen.getByText('Other recipients'));
  expect(screen.queryByText('Anna')).toBeNull();
  expect(screen.getByText('Someone')).toBeTruthy();
  expect(screen.queryByText('Can we talk?')).toBeNull();
  fireEvent.press(screen.getByText('Everyone'));
  expect(screen.getAllByText('Anna')).toHaveLength(2);
  expect(screen.getByText('Someone')).toBeTruthy();
});
