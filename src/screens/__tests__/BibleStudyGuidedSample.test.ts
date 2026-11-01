import fs from 'fs';
import path from 'path';

import {
  GUIDED_BIBLE_STUDIES,
  MATTHEW_23_GUIDED_STUDY,
  getGuidedBibleStudy,
} from '../../data/guidedBibleStudies';

const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

describe('Bible Study guided sample', () => {
  it('ships a complete, versioned Matthew 23 companion', () => {
    expect(MATTHEW_23_GUIDED_STUDY).toMatchObject({
      id: 'matthew-23-chapter-companion',
      version: 1,
      reference: 'Matthew 23',
    });
    expect(MATTHEW_23_GUIDED_STUDY.contexts).toHaveLength(3);
    expect(MATTHEW_23_GUIDED_STUDY.summary).toContain('Jesus laments over Jerusalem');
    expect(MATTHEW_23_GUIDED_STUDY.keyVerse).toMatchObject({
      reference: 'Matthew 23:23',
      translation: 'KJV',
    });
    expect(MATTHEW_23_GUIDED_STUDY.keyVerse.text).toContain('judgment, mercy, and faith');
    expect(MATTHEW_23_GUIDED_STUDY.lookAgain.guideAnswer).toBeTruthy();
    expect(MATTHEW_23_GUIDED_STUDY.reflect.guideAnswer).toBeTruthy();
    expect(MATTHEW_23_GUIDED_STUDY.respond.guideAnswer).toBeTruthy();
    expect(MATTHEW_23_GUIDED_STUDY.prayer).toBeTruthy();
    expect(MATTHEW_23_GUIDED_STUDY.carryTruth).toBeTruthy();
    expect(getGuidedBibleStudy(MATTHEW_23_GUIDED_STUDY.id)).toBe(MATTHEW_23_GUIDED_STUDY);
    expect(new Set(GUIDED_BIBLE_STUDIES.map(guide => guide.id)).size).toBe(GUIDED_BIBLE_STUDIES.length);
  });

  it('keeps searched and topical passages self-guided while the sample opts into guided mode', () => {
    const source = read('BibleStudyScreen.tsx');
    expect(source).toContain('const startStudy = useCallback');
    expect(source).toContain('createBibleStudySession(passage, requestedSelectedDate)');
    expect(source).toContain("studyMode: 'guided'");
    expect(source).toContain('guideId: guide.id');
    expect(source).toContain('INCLUDED GUIDED STUDY');
    expect(source).toContain("activeGuide ? advanceGuided('understand') : advance('observe')");
    expect(source).not.toContain('Color & Reflect');
  });

  it('renders every app-native guided step and saves the companion identity', () => {
    const pageSource = fs.readFileSync(path.resolve(__dirname, '../../components/journal/GuidedBibleStudyPage.tsx'), 'utf8');
    const storageSource = fs.readFileSync(path.resolve(__dirname, '../../storage/bibleStudyStorage.ts'), 'utf8');
    for (const page of ['understand', 'context', 'look_again', 'reflect', 'respond']) {
      expect(pageSource).toContain(`page === '${page}'`);
    }
    expect(pageSource).toContain('accessibilityLabel="Guided study prayer"');
    expect(pageSource).toContain('CARRY THIS WITH YOU');
    expect(storageSource).toContain("study_mode?: 'self_guided' | 'guided'");
    expect(storageSource).toContain('guide_id?: string');
    expect(storageSource).toContain('guided_page?: GuidedBibleStudyPage');
  });
});
