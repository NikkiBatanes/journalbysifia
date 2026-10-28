import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

const journalStack = readSource('../JournalStackNavigator.tsx');
const rootStack = readSource('../RootStackNavigator.tsx');
const bibleStudy = readSource('../../screens/BibleStudyScreen.tsx');
const scriptureNote = readSource('../../screens/ScriptureNoteEditorScreen.tsx');

const expectRouteAnimation = (source: string, routeName: string) => {
  expect(source).toMatch(
    new RegExp(
      `name="${routeName}"(?:(?!<Stack\\.Screen)[\\s\\S])*?animation: 'slide_from_bottom'`,
    ),
  );
};

describe('write workflow transitions', () => {
  it.each([
    'BibleStudy',
    'SermonNotes',
    'ReflectionEditor',
    'TimeBlockEditor',
    'ScriptureNoteEditor',
  ])('uses the shared reversible transition for %s', routeName => {
    expectRouteAnimation(journalStack, routeName);
  });

  it.each([
    'PrayerJournalWalkthrough',
    'PrayersForPeopleWalkthrough',
    'TodosWalkthrough',
    'GratitudeWalkthrough',
  ])('uses the shared reversible transition for %s', routeName => {
    expectRouteAnimation(rootStack, routeName);
  });

  it('waits for the route transition before revealing Bible Study content', () => {
    expect(bibleStudy).toContain("'transitionEnd'");
    expect(bibleStudy).toContain('screenEntranceReady');
  });

  it('waits for the route transition before revealing Scripture Note content', () => {
    expect(scriptureNote).toContain("'transitionEnd'");
    expect(scriptureNote).toContain('playEntrance');
  });
});
