import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../PrayerTrackingModal.tsx'), 'utf8');
const detailsSource = fs.readFileSync(path.resolve(__dirname, '../PrayerDetails.tsx'), 'utf8');

describe('PrayerTrackingModal', () => {
  it('keeps deletion in details but removes it from the Add Update sheet', () => {
    expect(source).toContain('<PrayerDetails prayer={prayer} onClose={onClose} onSave={onSave} onDelete={onDelete}');
    const updateStart = source.indexOf("if (mode === 'update'");
    const updateEnd = source.indexOf('return <PrayerNeedPicker', updateStart);
    const updateSheet = source.slice(updateStart, updateEnd);
    expect(updateSheet).toContain('<PrayerWritingSheet');
    expect(updateSheet).not.toContain('onDelete=');
    expect(updateSheet).toContain('compactInput');
    expect(updateSheet).toContain('hideSaveUntilTyped');
    expect(updateSheet).not.toContain('updateCounter');
    expect(updateSheet).not.toContain('removePrayer');
  });

  it('does not show topics that are absent from regular prayer creation', () => {
    expect(detailsSource).not.toContain("label('TOPICS')");
    expect(detailsSource).not.toContain('metadata: { ...current.metadata, topic:');
  });

  it('describes the answered-prayer decision without tracking jargon', () => {
    expect(detailsSource).toContain("action('Mark as answered'");
    expect(detailsSource).toContain("'Complete this prayer'");
    expect(detailsSource).toContain("'Keep praying'");
    expect(detailsSource).not.toContain("'Stop tracking'");
  });
});
