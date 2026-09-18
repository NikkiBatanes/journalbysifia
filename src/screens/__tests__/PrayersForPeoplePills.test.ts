import fs from 'fs';
import path from 'path';

const source = fs.readFileSync(path.resolve(__dirname, '../PrayersForPeopleWalkthroughScreen.tsx'), 'utf8');

describe('Pray for Someone tracking choices', () => {
  it('keeps each choice and its explanation in one full-width card', () => {
    expect(source).toMatch(/trackOptionsContainer:\s*\{[\s\S]*?gap: 14,[\s\S]*?width: '100%'/);
    expect(source).toMatch(/trackOptionButton:\s*\{[\s\S]*?width: '100%',[\s\S]*?backgroundColor: 'rgba\(82, 106, 91, 0\.08\)'[\s\S]*?borderRadius: 20,[\s\S]*?paddingVertical: 18,[\s\S]*?paddingHorizontal: 20/);
    expect(source).toMatch(/trackOptionButtonSelected:\s*\{[\s\S]*?backgroundColor: Colors\.sageMuted/);
    expect(source).toContain('trackOptionTextSelected: {\n    color: Colors.hopeWhite');
    expect(source).toContain('trackOptionDescription');
    expect(source).not.toContain('name="checkmark-circle" size={20}');
    expect(source).not.toContain('name="close-circle" size={20}');
  });
});
