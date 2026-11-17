import {runWhenIdle} from '../runWhenIdle';

describe('runWhenIdle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Reflect.deleteProperty(globalThis, 'requestIdleCallback');
    Reflect.deleteProperty(globalThis, 'cancelIdleCallback');
  });

  it('uses a timer fallback when requestIdleCallback is unavailable', () => {
    const callback = jest.fn();

    runWhenIdle(callback);
    expect(callback).not.toHaveBeenCalled();

    jest.runOnlyPendingTimers();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('cancels timer fallback work', () => {
    const callback = jest.fn();
    const task = runWhenIdle(callback);

    task.cancel();
    jest.runOnlyPendingTimers();

    expect(callback).not.toHaveBeenCalled();
  });

  it('uses and cancels requestIdleCallback when available', () => {
    const idleCallback = jest.fn();
    const cancelIdleCallback = jest.fn();
    const scheduler = globalThis as typeof globalThis & {
      requestIdleCallback?: typeof idleCallback;
      cancelIdleCallback?: typeof cancelIdleCallback;
    };
    scheduler.requestIdleCallback = idleCallback.mockReturnValue(42);
    scheduler.cancelIdleCallback = cancelIdleCallback;

    const task = runWhenIdle(jest.fn(), 250);
    task.cancel();

    expect(idleCallback).toHaveBeenCalledWith(expect.any(Function), {timeout: 250});
    expect(cancelIdleCallback).toHaveBeenCalledWith(42);
  });
});
