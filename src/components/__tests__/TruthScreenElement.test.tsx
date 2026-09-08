import React from 'react';
import { Share } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import TruthScreenElement from '../TruthScreenElement';
import { triggerLightHaptic } from '../../utils/haptics';

jest.mock('../common/ThemedText', () => require('react-native').Text);
jest.mock('react-native-vector-icons/Ionicons', () => require('react-native').Text);
jest.mock('../../utils/haptics', () => ({ triggerLightHaptic: jest.fn() }));
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ currentFont: 'lexend' }) }));

describe('TruthScreenElement', () => {
  it('keeps optional context collapsed until requested', () => {
    const screen = render(<TruthScreenElement element={{ kind: 'explanation', text: 'Additional context.', items: [] }} />);
    expect(screen.queryByDisplayValue('Additional context.')).toBeNull();
    fireEvent.press(screen.getByText('Explore this thought'));
    expect(screen.getByDisplayValue('Additional context.')).toBeTruthy();
    expect(triggerLightHaptic).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('Show less'));
    expect(screen.queryByDisplayValue('Additional context.')).toBeNull();
    expect(triggerLightHaptic).toHaveBeenCalledTimes(1);
  });

  it('shares a takeaway as a siFia reflection', () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
    const screen = render(<TruthScreenElement element={{ kind: 'takeaway', text: 'Listen without promising an answer.', items: [] }} />);
    fireEvent.press(screen.getByLabelText('Share this reflection'));
    expect(share).toHaveBeenCalledWith({ message: 'Listen without promising an answer.\n\n— siFia reflection' });
    share.mockRestore();
  });

  it('opens the visual composer when a share handler is provided', () => {
    const onShare = jest.fn();
    const screen = render(
      <TruthScreenElement
        element={{ kind: 'takeaway', text: 'Listen without promising an answer.', items: [] }}
        onShare={onShare}
      />
    );
    fireEvent.press(screen.getByLabelText('Share this reflection'));
    expect(onShare).toHaveBeenCalledWith('Listen without promising an answer.');
  });

  it('shows both sides of a comparison', () => {
    const screen = render(<TruthScreenElement element={{ kind: 'comparison', text: '', items: ['Listen first.', 'Decide afterward.'] }} />);
    expect(screen.getByDisplayValue('Listen first.')).toBeTruthy();
    expect(screen.getByDisplayValue('Decide afterward.')).toBeTruthy();
  });

  it('shares text from an expanded explanation', () => {
    const onShare = jest.fn();
    const screen = render(
      <TruthScreenElement
        element={{ kind: 'explanation', text: 'Grace is received, not earned.', items: [] }}
        onShare={onShare}
      />
    );
    fireEvent.press(screen.getByText('Explore this thought'));
    fireEvent.press(screen.getByLabelText('Share this reflection'));
    expect(onShare).toHaveBeenCalledWith('Grace is received, not earned.');
  });

  it('shares individual flow and comparison items', () => {
    const onShare = jest.fn();
    const flow = render(
      <TruthScreenElement
        element={{ kind: 'flow', text: '', items: ['Bring it to Christ.', 'Entrust the outcome.'] }}
        onShare={onShare}
      />
    );
    fireEvent.press(flow.getAllByLabelText('Share this reflection')[1]);
    expect(onShare).toHaveBeenCalledWith('Entrust the outcome.');
  });
});
