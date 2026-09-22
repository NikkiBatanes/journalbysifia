import React from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import TruthToCarryShareComposer from '../TruthToCarryShareComposer';
import { triggerLightHaptic } from '../../utils/haptics';

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { Social: { SMS: 'sms', INSTAGRAM_STORIES: 'instagram-stories' }, shareSingle: jest.fn().mockResolvedValue({}), open: jest.fn() },
}));
jest.mock('react-native-view-shot', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactMock.forwardRef((props: any, ref: any) => {
      ReactMock.useImperativeHandle(ref, () => ({
        capture: async () => props.options?.fileName === 'journal-story-share' ? '/tmp/story.png' : '/tmp/reflection.png',
      }));
      return ReactMock.createElement(View);
    }),
    captureRef: jest.fn().mockResolvedValue('data:image/png;base64,reflection'),
  };
});
jest.mock('react-native-linear-gradient', () => require('react-native').View);
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
jest.mock('../common/ThemedText', () => require('react-native').Text);
jest.mock('../../config/environment', () => ({ ENV: {} }));
jest.mock('../../utils/haptics', () => ({ triggerLightHaptic: jest.fn(), triggerSuccessHaptic: jest.fn() }));
jest.mock('../../utils/ProductionLogger', () => ({ Logger: { error: jest.fn() } }));

describe('Truth to Carry Message sharing', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('uses the full Journal by siFia brand on the share card', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    expect(screen.getByLabelText('Journal by siFia logo')).toBeTruthy();
  });

  it('renders a structured morning summary card without text-style controls', () => {
    const screen = render(
      <TruthToCarryShareComposer
        visible
        variant="morning-summary"
        text="Morning summary"
        morningSummary={{
          feeling: 'Overwhelmed',
          feelingIcon: 'waves',
          feelingIconType: 'material',
          feelingVerse: 'Come to Me, all who are weary and burdened.',
          feelingVerseReference: 'Matthew 11:28 · NASB',
          focus: 'Family',
          focusIcon: 'home',
          focusIconType: 'material',
          focusReflection: 'Be present in the conversations at home.',
          prioritiesCount: 2,
          todosCount: 2,
          psalmNumber: 1,
          psalmRead: true,
          observations: ['Sovereign King', 'Refuge'],
          reminder: 'Carry God’s faithfulness into what comes next.',
        }}
        onClose={jest.fn()}
      />
    );

    expect(screen.getByLabelText('Morning summary share card')).toBeTruthy();
    expect(screen.getByText('You’re ready for today.')).toBeTruthy();
    expect(screen.getByText('Overwhelmed')).toBeTruthy();
    expect(screen.getByText('Matthew 11:28 · NASB')).toBeTruthy();
    expect(screen.getByText('Psalm 1')).toBeTruthy();
    expect(screen.getByText('Sovereign King · Refuge')).toBeTruthy();
    expect(screen.getAllByText('Carry God’s faithfulness into what comes next.').length).toBeGreaterThan(0);
    expect(screen.queryByLabelText('Edit post style')).toBeNull();
  });

  it('lets the user choose typography and separates supporting truth', async () => {
    const screen = render(
      <TruthToCarryShareComposer
        visible
        text={'Jesus calls you to rest.\n\nYou do not need to earn his grace.'}
        onClose={jest.fn()}
      />
    );
    expect(screen.getByText('Jesus calls you to rest.')).toBeTruthy();
    expect(screen.getByText('You do not need to earn his grace.')).toBeTruthy();
    expect(screen.queryByLabelText('Use Script text style')).toBeNull();
    expect(screen.getByLabelText('Swipe left or right to choose a template')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Edit post style'));
    const scriptButton = await screen.findByText('Script');
    expect(StyleSheet.flatten(screen.getByText('Jesus calls you to rest.').props.style).fontFamily).toBe('Lora-Bold');
    fireEvent.press(scriptButton);
    expect(StyleSheet.flatten(screen.getByText('Jesus calls you to rest.').props.style).fontFamily)
      .not.toBe('Lora-Bold');
    fireEvent.press(screen.getByLabelText('Close post editor'));
    await waitFor(() => expect(screen.queryByLabelText('Use Script text style')).toBeNull());
  });

  it('adjusts share-card text with a continuous size control', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Edit post style'));

    const initialSize = StyleSheet.flatten(screen.getByText('A truth to carry.').props.style).fontSize;
    const slider = screen.getByLabelText('Text size');
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(slider.props.accessibilityValue.now).toBe(96);
    expect(StyleSheet.flatten(screen.getByText('A truth to carry.').props.style).fontSize).toBeLessThan(initialSize);
    expect(triggerLightHaptic).toHaveBeenCalled();
  });

  it('lets every Journal user choose whether to show share-card branding', async () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Message').props.accessibilityState.disabled).toBe(false));
    expect(screen.getByText('www.journalby.sifia.app')).toBeTruthy();

    const watermarkToggle = screen.getByLabelText('Show Journal by siFia watermark');
    expect(watermarkToggle.props.accessibilityState.checked).toBe(true);
    fireEvent.press(watermarkToggle);

    expect(screen.queryByText('www.journalby.sifia.app')).toBeNull();
    expect(screen.getByText('Hidden from this post')).toBeTruthy();
  });

  it('does not present a tier upsell for share-card branding', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    expect(screen.queryByText('Available with Growth')).toBeNull();
    expect(screen.queryByText('Get Growth')).toBeNull();
  });

  it('closes without haptic feedback', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Close share composer'));
    expect(triggerLightHaptic).not.toHaveBeenCalled();
  });

  it('uses the 9:16 capture for Instagram Stories', async () => {
    Platform.OS = 'android';
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Instagram'));

    await waitFor(() => expect(Share.shareSingle).toHaveBeenCalledWith(expect.objectContaining({
      social: 'instagram-stories',
      backgroundImage: 'file:///tmp/story.png',
    })));
  });

  it.each(['ios', 'android'] as const)('keeps Messages on the 4:5 image attachment on %s', async os => {
    Platform.OS = os;
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Message'));
    await waitFor(() => expect(Share.shareSingle).toHaveBeenCalledWith(expect.objectContaining({
      social: 'sms',
      recipient: '',
      type: 'image/png',
      url: os === 'ios' ? 'data:image/png;base64,reflection' : 'file:///tmp/reflection.png',
    })));
    if (os === 'ios') {
      expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ result: 'data-uri' }));
      const captureOptions = jest.mocked(captureRef).mock.calls.at(-1)?.[1];
      expect(captureOptions).not.toHaveProperty('width');
      expect(captureOptions).not.toHaveProperty('height');
    } else {
      expect(captureRef).not.toHaveBeenCalled();
    }
  });

  it('does not open Messages when image capture fails', async () => {
    Platform.OS = 'ios';
    jest.mocked(captureRef).mockRejectedValueOnce(new Error('Capture failed'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." onClose={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Message'));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(Share.shareSingle).not.toHaveBeenCalled();
  });

});
