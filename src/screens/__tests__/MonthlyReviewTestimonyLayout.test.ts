import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(
  path.resolve(__dirname, '../ReviewScreen.tsx'),
  'utf8',
);

describe('Monthly Review testimony page', () => {
  it('uses a compact testimony preview with the written pill in the card header', () => {
    const stage = source.slice(
      source.indexOf("current.kind === 'testimony'"),
      source.indexOf("if (current.kind === 'question')"),
    );

    expect(stage).toContain('styles.monthlyTestimonyCardHeading');
    expect(stage).toContain('styles.monthlyTestimonyDatePill');
    expect(stage.indexOf('styles.monthlyTestimonyDatePill')).toBeLessThan(
      stage.indexOf('styles.monthlyTestimonyRule'),
    );
    expect(stage).toContain('numberOfLines={5}');
    expect(source).toMatch(
      /monthlyTestimonyTitle: \{[\s\S]*?fontSize: 25,[\s\S]*?lineHeight: 33/,
    );
    expect(source).toMatch(
      /monthlyTestimonyBody: \{[\s\S]*?fontSize: 14,[\s\S]*?lineHeight: 23/,
    );
  });
});
