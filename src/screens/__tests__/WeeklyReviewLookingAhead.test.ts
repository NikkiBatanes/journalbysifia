import fs from 'fs';
import path from 'path';

describe('Weekly Review Looking Ahead artwork', () => {
  const source = fs.readFileSync(path.resolve(__dirname, '../ReviewScreen.tsx'), 'utf8');

  it('uses the fully framed sunrise asset without layout cropping', () => {
    expect(source).toContain("require('../../assets/images/reviews/weekly-looking-ahead-sunrise-v2.png')");
    expect(source).not.toContain("require('../../assets/images/reviews/weekly-looking-ahead-sunrise.png')");
    expect(source).toMatch(/resizeMode="contain"[\s\S]*?weekly-looking-ahead-sunrise-v2\.png/);
    expect(source).not.toMatch(/weeklyLookingAheadArtwork:\s*\{[^}]*transform:/);
    expect(source).not.toMatch(/weeklyLookingAheadArtwork:\s*\{[^}]*overflow:\s*'hidden'/);
    expect(source).not.toMatch(/weeklyLookingAheadStage:\s*\{[^}]*alignItems:\s*'center'/);
  });
});
