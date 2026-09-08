import React from 'react';
import { Alert, Platform } from 'react-native';
import { fireEvent, render, waitFor } from '@testing-library/react-native';
import Share from 'react-native-share';
import { captureRef } from 'react-native-view-shot';
import TruthToCarryShareComposer from '../TruthToCarryShareComposer';
import { triggerLightHaptic } from '../../utils/haptics';

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
jest.mock('../../services/NewSubscriptionService', () => ({ NewSubscriptionService: {} }));
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
