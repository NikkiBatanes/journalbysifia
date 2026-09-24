import fs from 'fs';
import path from 'path';

const profileSource = fs.readFileSync(
  path.resolve(__dirname, '../UserProfileScreen.tsx'),
  'utf8',
);
const reviewSettingsSource = fs.readFileSync(
  path.resolve(__dirname, '../ReviewSettingsScreen.tsx'),
  'utf8',
);

const forMeDaySwitchColors =
  'trackColor={{false: Colors.lightGray, true: Colors.sageMuted}}';

describe('More toggle consistency', () => {
  it('uses the For Me Day native switch treatment throughout More settings', () => {
    expect(profileSource).toContain('Switch,');
    expect(profileSource.match(/<Switch/g)).toHaveLength(9);
    expect(profileSource.match(new RegExp(forMeDaySwitchColors.replace(/[{}]/g, '\\$&'), 'g')))
      .toHaveLength(9);
    expect(profileSource).not.toContain('styles.switchTrack');
    expect(profileSource).not.toContain('styles.switchThumb');
  });

  it('uses a switch instead of check and close icons for review cadences', () => {
    expect(reviewSettingsSource).toContain('<Switch');
    expect(reviewSettingsSource).toContain(forMeDaySwitchColors);
    expect(reviewSettingsSource).not.toContain('styles.togglePill');
    expect(reviewSettingsSource).not.toContain("name={settings.enabledCadences[type] ? 'checkmark' : 'close'}");
    expect(reviewSettingsSource).toMatch(
      /onValueChange=\{\(\) => toggleCadence\(type\)\}/,
    );
  });
});
