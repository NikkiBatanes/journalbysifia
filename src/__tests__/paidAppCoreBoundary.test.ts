import fs from 'fs';
import path from 'path';

const read = (relative: string) => fs.readFileSync(path.resolve(__dirname, '..', relative), 'utf8');

describe('paid-app core boundary', () => {
  it('keeps OS permission denial and integration error handling after calendar ungating', () => {
    const calendarService = read('services/calendarSyncService.ts');
    const syncButton = read('components/CalendarSyncButton.tsx');

    expect(calendarService).toContain('PermissionsAndroid.requestMultiple');
    expect(calendarService).toContain('Calendar permission denied');
    expect(calendarService).toContain('PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION');
    expect(calendarService).toContain("error: 'Location permission denied'");
    expect(syncButton).toContain("Alert.alert(\n        'Sync Error'");
  });

  it('exports historical Playbooks through the native PDF engine without a tier decision', () => {
    const walkthrough = read('screens/PlaybookWalkthroughScreen.tsx');
    const exportHandler = walkthrough.slice(
      walkthrough.indexOf('const handleExportPDF'),
      walkthrough.indexOf('const handleFinish'),
    );

    expect(exportHandler).toContain('pdfExportService.exportPlaybookPDF');
    expect(exportHandler).not.toContain('useFeatureAccess');
    expect(exportHandler).not.toContain('OnboardingSalesOffer');
    expect(read('utils/pdfExportService.ts')).toContain("from 'react-native-html-to-pdf'");
    expect(fs.existsSync(path.resolve(__dirname, '..', 'services/exportService.ts'))).toBe(false);
    expect(fs.existsSync(path.resolve(__dirname, '..', 'components/ExportOptionsModal.tsx'))).toBe(false);
  });

  it('has no core gate navigation in Guided Reflection or Time Block saving', () => {
    const guidedEditor = read('components/journal/ReflectionLogEditor.tsx');
    const timeBlockModal = read('screens/SmartJournalingTimeBlockModal.tsx');

    expect(guidedEditor).not.toContain('guided_prompts_lock');
    expect(timeBlockModal).not.toContain('planning_lock');
    expect(timeBlockModal).not.toContain('repeat_options');
    expect(timeBlockModal).not.toContain('OnboardingSalesOffer');
  });
});
