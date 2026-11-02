import { adaptSifiaReflectionBundle } from '../sifiaReflectionBundleCompatibility';
import { legacyBundledReflections } from '../__fixtures__/sifiaPersistedRecords';

describe('legacy bundled reflection read compatibility', () => {
  it.each(['object', 'string'])('adapts %s storage without mistaking a container ID for a child ID', encoding => {
    const fixture = {
      ...legacyBundledReflections,
      content: encoding === 'string' ? JSON.stringify(legacyBundledReflections.content) : legacyBundledReflections.content,
    };
    const before = JSON.stringify(fixture);
    const result = adaptSifiaReflectionBundle(fixture);
    expect(result.status).toBe('supported');
    expect(result.items.map(item => item.reflection.id)).toEqual(['legacy-heart-1', 'legacy-heart-2']);
    expect(result.items.map(item => item.source)).toEqual([
      { table: 'reflection_entries', rowId: 'reflection-day-container', childId: 'legacy-heart-1' },
      { table: 'reflection_entries', rowId: 'reflection-day-container', childId: 'legacy-heart-2' },
    ]);
    expect(result.items[0].reflection.originalType).toBe('free-form');
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it.each(['broken JSON', '[]', '{}', null])('holds malformed containers for review: %s', content => {
    expect(adaptSifiaReflectionBundle({ ...legacyBundledReflections, content })).toMatchObject({
      status: 'review_required', reason: 'invalid_content', items: [],
    });
  });

  it.each([
    { content: { unsupported: true } },
    { selected_date: '2026-02-30' },
    { updated_at: 'not-a-date' },
    { metadata: [] },
    { id: '' },
  ])('returns no partial list when one child cannot be safely read: %s', invalid => {
    const [first, second] = legacyBundledReflections.content.entries;
    expect(adaptSifiaReflectionBundle({ ...legacyBundledReflections, content: { entries: [first, { ...second, ...invalid }] } }))
      .toMatchObject({ status: 'review_required', reason: 'invalid_child', items: [] });
  });

  it('holds duplicate child IDs rather than silently collapsing them', () => {
    const child = legacyBundledReflections.content.entries[0];
    expect(adaptSifiaReflectionBundle({ ...legacyBundledReflections, content: { entries: [child, child] } }))
      .toMatchObject({ status: 'review_required', reason: 'duplicate_child_id', items: [] });
  });

  it('rejects a child owned by another account', () => {
    const child = legacyBundledReflections.content.entries[0];
    expect(adaptSifiaReflectionBundle({ ...legacyBundledReflections, content: { entries: [{ ...child, user_id: 'another-account' }] } }))
      .toMatchObject({ status: 'review_required', reason: 'account_mismatch', items: [] });
  });

  it('does not guess that an unknown container is the legacy format', () => {
    expect(adaptSifiaReflectionBundle({ ...legacyBundledReflections, content_type: 'future-reflection' }))
      .toMatchObject({ status: 'review_required', reason: 'unsupported_container', items: [] });
  });
});
