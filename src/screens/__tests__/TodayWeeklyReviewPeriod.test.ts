import fs from 'fs';
import path from 'path';

describe('Today completed weekly review period', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../TodayScreen.tsx'), 'utf8');

  it('labels the memory card with the saved review period instead of the current calendar week', () => {
    expect(source).toContain('selectedWeeklyReview.periodStart,');
    expect(source).toContain('selectedWeeklyReview.periodEnd,');
    expect(source).toContain('FROM YOUR WEEK · {selectedWeeklyReviewPeriodLabel}');
    expect(source).not.toContain('FROM YOUR WEEK · {weekLabel}');
  });

  it('matches the completed review priority presentation', () => {
    expect(source).toContain('A week remembered');
    expect(source).toContain('name="flag-outline"');
    expect(source).toContain("String(index + 1).padStart(2, '0')");
    expect(source).toContain("weeklyPreviewCard: { padding: 18, backgroundColor: '#ECF1E8', borderColor: '#E1E9DB' }");
    expect(source).toContain('Look back into this week');
    expect(source).toContain("weeklyPreviewLinkPill: { alignSelf: 'flex-end'");
    expect(source).toContain('weight="bold" style={styles.weeklyPreviewTitle}');
    expect(source).toContain("weeklyPriorityText: { flex: 1, color: Colors.text, fontSize: 13.5");
    expect(source).toContain("minHeight: 32");
    expect(source).toContain("backgroundColor: 'rgba(82,106,91,0.08)'");
  });
});
