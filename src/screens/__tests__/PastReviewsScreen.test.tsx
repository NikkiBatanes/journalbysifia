import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import PastReviewsScreen from '../PastReviewsScreen';
import {getReviewEligibility} from '../../services/reviewEligibilityService';
import {getLocalReviewsByType} from '../../storage/reviewStorage';
import {getActiveReviewQAContext, getReviewQAEligibilityOptions} from '../../dev/reviews/reviewQALoader';

const mockNavigate = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: jest.fn(),
  popToTop: jest.fn(),
  getParent: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => mockNavigation,
  useFocusEffect: (effect: () => void) => {
    require('react').useEffect(effect, [effect]);
  },
}));
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: require('react-native').View,
  useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
}));
jest.mock('../../components/common/ThemedText', () => require('react-native').Text);
jest.mock('../../components/common/HeaderBackButton', () => require('react-native').Pressable);
jest.mock('../../utils/haptics', () => ({triggerLightHaptic: jest.fn()}));
jest.mock('../../services/reviewEligibilityService', () => ({getReviewEligibility: jest.fn()}));
jest.mock('../../storage/reviewStorage', () => ({getLocalReviewsByType: jest.fn()}));
jest.mock('../../dev/reviews/reviewQALoader', () => ({
  getActiveReviewQAContext: jest.fn(),
  getReviewQAEligibilityOptions: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (getLocalReviewsByType as jest.Mock).mockResolvedValue([]);
  (getActiveReviewQAContext as jest.Mock).mockResolvedValue(null);
});

it('uses the active Review QA date when deciding which review is current', async () => {
  const qaContext = {scenarioId: 'monthly-rich', referenceDate: '2026-09-03'};
  const qaOptions = {historyStartOverride: '2026-01-01'};
  (getActiveReviewQAContext as jest.Mock).mockResolvedValue(qaContext);
  (getReviewQAEligibilityOptions as jest.Mock).mockReturnValue(qaOptions);
  (getReviewEligibility as jest.Mock).mockResolvedValue({main: null, alsoReady: [], allActive: []});

  render(<PastReviewsScreen route={{params: {}}} />);

  await waitFor(() => expect(getReviewEligibility).toHaveBeenCalledWith(
    '2026-09-03',
    undefined,
    qaOptions,
  ));
});

it('makes a ready review accessible before the user has started it', async () => {
  (getReviewEligibility as jest.Mock).mockResolvedValue({
    main: null,
    alsoReady: [],
    allActive: [{
      type: 'weekly',
      state: 'ready',
      review: null,
      period: {
        type: 'weekly',
        periodStart: '2026-09-14',
        periodEnd: '2026-09-20',
        availableFrom: '2026-09-21',
        availableUntil: '2026-09-28',
      },
    }],
  });

  const screen = render(<PastReviewsScreen route={{params: {}}} />);
  const readyReview = await screen.findByLabelText('Begin weekly review for Sep 14 – 20');

  expect(screen.getByText('Ready')).toBeTruthy();
  fireEvent.press(readyReview);
  expect(mockNavigate).toHaveBeenCalledWith('Review', {
    type: 'weekly',
    reviewId: undefined,
    periodStart: '2026-09-14',
    periodEnd: '2026-09-20',
  });
});

it('shows an in-progress monthly review with its grace-period deadline', async () => {
  const monthlyReview = {
    type: 'monthly',
    state: 'in_progress',
    review: {id: 'monthly-draft'},
    period: {
      type: 'monthly',
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      availableFrom: '2026-10-01',
      availableUntil: '2026-10-08',
    },
  };
  (getReviewEligibility as jest.Mock).mockResolvedValue({
    main: monthlyReview,
    alsoReady: [],
    allActive: [monthlyReview],
  });

  const screen = render(<PastReviewsScreen route={{params: {}}} />);

  expect(await screen.findByText('In progress')).toBeTruthy();
  expect(screen.getByRole('tab', {name: 'Monthly', selected: true})).toBeTruthy();
  expect(screen.getByText(/Available through October 7\./)).toBeTruthy();
  fireEvent.press(
    screen.getByLabelText('Continue monthly review for September 2026'),
  );
  expect(mockNavigate).toHaveBeenCalledWith('Review', {
    type: 'monthly',
    reviewId: 'monthly-draft',
    periodStart: '2026-09-01',
    periodEnd: '2026-09-30',
    resumeLastStage: true,
  });
});
