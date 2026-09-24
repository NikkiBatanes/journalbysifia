import fs from 'fs';
import path from 'path';

describe('Weekly Review cover', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../ReviewScreen.tsx'), 'utf8');

  it('uses the layered-hills looking-back hero and reflective cover copy', () => {
    expect(source).toContain("require('../../assets/images/reviews/weekly-cover-looking-back-v2.png')");
    expect(source).toContain('style={styles.weeklyCoverArtwork}');
    expect(source).not.toContain('styles.weeklyCoverArtworkFrame');
    expect(source).not.toMatch(/weeklyCoverArtwork:\s*\{[^}]*transform:/);
    expect(source).toContain('Now, let’s look back.');
    expect(source).toContain('Pause. Notice what mattered. Carry it forward.');
  });

  it('uses the period as the main emphasis on Looking Back and Looking Ahead', () => {
    expect(source).toContain(
      'style={styles.reviewPeriodHeadline}>\n                  {weeklyPeriodLabel}',
    );
    expect(source).toContain(
      '? monthlyLookingAheadPeriodLabel\n                  : weeklyLookingAheadPeriodLabel',
    );
    expect(source).toContain('style={styles.reviewDirectionPrompt}>');
    expect(source).not.toContain('style={styles.weeklyAheadDates}');
  });

  it('keeps progress off the cover and starts it from the first reflection page', () => {
    expect(source).toContain("accessibilityLabel={stage > 1 ? 'Previous review step' : 'Back'}");
    expect(source).toContain("const isWeeklyCoverStage = reviewType === 'weekly' && currentStageKind === 'cover'");
    expect(source).toContain('{!isWeeklyCoverStage && <View');
    expect(source).toContain('testID="review-progress-bar"');
    expect(source).toContain('{ width: `${(reviewProgressStep / reviewProgressStepCount) * 100}%` }');
  });
});
