import fs from 'fs';
import path from 'path';

const read = (relativePath: string) => fs.readFileSync(path.resolve(__dirname, relativePath), 'utf8');

describe('primary card width consistency', () => {
  const today = read('../TodayScreen.tsx');
  const prayers = read('../PrayerListScreen.tsx');
  const moments = read('../../systems/journal/renderers/EnhancedMomentsRenderer.tsx');
  const journalCard = read('../../components/journal/JournalCard.tsx');
  const prayerCarousel = read('../../components/moments/PrayerMomentsCarousel.tsx');

  it('uses the same 18-point page gutter on Today, Prayer, and Moments', () => {
    expect(today).toMatch(/content:\s*\{[^}]*paddingHorizontal: 18/);
    expect(prayers).toMatch(/content:\s*\{[^}]*paddingHorizontal: 18/);
    expect(moments).toMatch(/momentItem:\s*\{[^}]*paddingHorizontal: 18/);
  });

  it('does not add another horizontal inset around Moments content cards', () => {
    expect(journalCard).toContain('paddingHorizontal: 0');
  });

  it('uses the full available Moments width for every prayer slide', () => {
    expect(prayerCarousel).toContain('const cardWidth = width;');
    expect(prayerCarousel).not.toContain('viewportWidth * 0.84');
  });
});
