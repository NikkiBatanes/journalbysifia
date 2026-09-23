import fs from 'fs';
import path from 'path';

describe('Today status bar treatment', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../TodayScreen.tsx'), 'utf8');

  it('does not place a glass overlay over the Today screen status bar', () => {
    expect(source).not.toContain("import LiquidGlassView from '../components/common/LiquidGlassView'");
    expect(source).not.toContain('<LiquidGlassView');
    expect(source).not.toContain('statusBarBlur');
    expect(source).not.toContain('statusBarBlurProgress');
  });
});
