import React from 'react';
import { AccessibilityInfo, Alert, Share } from 'react-native';
import { act, fireEvent, render, waitFor, within } from '@testing-library/react-native';
import GospelScreen from '../GospelScreen';
import PrayerHandsIcon from '../../components/common/PrayerHandsIcon';
import { gospelStorage } from '../../storage/gospelStorage';
import { gospelShareService } from '../../services/gospelShareService';

jest.mock('../../theme/ThemeContext', () => ({ useTheme: () => ({ fontFamily: 'System' }) }));
jest.mock('react-native-safe-area-context', () => ({ useSafeAreaInsets: () => ({ top: 0, bottom: 0 }) }));
jest.mock('../../hooks/useScreenStatusBar', () => ({ useScreenStatusBar: jest.fn() }));
jest.mock('../../utils/haptics', () => ({ triggerLightHaptic: jest.fn(), triggerSuccessHaptic: jest.fn() }));
jest.mock('../../utils/soundUtils', () => ({ playGospelOpeningSound: jest.fn().mockResolvedValue(undefined) }));
jest.mock('../../services/forMeDayService', () => ({ scheduleForMeDayReminder: jest.fn() }));
jest.mock('../../storage/gospelStorage', () => ({ gospelStorage: { getPeople: jest.fn(), addPerson: jest.fn() } }));
jest.mock('../../services/gospelShareService', () => ({ gospelShareService: { createLink: jest.fn(), getSharedResponses: jest.fn() } }));

const people = [
  { id: 'person-1', displayName: 'Anna', createdAt: '2026-09-20T08:00:00.000Z', updatedAt: '2026-09-20T08:00:00.000Z' },
  { id: 'person-2', displayName: 'Ben', createdAt: '2026-09-21T08:00:00.000Z', updatedAt: '2026-09-21T08:00:00.000Z' },
];

async function openScreen() {
  const navigation = { navigate: jest.fn(), goBack: jest.fn() };
  const screen = render(<GospelScreen navigation={navigation} />);
  await act(async () => {});
  return { screen, navigation };
}

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
  jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
  jest.mocked(gospelStorage.getPeople).mockResolvedValue(people);
  jest.mocked(gospelStorage.addPerson).mockResolvedValue(people[0]);
  jest.mocked(gospelShareService.createLink).mockImplementation(async personId => ({ token: personId || 'other', url: `https://example.com/${personId || 'other'}` }));
  jest.mocked(gospelShareService.getSharedResponses).mockResolvedValue([]);
});

afterEach(() => jest.restoreAllMocks());

it('uses the navigation prayer hands, opens prayer, and sends with the chosen person', async () => {
  const { screen, navigation } = await openScreen();
  fireEvent.press(screen.getByText("People I'm praying for"));
  expect(screen.getByText('Pray. Share. Follow up.')).toBeTruthy();
  expect(screen.getAllByText('Praying that they will know Christ and for an opportunity to share the Gospel.')).toHaveLength(2);
  expect(screen.getByText('Began praying · September 20, 2026')).toBeTruthy();
  expect(screen.queryByText('Shared responses')).toBeNull();
  const pray = screen.getByLabelText('Pray for Anna');
  expect(within(pray).UNSAFE_getByType(PrayerHandsIcon).props).toMatchObject({ size: 20, strokeWidth: 2.2 });
  fireEvent.press(pray);
  expect(navigation.navigate).toHaveBeenCalledWith('PrayersForPeopleWalkthrough', { initialPersonName: 'Anna', initialPrayerType: 'pray-for-someone' });
  fireEvent.press(screen.getByLabelText('Send the Gospel to Anna'));
  expect(screen.getByRole('radio', { name: 'Anna' }).props.accessibilityState.checked).toBe(true);
  fireEvent.press(screen.getByText('Share the Gospel'));
  await waitFor(() => expect(Share.share).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com/person-1' })));
  expect(gospelShareService.createLink).toHaveBeenCalledWith('person-1');
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
  expect(screen.getAllByText('Anna')).toHaveLength(1);
  expect(screen.queryByText('Someone')).toBeNull();
  fireEvent.press(screen.getByText('Other recipients'));
  expect(screen.getByText('Anna')).toBeTruthy();
  expect(screen.getByText('Someone')).toBeTruthy();
  expect(screen.queryByText('Can we talk?')).toBeNull();
  fireEvent.press(screen.getByText('Everyone'));
  expect(screen.getAllByText('Anna')).toHaveLength(2);
  expect(screen.getByText('Someone')).toBeTruthy();
});
