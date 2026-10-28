import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

const bottomTabs = readSource('../BottomTabNavigator.tsx');
const journalStack = readSource('../JournalStackNavigator.tsx');
const rootStack = readSource('../RootStackNavigator.tsx');
const bibleStudy = readSource('../../screens/BibleStudyScreen.tsx');
const sessionNotes = readSource('../../screens/SermonNotesScreen.tsx');
const heartJournal = readSource('../../screens/ReflectionEditorScreen.tsx');
const timeBlock = readSource('../../screens/TimeBlockEditorScreen.tsx');
const scriptureNote = readSource('../../screens/ScriptureNoteEditorScreen.tsx');
const todos = readSource('../../screens/TodosWalkthroughScreen.tsx');
const gratitude = readSource('../../screens/GratitudeWalkthroughScreen.tsx');
const prayerJournal = readSource('../../screens/PrayerJournalWalkthroughScreen.tsx');
const prayersForPeople = readSource('../../screens/PrayersForPeopleWalkthroughScreen.tsx');

describe('write workflow status bar', () => {
  it('keeps the status bar hidden from the write menu through tab-owned flows', () => {
    expect(bottomTabs).toContain(
      'const writeFlowHidesStatusBar = showAddMenu || addFlowActive',
    );
    expect(bottomTabs).toContain(
      "StatusBar.setHidden(writeFlowHidesStatusBar, 'fade')",
    );
  });

  it('does not use incompatible native-stack status bar ownership', () => {
    expect(journalStack).not.toContain('statusBarHidden');
    expect(rootStack).not.toContain('statusBarHidden');
  });

  it.each([
    ['Heart Journal', heartJournal],
    ['To-dos', todos],
    ['Gratitude', gratitude],
    ['Prayer Journal', prayerJournal],
  ])('uses React Native status-bar hiding for %s', (_name, source) => {
    expect(source).toContain("StatusBar.setHidden(true, 'slide')");
  });

  it.each([
    ['Bible Study', bibleStudy],
    ['Session Notes', sessionNotes],
    ['Time Block', timeBlock],
    ['Scripture Note', scriptureNote],
    ['Prayers for People', prayersForPeople],
  ])('renders a hidden React Native status bar for %s', (_name, source) => {
    expect(source).toMatch(/<StatusBar\s+hidden/);
  });
});
