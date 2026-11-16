import { PrivateReflectionApiError } from '@sifia/journal-contract';
import { ReflectionApi, type ReflectionApiEntry } from '../api/reflectionApi';
import { Logger, LogLevel } from '../../utils/ProductionLogger';

const mockQuery = {
  select: jest.fn(), eq: jest.fn(), order: jest.fn(), limit: jest.fn(),
  single: jest.fn(), insert: jest.fn(), update: jest.fn(), delete: jest.fn(),
  gte: jest.fn(), lte: jest.fn(), or: jest.fn(), range: jest.fn(), then: jest.fn(),
};
const mockFrom = jest.fn();
jest.mock('../supabaseClient', () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

const privateText = 'PRIVATE-JOURNAL-MARKER-73';
const privateEntry = {
  user_id: privateText, title: privateText, content: privateText,
  type: 'free', selected_date: '2026-11-03',
  tags: [privateText], journal_blocks: [{ content: privateText }],
} as unknown as Omit<ReflectionApiEntry, 'id' | 'created_at' | 'updated_at'>;
const rawFailure = {
  code: '42501', status: 403, message: privateText, details: privateText,
  hint: privateText, stack: privateText, cause: { content: privateText },
  entry: privateEntry, toJSON: () => privateText,
};
const tracker = { captureException: jest.fn(), captureMessage: jest.fn() };
let response: unknown;
let rejection: unknown;
let shouldReject: boolean;

const operations: [string, () => Promise<unknown>, boolean][] = [
  ['getReflectionEntries', () => ReflectionApi.getReflectionEntries(privateText, '2026-11-03'), false],
  ['getReflectionsByType', () => ReflectionApi.getReflectionsByType(privateText, '2026-11-03', 'free'), false],
  ['getPlaybookReflections', () => ReflectionApi.getPlaybookReflections(privateText, '2026-11-03'), false],
  ['getReflectionsByPlaybook', () => ReflectionApi.getReflectionsByPlaybook(privateText, privateText), false],
  ['getReflectionBySubtask', () => ReflectionApi.getReflectionBySubtask(privateText, privateText), false],
  ['createReflectionEntry', () => ReflectionApi.createReflectionEntry(privateEntry), false],
  ['updateReflectionEntry', () => ReflectionApi.updateReflectionEntry(privateText, privateEntry), false],
  ['deleteReflectionEntry', () => ReflectionApi.deleteReflectionEntry(privateText), false],
  ['getReflectionsInDateRange', () => ReflectionApi.getReflectionsInDateRange(privateText, '2026-11-01', '2026-11-03'), false],
  ['searchReflections', () => ReflectionApi.searchReflections({ userId: privateText, searchTerm: privateText }), false],
  ['getReflectionStats', () => ReflectionApi.getReflectionStats(privateText, '2026-11-01', '2026-11-03'), false],
  ['getPaginatedReflections', () => ReflectionApi.getPaginatedReflections(privateText), false],
  ['batchCreateReflections', () => ReflectionApi.batchCreateReflections([privateEntry]), false],
  ['getReflectionsCount', () => ReflectionApi.getReflectionsCount(privateText), false],
  ['getReflectionById', () => ReflectionApi.getReflectionById(privateText), true],
];

beforeEach(() => {
  jest.clearAllMocks();
  Logger.clearBuffer();
  Logger.setMinLevel(LogLevel.DEBUG);
  Logger.setErrorTracker(tracker);
  response = { data: null, count: null, error: rawFailure };
  rejection = rawFailure;
  shouldReject = false;
  for (const [name, method] of Object.entries(mockQuery)) {
    if (name !== 'then') {
      method.mockReturnValue(mockQuery);
    }
  }
  mockQuery.then.mockImplementation((resolve, reject) =>
    (shouldReject ? Promise.reject(rejection) : Promise.resolve(response)).then(resolve, reject));
  mockFrom.mockReturnValue(mockQuery);
});

function expectPrivateDiagnostics() {
  const logs = JSON.stringify(Logger.getRecentLogs());
  expect(logs).not.toContain(privateText);
  expect(logs).not.toMatch(/"details"|"hint"|"entry"|"cause"/);
  const calls = tracker.captureException.mock.calls;
  expect(calls).toHaveLength(1);
  const [error, context] = calls[0];
  expect(error).toBeInstanceOf(PrivateReflectionApiError);
  expect(error.message).not.toContain(privateText);
  expect(error.stack).not.toContain(privateText);
  expect(error.cause).toBeUndefined();
  expect(error.diagnosticCode).toBe('42501');
  expect(error.status).toBe(403);
  expect(JSON.stringify(context)).not.toContain(privateText);
}

describe('reflection API privacy boundary', () => {
  it.each(operations)('%s sanitizes returned failures, logger buffer, and tracker', async (_name, run, returnsNull) => {
    if (returnsNull) {
      await expect(run()).resolves.toBeNull();
    } else {
      await expect(run()).rejects.toBeInstanceOf(PrivateReflectionApiError);
    }
    expectPrivateDiagnostics();
  });

  it.each(operations)('%s sanitizes rejected SDK promises', async (_name, run) => {
    shouldReject = true;
    await expect(run()).rejects.toBeInstanceOf(PrivateReflectionApiError);
    expectPrivateDiagnostics();
  });

  it.each(operations)('%s leaves successful queries free of content diagnostics', async (_name, run) => {
    const data = [{ id: 'saved-id', ...privateEntry }];
    response = { data, count: 1, error: null };
    await run();
    expect(Logger.getRecentLogs()).toEqual([]);
    expect(tracker.captureException).not.toHaveBeenCalled();
    expect(tracker.captureMessage).not.toHaveBeenCalled();
  });

  it('retains successful create payloads and IDs without rewriting authored fields', async () => {
    const saved = { ...privateEntry, id: 'stable-id', created_at: 'now', updated_at: 'now' };
    response = { data: saved, error: null };
    await expect(ReflectionApi.createReflectionEntry(privateEntry)).resolves.toBe(saved);
    expect(mockQuery.insert).toHaveBeenCalledWith(expect.objectContaining(privateEntry));
  });

  it('preserves the existing missing-subtask result without logging it as a failure', async () => {
    response = { data: null, error: { ...rawFailure, code: 'PGRST116' } };
    await expect(ReflectionApi.getReflectionBySubtask(privateText, privateText)).resolves.toBeNull();
    expect(Logger.getRecentLogs()).toEqual([]);
  });

  it('keeps the legacy search network fallback without retaining its message', async () => {
    response = { data: null, error: { ...rawFailure, message: 'network ' + privateText } };
    await expect(ReflectionApi.searchReflections({ userId: privateText, searchTerm: privateText })).resolves.toEqual([]);
    expect(JSON.stringify(Logger.getRecentLogs())).not.toContain(privateText);
    expect(tracker.captureException).not.toHaveBeenCalled();
  });

  it.each(operations)('%s sanitizes synchronous SDK failures', async (_name, run) => {
    mockFrom.mockImplementation(() => { throw rawFailure; });
    await expect(run()).rejects.toBeInstanceOf(PrivateReflectionApiError);
    expectPrivateDiagnostics();
  });
});
