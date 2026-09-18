import fs from 'fs';
import path from 'path';
import { adaptFaithfulAction, adaptSifiaPrayer, adaptSifiaReflection, deriveReflectionOrigin } from '../sifiaReadCompatibility';
import { devotionalPonder, devotionalPrayer, devotionalReflection, faithfulAction, playbookPrayer, playbookReflection, sharedTimeBlock, sifiaGuided, sifiaThought } from '../__fixtures__/sifiaPersistedRecords';

describe('siFia read compatibility boundary', () => {
  test.each([
    [sifiaThought, 'sifia_thought'],
    [sifiaGuided, 'sifia_guided'],
    [devotionalPonder, 'sifia_devotional'],
    [devotionalReflection, 'sifia_devotional'],
    [playbookReflection, 'sifia_playbook'],
  ] as const)('adapts reflection %s without mutating persisted discriminators', (fixture, origin) => {
    const before = JSON.stringify(fixture);
    const model = adaptSifiaReflection(fixture as any);
    expect(model.origin).toBe(origin);
    expect(model.id).toBe(fixture.id);
    expect(model.serverId).toBe(fixture.server_id);
    expect(model.content).toBe(fixture.content);
    expect(model.searchText).toContain(fixture.content.toLowerCase());
    expect(model.presentation).toBe('generic_reflection');
    expect(JSON.stringify(fixture)).toBe(before);
  });

  it('keeps Thought origin separate from Heart Journal classification', () => {
    expect(deriveReflectionOrigin({ ...sifiaThought, metadata: { journalClassification: 'notes' } })).toBe('sifia_thought');
    expect(adaptSifiaReflection(sifiaThought).originalType).toBe('thoughts');
    expect((sifiaThought as any).metadata?.journalClassification).toBeUndefined();
  });

  it('faithfully exposes historical guided prompt and response without a v1 conversion', () => {
    const model = adaptSifiaReflection(sifiaGuided);
    expect(model.prompt).toBe(sifiaGuided.prompt);
    expect(model.content).toBe(sifiaGuided.content);
    expect(model.originalType).toBe('guided');
  });

  it('retains proven devotional and playbook relationships', () => {
    expect(adaptSifiaReflection(devotionalPonder).relationships.devotionalId).toBe('devotional-1');
    expect(adaptSifiaReflection(devotionalPonder).contextLines).toContain('Hope in Waiting');
    expect(adaptSifiaReflection(playbookReflection).relationships).toEqual({ devotionalId: undefined, playbookId: 'playbook-1', subtaskId: 'subtask-1' });
  });

  it('uses stable persisted action-step identity for Faithful Actions', () => {
    const model = adaptFaithfulAction(faithfulAction, 'Courage for Today');
    expect(model).toMatchObject({
      id: 'action-step-1',
      playbookId: 'playbook-1',
      playbookTitle: 'Courage for Today',
      title: 'Make the call',
      description: 'Reach out before noon.',
      completed: false,
      orderIndex: 0,
      createdAt: faithfulAction.created_at,
      updatedAt: faithfulAction.updated_at,
      origin: 'sifia_playbook',
    });
    expect(model.searchText).toContain('make the call');
    expect(model.searchText).toContain('courage for today');
  });

  it('centralizes devotional and playbook prayer origins while preserving IDs', () => {
    const devotional = adaptSifiaPrayer(devotionalPrayer);
    const playbook = adaptSifiaPrayer(playbookPrayer);
    expect(devotional.origin).toBe('sifia_devotional');
    expect(devotional.relationships.devotionalId).toBe('devotional-1');
    expect(playbook.origin).toBe('sifia_playbook');
    expect(playbook.relationships).toMatchObject({ playbookId: 'playbook-1', stepId: 'action-step-1', subtaskId: 'subtask-1' });
    expect(playbook.id).toBe(playbookPrayer.id);
  });

  it('keeps same-date sibling records distinct by persisted identity', () => {
    const sibling = { ...sifiaThought, id: 'thought-2', server_id: 'server-thought-2', content: 'A second thought.' };
    const models = [sifiaThought, sibling].map(adaptSifiaReflection);
    expect(new Set(models.map(model => model.id)).size).toBe(2);
  });

  it('contains a shared Time Block fixture with cloud identity and version', () => {
    expect(sharedTimeBlock).toMatchObject({ id: 'time-block-1', user_id: 'user-1', version: 2, selected_date: '2025-04-12' });
  });

  it('has no generation or refinement imports', () => {
    const source = fs.readFileSync(path.resolve(__dirname, '../sifiaReadCompatibility.ts'), 'utf8');
    ['unifiedGenerationService', 'enhancedGenerationService', 'queueService', 'enhancedQueueService', 'playbookRefinementService', 'functions/v1/generate-', 'functions.invoke'].forEach(forbidden => expect(source).not.toContain(forbidden));
  });
});
