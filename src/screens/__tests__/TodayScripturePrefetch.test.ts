import fs from 'fs';
import path from 'path';

const read = (relativePath: string) => fs.readFileSync(
  path.resolve(__dirname, relativePath),
  'utf8',
);

describe('Today Scripture prefetch wiring', () => {
  it('starts prefetching as soon as onboarding chooses a Bible version', () => {
    const source = read('../journalOnboarding/JournalOnboardingScreen.tsx');
    expect(source).toContain('prefetchDashboardScriptures(version.key).catch(() => {});');
    expect(source).toContain('prefetchDashboardScriptures(bibleVersion).catch(() => {});');
  });

  it('hydrates saved passages before mounting the main app', () => {
    const source = read('../../../App.tsx');
    expect(source).toContain('await hydrateDashboardScriptures(setup.bibleVersion);');
    expect(source.indexOf('await hydrateDashboardScriptures(setup.bibleVersion);'))
      .toBeLessThan(source.indexOf('setJournalOnboarded(done)'));
  });
});
