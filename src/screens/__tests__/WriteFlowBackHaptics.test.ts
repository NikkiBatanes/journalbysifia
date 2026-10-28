import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

const bibleStudy = readSource('../BibleStudyScreen.tsx');
const sessionNotes = readSource('../SermonNotesScreen.tsx');
const scriptureNote = readSource('../ScriptureNoteEditorScreen.tsx');
const guidedReflection = readSource('../../components/journal/GuidedReflectionExperience.tsx');
const journalComposer = readSource('../../components/journal/shared/JournalComposer.tsx');

describe('write workflow back-button haptics', () => {
  it('fires one light haptic for every Bible Study header back action', () => {
    expect(bibleStudy).toMatch(
      /const back = useCallback\(\(\) => \{\s*triggerLightHaptic\(\)/,
    );
    expect(bibleStudy).toMatch(
      /<HeaderBackButton[\s\S]*?onPress=\{\(\) => \{\s*triggerLightHaptic\(\);\s*setSelectedTopic\(null\)/,
    );
  });

  it('keeps shared composer back buttons haptic for Session and Scripture Notes', () => {
    expect(sessionNotes).toContain('<JournalComposerBar');
    expect(scriptureNote).toContain('<JournalComposerBar');
    expect(journalComposer).toMatch(
      /accessibilityLabel=\{backLabel\}[\s\S]*?onPress=\{\(\) => \{\s*triggerLightHaptic\(\);\s*onBack\(\)/,
    );
  });

  it('keeps Heart Journal guided back buttons haptic', () => {
    expect(guidedReflection).toMatch(
      /<HeaderBackButton[\s\S]*?onPress=\{\(\) => \{\s*triggerLightHaptic\(\)/,
    );
  });
});
