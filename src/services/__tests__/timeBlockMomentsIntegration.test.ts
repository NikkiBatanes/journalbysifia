import fs from 'fs';
import path from 'path';

const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, '../..', relative), 'utf8');

it('routes locally saved Time Blocks into the Moments renderer and refresh path', () => {
  const renderer = read('systems/journal/renderers/EnhancedMomentsRenderer.tsx');
  const editor = read('screens/TimeBlockEditorScreen.tsx');

  expect(renderer).toContain("item.kind === 'time_block'");
  expect(renderer).toContain("candidate.id === 'timeblocks'");
  expect(renderer).toContain("entry.timelineItem?.kind === 'time_block'");
  expect(editor).toContain("DeviceEventEmitter.emit('timeblock_saved'");
});

it('uses the Journal cream and sage presentation for Time Blocks in Moments', () => {
  const timeBlocks = read('components/journal/TimeBlockReactQuery.tsx');
  const calendarSync = read('components/CalendarSyncButton.tsx');

  expect(timeBlocks).toContain('momentsPalette && styles.timeBlockCardMoments');
  expect(timeBlocks).toMatch(/timeBlockCardMoments:\s*\{[\s\S]*?backgroundColor: Colors\.cardBackground/);
  expect(timeBlocks).toMatch(/categoryTagMoments:\s*\{[\s\S]*?backgroundColor: Colors\.anchorBlueLight/);
  expect(timeBlocks).toMatch(/allDayBadgeMoments:\s*\{[\s\S]*?backgroundColor: Colors\.anchorBlueLight/);
  expect(timeBlocks).toContain('color={momentsPalette ? Colors.sage : Colors.hopeWhite}');
  expect(calendarSync).toContain('momentsPalette && styles.unsyncedButtonMoments');
  expect(calendarSync).toMatch(/unsyncedButtonMoments:\s*\{[\s\S]*?backgroundColor: Colors\.anchorBlueLight/);
});
