import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../PrayerCard.tsx'), 'utf8');

describe('PrayerCard request context', () => {
  it('centers the request icon and distinguishes the context from Mark answered', () => {
    expect(source).toContain('name="mail-unread-outline" size={12} color={Colors.alertCoral}');
    expect(source).toContain("borderColor: 'rgba(217, 120, 114, 0.28)'");
    expect(source).toMatch(/requestContext:\s*\{[\s\S]*?alignItems: 'center',[\s\S]*?backgroundColor: 'transparent',[\s\S]*?borderWidth: 1/);
    expect(source).toMatch(/releaseButton:\s*\{[\s\S]*?backgroundColor: Colors\.actionBackground/);
  });
});
