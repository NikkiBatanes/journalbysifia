import fs from 'fs';
import path from 'path';

describe('Weekly Review Scripture Note presentation', () => {
  const reviewSource = fs.readFileSync(
    path.resolve(__dirname, '../ReviewScreen.tsx'),
    'utf8',
  );
  const momentsSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../components/journal/ScriptureNoteReactQuery.tsx',
    ),
    'utf8',
  );
  const previewSource = fs.readFileSync(
    path.resolve(
      __dirname,
      '../../components/journal/ScriptureNotePreview.tsx',
    ),
    'utf8',
  );

  it('shares the complete Scripture Note preview between Moments and Weekly Review', () => {
    expect(reviewSource).toContain('<ScriptureNotePreview');
    expect(momentsSource).toContain('<ScriptureNotePreview');
    expect(reviewSource).toContain('journalBlocks={item.journalBlocks}');
    expect(reviewSource).toContain('blocksPointerEvents="none"');
    expect(previewSource).toContain(
      '<SavedReflectionBlocks blocks={journalBlocks} compact />',
    );
  });

  it('uses the same canonical Scripture Note icon in both locations', () => {
    expect(reviewSource).toMatch(
      /<ScriptureNoteIcon\s+size=\{19\}\s+color=\{Colors\.sage\}\s*\/>/,
    );
    expect(momentsSource).toContain('<ScriptureNoteIcon');
    expect(previewSource).toContain(
      "export const SCRIPTURE_NOTE_ICON = 'script-text-outline' as const",
    );
    expect(reviewSource).toContain(
      "{presentation: 'scripture_reflection', title: SCRIPTURE_NOTE_SECTION_LABEL}",
    );
  });

  it('labels the Weekly Review count as notes instead of generic entries', () => {
    expect(reviewSource).toMatch(
      /presentation === 'scripture_reflection'[\s\S]*?items\.length === 1 \? 'note' : 'notes'/,
    );
  });

  it('centers the date beside the bookmark control', () => {
    expect(reviewSource).toContain('metaRightInset={36}');
    expect(reviewSource).toContain('metaMinHeight={24}');
  });
});
