import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../..');
const read = (relativePath: string) =>
  fs.readFileSync(path.join(SRC, relativePath), 'utf8');

describe('Scripture loading skeleton coverage', () => {
  it('provides one accessible pulsing skeleton with layout variants', () => {
    const skeleton = read('components/scripture/ScriptureLoadingSkeleton.tsx');

    expect(skeleton).toContain('accessibilityLabel="Loading Scripture"');
    expect(skeleton).toContain('accessibilityRole="progressbar"');
    expect(skeleton).toContain("variant?: 'inline' | 'card' | 'reader'");
    expect(skeleton).toContain('Animated.loop(');
  });

  it('uses the shared skeleton anywhere Scripture loading previously used a wheel or blank state', () => {
    const sharedSkeletonSurfaces = [
      'components/journal/GratitudeVerse.tsx',
      'components/journal/shared/ScriptureLookupInput.tsx',
      'components/routine/WisdomScripturePassage.tsx',
      'components/scripture/ProverbVerseExcerpt.tsx',
      'screens/BibleStudyScreen.tsx',
      'screens/ScriptureNoteEditorScreen.tsx',
      'screens/SermonNotesScreen.tsx',
      'screens/SermonNotesDetailScreen.tsx',
      'screens/evening/EveningProverbsScreen.tsx',
      'screens/morning/MorningClosingScreen.tsx',
      'screens/morning/PsalmOfTheDayScreen.tsx',
      'screens/morning/UnderneathItScreen.tsx',
    ];

    sharedSkeletonSurfaces.forEach(file => {
      expect(read(file)).toContain('<ScriptureLoadingSkeleton');
    });
  });

  it('keeps the existing dashboard and reader passage skeletons', () => {
    expect(read('components/dashboard/DashboardHeaderScripture.tsx')).toContain(
      '<DashboardScriptureSkeleton',
    );
    expect(read('components/ScriptureReaderModal.tsx')).toContain(
      'style={styles.scriptureSkeleton}',
    );
  });
});
