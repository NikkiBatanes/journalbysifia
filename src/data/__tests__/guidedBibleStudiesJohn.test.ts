import {JOHN_GUIDED_STUDIES} from '../../../content/bibleStudy/john';
import {getGuidedBibleStudy} from '../guidedBibleStudies';

const sentenceCount = (text: string): number =>
  (text.match(/[.!?](?=[”']?(?:\s|$))/g) ?? []).length;

const wordCount = (text: string): number =>
  text.trim().split(/\s+/).filter(Boolean).length;

describe('John chapter companions', () => {
  it('includes every chapter of John exactly once', () => {
    expect(JOHN_GUIDED_STUDIES).toHaveLength(21);
    expect(JOHN_GUIDED_STUDIES.map(study => study.reference)).toEqual(
      Array.from({length: 21}, (_, index) => `John ${index + 1}`),
    );
    expect(new Set(JOHN_GUIDED_STUDIES.map(study => study.id)).size).toBe(21);
    expect(getGuidedBibleStudy(JOHN_GUIDED_STUDIES[0].id)).toBe(JOHN_GUIDED_STUDIES[0]);
  });

  it('keeps every chapter within the master companion structure', () => {
    JOHN_GUIDED_STUDIES.forEach(study => {
      expect(wordCount(study.subtitle)).toBeLessThanOrEqual(15);
      expect(sentenceCount(study.summary)).toBeGreaterThanOrEqual(5);
      expect(sentenceCount(study.summary)).toBeLessThanOrEqual(10);
      expect(study.keyVerse.translation).toBe('KJV');
      expect(study.keyVerse.text).toBeTruthy();
      expect(sentenceCount(study.keyVerse.note)).toBe(1);
      expect(study.contexts.length).toBeGreaterThanOrEqual(1);
      expect(study.contexts.length).toBeLessThanOrEqual(3);
      study.contexts.forEach(context => {
        expect(sentenceCount(context.body)).toBeGreaterThanOrEqual(2);
        expect(sentenceCount(context.body)).toBeLessThanOrEqual(4);
      });
      expect(study.lookAgain.question).toBeTruthy();
      expect(study.reflect.question).toBeTruthy();
      expect(study.respond.question).toBeTruthy();
      expect(sentenceCount(study.prayer)).toBe(2);
      expect(wordCount(study.carryTruth)).toBeGreaterThanOrEqual(8);
      expect(wordCount(study.carryTruth)).toBeLessThanOrEqual(18);
      expect(JSON.stringify(study).toLowerCase()).not.toContain('illustration');
    });
  });
});
