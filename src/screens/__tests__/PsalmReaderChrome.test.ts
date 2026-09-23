import fs from 'fs';
import path from 'path';

describe('Psalm reader controls', () => {
  const psalmSource = fs.readFileSync(path.resolve(__dirname, '../morning/PsalmOfTheDayScreen.tsx'), 'utf8');
  const shellSource = fs.readFileSync(path.resolve(__dirname, '../../components/routine/RoutineStepShell.tsx'), 'utf8');

  it('uses the established unread Scripture button treatment', () => {
    expect(psalmSource).toContain("backgroundColor: '#E9EAE3'");
    expect(psalmSource).toContain('readButtonText: {\n    color: Colors.sage');
  });

  it('keeps the reading controls fixed while allowing room to scroll the Psalm', () => {
    expect(psalmSource).toContain('extraScrollBottomPadding={140}');
    expect(psalmSource).toContain('stickyRightControls');
    expect(shellSource).toContain('testID="routine-sticky-header-controls"');
    expect(shellSource).toContain("position: 'absolute'");
  });
});
