import fs from 'fs';
import path from 'path';

describe('Prayer need details', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../PrayerNeedPicker.tsx'), 'utf8');

  it('does not force the details page to the bottom when the notes field receives focus', () => {
    expect(source).toContain('Add the details you want to remember');
    expect(source).not.toContain('scrollRef.current?.scrollToEnd');
    expect(source).not.toContain('setTimeout(() => scrollRef.current');
  });
});
