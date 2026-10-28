import fs from 'fs';
import path from 'path';

const readSource = (relativePath: string) =>
  fs.readFileSync(path.resolve(__dirname, '../../', relativePath), 'utf8');

describe('Heart Journal moment title typography', () => {
  it('uses a large bold title in Moments', () => {
    const source = readSource('components/journal/ReflectionLogReactQuery.tsx');

    expect(source).toContain('<ThemedText weight="bold" style={[styles.promptCardText');
    expect(source).toMatch(/promptCardText:\s*\{[\s\S]*?fontSize: 20,[\s\S]*?lineHeight: 27,/);
  });

  it('uses the same large bold title in review moment cards', () => {
    const source = readSource('screens/ReviewScreen.tsx');

    expect(source).toMatch(/weight="bold"\s*style=\{styles\.reflectionTitle\}/);
    expect(source).toMatch(/reflectionTitle:\s*\{[\s\S]*?fontSize: 20,[\s\S]*?lineHeight: 27,/);
  });
});
