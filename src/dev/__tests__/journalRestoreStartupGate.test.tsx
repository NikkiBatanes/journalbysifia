import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {Button} from 'react-native';
import Gate from '../JournalRestoreStartupGate';
import {checkDevelopmentRestoreAtStartup} from '../journalRestoreStartup';

jest.mock('../journalRestoreStartup', () => ({checkDevelopmentRestoreAtStartup: jest.fn()}));
const mockLoadApp = jest.fn();
const mockRenderApp = jest.fn(() => null);
jest.mock('../../../App', () => {
  mockLoadApp();
  return {default: mockRenderApp};
});

it('loads the app only after a successful startup check, including on retry', async () => {
  let fail!: (error: Error) => void;
  jest.mocked(checkDevelopmentRestoreAtStartup)
    .mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject; }))
    .mockResolvedValueOnce('idle');
  let screen!: TestRenderer.ReactTestRenderer;
  await act(async () => { screen = TestRenderer.create(<Gate />); });
  expect(mockLoadApp).not.toHaveBeenCalled();
  await act(async () => { fail(new Error('Key unavailable')); });
  expect(mockLoadApp).not.toHaveBeenCalled();
  await act(async () => { screen.root.findByType(Button).props.onPress(); });
  expect(mockLoadApp).toHaveBeenCalledTimes(1);
  expect(mockRenderApp).toHaveBeenCalled();
  await act(async () => { screen.unmount(); });
});
