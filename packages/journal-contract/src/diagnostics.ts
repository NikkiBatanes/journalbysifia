/** Authored content can appear in backend messages, details, hints, and causes.
 * Construct a fresh error from fixed strings; never keep the original error.
 * This boundary is for diagnostics, not retry policy or authorization.
 */
const messages = {
  read: 'Could not load reflections. Please try again.',
  create: 'Could not save the reflection. Please try again.',
  update: 'Could not update the reflection. Please try again.',
  delete: 'Could not delete the reflection. Please try again.',
  search: 'Could not search reflections. Please try again.',
  count: 'Could not count reflections. Please try again.',
  batch_create: 'Could not save reflections. Please try again.',
} as const;

export type ReflectionApiAction = keyof typeof messages;

const diagnosticCodes = ['42501', '23505', '23503', '23502', '23514', '22001', '22P02', 'PGRST116', 'PGRST301', 'PGRST302'] as const;
type DiagnosticCode = typeof diagnosticCodes[number];
const diagnosticStatuses = [400, 401, 403, 404, 409, 413, 429, 500, 502, 503, 504] as const;
type DiagnosticStatus = typeof diagnosticStatuses[number];

function readProperty(value: unknown, key: string): unknown {
  try {
    return value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined;
  } catch {
    return undefined;
  }
}

export class PrivateReflectionApiError extends Error {
  readonly action: ReflectionApiAction;
  readonly diagnosticCode?: DiagnosticCode;
  readonly status?: DiagnosticStatus;

  constructor(action: ReflectionApiAction, original: unknown) {
    // Runtime validation also protects JavaScript consumers and invalid casts.
    const safeAction = Object.prototype.hasOwnProperty.call(messages, action) ? action : 'read';
    super(messages[safeAction]);
    this.name = 'PrivateReflectionApiError';
    this.action = safeAction;
    const code = readProperty(original, 'code');
    const status = readProperty(original, 'status');
    if (diagnosticCodes.some(allowed => allowed === code)) {
      this.diagnosticCode = code as DiagnosticCode;
    }
    if (diagnosticStatuses.some(allowed => allowed === status)) {
      this.status = status as DiagnosticStatus;
    }
  }
}
