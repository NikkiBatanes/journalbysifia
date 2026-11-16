import { PrivateReflectionApiError, type ReflectionApiAction } from '@sifia/journal-contract';

describe('shared private reflection diagnostics', () => {
  it.each(['read', 'create', 'update', 'delete', 'search', 'count', 'batch_create'] as const)('uses a fixed %s error without copying the original', action => {
    const original = new Error('PRIVATE-MESSAGE');
    const error = new PrivateReflectionApiError(action, original);
    expect(error).toBeInstanceOf(Error);
    expect(error.action).toBe(action);
    expect(error.message).not.toContain('PRIVATE-MESSAGE');
    expect(error.stack).not.toContain('PRIVATE-MESSAGE');
    expect('cause' in error).toBe(false);
  });

  it.each([null, undefined, 'PRIVATE', 42, { code: 'PRIVATE', status: 'PRIVATE' }, { code: '42501 PRIVATE', status: 403.5 }])('drops unrecognized diagnostics: %p', original => {
    const error = new PrivateReflectionApiError('create', original);
    expect(error.diagnosticCode).toBeUndefined();
    expect(error.status).toBeUndefined();
    expect(JSON.stringify(error)).not.toContain('PRIVATE');
  });

  it('does not read messages/details/hints or serialize the original object', () => {
    const accessed = jest.fn(() => { throw new Error('PRIVATE'); });
    const original = { code: '23505', status: 409, get message() { return accessed(); },
      get details() { return accessed(); }, get hint() { return accessed(); }, toJSON: accessed };
    expect(new PrivateReflectionApiError('update', original)).toMatchObject({ diagnosticCode: '23505', status: 409 });
    expect(accessed).not.toHaveBeenCalled();
  });

  it('tolerates throwing diagnostic properties without retaining the exception', () => {
    const original = { get code() { throw new Error('PRIVATE'); }, get status() { throw new Error('PRIVATE'); } };
    expect(JSON.stringify(new PrivateReflectionApiError('read', original))).not.toContain('PRIVATE');
  });

  it.each(['PRIVATE', '__proto__', 'constructor'])('does not interpolate an invalid action: %s', action => {
    const error = new PrivateReflectionApiError(action as ReflectionApiAction, null);
    expect(error.action).toBe('read');
    expect(error.message).toBe('Could not load reflections. Please try again.');
  });
});
