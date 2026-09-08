import React from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import TruthToCarryShareComposer from '../TruthToCarryShareComposer';
import { triggerLightHaptic } from '../../utils/haptics';
import { NewSubscriptionService } from '../../services/NewSubscriptionService';

jest.mock('react-native-share', () => ({
  __esModule: true,
  default: { Social: { SMS: 'sms' }, shareSingle: jest.fn().mockResolvedValue({}), open: jest.fn() },
}));
jest.mock('react-native-view-shot', () => {
  const ReactMock = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: ReactMock.forwardRef((props: any, ref: any) => {
      ReactMock.useImperativeHandle(ref, () => ({ capture: async () => '/tmp/reflection.png' }));
      return ReactMock.createElement(View, null, props.children);
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
jest.mock('../../services/NewSubscriptionService', () => ({
  NewSubscriptionService: { getUserSubscription: jest.fn() },
}));
jest.mock('../../utils/haptics', () => ({ triggerLightHaptic: jest.fn(), triggerSuccessHaptic: jest.fn() }));
jest.mock('../../utils/ProductionLogger', () => ({ Logger: { error: jest.fn() } }));

describe('Truth to Carry Message sharing', () => {
  const originalOS = Platform.OS;
  afterEach(() => {
    Platform.OS = originalOS;
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  it('uses an uppercase reflection label on the share card', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." userId="" onClose={jest.fn()} onUpgrade={jest.fn()} />);
    expect(screen.getByText('siFia REFLECTION')).toBeTruthy();
  });

  it('lets the user choose typography and separates supporting truth', async () => {
    const screen = render(
      <TruthToCarryShareComposer
        visible
        text={'Jesus calls you to rest.\n\nYou do not need to earn his grace.'}
        userId=""
        onClose={jest.fn()}
        onUpgrade={jest.fn()}
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
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." userId="" onClose={jest.fn()} onUpgrade={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Edit post style'));

    const initialSize = StyleSheet.flatten(screen.getByText('A truth to carry.').props.style).fontSize;
    const slider = screen.getByLabelText('Text size');
    fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'decrement' } });

    expect(slider.props.accessibilityValue.now).toBe(96);
    expect(StyleSheet.flatten(screen.getByText('A truth to carry.').props.style).fontSize).toBeLessThan(initialSize);
    expect(triggerLightHaptic).toHaveBeenCalled();
  });

  it('removes all share-card branding for Growth accounts', async () => {
    jest.mocked(NewSubscriptionService.getUserSubscription).mockResolvedValueOnce({ tier: 'growth' } as any);
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." userId="paid-user" onClose={jest.fn()} onUpgrade={jest.fn()} />);

    await waitFor(() => expect(screen.getByLabelText('Message').props.accessibilityState.disabled).toBe(false));
    expect(screen.queryByText('www.sifia.app')).toBeNull();
    expect(screen.queryByText('Hide the siFia watermark')).toBeNull();
  });

  it('keeps share-card branding for Spark accounts', async () => {
    jest.mocked(NewSubscriptionService.getUserSubscription).mockResolvedValueOnce({ tier: 'spark' } as any);
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." userId="spark-user" onClose={jest.fn()} onUpgrade={jest.fn()} />);

    await waitFor(() => expect(screen.getByText('www.sifia.app')).toBeTruthy());
    expect(screen.getByText('Hide the siFia watermark')).toBeTruthy();
  });

  it('closes without haptic feedback', () => {
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." userId="" onClose={jest.fn()} onUpgrade={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Close share composer'));
    expect(triggerLightHaptic).not.toHaveBeenCalled();
  });

  it.each(['ios', 'android'] as const)('passes a safe recipient and image attachment on %s', async os => {
    Platform.OS = os;
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." userId="" onClose={jest.fn()} onUpgrade={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Message'));
    await waitFor(() => expect(Share.shareSingle).toHaveBeenCalledWith(expect.objectContaining({
      social: 'sms',
      recipient: '',
      type: 'image/png',
      url: os === 'ios' ? 'data:image/png;base64,reflection' : 'file:///tmp/reflection.png',
    })));
    if (os === 'ios') {
      expect(captureRef).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ result: 'data-uri' }));
    } else {
      expect(captureRef).not.toHaveBeenCalled();
    }
  });

  it('does not open Messages when image capture fails', async () => {
    Platform.OS = 'ios';
    jest.mocked(captureRef).mockRejectedValueOnce(new Error('Capture failed'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const screen = render(<TruthToCarryShareComposer visible text="A truth to carry." userId="" onClose={jest.fn()} onUpgrade={jest.fn()} />);
    fireEvent.press(screen.getByLabelText('Message'));
    await waitFor(() => expect(alert).toHaveBeenCalled());
    expect(Share.shareSingle).not.toHaveBeenCalled();
  });

});
