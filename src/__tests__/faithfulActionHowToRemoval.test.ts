import fs from 'fs';
import path from 'path';

const srcRoot = path.resolve(__dirname, '..');
const read = (relative: string) => fs.readFileSync(path.join(srcRoot, relative), 'utf8');

describe('Faithful Action How-To removal boundary', () => {
  it('has no production modal, service, or local Edge Function invocation', () => {
    expect(fs.existsSync(path.join(srcRoot, 'components/HowToModal.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(srcRoot, 'services/actionWisdomService.ts'))).toBe(false);

    const production = [
      'components/ActionStepsCard.tsx',
      'screens/PlaybookWalkthroughScreen.tsx',
      'screens/UserProfileScreen.tsx',
    ].map(read).join('\n');

    expect(production).not.toContain('HowToModal');
    expect(production).not.toContain('getActionWisdom');
    expect(production).not.toContain("functions.invoke('get-action-guidance'");
    expect(production).not.toContain('wisdomUsageReset');
    expect(production).not.toContain('Faithful Action How-Tos');
    expect(production).not.toContain("how-to's for faithful actions");
  });

  it('keeps historical Faithful Action and stored guidance content read-only', () => {
    const card = read('components/ActionStepsCard.tsx');
    const walkthrough = read('screens/PlaybookWalkthroughScreen.tsx');

    expect(card).toContain('step.title');
    expect(card).toContain('subTask.wisdom_text');
    expect(walkthrough).toContain("currentStep?.wisdom_text || ''");
    expect(walkthrough).toContain('updateActionStepCompleted');
    expect(walkthrough).toContain('pdfExportService.exportPlaybookPDF');
    expect(walkthrough).not.toContain('setHowToModalVisible');
  });

  it('preserves the remote function for the separate ownership audit', () => {
    expect(fs.existsSync(path.resolve(srcRoot, '../supabase/functions/get-action-guidance/index.ts'))).toBe(true);
  });
});
