import fs from 'fs';
import path from 'path';

describe('Scripture Note Moments presentation', () => {
  const source = fs.readFileSync(
    path.resolve(__dirname, '../ScriptureNoteReactQuery.tsx'),
    'utf8',
  );
  const previewSource = fs.readFileSync(
    path.resolve(__dirname, '../ScriptureNotePreview.tsx'),
    'utf8',
  );

  it('uses the saved-view block renderer instead of flattening structured notes', () => {
    expect(previewSource).toContain(
      "import SavedReflectionBlocks from './SavedReflectionBlocks'",
    );
    expect(source).toContain('reflection.metadata?.journalBlocks');
    expect(previewSource).toContain(
      '<SavedReflectionBlocks blocks={journalBlocks} compact />',
    );
    expect(previewSource).toContain('journalBlocks.length > 0');
  });

  it('gives Scripture Notes a reference-led card with reading controls', () => {
    expect(source).toContain("import {JournalCard} from './JournalCard'");
    expect(source).toContain('title={SCRIPTURE_NOTE_LABEL}');
    expect(source).toContain('viewMode={viewMode}');
    expect(source).toContain('<ScriptureNotePreview');
    expect(previewSource).toContain('styles.referenceAccent');
    expect(previewSource).toContain('fontFamily: Fonts.lora.bold');
    expect(source).toContain('Read verse');
    expect(source).toContain('useMomentsPalette()');
  });

  it('keeps older plain-text Scripture Notes readable', () => {
    expect(source).toContain("content={reflection.content || ''}");
    expect(previewSource).toContain('!!content.trim()');
    expect(previewSource).toContain('{content.trim()}');
  });
});
