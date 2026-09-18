import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../PrayerTrackingModal.tsx'), 'utf8');

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
});
