import {GUIDED_REFLECTION_PATHS} from '../../data/guidedReflectionPaths';
import {REFLECTION_NOTE_TYPES, parseGuidedReflection} from '../../types/guidedReflection';
import {
  buildGuidedReflectionDemoFixtures,
  GUIDED_REFLECTION_DEMO_PREFIX,
  guidedReflectionFixturesForScenario,
} from '../guidedReflectionDemoFixtures';

describe('Guided Reflection demo fixtures', () => {
  const reference = new Date(2026, 8, 20, 12, 0, 0);
  const fixtures = buildGuidedReflectionDemoFixtures(reference);

  it('provides a dense set across all three authored journeys plus a realistic stopped journey', () => {
    expect(fixtures).toHaveLength(10);
    expect(fixtures.every(fixture => fixture.id.startsWith(GUIDED_REFLECTION_DEMO_PREFIX))).toBe(true);
    expect(new Set(fixtures.map(fixture => fixture.id)).size).toBe(10);
    expect(new Set(fixtures.map(fixture => fixture.metadata.guidedJourney.pathId))).toEqual(
      new Set(['mind-feels-full', 'something-bothering-me', 'decision-to-make']),
    );
    expect(fixtures.filter(fixture => fixture.metadata.guidedJourney.completed)).toHaveLength(9);
    expect(fixtures.find(fixture => !fixture.metadata.guidedJourney.completed)?.metadata.guidedJourney)
      .toMatchObject({currentStepId: 'options', stoppedAtStepId: 'options'});
    expect(guidedReflectionFixturesForScenario('draft', reference)).toHaveLength(1);
    expect(guidedReflectionFixturesForScenario('mind', reference)).toHaveLength(3);
    expect(guidedReflectionFixturesForScenario('conflict', reference)).toHaveLength(3);
    expect(guidedReflectionFixturesForScenario('decision', reference)).toHaveLength(3);
    expect(guidedReflectionFixturesForScenario('full', reference)).toHaveLength(10);
  });

  it('defaults every demo reflection to the September 14–20, 2026 QA week', () => {
    const defaultFixtures = buildGuidedReflectionDemoFixtures();
    expect(defaultFixtures.map(fixture => fixture.selected_date)).toEqual([
      '2026-09-20',
      '2026-09-17',
      '2026-09-14',
      '2026-09-18',
      '2026-09-20',
      '2026-09-16',
      '2026-09-15',
      '2026-09-18',
      '2026-09-14',
      '2026-09-19',
    ]);
    expect(defaultFixtures.every(fixture => (
      fixture.selected_date >= '2026-09-14' && fixture.selected_date <= '2026-09-20'
    ))).toBe(true);
  });

  it('uses valid pill choices from the authored path definitions', () => {
    fixtures.forEach(fixture => {
      const journey = fixture.metadata.guidedJourney;
      const path = GUIDED_REFLECTION_PATHS.find(candidate => candidate.id === journey.pathId)!;
      journey.answers.forEach(answer => {
        const step = path.steps.find(candidate => candidate.id === answer.stepId)!;
        (answer.selected || []).forEach(selected => expect(step.options).toContain(selected));
      });
    });
    expect(fixtures.flatMap(fixture => fixture.metadata.guidedJourney.answers).flatMap(answer => answer.selected || []).length)
      .toBeGreaterThan(60);
  });

  it('covers every Guided Reflection block type with portable, ordered block data', () => {
    const blocks = fixtures.flatMap(fixture => fixture.metadata.journalBlocks);
    expect(new Set(blocks.map(block => block.kind))).toEqual(
      new Set(['text', ...REFLECTION_NOTE_TYPES.map(item => item.kind)]),
    );
    expect(blocks.find(block => block.kind === 'photo')?.uri).toBeTruthy();
    expect(blocks.find(block => block.kind === 'voice')?.durationMillis).toBeGreaterThan(0);
    expect(blocks.find(block => block.kind === 'table')?.tableRows?.length).toBeGreaterThan(1);
    const column = blocks.find(block => block.kind === 'column')!;
    expect(blocks.filter(block => block.parentColumnId === column.id).map(block => block.columnSide))
      .toEqual(expect.arrayContaining(['left', 'right']));
  });

  it('keeps serialized content and metadata on the same canonical journey', () => {
    fixtures.forEach(fixture => {
      expect(parseGuidedReflection(fixture.content)).toEqual(fixture.metadata.guidedJourney);
      expect(fixture.metadata.journalBlocks).toEqual(
        fixture.metadata.guidedJourney.answers.flatMap(answer => answer.notes),
      );
      expect(fixture.title).toBe(fixture.metadata.prompt);
      expect(fixture.type).toBe('guided');
      expect(fixture.source).toBe('guided');
    });
  });
});
