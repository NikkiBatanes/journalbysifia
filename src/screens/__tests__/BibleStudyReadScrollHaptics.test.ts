import fs from 'fs';
import path from 'path';

const bibleStudy = fs.readFileSync(
  path.resolve(__dirname, '../BibleStudyScreen.tsx'),
  'utf8',
);

describe('Bible Study read-stage haptics', () => {
  it('dismisses highlight controls silently during scrolling and passive touches', () => {
    expect(bibleStudy).toMatch(
      /onScrollBeginDrag=\{\(\) => \{ if \(stage === 'read'\) \{dismissHighlightActions\(\{withHaptic: false\}\);\} \}\}/,
    );
    expect(bibleStudy).toMatch(
      /onTouchEnd=\{\(\) => \{ if \(stage === 'read'\) \{dismissHighlightActions\(\{withHaptic: false\}\);\} \}\}/,
    );
  });

  it('keeps haptics on the explicit dismiss control', () => {
    expect(bibleStudy).toMatch(
      /accessibilityLabel="Dismiss highlight controls"/,
    );
    expect(bibleStudy).toMatch(
      /onPress=\{\(\) => dismissHighlightActions\(\)\}/,
    );
  });
});
