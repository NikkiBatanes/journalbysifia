import React from 'react';
import TestRenderer, {act} from 'react-test-renderer';
import {useDailyScriptureSequenceAnchor} from '../useDailyScriptureSequenceAnchor';
import {getOrCreateScriptureSequenceAnchor} from '../../services/scriptureSequenceAnchor';
import {getActiveReviewQAContext} from '../../dev/reviews/reviewQALoader';

let mockBootstrapping = false;
jest.mock('../../context/IndustryStandardAuthContext', () => ({useAuth: () => ({bootstrapping: mockBootstrapping})}));
jest.mock('../../dev/reviews/reviewQALoader', () => ({getActiveReviewQAContext: jest.fn()}));
jest.mock('../../services/scriptureSequenceAnchor', () => ({
  ...jest.requireActual('../../services/scriptureSequenceAnchor'),
  getOrCreateScriptureSequenceAnchor: jest.fn(),
}));

let value: ReturnType<typeof useDailyScriptureSequenceAnchor>;
let renderer: TestRenderer.ReactTestRenderer;
const Harness = ({createdAt}: {createdAt?: string}) => {
  value = useDailyScriptureSequenceAnchor(createdAt);
  return null;
};

beforeEach(() => {
  mockBootstrapping = false;
  jest.clearAllMocks();
  (getActiveReviewQAContext as jest.Mock).mockResolvedValue(null);
  (getOrCreateScriptureSequenceAnchor as jest.Mock).mockResolvedValue('2026-09-24');
});
afterEach(() => {act(() => renderer.unmount());});

it('waits for persistence before exposing a ready schedule to a signed-out walkthrough', async () => {
  let resolve!: (date: string) => void;
  (getOrCreateScriptureSequenceAnchor as jest.Mock).mockReturnValue(new Promise<string>(done => {resolve = done;}));
  await act(async () => {renderer = TestRenderer.create(<Harness />);});
  expect(value.ready).toBe(false);
  await act(async () => {resolve('2026-09-24');});
  expect(value).toMatchObject({ready: true, anchor: '2026-09-24', error: null});
});

it('waits for auth initialization before selecting the start date', async () => {
  mockBootstrapping = true;
  await act(async () => {renderer = TestRenderer.create(<Harness />);});
  expect(getOrCreateScriptureSequenceAnchor).not.toHaveBeenCalled();
  expect(value.ready).toBe(false);
  mockBootstrapping = false;
  await act(async () => {renderer.update(<Harness createdAt="2026-09-24" />);});
  expect(getOrCreateScriptureSequenceAnchor).toHaveBeenCalledWith('2026-09-24');
  expect(value.ready).toBe(true);
});

it('keeps saving disabled after a storage failure and supports retry', async () => {
  (getOrCreateScriptureSequenceAnchor as jest.Mock).mockRejectedValueOnce(new Error('storage failure'));
  await act(async () => {renderer = TestRenderer.create(<Harness />);});
  expect(value.ready).toBe(false);
  expect(value.error).toContain('Tap to retry');
  await act(async () => {value.retry();});
  expect(value).toMatchObject({ready: true, anchor: '2026-09-24', error: null});
});

it('uses an active QA scenario without changing the real local start', async () => {
  (getActiveReviewQAContext as jest.Mock).mockResolvedValue({historyStart: '2026-09-14'});
  await act(async () => {renderer = TestRenderer.create(<Harness />);});
  expect(value).toMatchObject({ready: true, anchor: '2026-09-14'});
  expect(getOrCreateScriptureSequenceAnchor).not.toHaveBeenCalled();
});
