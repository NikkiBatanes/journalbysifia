import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import ShareableSelectableText from '../ShareableSelectableText';

jest.mock('react-native-vector-icons/Ionicons', () => require('react-native').Text);
jest.mock('../../hooks/useTheme', () => ({ useTheme: () => ({ currentFont: 'lexend' }) }));

describe('ShareableSelectableText', () => {
  it('shares only the selected text when a selection exists', () => {
    const onShare = jest.fn();
    const screen = render(
      <ShareableSelectableText text="Grace meets you here" onShare={onShare} />
    );
    act(() => {
      screen.getByDisplayValue('Grace meets you here').props.onSelectionChange({
        nativeEvent: { selection: { start: 0, end: 5 } },
      });
    });
    fireEvent.press(screen.getByLabelText('Share selected text'));
    expect(onShare).toHaveBeenCalledWith('Grace');
  });

  it('shares the full text when nothing is selected', () => {
    const onShare = jest.fn();
    const screen = render(
      <ShareableSelectableText text="Jesus calls you forward." onShare={onShare} />
    );
    fireEvent.press(screen.getByLabelText('Share this reflection'));
    expect(onShare).toHaveBeenCalledWith('Jesus calls you forward.');
  });

});
