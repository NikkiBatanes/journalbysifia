import fs from 'fs';
import path from 'path';

const reviewSource = fs.readFileSync(
  path.resolve(__dirname, '../ReviewScreen.tsx'),
  'utf8',
);
const momentsSource = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../systems/journal/renderers/EnhancedMomentsRenderer.tsx',
  ),
  'utf8',
);
const cardSource = fs.readFileSync(
  path.resolve(__dirname, '../../components/moments/ForMeDayMomentCard.tsx'),
  'utf8',
);

describe('New Life Day review and Moments presentation', () => {
  it('gives testimony and yearly reflections their own Review groups and card', () => {
    expect(reviewSource).toContain(
      "{presentation: 'testimony', title: 'Your testimony'}",
    );
    expect(reviewSource).toContain(
      "{presentation: 'for_me_day_reflection', title: 'New Life Day reflections'}",
    );
    expect(reviewSource).toContain("item.presentation === 'testimony'");
    expect(reviewSource).toContain(
      "item.presentation === 'for_me_day_reflection'",
    );
    expect(reviewSource).toContain('MY NEW LIFE DAY');
    expect(reviewSource).toContain('YEARLY REFLECTION');
  });

  it('routes both records around the generic Heart Journal renderer in Moments', () => {
    expect(momentsSource).toContain('isForMeDayMomentEntry(entry)');
    expect(momentsSource).toContain(
      '<ForMeDayMomentCard timelineItem={entry.timelineItem}',
    );
    expect(cardSource).toContain("metadata.forMeDayEntry === 'testimony'");
    expect(cardSource).toContain('MY NEW LIFE DAY');
    expect(cardSource).toContain('YEARLY REFLECTION');
    expect(cardSource).toContain('!isTestimony && (');
  });
});
