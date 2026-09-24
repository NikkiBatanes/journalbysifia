import fs from 'fs';
import path from 'path';

describe('Today opening sound', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../TodayScreen.tsx'), 'utf8');

  it('waits for the focused Today screen transition to settle before playing', () => {
    expect(source).toContain('useFocusEffect(useCallback(() => {');
    expect(source).toContain('InteractionManager.runAfterInteractions(() => {');
    expect(source).toContain('interactionTask.cancel();');
  });
});
