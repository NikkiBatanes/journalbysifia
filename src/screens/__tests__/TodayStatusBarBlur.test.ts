import fs from 'fs';
import path from 'path';

describe('Today status bar blur', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../TodayScreen.tsx'), 'utf8');

  it('fades the existing native liquid glass in as Today scrolls', () => {
    expect(source).toContain("import LiquidGlassView from '../components/common/LiquidGlassView'");
    expect(source).toContain('statusBarBlurProgress.value = y');
    expect(source).toContain('statusBarBlurProgress.value / 18');
    expect(source).toContain('<LiquidGlassView');
    expect(source).toContain('fadesToTransparent');
  });

  it('extends below the non-interactive status bar inset so its edge blends away', () => {
    expect(source).toContain('pointerEvents="none"');
    expect(source).toContain('{ height: insets.top + 30 }');
  });
});
