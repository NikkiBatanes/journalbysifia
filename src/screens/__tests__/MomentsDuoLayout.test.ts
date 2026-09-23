import fs from 'fs';
import path from 'path';

describe('Moments iPhone Duo layout', () => {
  const screen = fs.readFileSync(path.resolve(__dirname, '../MomentsScreen.tsx'), 'utf8');
  const renderer = fs.readFileSync(
    path.resolve(__dirname, '../../systems/journal/renderers/EnhancedMomentsRenderer.tsx'),
    'utf8',
  );

  it('moves and insets only the front-screen header region', () => {
    expect(screen).toContain('const MOMENTS_DUO_HEADER_TOP_SPACING = 12');
    expect(screen).toContain("Platform.OS === 'ios' && insets.left !== insets.right");
    expect(screen).toContain('paddingTop: insets.top + MOMENTS_DUO_HEADER_TOP_SPACING');
    expect(screen).toContain('sectionHorizontalInsets={usesDuoLayout');
    expect(screen).toContain('return <View style={styles.container}>{screenContent}</View>;');
  });

  it('places landscape filters beside the side status region', () => {
    expect(screen).toContain("sizeClasses.horizontal === 'regular'");
    expect(screen).not.toContain("sizeClasses.vertical === 'regular'\n    && width > height");
    expect(screen).toContain('height / width > 0.58');
    expect(screen).toContain('!Platform.isPad');
    expect(screen).toContain('!isDuoLandscape && <View style={styles.headerActions}>');
    expect(screen).toContain('styles.duoLandscapeHeaderActions');
    expect(screen).toContain('right: 18');
  });

  it('keeps the inset on date headers while moment content remains full width', () => {
    expect(renderer).toContain('sectionHorizontalInsets?: { left: number; right: number }');
    expect(renderer).toContain('style={[styles.sectionHeader, sectionHorizontalInsetStyle]}');
    expect(renderer).toContain('momentItem: {');
    expect(renderer).not.toContain('style={[styles.momentItem, sectionHorizontalInsetStyle]}');
  });
});
